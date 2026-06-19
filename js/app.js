/* =====================================================================
   app.js — Controleur UI de l'app SSBS Street Lifting.
   Importe la logique pure (engine), la persistance (storage), les
   et les donnees du programme (program).
   ===================================================================== */
import * as E from './engine.js';
import * as S from './storage.js';
import * as P from './program.js';

/* ---------- Etat ---------- */
const APP_VERSION = 'v10';
let data = S.loadData();                 // auto-controle d'integrite au chargement
let tab = 'today';
let exec = null;                         // etat de la seance en cours
let rest = { id: null, left: 0, total: 0, running: false };
let wakeLock = null;
let journalWeek = null;                  // semaine affichee dans le Journal
let pendingDraft = null;                 // brouillon de séance à reprendre
const DRAFT_KEY = 'ssbs_draft';

const $ = sel => document.querySelector(sel);
const view = $('#view');

/* ---------- Helpers ---------- */
const FRDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function todayKey() { return E.todayISO(); }
function sessionForDate(iso = todayKey()) {
  const d = E.toDateOnly(iso);
  return FRDAYS[d.getDay()];               // 'lundi'... ; null si pas une seance
}
function isTrainingDay(iso = todayKey()) { return P.SESSION_ORDER.includes(sessionForDate(iso)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fmtNum(n) { return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 }); }
function save() { S.saveData(data); }

/* Instantane discipline : une seance n'est "ratee" que si sa date est
   PASSEE et non loggee. La seance du jour non encore faite = en attente. */
function disciplineSnapshot() {
  const today = todayKey();
  const statusMap = S.sessionStatusMap(data);
  const sched = E.buildSchedule(data.meta.startDate, today)
    .filter(p => p.date < today || statusMap.has(p.date + '|' + p.sessionKey));
  const stats = E.adherenceStats(sched, p => statusMap.get(p.date + '|' + p.sessionKey));
  return { stats, statusMap, streak: E.currentStreak(stats.statuses), redline: E.redLineState(stats.statuses) };
}

function toast(msg, kind = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', 2200);
}

/* Détection de fatigue -> suggestion d'avancer la décharge (auto-décharge anticipée) */
function fatigueSignal() {
  const wk = E.getWeekNumber(todayKey());
  if (wk <= 1 || E.isDeloadWeek(wk)) return null;          // pas pertinent en S1 ni en décharge
  const recent = (data.logs || []).filter(l => l.status !== 'missed' && l.readiness)
    .sort((a, b) => a.date < b.date ? -1 : 1).slice(-3);
  let low = 0;
  recent.forEach(l => { const r = l.readiness; if ((r.energy || 3) + (r.sleep || 3) + (6 - (r.soreness || 3)) <= 7) low++; });
  let rpeUp = false;
  Object.keys(E.MAIN_MOVEMENTS).forEach(k => { if (E.rpeTrendAlert(S.movementHistory(data, k)).alert) rpeUp = true; });
  if ((recent.length >= 2 && low >= 2) || rpeUp) return { low, rpeUp };
  return null;
}

/* ---------- Boot ---------- */
function boot() {
  document.body.addEventListener('click', onClick);
  document.body.addEventListener('input', onInput);
  document.body.addEventListener('change', onChange);
  document.body.addEventListener('submit', onSubmit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && exec) reacquireWakeLock();
  });
  registerSW();
  pendingDraft = loadDraft();
  render();
  maybeShowInstall();
}

/* ----- brouillon de séance (reprise après fermeture accidentelle) ----- */
function saveDraft() {
  if (!exec) return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ exec, savedAt: Date.now() })); } catch { /* quota */ }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ } pendingDraft = null; }
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !d.exec || !Array.isArray(d.exec.exercises) || !d.exec.exercises.length) return null;
    return d;
  } catch { return null; }
}
function draftProgress(d) {
  let done = 0, total = 0;
  d.exec.exercises.forEach(ex => (ex.sets || []).forEach(s => { total++; if (s.done) done++; }));
  return { done, total };
}
function resumeDraft() {
  if (!pendingDraft) return;
  exec = pendingDraft.exec;
  exec.exercises.forEach(ex => { ex.mv = ex.main ? E.MAIN_MOVEMENTS[ex.key] : null; });   // re-lier les références
  // ne pas compter le temps pendant lequel l'app était fermée
  const gap = Date.now() - (pendingDraft.savedAt || Date.now());
  if (gap > 0) exec.startedAt = (exec.startedAt || Date.now()) + gap;
  pendingDraft = null;
  openExec();
}

/* =====================================================================
   Rendu principal (onglets)
   ===================================================================== */
function render() {
  const wk = E.getWeekNumber(todayKey());
  const ph = E.getPhase(wk);
  $('#wkchip').innerHTML = wk > 0
    ? `<b>Semaine ${wk}/${E.PROGRAM_WEEKS}</b><span>${esc(ph.name)}${ph.deload ? ' · décharge' : ''}</span>`
    : `<b>Bientôt</b><span>départ 15 juin</span>`;

  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  view.innerHTML =
    tab === 'today' ? renderToday(wk, ph) :
    tab === 'journal' ? renderJournal() :
    tab === 'programme' ? renderProgramme() :
    tab === 'stats' ? renderStats() :
    tab === 'mesures' ? renderMesures() :
    renderBilan(wk, ph);
  window.scrollTo(0, 0);
}

/* ---------------- AUJOURD'HUI ---------------- */
function renderToday(wk, ph) {
  const { stats, statusMap, streak, redline } = disciplineSnapshot();
  const sk = sessionForDate();
  const isTrain = P.SESSION_ORDER.includes(sk);

  let html = `<div class="welcome">${esc(P.WELCOME_PHRASE)}</div>`;

  // reprise de séance en cours (brouillon)
  if (pendingDraft) {
    const pr = draftProgress(pendingDraft);
    const ds = P.SESSIONS[pendingDraft.exec.sessionKey];
    html += `<div class="banner ok"><div class="bt">▶ Séance en cours</div><div class="small">${esc(ds ? ds.title : 'Séance')} · ${pr.done}/${pr.total} séries déjà loggées. Tu avais été interrompu ?</div><div class="btn-grid" style="margin-top:10px"><button class="btn sm primary" data-act="resume-draft">Reprendre</button><button class="btn sm" data-act="discard-draft">Abandonner</button></div></div>`;
  }

  // bandeau semaine / phase
  if (wk > 0) {
    html += `<div class="banner ${ph.deload ? 'info' : ''}">
      <div class="bt">Semaine ${wk} / ${E.PROGRAM_WEEKS} — ${esc(ph.name)}</div>
      <div class="small">${esc(ph.hint)}</div>
      ${ph.deload ? `<div class="pill info" style="margin-top:8px;color:var(--pull)">⚠️ Décharge : réduis le volume (~−40 %), autorégulation en pause.</div>` : ''}
    </div>`;
  } else {
    html += `<div class="banner info"><div class="bt">Avant le départ</div><div class="small">Le programme démarre le lundi 15 juin 2026. Tu peux déjà explorer l'onglet Programme.</div></div>`;
  }

  // auto-décharge anticipée (fatigue)
  const fatigue = fatigueSignal();
  if (fatigue) {
    html += `<div class="banner warn"><div class="bt">🪫 Fatigue détectée</div><div class="small">${fatigue.rpeUp ? 'Ton RPE grimpe à charge égale sur plusieurs séances' : 'Ta forme est basse sur plusieurs séances d\'affilée'}. Pense à <b>avancer ta décharge</b> ou à ajouter un jour de repos — reculer d'un pas pour avancer de deux.</div></div>`;
  }

  // garde-fou ligne rouge
  if (redline.atRisk && !redline.violated) {
    html += `<div class="banner warn"><div class="bt">Ligne rouge</div><div class="small">Tu as raté la dernière séance — pas grave, c'est prévu. La seule règle : <b>ne pas en rater une 2<sup>e</sup> d'affilée.</b> La prochaine, tu y vas.</div></div>`;
  } else if (redline.violated) {
    html += `<div class="banner warn"><div class="bt">Deux d'affilée</div><div class="small">Deux séances ratées de suite. On stoppe l'hémorragie : la prochaine séance, même en version <b>minimum viable</b> (20 min), compte double. Tu reprends maintenant.</div></div>`;
  }

  // tuiles discipline
  html += `<div class="tiles" style="margin-bottom:14px">
    <div class="tile"><div class="v amber">${streak}🔥</div><div class="l">Série en cours</div></div>
    <div class="tile"><div class="v ${stats.onTarget ? 'ok' : ''}">${stats.total ? Math.round(stats.rate * 100) + '%' : '—'}</div><div class="l">Adhérence · cible 85%</div></div>
  </div>`;

  // seance du jour
  if (isTrain) {
    const ses = P.SESSIONS[sk];
    const done = statusMap.get(todayKey() + '|' + sk);
    html += sessionCard(ses, true, done);
    // aperçu des charges suggérées du jour (mouvements principaux) — précharger la barre mentalement
    const mains = ses.exercises.filter(e => e.main && E.MAIN_MOVEMENTS[e.key]);
    if (mains.length) {
      const chips = mains.map(e => {
        const mv = E.MAIN_MOVEMENTS[e.key];
        const sg = E.suggestNextLoad(e.key, S.movementHistory(data, e.key), { isDeloadWeek: ph.deload, shoulderPainToday: 0 });
        let w = sg.load;
        if (ph.deload && w) w = Math.round((w * 0.85) / mv.inc) * mv.inc;
        const arrow = sg.status === 'increase' ? ' ↑' : sg.status === 'reduce' ? ' ↓' : '';
        return `<span class="pill amber">${esc(mv.name.split(' ')[0])} ${E.fmtLoad(w, mv)}${arrow}</span>`;
      }).join('');
      html += `<div class="card tight"><div class="tiny muted" style="margin-bottom:7px">🎯 Charges suggérées du jour${ph.deload ? ' (décharge)' : ''} — précharge la barre</div><div class="wrap-row">${chips}</div></div>`;
    }
    html += `<div class="btn-grid" style="margin-top:2px">
      <button class="btn primary ${ses.color} block" data-act="start" data-session="${sk}">${done ? 'Reprendre' : '▶ Démarrer'} la séance</button>
      <button class="btn block" data-act="minimal" data-session="${sk}">🔋 Minimum viable</button>
    </div>`;
    html += `<div class="small muted center" style="margin-top:8px">${esc(P.MINIMUM_VIABLE_MSG)}</div>`;
  } else {
    const rest = sk === 'mercredi' || sk === 'dimanche' ? 'Repos complet — récupération totale.' :
      sk === 'samedi' ? 'Repos force (ton HIIT est suivi ailleurs).' : 'Repos.';
    html += `<div class="card center"><div class="fd" style="font-size:18px">Repos aujourd'hui</div><div class="small muted" style="margin-top:6px">${esc(rest)} Marche 8-10 000 pas, mobilité légère si tu veux bouger.</div></div>`;
  }

  // logger une autre seance (hors planning)
  html += `<div class="sec-h">Logger une autre séance</div><div class="wrap-row">`;
  P.SESSION_ORDER.forEach(k => {
    const s = P.SESSIONS[k];
    html += `<button class="btn sm" data-act="start" data-session="${k}">${esc(s.day)} · ${esc(s.title.split(' ')[0])}</button>`;
  });
  html += `</div>`;

  return html;
}

function sessionCard(ses, compact, doneStatus) {
  let rows = ses.exercises.map(ex => {
    const main = ex.main ? ` <span class="king">★</span>` : '';
    return `<div class="exrow"><div class="row between"><div class="en">${esc(ex.name)}${main}</div><div class="es">${esc(ex.scheme)}</div></div>${compact ? '' : `<div class="enote">${esc(ex.note)}</div>`}</div>`;
  }).join('');
  return `<div class="ses c-${ses.color}">
    <div class="ses-h"><div class="dl">${esc(ses.day)}${doneStatus ? ' · ✓ ' + statusLabel(doneStatus) : ''}</div><div class="tt">${esc(ses.title)}</div><div class="mt">${esc(ses.focus)} · ${esc(ses.duration)}</div></div>
    <div class="ses-b">${rows}</div>
  </div>`;
}
function statusLabel(s) { return { done: 'faite', partial: 'partielle', minimal: 'minimale', missed: 'ratée' }[s] || s; }

/* ---------------- PROGRAMME (source de verite, reproduit le HTML) ---------------- */
function renderProgramme() {
  let h = `<div class="sec-h" style="margin-top:8px">Le programme — 11 semaines</div>`;
  h += `<div class="card tight"><div class="small">${esc(P.ATHLETE.objectif1)}<br><b>Objectif n°2 :</b> ${esc(P.ATHLETE.objectif2)}<br><span class="muted">${esc(P.ATHLETE.taille)} · ${esc(P.ATHLETE.poids)} · IMC ${P.ATHLETE.imc} · ${esc(P.ATHLETE.niveau)}</span></div></div>`;

  // arc des semaines
  h += `<div class="sec-h">L'arc des 11 semaines</div>`;
  h += P.WEEK_ARC.map(a => `<div class="card tight"><div class="row between"><b class="fd" style="font-size:15px;letter-spacing:.04em;color:${a.type === 'deload' ? 'var(--pull)' : a.type === 'test' ? 'var(--pr)' : 'var(--accent)'}">${esc(a.weeks)} · ${esc(a.label)}</b>${a.type === 'deload' ? '<span class="badge deload">décharge</span>' : a.type === 'test' ? '<span class="badge test">tests</span>' : ''}</div><div class="small muted" style="margin-top:3px">${esc(a.desc)}</div></div>`).join('');

  // echauffement
  h += `<div class="banner"><div class="bt">Échauffement type (avant chaque séance)</div><div class="small">${esc(P.WARMUP)}</div></div>`;

  // les 4 seances detaillees
  h += `<div class="sec-h">Les 4 séances en détail</div>`;
  P.SESSION_ORDER.forEach(k => {
    const s = P.SESSIONS[k];
    h += `<div class="ses c-${s.color}">
      <div class="ses-h"><div class="dl">${esc(s.day)}</div><div class="tt">${esc(s.title)}</div><div class="mt">${esc(s.focus)} · ${esc(s.duration)}</div></div>
      <div class="ses-b">
        <div class="small muted" style="padding:4px 4px 10px"><b>Échauffement :</b> ${esc(s.warmupSpecial)}</div>
        <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Exercice</th><th>Séries · tempo</th><th>Repos</th></tr></thead><tbody>
        ${s.exercises.map(ex => `<tr><td class="ex">${ex.main ? '★ ' : ''}${esc(ex.name)}<div class="tiny muted" style="font-weight:400">${esc(ex.note)}</div></td><td class="fd">${esc(ex.scheme)}<div class="tiny muted" style="font-weight:400">tempo ${esc(ex.tempo)}</div></td><td class="muted small">${esc(ex.rest)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="small" style="padding:10px 4px 2px;color:var(--accent)">🔥 Finisher : <span class="muted">${esc(s.finisher)}</span></div>
      </div></div>`;
  });

  // legende des tempos
  h += `<div class="sec-h">Comment lire les tempos</div>`;
  h += `<div class="card tight"><div class="small">${esc(P.TEMPO_LEGEND.intro)}</div><div class="divider"></div>` +
    P.TEMPO_LEGEND.phases.map(([k, v]) => `<div class="row between small" style="padding:3px 0"><b class="amber">${k}</b><span class="muted" style="text-align:right;flex:1;margin-left:12px">${esc(v)}</span></div>`).join('') +
    `<div class="divider"></div>` +
    P.TEMPO_LEGEND.words.map(([k, v]) => `<div class="row between small" style="padding:3px 0"><b>« ${k} »</b><span class="muted" style="text-align:right;flex:1;margin-left:12px">${esc(v)}</span></div>`).join('') +
    `<div class="divider"></div><div class="small amber">${esc(P.TEMPO_LEGEND.rule)}</div></div>`;

  // autoregulation
  h += `<div class="sec-h">Méthode SSBS — autorégulation au RPE</div>`;
  h += `<div class="banner"><div class="small"><b>Tu finis au RPE cible ou en dessous → +charge la prochaine fois.</b> RPE dépassé ou reps ratées → tu gardes et tu retentes. Note toujours <b>charge ET RPE</b>. Le moteur de l'app applique ça automatiquement.</div></div>`;
  h += `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Mouvement</th><th>Départ</th><th>@RPE</th><th>+</th></tr></thead><tbody>` +
    Object.values(E.MAIN_MOVEMENTS).map(m => `<tr><td class="ex">${esc(m.name)}</td><td class="fd">${E.fmtLoad(m.start, m)}</td><td class="fd">${m.sets}×${m.reps}${m.rpe ? ' @' + m.rpe : ''}</td><td class="muted">${m.repBased ? '2 reps' : (m.incLabel || '+' + m.inc)}</td></tr>`).join('') +
    `</tbody></table></div>`;
  h += `<div class="banner warn" style="margin-top:12px"><div class="bt">Dips — règle épaule</div><div class="small">Jamais de montée de charge si douleur épaule > 3/10. Forme parfaite + zéro douleur priment sur le chiffre.</div></div>`;

  // nutrition
  h += `<div class="sec-h">Nutrition — recomposition</div>`;
  h += `<div class="card tight"><div class="small">${esc(P.NUTRITION.intro)}</div></div>`;
  h += `<div class="tiles">
    <div class="tile"><div class="l" style="margin:0 0 6px">${esc(P.NUTRITION.train.tag)}</div><div class="v amber">${fmtNum(P.NUTRITION.train.kcal)}<span style="font-size:14px"> kcal</span></div><div class="small muted" style="margin-top:6px">P ${P.NUTRITION.train.p} · G ${P.NUTRITION.train.c} · L ${P.NUTRITION.train.f}</div></div>
    <div class="tile"><div class="l" style="margin:0 0 6px">${esc(P.NUTRITION.rest.tag)}</div><div class="v">${fmtNum(P.NUTRITION.rest.kcal)}<span style="font-size:14px"> kcal</span></div><div class="small muted" style="margin-top:6px">P ${P.NUTRITION.rest.p} · G ${P.NUTRITION.rest.c} · L ${P.NUTRITION.rest.f}</div></div>
  </div>`;
  h += `<div class="small muted" style="margin:8px 2px">${esc(P.NUTRITION.moyenne)}</div>`;
  h += `<div class="card tight"><div class="sec-h" style="margin:2px 0 8px">Timing séance</div><ul class="clean">${P.NUTRITION.timing.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  h += `<div class="card tight"><div class="sec-h" style="margin:2px 0 8px">Règle d'ajustement</div><ul class="clean">${P.NUTRITION.ajustement.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  h += `<div class="banner"><div class="bt">Suppléments</div><div class="small">${esc(P.NUTRITION.supplements)}</div></div>`;

  // discipline
  h += `<div class="sec-h">Système de discipline</div>`;
  h += P.DISCIPLINE_RULES.map(r => `<div class="card tight"><div class="row"><div class="fd" style="font-size:26px;color:var(--accent);min-width:30px">${r.n}</div><div><b>${esc(r.title)}</b><div class="small muted" style="margin-top:2px">${esc(r.text)}</div></div></div></div>`).join('');
  h += `<div class="banner"><div class="bt">🔋 Séance minimum viable</div><div class="small">Pas envie ? Tu n'annules pas, tu fais 20 min (mouvement principal). ${esc(P.MINIMUM_VIABLE_MSG)}</div></div>`;

  // optimisation
  h += `<div class="sec-h">Optimisation & récupération</div>`;
  h += `<div class="card tight"><div class="small"><b>Sommeil :</b> ${esc(P.OPTIMISATION.sommeil)}</div><div class="divider"></div><div class="small"><b>Fatigue :</b> ${esc(P.OPTIMISATION.fatigue)}</div></div>`;
  h += `<div class="card tight"><ul class="clean">${P.OPTIMISATION.leviers.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  h += `<div class="banner warn"><div class="bt">Épaule — priorité n°1</div><ul class="clean" style="margin-top:4px">${P.OPTIMISATION.epaule.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;

  // objectifs
  h += `<div class="sec-h">Objectifs</div>`;
  h += `<div class="card tight"><div class="fd amber" style="font-size:14px;margin-bottom:6px">Plancher (+10 kg mini)</div><ul class="clean">${P.OBJECTIVES.plancher.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  h += `<div class="card tight"><div class="fd" style="font-size:14px;margin-bottom:6px;color:var(--pr)">Stretch (sans pression)</div><ul class="clean">${P.OBJECTIVES.stretch.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;

  return h;
}

/* Résumé motivant : progrès depuis le départ (départ S1 → actuel → Δ) + PR */
function progressSummary() {
  const rows = []; let totalGain = 0;
  ['traction', 'chinup', 'dips', 'squat', 'souleve', 'muscleup'].forEach(k => {
    const mv = E.MAIN_MOVEMENTS[k];
    const hist = S.movementHistory(data, k);
    if (!hist.length) return;
    const start = mv.start;
    const cur = hist[hist.length - 1].weight;
    const pr = Math.max(...hist.map(x => x.weight));
    const delta = round1(cur - start);
    if (delta > 0) totalGain = round1(totalGain + delta);
    rows.push({ mv, start, cur, delta, atPR: cur >= pr && hist.length > 1 });
  });
  if (!rows.length) return '';
  let h = `<div class="card tight" style="border-color:var(--accent-soft)">
    <div class="row between" style="margin-bottom:8px"><b class="fd amber" style="font-size:15px;letter-spacing:.03em">📈 Mes progrès depuis le 15 juin</b>${totalGain > 0 ? `<span class="pill ok">+${fmtNum(totalGain)} kg cumulés</span>` : ''}</div>`;
  rows.forEach(r => {
    const sign = r.delta > 0 ? '+' : '';
    const col = r.delta > 0 ? 'var(--ok)' : 'var(--muted)';
    h += `<div class="row between" style="padding:6px 0;border-bottom:1px solid #232330">
      <span class="small">${esc(r.mv.name)} ${r.atPR ? '🏆' : ''}</span>
      <span class="small" style="text-align:right"><span class="muted">${E.fmtLoad(r.start, r.mv)} → </span><b>${E.fmtLoad(r.cur, r.mv)}</b> ${r.delta !== 0 ? `<b style="color:${col}">(${sign}${fmtNum(r.delta)})</b>` : ''}</span>
    </div>`;
  });
  return h + `</div>`;
}

/* Records personnels par exercice (mouvements rois ET accessoires) */
function allExerciseRecords() {
  const map = {};
  (data.logs || []).forEach(l => (l.exercises || []).forEach(ex => {
    (ex.sets || []).forEach(s => {
      if (s.reps == null) return;
      const m = map[ex.key] || (map[ex.key] = { name: ex.name, main: ex.main, maxW: -Infinity, atW: 0, maxReps: 0, best1rm: 0 });
      const w = numOr(s.weight, 0);
      if (w > m.maxW) { m.maxW = w; m.atW = s.reps; }
      if (s.reps > m.maxReps) m.maxReps = s.reps;
      const e1 = E.estimate1RM(w, s.reps, s.rpe); if (e1 > m.best1rm) m.best1rm = e1;
    });
  }));
  return map;
}

/* ---------------- STATS ---------------- */
function renderStats() {
  let h = `<div class="sec-h" style="margin-top:8px">Mes progrès</div>`;
  const ps = progressSummary();
  h += ps || `<div class="banner info"><div class="bt">Bientôt</div><div class="small">Logge tes séances : tes gains depuis le départ s'afficheront ici, mouvement par mouvement.</div></div>`;
  h += `<div class="sec-h">1RM estimé & objectifs</div>`;
  h += `<div class="card tight small muted" style="border-style:dashed">🤖 <b>Tout est calculé automatiquement</b> à partir des charges/reps/RPE que tu logges en séance (et de ton poids dans Mesures). <b>Rien à saisir ici.</b></div>`;
  const mains = ['traction', 'chinup', 'dips', 'squat', 'souleve', 'muscleup'];
  let any = false;
  mains.forEach(k => {
    const mv = E.MAIN_MOVEMENTS[k];
    const hist = S.movementHistory(data, k);
    const t = E.TARGETS[k];
    if (!hist.length) {
      h += `<div class="card tight"><div class="row between"><b>${esc(mv.name)}</b><span class="muted small">pas encore loggé</span></div></div>`;
      return;
    }
    any = true;
    const last = hist[hist.length - 1];
    const best = Math.max(...last.sets.map(s => E.estimate1RM(last.weight, s.reps, s.rpe)));
    const cur1rm = best;
    const prog = t ? E.objectiveProgress(cur1rm, t) : null;
    const workProg = E.workProgress(last.weight, mv);
    const alert = E.rpeTrendAlert(hist);
    const series = hist.map(p => Math.max(...p.sets.map(s => E.estimate1RM(p.weight, s.reps, s.rpe))));
    const barCls = mv.session === 'lundi' ? 'pull' : mv.session === 'jeudi' ? 'legs' : '';
    const sparkColor = mv.session === 'lundi' ? 'var(--pull)' : mv.session === 'jeudi' ? 'var(--legs)' : 'var(--accent)';
    const proj = E.projectWorkTarget(hist, mv, todayKey());
    const projLine = proj ? `<div class="tiny" style="margin-top:7px;color:${proj.onTrack ? 'var(--ok)' : 'var(--warn)'}">🎯 Projection 30 août : <b>${E.fmtLoad(proj.projected, mv)}</b> ${proj.onTrack ? '— dans les temps ✓' : `— en retard (cible ${E.fmtLoad(proj.target, mv)})`}</div>` : '';
    h += `<div class="card tight">
      <div class="row between"><b>${esc(mv.name)}</b><span class="fd amber" style="font-size:17px">${E.fmtLoad(round1(cur1rm), mv)} <span class="muted small" style="font-weight:400">1RM est.</span></span></div>
      <div class="small muted" style="margin:3px 0 10px">Dernier : ${E.fmtLoad(last.weight, mv)} × ${last.sets.map(s => s.reps).join('/')}${last.sets[0].rpe ? ' @RPE ' + last.sets.map(s => s.rpe).join('/') : ''}</div>
      ${workProg != null ? `<div class="tiny muted" style="margin-bottom:3px">Charge de travail → cible 30 août</div>
      <div class="bar ${barCls}"><i style="width:${Math.round(workProg * 100)}%"></i></div>
      <div class="row between tiny muted" style="margin:4px 0 10px"><span>${E.fmtLoad(last.weight, mv)} (actuel)</span><span>cible ${E.fmtLoad(mv.workTarget, mv)}${mv.shoulder ? ' · si épaule ok' : ''}</span></div>` : ''}
      ${prog != null ? `<div class="tiny muted" style="margin-bottom:3px">1RM estimé → plancher / stretch</div>
      <div class="bar ${barCls}" style="opacity:.7"><i style="width:${Math.round(prog * 100)}%"></i></div>
      <div class="row between tiny muted" style="margin-top:4px"><span>${E.fmtLoad(round1(cur1rm), mv)}</span><span>plancher ${E.fmtLoad(t.floor, mv)}${t.stretch ? ' · stretch ' + E.fmtLoad(t.stretch, mv) : ''}</span></div>` : ''}
      ${projLine}
      ${series.length >= 2 ? sparkline(series, sparkColor) + `<div class="tiny muted">Courbe 1RM estimé · ${series.length} séances</div>` : ''}
      ${alert.alert ? `<div class="sugg warn" style="margin-top:10px"><div class="st">⚠️ Tendance RPE</div>RPE qui grimpe à charge égale sur 3 séances. Envisage une décharge ou consolide avant de monter.</div>` : ''}
    </div>`;
  });
  if (!any) h = `<div class="banner info" style="margin-top:8px"><div class="bt">Stats</div><div class="small">Logge tes premières séances : 1RM estimés, courbes de progression et alertes apparaîtront ici.</div></div>` + h;

  // records personnels (incl. accessoires)
  const recs = allExerciseRecords();
  const rkeys = Object.keys(recs).sort((a, b) => (recs[b].main ? 1 : 0) - (recs[a].main ? 1 : 0));
  if (rkeys.length) {
    h += `<div class="sec-h">🏆 Records personnels</div><div class="card tight hist">`;
    rkeys.forEach(k => {
      const m = recs[k]; const u = E.MAIN_MOVEMENTS[k] || { unit: m.main ? '+kg' : 'kg' };
      const best = m.maxW > 0 ? `${E.fmtLoad(m.maxW, u)} × ${m.atW}` : `${m.maxReps} reps`;
      h += `<div class="hr"><span class="small">${m.main ? '★ ' : ''}${esc(m.name)}</span><b class="small">${best}${m.main && m.best1rm > 0 ? ` · 1RM ${E.fmtLoad(round1(m.best1rm), u)}` : ''}</b></div>`;
    });
    h += `</div>`;
  }

  // tonnage par semaine
  h += `<div class="sec-h">Volume (tonnage) par semaine</div>`;
  const byWeek = {};
  (data.logs || []).forEach(l => { byWeek[l.weekNumber] = (byWeek[l.weekNumber] || 0) + S.sessionTonnage(l); });
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
  if (weeks.length) {
    const max = Math.max(...weeks.map(w => byWeek[w]));
    h += `<div class="card tight">` + weeks.map(w => `<div style="margin-bottom:9px"><div class="row between small"><span class="muted">S${w}</span><b class="fd">${fmtNum(Math.round(byWeek[w]))} kg</b></div><div class="bar"><i style="width:${Math.round(byWeek[w] / max * 100)}%"></i></div></div>`).join('') + `</div>`;
  } else {
    h += `<div class="card tight small muted">Aucun tonnage encore enregistré.</div>`;
  }

  // poids du corps moyenne glissante
  h += `<div class="sec-h">Poids du corps · moyenne 7 j</div>`;
  h += bodyweightBlock();
  return h;
}
function round1(n) { return Math.round(n * 10) / 10; }

/* sparkline SVG natif (courbe de progression, sans CDN) */
function sparkline(values, color = 'var(--accent)') {
  if (!values || values.length < 2) return '';
  const W = 240, H = 40, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + i * (W - 2 * pad) / (values.length - 1);
    const y = H - pad - (v - min) / span * (H - 2 * pad);
    return `${round1(x)},${round1(y)}`;
  });
  const last = pts[pts.length - 1].split(',');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="margin-top:8px;display:block">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}"/></svg>`;
}

function bodyweightBlock() {
  const bw = [...(data.bodyweight || [])].sort((a, b) => a.date < b.date ? -1 : 1);
  if (!bw.length) return `<div class="card tight small muted">Ajoute ton poids dans l'onglet Mesures pour voir la tendance.</div>`;
  const last = bw[bw.length - 1];
  const avg7 = rollingAvg(bw, 7);
  const series = bw.map(b => Number(b.kg));
  const spark = series.length >= 2 ? sparkline(series, 'var(--accent)') + `<div class="tiny muted">Évolution du poids · ${series.length} mesures</div>` : '';
  return `<div class="card tight"><div class="tiles"><div class="tile"><div class="v">${fmtNum(last.kg)}<span style="font-size:14px"> kg</span></div><div class="l">Dernier (${esc(last.date.slice(5))})</div></div><div class="tile"><div class="v amber">${avg7 ? fmtNum(avg7) : '—'}<span style="font-size:14px"> kg</span></div><div class="l">Moyenne 7 j</div></div></div>${spark}</div>`;
}
function rollingAvg(arr, n) {
  if (!arr.length) return null;
  const last = arr.slice(-n);
  return round1(last.reduce((a, b) => a + Number(b.kg), 0) / last.length);
}

/* ---------------- MESURES ---------------- */
function renderMesures() {
  let h = `<div class="sec-h" style="margin-top:8px">Poids du corps</div>`;
  h += `<form data-form="bw" class="card tight"><div class="row" style="gap:8px"><input type="number" step="0.1" name="kg" placeholder="kg" inputmode="decimal" style="flex:1"><button class="btn sm primary" type="submit">+ Ajouter</button></div><div class="tiny muted" style="margin-top:8px">📏 Le matin au réveil, après être passé aux toilettes, avant de boire/manger — toujours dans les mêmes conditions. C'est la régularité qui rend la moyenne 7 j fiable.</div></form>`;
  h += bodyweightBlock();
  const bw = [...(data.bodyweight || [])].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 8);
  if (bw.length) h += `<div class="card tight hist">${bw.map(b => `<div class="hr"><span class="muted">${esc(b.date)}</span><b>${fmtNum(b.kg)} kg</b></div>`).join('')}</div>`;

  // sommeil
  h += `<div class="sec-h">Sommeil</div>`;
  h += `<form data-form="sleep" class="card tight"><div class="row" style="gap:8px"><input type="number" step="0.5" name="hours" placeholder="heures cette nuit" inputmode="decimal" style="flex:1"><button class="btn sm primary" type="submit">+ Ajouter</button></div></form>`;
  const sl = [...(data.sleep || [])].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5);
  if (sl.length) h += `<div class="card tight hist">${sl.map(s => `<div class="hr"><span class="muted">${esc(s.date)}</span><b>${fmtNum(s.hours)} h</b></div>`).join('')}</div>`;

  // pas (meilleur levier sèche pour le côté veineux)
  h += `<div class="sec-h">Pas du jour <span class="muted small" style="text-transform:none;letter-spacing:0">· cible 8-10 000</span></div>`;
  h += `<form data-form="steps" class="card tight"><div class="row" style="gap:8px"><input type="number" step="500" name="count" placeholder="nb de pas" inputmode="numeric" style="flex:1"><button class="btn sm primary" type="submit">+ Ajouter</button></div></form>`;
  const st = [...(data.steps || [])].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5);
  if (st.length) {
    const avgSteps = Math.round((data.steps.slice(-7).reduce((a, b) => a + Number(b.count), 0)) / Math.min(7, data.steps.length));
    h += `<div class="card tight"><div class="row between" style="margin-bottom:8px"><span class="small muted">Moyenne 7 j</span><b class="${avgSteps >= 8000 ? 'amber' : ''}">${fmtNum(avgSteps)} pas</b></div><div class="hist">${st.map(s => `<div class="hr"><span class="muted">${esc(s.date)}</span><b>${fmtNum(s.count)}</b></div>`).join('')}</div></div>`;
  } else h += `<div class="card tight small muted">Ton meilleur outil de sèche pour le côté veineux — sans entamer ta récup.</div>`;


  // douleur epaule historique
  h += `<div class="sec-h">Douleur épaule — historique</div>`;
  const pains = (data.logs || []).filter(l => l.shoulderPain != null).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 8);
  if (pains.length) {
    const trend = shoulderTrend();
    h += trend ? `<div class="banner warn"><div class="bt">⚠️ Épaule en hausse</div><div class="small">La douleur grimpe sur les dernières séances. Réduis charge/amplitude et <b>consulte un kiné</b> — c'est l'indicateur prioritaire.</div></div>` : '';
    h += `<div class="card tight hist">${pains.map(p => `<div class="hr"><span class="muted">${esc(p.date)} · ${esc(p.sessionKey)}</span><b style="color:${p.shoulderPain > 3 ? 'var(--pr)' : p.shoulderPain > 0 ? 'var(--warn)' : 'var(--ok)'}">${p.shoulderPain}/10</b></div>`).join('')}</div>`;
  } else h += `<div class="card tight small muted">La douleur épaule se note pendant les séances de poussée. Rien encore.</div>`;

  // nutrition adherence du jour
  h += `<div class="sec-h">Nutrition — adhérence du jour</div>`;
  const today = todayKey();
  const nut = (data.nutrition || []).find(n => n.date === today);
  h += `<div class="card tight"><div class="row between"><div class="small">As-tu tenu tes macros aujourd'hui ?<div class="tiny muted">${isTrainingDay() ? '~2 500 kcal · P160/G320/L65' : '~2 100 kcal · P160/G230/L60'}</div></div><button class="btn sm ${nut && nut.achieved ? 'primary' : ''}" data-act="nut-toggle">${nut && nut.achieved ? '✓ Tenu' : 'Marquer tenu'}</button></div></div>`;

  return h;
}
function shoulderTrend() {
  const pains = (data.logs || []).filter(l => l.shoulderPain != null).sort((a, b) => a.date < b.date ? -1 : 1).slice(-3);
  if (pains.length < 3) return false;
  const v = pains.map(p => p.shoulderPain);
  return v[2] > v[0] && v[2] >= 4;
}

/* ---------------- JOURNAL (par semaine : toutes les séances d'une semaine) ---------------- */
function frDate(iso) { return capit(E.toDateOnly(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })); }

function renderJournal() {
  const byDate = {};
  const touch = d => (byDate[d] = byDate[d] || { logs: [], bw: null, steps: null, sleep: null, waist: null, nut: null });
  (data.logs || []).forEach(l => touch(l.date).logs.push(l));
  (data.bodyweight || []).forEach(b => { touch(b.date).bw = b.kg; });
  (data.steps || []).forEach(s => { touch(s.date).steps = s.count; });
  (data.sleep || []).forEach(s => { touch(s.date).sleep = s.hours; });
  (data.nutrition || []).forEach(n => { touch(n.date).nut = n.achieved; });

  // semaine affichée : par défaut la dernière avec des données, sinon la semaine en cours
  const allDates = Object.keys(byDate);
  if (journalWeek == null) {
    const wks = allDates.map(d => E.getWeekNumber(d)).filter(w => w > 0);
    journalWeek = wks.length ? Math.max(...wks) : (E.getWeekNumber(todayKey()) || 1);
  }
  journalWeek = Math.min(E.PROGRAM_WEEKS, Math.max(1, journalWeek));

  const ph = E.getPhase(journalWeek);
  const wStart = E.addDaysISO(data.meta.startDate, (journalWeek - 1) * 7);
  const wEnd = E.addDaysISO(data.meta.startDate, (journalWeek - 1) * 7 + 6);
  const tag = ph.deload ? ' · décharge' : ph.type === 'test' ? ' · tests' : '';

  let h = `<div class="sec-h" style="margin-top:8px">Journal — par semaine</div>`;
  h += `<div class="card tight"><div class="row between">
    <button class="btn sm" data-act="jrn-week" data-d="-1" ${journalWeek <= 1 ? 'disabled style="opacity:.35"' : ''}>◀</button>
    <div class="center"><b class="fd" style="font-size:16px;letter-spacing:.03em">Semaine ${journalWeek}${tag}</b><div class="tiny muted">${frDate(wStart)} – ${frDate(wEnd)}</div></div>
    <button class="btn sm" data-act="jrn-week" data-d="1" ${journalWeek >= E.PROGRAM_WEEKS ? 'disabled style="opacity:.35"' : ''}>▶</button>
  </div></div>`;

  // résumé de la semaine
  const weekLogs = (data.logs || []).filter(l => E.getWeekNumber(l.date) === journalWeek && l.status !== 'missed');
  const tonnage = weekLogs.reduce((a, l) => a + S.sessionTonnage(l), 0);
  const fins = weekLogs.filter(l => l.finisherDone).length;
  h += `<div class="tiles"><div class="tile"><div class="v ${weekLogs.length >= 4 ? 'ok' : ''}">${weekLogs.length}/4</div><div class="l">Séances faites</div></div><div class="tile"><div class="v amber">${fmtNum(Math.round(tonnage))}</div><div class="l">kg déplacés · ${fins} finisher${fins > 1 ? 's' : ''}</div></div></div>`;

  // jours de la semaine (avec données), du plus récent au plus ancien
  const weekDates = allDates.filter(d => E.getWeekNumber(d) === journalWeek).sort((a, b) => a < b ? 1 : -1);
  if (!weekDates.length) {
    h += `<div class="banner info" style="margin-top:12px"><div class="bt">Rien cette semaine</div><div class="small">Aucune donnée loggée en semaine ${journalWeek}. Navigue avec ◀ ▶, ou logge une séance.</div></div>`;
  } else {
    h += `<div style="height:12px"></div>`;
    weekDates.forEach(d => { h += dayCard(d, byDate[d]); });
  }
  return h;
}

function capit(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function dayCard(d, e) {
  const wk = E.getWeekNumber(d);
  const label = capit(E.toDateOnly(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
  let chips = '';
  if (e.bw != null) chips += `<span class="pill">⚖️ ${fmtNum(e.bw)} kg</span>`;
  if (e.steps != null) chips += `<span class="pill ${e.steps >= 8000 ? 'ok' : ''}">👟 ${fmtNum(e.steps)} pas</span>`;
  if (e.sleep != null) chips += `<span class="pill">😴 ${fmtNum(e.sleep)} h</span>`;
  if (e.nut != null) chips += `<span class="pill ${e.nut ? 'ok' : ''}">🍽️ ${e.nut ? 'macros tenues' : 'macros non'}</span>`;
  const body = e.logs.map(journalSession).join('');
  return `<div class="card tight">
    <div class="row between" style="margin-bottom:${(body || chips) ? '10' : '0'}px"><b class="fd" style="font-size:15px;letter-spacing:.03em">${esc(label)}</b><span class="tiny muted">${wk > 0 ? 'S' + wk : ''}</span></div>
    ${body}
    ${chips ? `<div class="wrap-row">${chips}</div>` : ''}
  </div>`;
}

function journalSession(l) {
  const ses = P.SESSIONS[l.sessionKey];
  const color = ses ? ses.color : 'accent';
  const exLines = (l.exercises || []).filter(x => x.sets && x.sets.length).map(x => {
    const mv = E.MAIN_MOVEMENTS[x.key];
    const unit = mv || { unit: x.main ? '+kg' : 'kg' };
    const w = x.sets[0].weight;
    const sameW = x.sets.every(s => s.weight === w);
    const repsStr = x.sets.map(s => s.reps).join('/');
    const rpeStr = x.sets.some(s => s.rpe != null) ? ' @' + x.sets.map(s => s.rpe == null ? '–' : s.rpe).join('/') : '';
    const perfStr = !sameW ? `charges variables · ${repsStr}${rpeStr}`
      : (w != null && w !== 0 ? `${E.fmtLoad(w, unit)} × ${repsStr}${rpeStr}` : `${repsStr} reps${rpeStr}`);
    return `<div class="tiny" style="padding:2px 0"><span class="muted">${x.main ? '★ ' : ''}${esc(x.name)} :</span> <b>${perfStr}</b></div>`;
  }).join('');
  const meta = [];
  if (l.shoulderPain != null) meta.push(`épaule ${l.shoulderPain}/10`);
  if (l.readiness) meta.push(`forme ${l.readiness.energy}/${l.readiness.sleep}/${l.readiness.soreness}`);
  if (l.durationSec) meta.push(`${Math.round(l.durationSec / 60)} min`);
  return `<div style="border-left:3px solid var(--${color});padding-left:10px;margin-bottom:9px">
    <div class="row between"><div><b>${esc(ses ? ses.title : l.sessionKey)}</b> <span class="badge" style="background:var(--bg3);color:var(--muted)">${statusLabel(l.status)}</span></div><button class="btn sm danger" data-act="del-log" data-id="${esc(l.id)}" style="min-height:28px;padding:2px 9px">✕</button></div>
    ${exLines}
    ${l.finisherDone ? `<div class="tiny" style="padding:2px 0;color:var(--accent)">🔥 Finisher fait</div>` : ''}
    ${meta.length || l.notes ? `<div class="tiny muted" style="margin-top:4px">${meta.join(' · ')}${l.notes ? `${meta.length ? '<br>' : ''}“${esc(l.notes)}”` : ''}</div>` : ''}
  </div>`;
}

/* heatmap 11 semaines × 4 séances : fait / manqué / décharge / à venir */
const DOW = { lundi: 0, mardi: 1, jeudi: 3, vendredi: 4 };
function heatmapHTML() {
  const start = data.meta.startDate, today = todayKey();
  const statusMap = S.sessionStatusMap(data);
  let rows = `<div class="hm-row"><div class="hm-wk"></div>${P.SESSION_ORDER.map(s => `<div class="hm-head">${s[0].toUpperCase()}</div>`).join('')}</div>`;
  for (let w = 1; w <= E.PROGRAM_WEEKS; w++) {
    const ph = E.getPhase(w);
    const tag = ph.deload ? '·D' : ph.type === 'test' ? '·T' : '';
    let cells = `<div class="hm-wk">S${w}${tag}</div>`;
    P.SESSION_ORDER.forEach(sk => {
      const date = E.addDaysISO(start, (w - 1) * 7 + DOW[sk]);
      const logged = statusMap.get(date + '|' + sk);
      let cls = 'future', mark = '';
      if (logged) { cls = logged === 'missed' ? 'missed' : (logged === 'partial' ? 'partial' : 'done'); mark = logged === 'missed' ? '✕' : '✓'; }
      else if (date < today) { cls = 'missed'; mark = '·'; }
      else if (date === today) { cls = 'today'; mark = '•'; }
      else if (ph.deload) { cls = 'deload'; }
      cells += `<div class="hm-cell ${cls}" title="${sk} ${date}">${mark}</div>`;
    });
    rows += `<div class="hm-row">${cells}</div>`;
  }
  const leg = `<div class="hm-leg">
    <span><i style="background:#11281a;border-color:#2c6b43"></i>Faite</span>
    <span><i style="background:#2a1410;border-color:#5a2a22"></i>Manquée</span>
    <span><i style="background:var(--accent-soft);border-color:var(--accent)"></i>Aujourd'hui</span>
    <span><i style="background:#13202f;border-color:#27406a"></i>Décharge</span>
    <span><i style="background:var(--bg3)"></i>À venir</span></div>`;
  return `<div class="card tight"><div class="heat">${rows}</div>${leg}</div>`;
}

/* Verdict recomp auto : applique la règle d'ajustement du programme */
function recompVerdict(strengthUp) {
  const bw = [...(data.bodyweight || [])].sort((a, b) => a.date < b.date ? -1 : 1);
  if (!bw.length) return null;
  const recent = rollingAvg(bw, 7);
  const old = bw.filter(b => E.daysBetween(b.date, todayKey()) >= 12);
  const wDelta = old.length ? round1(recent - rollingAvg(old, 7)) : null;

  if (strengthUp && (wDelta == null || Math.abs(wDelta) <= 1)) {
    return { tone: 'ok', text: `Poids stable${wDelta != null ? ` (${wDelta > 0 ? '+' : ''}${wDelta} kg)` : ''} + charges qui montent = <b>la recomp marche</b>. Garde le cap, les veines sortiront progressivement.` };
  }
  if (wDelta != null && wDelta > 1) {
    return { tone: 'warn', text: `Le poids monte (+${wDelta} kg) sans que ce soit clairement du muscle. Si ta priorité est de sécher : <b>coupe 150-200 kcal</b> (glucides). Jamais sous ~2 000 kcal.` };
  }
  if (!strengthUp && wDelta != null && wDelta < -1) {
    return { tone: 'warn', text: `Tu perds du poids (${wDelta} kg) mais les charges ne suivent pas : tu as peut-être trop coupé. <b>Remonte ~150 kcal</b> pour garder le muscle.` };
  }
  return { tone: 'info', text: `Continue à te peser le matin (moyenne 7 j). La recomp se juge sur la tendance + tes charges, pas sur un jour.` };
}

/* Badges / jalons gagnés */
function computeBadges() {
  const out = [];
  const n = (data.logs || []).filter(l => l.status !== 'missed').length;
  if (n >= 1) out.push('🎯 1ʳᵉ séance');
  if (n >= 5) out.push('🖐️ 5 séances');
  if (n >= 10) out.push('💪 10 séances');
  if (n >= 25) out.push('🔥 25 séances');
  let anyUp = false;
  Object.keys(E.MAIN_MOVEMENTS).forEach(k => { const hh = S.movementHistory(data, k); if (hh.length >= 2 && hh[hh.length - 1].weight > hh[0].weight) anyUp = true; });
  if (anyUp) out.push('📈 1ʳᵉ montée');
  const { streak } = disciplineSnapshot();
  if (streak >= 4) out.push(`⛓️ série de ${streak}`);
  if ((data.logs || []).some(l => E.isDeloadWeek(l.weekNumber) && l.status !== 'missed')) out.push('🪫 décharge tenue');
  if ((data.steps || []).some(s => Number(s.count) >= 10000)) out.push('👟 10k pas');
  return out;
}

/* ---------------- BILAN / REGLAGES ---------------- */
function renderBilan(wk, ph) {
  const { stats, streak } = disciplineSnapshot();

  let h = `<div class="sec-h" style="margin-top:8px">Bilan hebdomadaire — S${wk || '–'}</div>`;
  // charges montees cette semaine
  const upMoves = [];
  Object.keys(E.MAIN_MOVEMENTS).forEach(k => {
    const hist = S.movementHistory(data, k);
    if (hist.length >= 2) {
      const a = hist[hist.length - 1].weight, b = hist[hist.length - 2].weight;
      if (a > b) upMoves.push(`${E.MAIN_MOVEMENTS[k].name} → ${E.fmtLoad(a, E.MAIN_MOVEMENTS[k])}`);
    }
  });
  const weekLogs = (data.logs || []).filter(l => l.weekNumber === wk);
  h += `<div class="card tight">
    <div class="row between"><span class="muted small">Séances cette semaine</span><b>${weekLogs.length} / 4</b></div><div class="divider"></div>
    <div class="row between"><span class="muted small">Adhérence globale</span><b class="${stats.onTarget ? 'amber' : ''}">${stats.total ? Math.round(stats.rate * 100) + '%' : '—'} ${stats.onTarget ? '✓' : ''}</b></div><div class="divider"></div>
    <div class="row between"><span class="muted small">Série en cours</span><b>${streak} 🔥</b></div>
    ${upMoves.length ? `<div class="divider"></div><div class="small"><b class="amber">Charges montées :</b><br>${upMoves.map(esc).join('<br>')}</div>` : ''}
  </div>`;

  // badges / jalons
  const bdg = computeBadges();
  if (bdg.length) h += `<div class="sec-h">Badges</div><div class="card tight wrap-row">${bdg.map(b => `<span class="pill amber">${esc(b)}</span>`).join('')}</div>`;

  // tendance poids + verdict recomp automatique
  const avg7 = rollingAvg([...(data.bodyweight || [])].sort((a, b) => a.date < b.date ? -1 : 1), 7);
  if (avg7) h += `<div class="card tight small"><b>Poids (moy. 7 j) :</b> ${fmtNum(avg7)} kg.</div>`;
  const verdict = recompVerdict(upMoves.length > 0);
  if (verdict) h += `<div class="banner ${verdict.tone}"><div class="bt">Verdict recomp</div><div class="small">${verdict.text}</div></div>`;

  // calendrier heatmap
  h += `<div class="sec-h">Calendrier — 11 semaines</div>`;
  h += heatmapHTML();

  // rappel kine epaule (recurrent tant que non coche)
  if (!data.settings.kineDone) {
    h += `<div class="banner warn"><div class="bt">Épaule — action n°1</div><div class="small">Fais voir ton épaule sensible par un <b>kiné</b> avant de charger lourd. Un rendez-vous peut t'éviter des mois d'arrêt.</div><button class="btn sm" data-act="kine-done" style="margin-top:10px">✓ J'ai fait le bilan kiné</button></div>`;
  }

  // bilan final S11 (tests)
  if (wk >= E.TEST_WEEK) {
    h += `<div class="banner ok"><div class="bt">🏁 Semaine de tests — bilan final</div><div class="small">Teste traction, chin-up, squat, soulevé (dips selon épaule). Note tes mensurations, compare à juin, et garde ton bilan. Bravo d'être allé au bout — direction le bloc Hyrox.</div></div>`;
  }

  // rappel decharge
  if (ph.deload) h += `<div class="banner info"><div class="bt">Rappel décharge</div><div class="small">Cette semaine : volume −40 %, pas de finisher, charges légères. La décharge sert à récupérer.</div></div>`;

  // reglages
  h += `<div class="sec-h">Réglages</div>`;
  h += `<div class="card tight">
    <div class="row between"><span class="small">Repos auto par exercice<div class="tiny muted" style="text-transform:none;letter-spacing:0">utilise le repos prescrit (3 min, 90 s…)</div></span><button class="btn sm ${data.settings.autoRest ? 'primary' : ''}" data-act="toggle-autorest">${data.settings.autoRest ? 'Activé' : 'Désactivé'}</button></div>
    <div class="divider"></div>
    <div class="field"><label>Minuteur de repos par défaut (s)<span class="muted" style="text-transform:none;letter-spacing:0"> · si repos auto désactivé</span></label><div class="row" style="gap:8px"><input type="number" id="restdef" value="${data.settings.restDefaultSec}" step="15" style="flex:1"><button class="btn sm" data-act="save-rest">OK</button></div></div>
    <div class="row between"><span class="small">Garder l'écran allumé en séance</span><button class="btn sm ${data.settings.keepAwake ? 'primary' : ''}" data-act="toggle-wake">${data.settings.keepAwake ? 'Activé' : 'Désactivé'}</button></div>
    <div class="divider"></div>
    <div class="row between"><span class="small">Son en fin de repos</span><button class="btn sm ${data.settings.soundOnRestEnd ? 'primary' : ''}" data-act="toggle-sound">${data.settings.soundOnRestEnd ? 'Activé' : 'Désactivé'}</button></div>
    <div class="divider"></div>
    <div class="row between"><span class="small">Bilan épaule (kiné) fait</span><button class="btn sm ${data.settings.kineDone ? 'primary' : ''}" data-act="toggle-kine">${data.settings.kineDone ? 'Fait ✓' : 'Pas encore'}</button></div>
  </div>`;

  // donnees
  h += `<div class="sec-h">Données (100% local)</div>`;
  const lastExp = data.meta.lastExport;
  const needBackup = (data.logs || []).length > 0 && (!lastExp || E.daysBetween(lastExp, todayKey()) >= 7);
  if (needBackup) h += `<div class="banner info"><div class="bt">Sauvegarde</div><div class="small">${lastExp ? `Dernier envoi il y a ${E.daysBetween(lastExp, todayKey())} j.` : 'Aucune sauvegarde encore.'} iOS peut purger le stockage local — <b>envoie-toi ta sauvegarde</b> régulièrement (mail/Notes).</div></div>`;
  h += `<div class="card tight">
    <button class="btn primary block" data-act="share-backup">📤 M'envoyer ma sauvegarde</button>
    <div class="btn-grid" style="margin-top:10px"><button class="btn sm" data-act="export-json">⬇ Export JSON</button><label class="btn sm" style="text-align:center">⬆ Import JSON<input type="file" accept="application/json,.json" data-form="import" hidden></label></div>
    <button class="btn sm block" data-act="export-csv" style="margin-top:10px">⬇ Export CSV (séries)</button>
    <button class="btn sm block danger" data-act="reset" style="margin-top:10px">Réinitialiser toutes les données</button>
    <div class="tiny muted center" style="margin-top:8px">Aucun compte, aucun serveur. Tes données restent sur cet appareil. Pense à exporter régulièrement.</div>
  </div>`;
  h += `<button class="btn sm block ghost" data-act="show-install">📲 Comment installer sur iPhone ?</button>`;
  h += `<div class="tiny muted center" style="margin:14px 0 30px">SSBS ${APP_VERSION} · 11 semaines · 100% local</div>`;
  return h;
}

/* =====================================================================
   MODE EXECUTION
   ===================================================================== */
function startSession(sk, minimal = false) {
  const ses = P.SESSIONS[sk];
  if (!ses) return;
  const wk = E.getWeekNumber(todayKey());
  const ph = E.getPhase(wk);
  const isDeload = ph.deload;
  // construit l'etat des exercices
  let exercises = ses.exercises;
  if (minimal) {
    const keep = { lundi: ['traction', 'muscleup'], mardi: ['dips', 'facepull'], jeudi: ['squat'], vendredi: ['tracvol', 'dipsvol'] }[sk] || [];
    exercises = ses.exercises.filter(e => keep.includes(e.key));
  }
  exec = {
    sessionKey: sk, minimal, startedAt: Date.now(), weekNumber: wk, phase: ph.name, isDeload,
    logDate: todayKey(), warmOpen: true,
    finisher: (isDeload || minimal) ? null : ses.finisher, finisherDone: false,
    shoulderPain: ses.shoulder ? 0 : null,
    readiness: { energy: 3, sleep: 3, soreness: 3 },
    exercises: exercises.map(ex => {
      const mv = ex.main ? E.MAIN_MOVEMENTS[ex.key] : null;
      const lp = S.lastPerf(data, ex.key);
      const hist = S.movementHistory(data, ex.key);
      const prWeight = hist.length ? Math.max(...hist.map(x => x.weight)) : null;
      const lastWeight = hist.length ? hist[hist.length - 1].weight : null;
      let sugg = null, weight = '', advice = null;
      if (mv) {
        sugg = E.suggestNextLoad(ex.key, hist, { isDeloadWeek: isDeload, shoulderPainToday: 0 });
        weight = sugg.load;
        if (isDeload && weight) weight = roundToInc(weight * 0.85, mv.inc);   // décharge = ~−15 %
      } else {
        if (lp && lp.sets.length && lp.sets[0].weight != null) weight = lp.sets[0].weight;
        advice = E.accessoryAdvice(ex.scheme, lp ? lp.sets : null);          // double progression
      }
      const baseSets = mv ? mv.sets : parseSets(ex.scheme);
      const nSets = isDeload ? Math.max(2, Math.round(baseSets * 0.6)) : baseSets;  // décharge = ~−40 % volume
      const reps = mv ? mv.reps : parseReps(ex.scheme);
      return {
        key: ex.key, name: ex.name, main: !!mv, mv, scheme: ex.scheme, tempo: ex.tempo, note: ex.note, pain: !!ex.pain,
        rest: ex.rest || '', restSec: parseRestSec(ex.rest),    // repos auto par exercice
        suggestion: sugg, advice, weight, lastWeight, prWeight, celebrated: false,
        lastPerf: lp,                          // pour le comparatif live série par série
        unit: mv ? mv.unit : (ex.main ? '+kg' : 'kg'),
        rpe: mv && mv.rpe ? mv.rpe : null,
        sets: Array.from({ length: nSets }, () => ({ reps, rpe: mv && mv.rpe ? mv.rpe : null, done: false })),
      };
    }),
  };
  openExec();
}
function roundToInc(v, inc) { return Math.round(v / inc) * inc; }

function ring(done, total) {
  const r = 17, circ = 2 * Math.PI * r, pct = total ? done / total : 0;
  const col = done >= total && total ? 'var(--ok)' : 'var(--accent)';
  return `<svg width="46" height="46" viewBox="0 0 46 46" style="flex:none"><circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--bg4)" stroke-width="4"/><circle cx="23" cy="23" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - pct)).toFixed(1)}" transform="rotate(-90 23 23)"/><text x="23" y="27" text-anchor="middle" font-size="13" font-weight="700" fill="${col}">${total ? Math.round(pct * 100) : 0}</text></svg>`;
}
function celebratePR(ex) {
  if (ex.celebrated) return;
  const w = numOr(ex.weight, 0);
  if (w > 0 && ex.prWeight != null && w > ex.prWeight) {
    ex.celebrated = true;
    toast(`🏆 Record ${ex.name} : ${E.fmtLoad(w, ex.mv || { unit: ex.main ? '+kg' : 'kg' })} !`, 'ok');
    if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 140]);
  }
}

function shoulderSubs(sk) {
  return {
    lundi: 'Allège les muscle-ups (négatives lentes) ou remplace-les par des tractions strictes.',
    mardi: 'Remplace les dips lestés par développé machine ou pompes ; réduis l\'amplitude.',
    vendredi: 'Remplace dips PdC par pompes et le MU technique par des tractions ; allège les pressings.',
  }[sk] || 'Réduis charge et amplitude sur les poussées.';
}
function plateBreakdown(total) {
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25]; let r = round1(total); const out = [];
  for (const p of plates) while (r >= p - 1e-6) { out.push(p); r = round1(r - p); }
  return out;
}
function fmtPlate(n) { return String(n).replace('.', ','); }
function plateText(weight, mv) {
  const w = numOr(weight, 0);
  if (mv.unit === 'kg') {
    if (w < 20) return '';
    const per = round1((w - 20) / 2);
    if (per <= 0) return 'barre à vide (20 kg)';
    const b = plateBreakdown(per);
    return b.length ? `barre 20 + ${b.map(fmtPlate).join(' + ')} /côté` : '';
  }
  if (w <= 0) return '';
  const b = plateBreakdown(w);
  return b.length ? `ceinture : ${b.map(fmtPlate).join(' + ')}` : '';
}
function recomputeSuggestions() {
  const lowRdy = (exec.readiness.energy + exec.readiness.sleep + (6 - exec.readiness.soreness)) <= 7;
  exec.exercises.forEach(ex => {
    if (!ex.main || !ex.mv) return;
    const anyDone = ex.sets.some(s => s.done);
    const sugg = E.suggestNextLoad(ex.key, S.movementHistory(data, ex.key), { isDeloadWeek: exec.isDeload, shoulderPainToday: exec.shoulderPain || 0, readinessLow: lowRdy });
    ex.suggestion = sugg;
    if (!anyDone) { let w = sugg.load; if (exec.isDeload && w) w = roundToInc(w * 0.85, ex.mv.inc); ex.weight = w; }
  });
}
function parseSets(scheme) { const m = String(scheme).match(/(\d+)\s*[×x]/); return m ? +m[1] : 3; }
function parseReps(scheme) { const m = String(scheme).match(/[×x]\s*(\d+)/); return m ? +m[1] : 8; }
function parseRestSec(restStr) {  // "3 min" -> 180 · "90 s" -> 90 · "2-3 min" -> 180
  if (!restStr) return null;
  const s = String(restStr).toLowerCase();
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (!nums.length) return null;
  const n = Math.max(...nums);
  return s.includes('min') ? n * 60 : n;
}
function restSecFor(ex) {
  return (data.settings.autoRest && ex && ex.restSec) ? ex.restSec : data.settings.restDefaultSec;
}

function openExec() {
  const ses = P.SESSIONS[exec.sessionKey];
  $('#exec-title').textContent = ses.title;
  $('#exec-sub').textContent = `${ses.day} · S${exec.weekNumber} · ${exec.phase}${exec.minimal ? ' · minimum viable' : ''}`;
  $('#exec').classList.add('open'); $('#exec').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  // (ré)initialise le bouton de pied de page (au cas où il aurait servi à l'écran récap)
  const foot = document.querySelector('.exec-foot button');
  if (foot) { foot.textContent = 'Terminer la séance'; foot.dataset.act = 'finish-open'; }
  if (data.settings.keepAwake) acquireWakeLock();
  renderExec();
}
function closeExec(silent) {
  $('#exec').classList.remove('open'); $('#exec').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  stopRest(); releaseWakeLock();
  clearDraft();
  exec = null;
  if (!silent) render();
}

function renderExec() {
  const c = $('#exec-scroll');
  let h = '';
  if (exec.isDeload) h += `<div class="banner info"><div class="bt">Décharge</div><div class="small">Volume réduit (~−40 %, 2-3 séries), charges légères. Autorégulation en pause — on récupère. Pas de finisher.</div></div>`;
  if (E.getPhase(exec.weekNumber).type === 'test') h += `<div class="banner ok"><div class="bt">Jour de test (S11)</div><div class="small">Pas de cible imposée : tente ton meilleur (PR) en restant propre. On enregistre la meilleure perf. Dips selon l'épaule.</div></div>`;

  // suivi EN DIRECT : anneau de progression + tonnage
  const totalSets = exec.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const doneSets = exec.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);
  const tonnage = exec.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).reduce((b, s) => b + numOr(ex.weight, 0) * numOr(s.reps, 0), 0), 0);
  h += `<div class="card tight"><div class="row" style="gap:13px;align-items:center">${ring(doneSets, totalSets)}<div style="flex:1"><div class="row between"><b class="fd" style="font-size:16px">${doneSets}/${totalSets} séries</b><b class="fd amber" style="font-size:16px">${fmtNum(Math.round(tonnage))} kg</b></div><div class="tiny muted">progression de la séance · tonnage déplacé en direct</div></div></div></div>`;

  // rappel echauffement (repliable)
  const ses0 = P.SESSIONS[exec.sessionKey];
  h += `<div class="xb"><div class="row between" data-act="toggle-warm" style="cursor:pointer"><div class="xname">🔥 Échauffement</div><span class="muted small">${exec.warmOpen ? 'masquer ▲' : 'voir ▼'}</span></div>${exec.warmOpen ? `<div class="tiny muted" style="margin-top:8px">${esc(P.WARMUP)}<div class="divider"></div><b>Spécifique :</b> ${esc(ses0.warmupSpecial)}</div>` : ''}</div>`;

  // readiness
  h += `<div class="xb"><div class="xname" style="margin-bottom:8px">Check-in (avant la séance)</div>`;
  h += scaleRow('Énergie', 'readiness', 'energy', exec.readiness.energy, 1, 5);
  h += scaleRow('Sommeil', 'readiness', 'sleep', exec.readiness.sleep, 1, 5);
  h += scaleRow('Courbatures', 'readiness', 'soreness', exec.readiness.soreness, 1, 5);
  const lowRdy = (exec.readiness.energy + exec.readiness.sleep + (6 - exec.readiness.soreness)) <= 7;
  if (lowRdy) h += `<div class="sugg hold" style="margin-top:8px"><div class="st">Forme basse</div>Vise le bas de la fourchette RPE aujourd'hui. Montre-toi, c'est l'essentiel.</div>`;
  h += `</div>`;

  // douleur epaule session
  if (exec.shoulderPain != null) {
    h += `<div class="xb"><div class="xname" style="margin-bottom:8px">Douleur épaule du jour <span class="muted small">(0 = aucune)</span></div>`;
    h += scaleRowPain('shoulderPain', exec.shoulderPain, 0, 10);
    if (exec.shoulderPain > 3) h += `<div class="sugg warn" style="margin-top:8px"><div class="st">⚠️ Épaule > 3/10 — substitutions</div>Pas de montée de charge aujourd'hui. ${esc(shoulderSubs(exec.sessionKey))} Garde les face pulls / band pull-aparts. Si ça persiste → kiné.</div>`;
    h += `</div>`;
  }

  // exercices
  exec.exercises.forEach((ex, xi) => {
    h += `<div class="xb ${ex.main ? 'main' : ''}">
      <div class="xh"><div class="xname">${ex.main ? '★ ' : ''}${esc(ex.name)}</div><div class="xtar">${esc(ex.scheme)}${ex.rpe ? ' @' + ex.rpe : ''}<div class="tiny muted" style="font-weight:400">tempo ${esc(ex.tempo)}${ex.rest ? ' · repos ' + esc(ex.rest) : ''}</div></div></div>
      ${ex.note ? `<div class="tiny muted" style="margin-bottom:8px">${esc(ex.note)}</div>` : ''}`;
    // precedent
    const lp = S.lastPerf(data, ex.key);
    if (lp) h += `<div class="prev">Précédent : <b>${lp.sets.map(s => `${s.weight != null ? E.fmtLoad(s.weight, ex.mv || { unit: ex.main ? '+kg' : 'kg' }) + '×' : ''}${s.reps ?? '?'}${s.rpe ? '@' + s.rpe : ''}`).join(' · ')}</b></div>`;
    // suggestion (mouvement principal) ou conseil double-progression (accessoire)
    if (ex.suggestion) {
      const s = ex.suggestion;
      const cls = s.status === 'increase' || s.status === 'start' ? '' : s.status === 'hold_pain' || s.status === 'reduce' ? 'warn' : 'hold';
      h += `<div class="sugg ${cls}"><div class="st">${suggTitle(s.status)}</div>${esc(s.message)}</div>`;
    } else if (ex.advice) {
      h += `<div class="sugg hold"><div class="st">Double progression</div>${esc(ex.advice.text)}</div>`;
    }
    // feedback EN DIRECT vs dernière fois / record
    if (ex.sets.some(s => s.done)) {
      const w = numOr(ex.weight, 0);
      const u = ex.mv || { unit: ex.main ? '+kg' : 'kg' };
      if (w > 0 && ex.prWeight != null && w > ex.prWeight) {
        h += `<div class="sugg" style="background:#11281a;border-color:#2c6b43"><div class="st" style="color:var(--ok)">🏆 Nouveau record</div>${E.fmtLoad(w, u)} — ton meilleur sur ce mouvement !</div>`;
      } else if (ex.lastWeight != null && w > 0) {
        const d = round1(w - ex.lastWeight);
        const txt = d > 0 ? `↑ +${fmtNum(d)} kg vs la dernière fois (${E.fmtLoad(ex.lastWeight, u)})`
          : d === 0 ? `= dernière fois (${E.fmtLoad(ex.lastWeight, u)}) — on consolide`
          : `↓ ${fmtNum(d)} kg vs la dernière fois`;
        h += `<div class="sugg ${d >= 0 ? '' : 'hold'}"><div class="st">En direct</div>${txt}</div>`;
      }
    }
    // poids
    h += `<div class="row" style="gap:10px;margin-bottom:4px"><div style="flex:1">` + stepper(`w${xi}`, ex.weight === '' ? 0 : ex.weight, ex.main && ex.mv ? ex.mv.inc : 2.5, ex.main && ex.mv && ex.mv.unit === '+kg' ? '+kg' : 'kg', xi) + `</div></div>`;
    // calculateur de disques (mouvements principaux)
    const pt = ex.mv ? plateText(numOr(ex.weight, 0), ex.mv) : '';
    h += `<div id="plate${xi}" class="tiny muted" style="margin-bottom:6px">${pt ? '🏋 ' + esc(pt) : ''}</div>`;
    // rpe exercice (principal)
    if (ex.main && ex.mv && ex.mv.rpe) {
      h += `<div class="mlab" style="margin:8px 0 5px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">RPE (cible ${ex.mv.rpe})</div>` + rpeRow(xi, ex.rpe);
    }
    // series
    h += `<div class="setlist">` + ex.sets.map((st, si) => setRow(xi, si, st, ex)).join('') + `</div>`;
    const remaining = ex.sets.some(s => !s.done);
    if (remaining) h += `<button class="btn sm block" data-act="all-sets" data-x="${xi}" style="margin-top:9px">✓ Valider toutes les séries</button>`;
    // contrôles : réordonner / retirer
    h += `<div class="row" style="gap:6px;justify-content:flex-end;margin-top:8px">
      <button class="btn sm" data-act="ex-move" data-x="${xi}" data-dir="-1" ${xi === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="monter">↑</button>
      <button class="btn sm" data-act="ex-move" data-x="${xi}" data-dir="1" ${xi === exec.exercises.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="descendre">↓</button>
      <button class="btn sm danger" data-act="ex-remove" data-x="${xi}">Retirer</button>
    </div>`;
    h += `</div>`;
  });
  h += `<button class="btn sm block" data-act="ex-add" style="margin-bottom:14px">+ Ajouter un exercice</button>`;

  // finisher (optionnel, masqué en décharge / minimum viable)
  if (exec.finisher) {
    h += `<div class="xb"><div class="row between"><div class="xname">🔥 Finisher <span class="muted small">(optionnel)</span></div><button class="btn sm ${exec.finisherDone ? 'primary' : ''}" data-act="toggle-finisher">${exec.finisherDone ? '✓ Fait' : 'À faire'}</button></div><div class="tiny muted" style="margin-top:8px">${esc(exec.finisher)}</div></div>`;
  }

  // notes
  h += `<div class="xb"><div class="xname" style="margin-bottom:8px">Notes libres</div><textarea data-act="note" placeholder="ressenti, douleur, ajustements…">${esc(exec.notes || '')}</textarea></div>`;

  c.innerHTML = h;
  saveDraft();                 // persiste l'état après chaque rendu (anti-perte)
}
function suggTitle(s) { return { start: 'Charge de départ', increase: '↑ Suggestion : monte', hold: '→ Maintien', hold_pain: '⚠️ Épaule — maintien', reduce: '↓ Recule de 5%', deload: 'Décharge — pause' }[s] || 'Suggestion'; }

function stepper(id, val, step, unit, xi) {
  const disp = unit === '+kg' ? (val > 0 ? '+' + fmtNum(val) : fmtNum(val)) : fmtNum(val);
  return `<div class="stepper" data-stepper="${id}">
    <button data-act="step" data-id="${id}" data-x="${xi}" data-delta="${-step}" aria-label="moins">−</button>
    <div class="val"><b id="${id}">${disp}</b><small>${unit === '+kg' ? 'kg lestés' : 'kg'}</small></div>
    <button data-act="step" data-id="${id}" data-x="${xi}" data-delta="${step}" aria-label="plus">+</button>
  </div>`;
}
function rpeRow(xi, cur) {
  return `<div class="scale">` + [6, 7, 8, 9, 10].map(v => `<button data-act="ex-rpe" data-x="${xi}" data-val="${v}" class="${cur === v ? 'on' : ''}">${v}</button>`).join('') + `</div>`;
}
function setRow(xi, si, st, ex) {
  return `<div class="setrow ${st.done ? 'done' : ''}">
    <div class="sn">${si + 1}</div>
    <div class="mini"><button data-act="rep" data-x="${xi}" data-s="${si}" data-delta="-1">−</button><b>${st.reps}</b><button data-act="rep" data-x="${xi}" data-s="${si}" data-delta="1">+</button></div>
    <div class="mlab">reps</div>
    <button class="ok" data-act="set-done" data-x="${xi}" data-s="${si}" aria-label="valider série">✓</button>
  </div>`;
}
function scaleRow(label, group, field, val, lo, hi) {
  let btns = '';
  for (let v = lo; v <= hi; v++) btns += `<button data-act="scale" data-group="${group}" data-field="${field}" data-val="${v}" class="${val === v ? 'on' : ''}">${v}</button>`;
  return `<div class="mlab" style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:6px 0 5px">${esc(label)}</div><div class="scale">${btns}</div>`;
}
function scaleRowPain(field, val, lo, hi) {
  let btns = '';
  for (let v = lo; v <= hi; v++) btns += `<button data-act="pain" data-field="${field}" data-val="${v}" class="${val === v ? 'on' : ''}">${v}</button>`;
  return `<div class="scale pain">${btns}</div>`;
}

/* ----- finir la seance ----- */
const KUDOS = ['La régularité bat l\'intensité.', 'Une de plus dans la banque. 🏦', 'Show up > performance.', 'C\'est ça, la constance. En route. 🔥', 'Le travail propre paie toujours.'];
function randomKudos() { return KUDOS[Math.floor(Math.random() * KUDOS.length)]; }

function finishSession(status) {
  const ses = P.SESSIONS[exec.sessionKey];
  // records / charges montées (avant fermeture, depuis l'état exec)
  const prs = [], ups = [];
  exec.exercises.forEach(ex => {
    if (!ex.main) return;
    const w = numOr(ex.weight, 0);
    if (!ex.sets.some(s => s.done) || w <= 0) return;
    const u = ex.mv || { unit: '+kg' };
    if (ex.prWeight != null && w > ex.prWeight) prs.push(`${ex.name} ${E.fmtLoad(w, u)}`);
    else if (ex.lastWeight != null && w > ex.lastWeight) ups.push(`${ex.name} +${fmtNum(round1(w - ex.lastWeight))} kg`);
  });
  const log = S.stampWeek({
    id: S.cryptoId(),
    date: exec.logDate || todayKey(),
    sessionKey: exec.sessionKey,
    status: exec.minimal && status === 'done' ? 'minimal' : status,
    readiness: exec.readiness,
    shoulderPain: exec.shoulderPain,
    notes: exec.notes || '',
    durationSec: Math.round((Date.now() - exec.startedAt) / 1000),
    finisherDone: !!(exec.finisher && exec.finisherDone),
    finisherText: exec.finisher || '',
    exercises: exec.exercises.map(ex => ({
      key: ex.key, name: ex.name, main: ex.main,
      sets: ex.sets.filter(s => s.done).map(s => ({ weight: numOr(ex.weight), reps: s.reps, rpe: ex.rpe })),
    })).filter(ex => ex.sets.length || status !== 'missed'),
  });
  // remplace un log existant du meme jour+seance
  data.logs = (data.logs || []).filter(l => !(l.date === log.date && l.sessionKey === log.sessionKey));
  data.logs.push(log);
  save();
  clearDraft();
  if (status === 'missed') { closeExec(true); render(); toast('Séance notée comme ratée.'); return; }
  showRecap(log, prs, ups);                 // écran récap de fin de séance
}
function showRecap(log, prs, ups) {
  const tonnage = S.sessionTonnage(log);
  const min = Math.round((log.durationSec || 0) / 60);
  const ses = P.SESSIONS[log.sessionKey];
  const c = $('#exec-scroll');
  c.innerHTML = `<div style="text-align:center;padding:14px 4px">
    <div style="font-size:52px;line-height:1">💪</div>
    <div class="fd" style="font-size:26px;margin-top:4px">Séance bouclée</div>
    <div class="small muted">${esc(ses ? ses.title : log.sessionKey)} · S${log.weekNumber}</div>
    <div class="tiles" style="margin:16px 0;text-align:left">
      <div class="tile"><div class="v amber">${fmtNum(Math.round(tonnage))}</div><div class="l">kg déplacés</div></div>
      <div class="tile"><div class="v">${min}<span style="font-size:14px"> min</span></div><div class="l">durée</div></div>
    </div>
    ${prs.length ? `<div class="banner ok" style="text-align:left"><div class="bt">🏆 Record${prs.length > 1 ? 's' : ''} battu${prs.length > 1 ? 's' : ''} !</div><div class="small">${prs.map(esc).join('<br>')}</div></div>` : ''}
    ${ups.length ? `<div class="banner" style="text-align:left"><div class="bt">📈 Charges montées</div><div class="small">${ups.map(esc).join('<br>')}</div></div>` : ''}
    ${log.finisherDone ? `<span class="pill ok" style="margin:4px 0">🔥 Finisher fait</span>` : ''}
    <div class="small amber" style="margin-top:16px;font-weight:600">${esc(randomKudos())}</div>
  </div>`;
  const foot = document.querySelector('.exec-foot button');
  if (foot) { foot.textContent = '✓ Fermer'; foot.dataset.act = 'recap-close'; }
  toast('Séance enregistrée 💪', 'ok');
}
function numOr(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }

/* =====================================================================
   Minuteur de repos
   ===================================================================== */
function startRest(sec) {
  stopTimerOnly();
  clearTimeout(rest._goT);
  rest = { id: null, left: sec, total: sec, running: true, minimized: false };
  paintRest();
  rest.id = setInterval(() => {
    rest.left--;
    if (rest.left <= 0) restDone();
    paintRest();
  }, 1000);
}
function stopTimerOnly() { if (rest.id) clearInterval(rest.id); rest.id = null; }
function stopRest() {
  stopTimerOnly(); clearTimeout(rest._goT);
  rest.running = false; rest.left = 0; rest.total = 0;
  $('#restbar').classList.remove('show');
  hideRestFull();
  if ($('#exec-clock')) { $('#exec-clock').textContent = '—'; $('#exec-rest').className = 'rest'; }
}
function restDone() {
  stopTimerOnly(); rest.running = false; rest.left = 0;
  if (data.settings.soundOnRestEnd) beep();
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  clearTimeout(rest._goT);
  rest._goT = setTimeout(() => { if (!rest.running) stopRest(); }, 2400);  // laisse "GO !" affiché
}
function hideRestFull() { const f = $('#restfull'); if (f) { f.classList.remove('show', 'done'); f.setAttribute('aria-hidden', 'true'); } }
function showRestFull() { const f = $('#restfull'); if (f) { f.classList.add('show'); f.setAttribute('aria-hidden', 'false'); } }
function addCustomExercise() {
  const name = (prompt('Nom de l\'exercice à ajouter :') || '').trim();
  if (!name) return;
  exec.exercises.push({
    key: 'custom-' + S.cryptoId().slice(0, 6), name, main: false, mv: null,
    scheme: '3 × 10', tempo: 'contrôlé', rest: '90 s', restSec: 90, note: 'Exercice ajouté', pain: false,
    suggestion: null, advice: null, weight: '', lastWeight: null, prWeight: null,
    celebrated: false, lastPerf: null, unit: 'kg', rpe: null,
    sets: [{ reps: 10, rpe: null, done: false }, { reps: 10, rpe: null, done: false }, { reps: 10, rpe: null, done: false }],
  });
  renderExec();
}
function nextPendingLabel() {
  if (!exec) return '';
  for (const ex of exec.exercises) {
    const i = ex.sets.findIndex(s => !s.done);
    if (i >= 0) return `À suivre : ${ex.name} · série ${i + 1}/${ex.sets.length}`;
  }
  return 'Dernière série bouclée — finis tranquille 💪';
}
function paintRest() {
  const mmss = `${Math.floor(Math.max(0, rest.left) / 60)}:${String(Math.max(0, rest.left) % 60).padStart(2, '0')}`;
  const done = !rest.running && rest.total > 0 && rest.left <= 0;
  const active = rest.running || done;
  const inExec = !!exec;
  // plein écran (en séance, non minimisé)
  const f = $('#restfull');
  if (f) {
    if (active && inExec && !rest.minimized) {
      showRestFull(); f.classList.toggle('done', done);
      $('#rf-label').textContent = done ? 'Repos terminé' : 'Repos';
      $('#rf-clock').textContent = done ? 'GO !' : mmss;
      $('#rf-next').textContent = done ? 'Série suivante !' : nextPendingLabel();
    } else hideRestFull();
  }
  // barre du bas (minimisé ou hors séance)
  const bar = $('#restbar');
  if (active && (rest.minimized || !inExec)) {
    bar.classList.add('show');
    bar.innerHTML = done
      ? `<div class="clock" style="color:var(--ok)">GO</div><div class="small" style="flex:1;color:var(--ok)">Repos terminé !</div><button class="btn sm" data-act="rest-skip">OK</button>`
      : `<div class="clock">${mmss}</div><div class="small muted" style="flex:1">Repos</div><button class="btn sm" data-act="rest-full" aria-label="plein écran">⤢</button><button class="btn sm" data-act="rest-add" data-d="30">+30s</button><button class="btn sm" data-act="rest-skip">Passer</button>`;
  } else bar.classList.remove('show');
  // mini horloge header exec
  if ($('#exec-clock') && exec) {
    $('#exec-clock').textContent = rest.running ? mmss : (done ? 'GO' : '—');
    $('#exec-rest').className = 'rest' + (rest.running ? ' run' : (done ? ' done' : ''));
  }
}
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination); o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    o.start(); o.stop(ac.currentTime + 0.5);
  } catch { /* silencieux */ }
}

/* =====================================================================
   Wake Lock (ecran allume)
   ===================================================================== */
async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); }
  } catch { /* refuse / non supporte : on continue */ }
}
function releaseWakeLock() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch { /* */ } }
async function reacquireWakeLock() { if (!wakeLock && data.settings.keepAwake) acquireWakeLock(); }

/* =====================================================================
   Evenements
   ===================================================================== */
function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const x = el.dataset.x != null ? +el.dataset.x : null;
  switch (act) {
    case 'tab': tab = el.dataset.tab; render(); break;
    case 'start': startSession(el.dataset.session, false); break;
    case 'minimal': startSession(el.dataset.session, true); break;
    case 'exec-close': confirmCloseExec(); break;
    case 'finish-open': openFinishSheet(); break;
    case 'step': stepWeight(x, +el.dataset.delta); break;
    case 'rep': stepRep(x, +el.dataset.s, +el.dataset.delta); break;
    case 'ex-rpe': setExRpe(x, +el.dataset.val); break;
    case 'set-done': toggleSet(x, +el.dataset.s); break;
    case 'all-sets': validateAll(x); break;
    case 'scale': exec.readiness[el.dataset.field] = +el.dataset.val; recomputeSuggestions(); renderExec(); break;
    case 'pain': exec.shoulderPain = +el.dataset.val; recomputeSuggestions(); renderExec(); break;
    case 'toggle-warm': exec.warmOpen = !exec.warmOpen; renderExec(); break;
    case 'toggle-finisher': exec.finisherDone = !exec.finisherDone; renderExec(); break;
    case 'ex-move': { const i = +el.dataset.x, j = i + (+el.dataset.dir); if (j >= 0 && j < exec.exercises.length) { const a = exec.exercises;[a[i], a[j]] = [a[j], a[i]]; renderExec(); } break; }
    case 'ex-remove': { const i = +el.dataset.x; if (exec.exercises[i].sets.some(s => s.done) && !confirm('Retirer cet exercice ? Les séries validées seront perdues.')) break; exec.exercises.splice(i, 1); renderExec(); break; }
    case 'ex-add': addCustomExercise(); break;
    case 'resume-draft': resumeDraft(); break;
    case 'discard-draft': clearDraft(); render(); break;
    case 'recap-close': closeExec(false); break;
    case 'share-backup': shareBackup(); break;
    case 'jrn-week': journalWeek = Math.min(E.PROGRAM_WEEKS, Math.max(1, journalWeek + (+el.dataset.d))); render(); break;
    case 'rest-skip': stopRest(); break;
    case 'rest-min': rest.minimized = true; paintRest(); break;
    case 'rest-full': rest.minimized = false; paintRest(); break;
    case 'rest-add': {
      const dd = +el.dataset.d;
      if (rest.id) { rest.left = Math.max(1, rest.left + dd); rest.total = Math.max(rest.left, rest.total + dd); paintRest(); }
      else { startRest(Math.max(15, (rest.total || data.settings.restDefaultSec) + dd)); }   // relance si déjà fini
      break;
    }
    case 'nut-toggle': toggleNutrition(); break;
    case 'save-rest': { const v = +$('#restdef').value; if (v > 0) { data.settings.restDefaultSec = v; save(); toast('Repos par défaut : ' + v + 's', 'ok'); } break; }
    case 'toggle-wake': data.settings.keepAwake = !data.settings.keepAwake; save(); render(); break;
    case 'toggle-sound': data.settings.soundOnRestEnd = !data.settings.soundOnRestEnd; save(); render(); break;
    case 'toggle-autorest': data.settings.autoRest = !data.settings.autoRest; save(); render(); break;
    case 'toggle-kine': data.settings.kineDone = !data.settings.kineDone; save(); render(); break;
    case 'kine-done': data.settings.kineDone = true; save(); render(); toast('Bilan kiné noté ✓', 'ok'); break;
    case 'del-log': delLog(el.dataset.id); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'reset': resetAll(); break;
    case 'show-install': $('#install').classList.add('show'); break;
    case 'install-dismiss': $('#install').classList.remove('show'); data.seenInstall = true; save(); break;
    case 'finish-status': finishSession(el.dataset.status); break;
  }
}
function onInput(e) {
  if (e.target.matches('[data-act="note"]')) { if (exec) exec.notes = e.target.value; }
}
function onChange(e) {
  const f = e.target.dataset.form;
  if (f === 'import') importFile(e.target.files[0]);
}
function onSubmit(e) {
  const f = e.target.dataset.form;
  if (!f) return;
  e.preventDefault();
  const fd = new FormData(e.target);
  if (f === 'bw') {
    const kg = parseFloat(fd.get('kg')); if (!kg) return;
    upsertByDate('bodyweight', { date: todayKey(), kg }); save(); render(); toast('Poids ajouté', 'ok');
  } else if (f === 'sleep') {
    const hours = parseFloat(fd.get('hours')); if (!hours) return;
    upsertByDate('sleep', { date: todayKey(), hours }); save(); render(); toast('Sommeil ajouté', 'ok');
  } else if (f === 'steps') {
    const count = parseInt(fd.get('count'), 10); if (!count) return;
    upsertByDate('steps', { date: todayKey(), count }); save(); render(); toast('Pas ajoutés', 'ok');
  }
}
function upsertByDate(key, obj) {
  data[key] = (data[key] || []).filter(x => x.date !== obj.date); data[key].push(obj);
}

/* ----- exec interactions ----- */
function stepWeight(xi, delta) {
  const ex = exec.exercises[xi];
  let w = numOr(ex.weight, 0) + delta;
  if (ex.main && ex.mv && ex.mv.unit !== '+kg') w = Math.max(0, w);
  ex.weight = Math.round(w * 100) / 100;
  const node = document.getElementById('w' + xi);
  if (node) node.textContent = (ex.main && ex.mv && ex.mv.unit === '+kg') ? (ex.weight > 0 ? '+' + fmtNum(ex.weight) : fmtNum(ex.weight)) : fmtNum(ex.weight);
  const pnode = document.getElementById('plate' + xi);
  if (pnode && ex.mv) { const pt = plateText(ex.weight, ex.mv); pnode.innerHTML = pt ? '🏋 ' + esc(pt) : ''; }
  saveDraft();
}
function stepRep(xi, si, delta) {
  const st = exec.exercises[xi].sets[si];
  st.reps = Math.max(0, st.reps + delta);
  renderExec();
}
function setExRpe(xi, val) {
  const ex = exec.exercises[xi];
  ex.rpe = val; ex.sets.forEach(s => { if (!s.done) s.rpe = val; });
  renderExec();
}
function toggleSet(xi, si) {
  const ex = exec.exercises[xi];
  const st = ex.sets[si];
  st.done = !st.done;
  if (st.done) { st.rpe = ex.rpe; celebratePR(ex); startRest(restSecFor(ex)); }
  renderExec();
}
function validateAll(xi) {
  const ex = exec.exercises[xi];
  ex.sets.forEach(s => { s.done = true; s.rpe = ex.rpe; });
  celebratePR(ex);
  startRest(restSecFor(ex));
  renderExec();
}
function confirmCloseExec() {
  const hasData = exec && exec.exercises.some(ex => ex.sets.some(s => s.done));
  if (hasData) {
    if (confirm('Quitter sans enregistrer la séance ? (Tu peux la terminer pour la sauver.)')) closeExec();
  } else closeExec();
}
function openFinishSheet() {
  stopRest();   // évite que le minuteur plein écran recouvre l'écran de fin
  const done = exec.exercises.some(ex => ex.sets.some(s => s.done));
  const total = exec.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const doneCount = exec.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);
  const partial = done && doneCount < total;
  const c = $('#exec-scroll');
  c.innerHTML = `<div class="xb"><div class="xname" style="margin-bottom:10px">Terminer la séance</div>
    <div class="small muted" style="margin-bottom:12px">${doneCount}/${total} séries validées${exec.shoulderPain != null ? ' · épaule ' + exec.shoulderPain + '/10' : ''}.</div>
    <div class="field"><label>Date de la séance</label><input type="date" id="finish-date" value="${exec.logDate}"></div>
    <button class="btn primary block" data-act="finish-status" data-status="done" style="margin-bottom:10px">✓ Séance ${partial ? 'partielle' : 'complète'} faite</button>
    <button class="btn block" data-act="finish-status" data-status="missed" style="margin-bottom:10px">Marquer comme ratée</button>
    <button class="btn ghost block" data-act="finish-back">← Revenir à la séance</button></div>`;
  c.querySelector('#finish-date').addEventListener('change', e => { if (e.target.value) exec.logDate = e.target.value; });
  c.querySelector('[data-act="finish-back"]').addEventListener('click', renderExec);
}

/* ----- nutrition ----- */
function toggleNutrition() {
  const today = todayKey();
  const ex = (data.nutrition || []).find(n => n.date === today);
  if (ex) ex.achieved = !ex.achieved;
  else data.nutrition.push({ date: today, type: isTrainingDay() ? 'train' : 'rest', achieved: true });
  save(); render();
}

/* =====================================================================
   Export / import / reset
   ===================================================================== */
function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() { data.meta.lastExport = todayKey(); save(); download(`ssbs-sauvegarde-${todayKey()}.json`, S.exportJSON(data)); toast('Export JSON prêt', 'ok'); }
async function shareBackup() {
  const json = S.exportJSON(data);
  const fname = `ssbs-sauvegarde-${todayKey()}.json`;
  data.meta.lastExport = todayKey(); save();
  try {
    const file = new File([json], fname, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Sauvegarde SSBS', text: 'Ma sauvegarde SSBS — à garder précieusement.' });
      toast('Sauvegarde envoyée ✓', 'ok'); render(); return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; /* annulé par l'utilisateur */ }
  download(fname, json); toast('Sauvegarde téléchargée', 'ok'); render();   // repli (PC / pas de partage)
}
function exportCSV() { download(`ssbs-series-${todayKey()}.csv`, S.exportCSV(data), 'text/csv'); toast('Export CSV prêt', 'ok'); }
function importFile(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const imported = S.importJSON(fr.result);
      if (!confirm('Remplacer les données actuelles par la sauvegarde importée ?')) return;
      data = imported; save(); render(); toast('Données importées ✓', 'ok');
    } catch { toast('Fichier JSON invalide', 'err'); }
  };
  fr.readAsText(file);
}
function delLog(id) {
  if (!confirm('Supprimer cette séance de l\'historique ?')) return;
  data.logs = (data.logs || []).filter(l => l.id !== id);
  save(); render(); toast('Séance supprimée');
}
function resetAll() {
  if (!confirm('Tout effacer ? Cette action est irréversible. Pense à exporter avant.')) return;
  if (!confirm('Confirmer la suppression définitive de toutes les données ?')) return;
  data = S.defaultData(); save(); render(); toast('Données réinitialisées');
}

/* =====================================================================
   Install / Service Worker
   ===================================================================== */
function maybeShowInstall() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!standalone && iOS && !data.seenInstall) setTimeout(() => $('#install').classList.add('show'), 1500);
}
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => {
          // une nouvelle version est prête ET une ancienne contrôlait déjà la page
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
        });
      });
    }).catch(() => { /* hors-ligne ok après la 1re visite */ });
  });
}
function showUpdateBanner() {
  if (document.getElementById('sw-update')) return;
  const d = document.createElement('div');
  d.id = 'sw-update';
  d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h) + var(--safe-b) + 12px);max-width:536px;margin:0 auto;background:var(--bg3);border:1px solid var(--accent);border-radius:12px;padding:12px 14px;z-index:90;display:flex;align-items:center;gap:10px;box-shadow:0 8px 30px #000a';
  d.innerHTML = '<div class="small" style="flex:1">🆕 Nouvelle version disponible.</div><button class="btn sm primary" id="sw-reload">Recharger</button>';
  document.body.appendChild(d);
  document.getElementById('sw-reload').addEventListener('click', () => location.reload());
}

boot();
