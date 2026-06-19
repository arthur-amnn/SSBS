/* =====================================================================
   engine.js — Moteur de logique pure (SSBS Street Lifting)
   Aucune dependance au DOM ni au stockage : importable en navigateur
   ET en Node (pour les tests). Toutes les fonctions sont deterministes.
   ===================================================================== */

/* ---------- Constantes du programme ---------- */
export const PROGRAM_START = '2026-06-15';   // lundi 15 juin 2026
export const PROGRAM_WEEKS = 11;             // 15 juin -> 30 aout = 11 semaines
export const DELOAD_WEEKS = [5, 9];          // semaines de decharge
export const TEST_WEEK = 11;
export const DIPS_PAIN_THRESHOLD = 3;        // douleur epaule > 3/10 => pas de montee (dips)
export const ADHERENCE_TARGET = 0.85;        // objectif 85 %, pas 100 %

/* Les 4 seances de force (AUCUN HIIT). Ordre chrono dans la semaine. */
export const SESSIONS_PER_WEEK = ['lundi', 'mardi', 'jeudi', 'vendredi'];
/* Decalage (en jours) depuis le lundi de chaque semaine */
const SESSION_DOW = { lundi: 0, mardi: 1, jeudi: 3, vendredi: 4 };

/* ---------- Mouvements principaux (autoregulation) ----------
   start  : charge de depart S1 (kg ajoutes pour la callisthenie, barre pour squat/SDT)
   reps   : reps cible par serie (borne basse si fourchette)
   rpe    : RPE cible (null si pilote par les reps)
   inc    : increment de montee
   unit   : '+kg' (lest ajoute) ou 'kg' (charge barre)
   shoulder : true => regle speciale epaule (dips)
   repBased : true => progression sur reps propres (muscle-up)            */
export const MAIN_MOVEMENTS = {
  muscleup: { key: 'muscleup', name: 'Muscle-up',         session: 'lundi',    sets: 4, reps: 2, rpe: null, inc: 2.5,  start: 0,    workTarget: 5,   unit: '+kg', repBased: true },
  traction: { key: 'traction', name: 'Traction lestée',   session: 'lundi',    sets: 4, reps: 4, rpe: 8,    inc: 1.25, start: 17.5, workTarget: 28,  unit: '+kg' },
  chinup:   { key: 'chinup',   name: 'Chin-up lesté',     session: 'lundi',    sets: 3, reps: 5, rpe: 8,    inc: 1.25, start: 12.5, workTarget: 21,  unit: '+kg' },
  dips:     { key: 'dips',     name: 'Dips lestés',       session: 'mardi',    sets: 4, reps: 5, rpe: 8,    inc: 1.25, start: 15,   workTarget: 25,  unit: '+kg', shoulder: true },
  squat:    { key: 'squat',    name: 'Back Squat',        session: 'jeudi',    sets: 5, reps: 3, rpe: 8,    inc: 2.5,  start: 100,  workTarget: 113, unit: 'kg' },
  // soulevé : +2,5 par défaut, +5 si la dernière séance était à RPE <= 7 (cf. §3.4)
  souleve:  { key: 'souleve',  name: 'Soulevé de terre',  session: 'jeudi',    sets: 3, reps: 4, rpe: 8,    inc: 2.5,  incBig: 5, bigWhenRpeLe: 7, incLabel: '+2,5-5', start: 100, workTarget: 118, unit: 'kg' },
};

/* Objectifs : actuel -> plancher (+10 kg) -> stretch (cf. cahier des charges) */
export const TARGETS = {
  traction: { baseline: 30,  floor: 40,  stretch: 45,  unit: '+kg' },
  chinup:   { baseline: 25,  floor: 35,  stretch: null, unit: '+kg' },
  dips:     { baseline: 40,  floor: 50,  stretch: 50,  unit: '+kg', note: 'propre & sans douleur d\'abord' },
  squat:    { baseline: 110, floor: 120, stretch: 125, unit: 'kg' },
  souleve:  { baseline: 120, floor: 130, stretch: 135, unit: 'kg' },
  muscleup: { baseline: 0,   floor: 5,   stretch: 5,   unit: '+kg' },
};

/* =====================================================================
   Utilitaires de date (robustes au fuseau / heure d'ete via UTC)
   ===================================================================== */
export function toDateOnly(d) {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}
function dayIndex(d) {
  const x = toDateOnly(d);
  return Math.floor(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000);
}
export function daysBetween(a, b) { return dayIndex(b) - dayIndex(a); }
export function addDaysISO(start, n) {
  const d = toDateOnly(start);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function todayISO(now = new Date()) {
  return addDaysISO(toDateOnly(now), 0);
}

/* =====================================================================
   Semaine & phase
   ===================================================================== */
export function getWeekNumber(today, start = PROGRAM_START) {
  const d = daysBetween(start, today);
  if (d < 0) return 0;                       // avant le depart
  return Math.min(PROGRAM_WEEKS, Math.floor(d / 7) + 1);
}
export function isDeloadWeek(week) { return DELOAD_WEEKS.includes(week); }

export function getPhase(week) {
  if (week <= 0)   return { week, name: 'Avant le départ', type: 'pre', deload: false, hint: 'Le programme démarre le lundi 15 juin 2026.' };
  if (week <= 3)   return { week, name: 'Accumulation 1',  type: 'accumulation',    deload: false, hint: 'Montée linéaire, on ancre la régularité.' };
  if (week === 4)  return { week, name: 'Pic du bloc 1',   type: 'peak',            deload: false, hint: 'Dernières charges hautes du premier bloc.' };
  if (week === 5)  return { week, name: 'Décharge',        type: 'deload',          deload: true,  hint: 'Volume −40 % (2-3 séries), charges légères. Tu récupères.' };
  if (week <= 8)   return { week, name: 'Accumulation 2',  type: 'accumulation',    deload: false, hint: 'On dépasse les charges de S4.' };
  if (week === 9)  return { week, name: 'Décharge légère', type: 'deload',          deload: true,  hint: 'Légère, optionnelle si grosse fatigue.' };
  if (week === 10) return { week, name: 'Intensification', type: 'intensification', deload: false, hint: 'Charges de travail maximales.' };
  return { week, name: 'Tests', type: 'test', deload: false, hint: 'Tests : traction, chin-up, squat, soulevé (dips selon épaule) + mensurations + bilan.' };
}

/* =====================================================================
   1RM estime — Epley (sur la charge externe loggee)
   ===================================================================== */
export function epley1RM(weight, reps) {
  const w = Number(weight);
  if (!(w > 0) || !(reps > 0)) return Math.max(0, w || 0);
  if (reps <= 1) return w;
  return w * (1 + reps / 30);
}
/* Variante ajustee au RPE : reps en reserve = 10 - RPE */
export function estimate1RM(weight, reps, rpe) {
  const rir = rpe == null ? 0 : Math.max(0, 10 - Number(rpe));
  return epley1RM(weight, Number(reps) + rir);
}

/* =====================================================================
   Helpers d'evaluation d'une perf (un mouvement sur une seance)
   perf = { weight, sets:[{reps,rpe}], ... }
   ===================================================================== */
function requiredReps(mv) { return mv.reps; }

export function repsMissed(perf, mv) {
  if (!perf || !Array.isArray(perf.sets) || perf.sets.length === 0) return true;
  if (perf.sets.length < mv.sets) return true;
  const req = requiredReps(mv);
  return perf.sets.some(s => Number(s.reps) < req);
}
function rpeWithinTarget(perf, mv) {
  if (mv.rpe == null) return true;
  return (perf.sets || []).every(s => s.rpe == null || Number(s.rpe) <= mv.rpe);
}
export function sessionFailed(perf, mv) { return repsMissed(perf, mv); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function roundToIncrement(value, mv) {
  const step = mv.inc || 1.25;
  return Number((Math.round(value / step) * step).toFixed(3));
}
export function fmtLoad(load, mv) {
  if (mv && mv.repBased && (!load || load <= 0)) return 'poids du corps';
  if (mv && mv.unit === '+kg') return (load > 0 ? '+' : '') + `${stripZero(load)} kg`;
  return `${stripZero(load)} kg`;
}
function stripZero(n) { return Number(n).toString(); }

/* =====================================================================
   MOTEUR D'AUTOREGULATION SSBS
   movementKey : cle de MAIN_MOVEMENTS
   history     : perfs passees du mouvement, ordre chronologique
   ctx         : { isDeloadWeek, shoulderPainToday, startingLoad }
   -> { load, status, delta, message, movement, target }
   status : start | increase | hold | hold_pain | reduce | deload
   ===================================================================== */
function result(load, status, delta, message, mv) {
  return {
    load: Number(load),
    status,
    delta: Number(delta) || 0,
    message,
    movement: mv.key,
    target: { sets: mv.sets, reps: mv.reps, rpe: mv.rpe },
    display: fmtLoad(load, mv),
  };
}

export function suggestNextLoad(movementKey, history, ctx = {}) {
  const mv = MAIN_MOVEMENTS[movementKey];
  if (!mv) throw new Error('Mouvement principal inconnu : ' + movementKey);

  const startingLoad = ctx.startingLoad != null ? ctx.startingLoad : mv.start;
  const isDeload = !!ctx.isDeloadWeek;
  const painToday = ctx.shoulderPainToday != null ? Number(ctx.shoulderPainToday) : 0;

  const hist = (history || []).filter(Boolean);

  /* 1. Premiere seance, aucun historique -> charge de depart */
  if (hist.length === 0) {
    return result(startingLoad, 'start', 0,
      `Première séance : on démarre à ${fmtLoad(startingLoad, mv)}. Note bien charge ET RPE.`, mv);
  }

  const last = hist[hist.length - 1];
  const lastLoad = last.weight != null ? Number(last.weight) : startingLoad;

  /* 2. Semaine de decharge -> autoregulation EN PAUSE */
  if (isDeload) {
    return result(lastLoad, 'deload', 0,
      `Semaine de décharge : autorégulation en pause. Charge légère, volume réduit (~−40 %). On ne cherche pas à monter.`, mv);
  }

  /* 3. Deux echecs d'affilee -> -5 % */
  if (hist.length >= 2) {
    const a = hist[hist.length - 1], b = hist[hist.length - 2];
    if (sessionFailed(a, mv) && sessionFailed(b, mv)) {
      const reduced = roundToIncrement(lastLoad * 0.95, mv);
      return result(reduced, 'reduce', reduced - lastLoad,
        `Deux échecs d'affilée : on recule de 5 % (${fmtLoad(reduced, mv)}) pour repartir solide. Reculer d'un pas pour avancer de deux.`, mv);
    }
  }

  /* 4. Regle speciale DIPS — epaule */
  if (mv.shoulder && painToday > DIPS_PAIN_THRESHOLD) {
    return result(lastLoad, 'hold_pain', 0,
      `Épaule à ${painToday}/10 : on NE monte PAS. Forme parfaite et zéro douleur priment sur le chiffre. Réduis charge/amplitude si ça tire.`, mv);
  }

  const repsOk = !repsMissed(last, mv);
  const rpeOk = rpeWithinTarget(last, mv);

  /* 4 bis. Forme basse (readiness) : on bloque la montée du jour */
  if (ctx.readinessLow && repsOk && rpeOk) {
    return result(lastLoad, 'hold', 0,
      `Forme basse aujourd'hui : on consolide à ${fmtLoad(lastLoad, mv)} plutôt que de monter. Montre-toi, c'est l'essentiel.`, mv);
  }

  /* 5. Muscle-up (pilote par les reps propres) */
  if (mv.repBased) {
    if (repsOk) {
      const next = roundToIncrement(lastLoad + mv.inc, mv);
      return result(next, 'increase', mv.inc,
        lastLoad <= 0
          ? `${mv.reps} reps propres au poids du corps : tu peux commencer à lester (+${mv.inc} kg).`
          : `2 reps lestées propres : +${mv.inc} kg → ${fmtLoad(next, mv)}.`, mv);
    }
    return result(lastLoad, 'hold', 0,
      `On consolide la technique et la propreté du geste avant d'ajouter du lest.`, mv);
  }

  const maxRpe = Math.max(0, ...last.sets.map(s => s.rpe == null ? 0 : Number(s.rpe)));

  /* 6. Mouvement RPE : montee si reps OK ET RPE <= cible */
  if (repsOk && rpeOk) {
    // increment : cas special soulevé (+5 si la séance était facile, RPE <= 7)
    let inc = mv.inc;
    if (mv.incBig && maxRpe > 0 && maxRpe <= mv.bigWhenRpeLe) inc = mv.incBig;
    const next = roundToIncrement(lastLoad + inc, mv);
    let msg = `Séries bouclées au RPE cible ou en dessous : +${inc} kg → ${fmtLoad(next, mv)}.`;
    if (inc === mv.incBig) msg += ` Séance facile (RPE ≤ ${mv.bigWhenRpeLe}) → on prend le gros incrément.`;
    if (mv.shoulder && painToday > 0) msg += ` (épaule à ${painToday}/10 — reste prudent sur l'amplitude.)`;
    return result(next, 'increase', inc, msg, mv);
  }

  /* 7. Sinon -> maintien (avec flag "soigne la forme" si RPE bien au-dessus) */
  if (!repsOk) {
    return result(lastLoad, 'hold', 0,
      `On garde ${fmtLoad(lastLoad, mv)} : des reps sont passées à la trappe. Répète et soigne la forme.`, mv);
  }
  const heavy = maxRpe >= mv.rpe + 1.5;
  return result(lastLoad, 'hold', 0,
    heavy
      ? `On garde ${fmtLoad(lastLoad, mv)} : RPE bien au-dessus de la cible (${maxRpe} vs ${mv.rpe}). Répète et soigne la forme.`
      : `On garde ${fmtLoad(lastLoad, mv)} et on retente : RPE un cran au-dessus de la cible (${mv.rpe}).`, mv);
}

/* =====================================================================
   Planning, adherence, streak, garde-fou "jamais deux d'affilee"
   ===================================================================== */
/* Toutes les seances planifiees dont la date est <= today */
export function buildSchedule(start, today, weeks = PROGRAM_WEEKS) {
  const out = [];
  const totalDays = daysBetween(start, today);
  if (totalDays < 0) return out;
  for (let w = 1; w <= weeks; w++) {
    for (const s of SESSIONS_PER_WEEK) {
      const offset = (w - 1) * 7 + SESSION_DOW[s];
      if (offset <= totalDays) {
        out.push({ week: w, sessionKey: s, dayOffset: offset, date: addDaysISO(start, offset) });
      }
    }
  }
  return out;
}

/* planned : tableau chrono ; statusOf(item) -> 'done'|'partial'|'minimal'|'missed' */
export function adherenceStats(planned, statusOf) {
  let done = 0, missed = 0, partial = 0, minimal = 0;
  const statuses = planned.map(p => {
    const st = statusOf(p) || 'missed';
    if (st === 'missed') missed++;
    else { done++; if (st === 'partial') partial++; if (st === 'minimal') minimal++; }
    return st;
  });
  const total = planned.length;
  const rate = total ? done / total : 0;
  return { total, done, missed, partial, minimal, rate, statuses, onTarget: rate >= ADHERENCE_TARGET };
}

/* Serie en cours : seances "faites" consecutives depuis la fin */
export function currentStreak(statuses) {
  let s = 0;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] !== 'missed') s++; else break;
  }
  return s;
}

/* Garde-fou : la seule ligne rouge = jamais deux seances ratees d'affilee */
export function redLineState(statuses) {
  const n = statuses.length;
  const last = n ? statuses[n - 1] : null;
  const prev = n > 1 ? statuses[n - 2] : null;
  const atRisk = last === 'missed';                       // une 2e absence franchirait la ligne
  const violated = last === 'missed' && prev === 'missed';
  return { atRisk, violated, last, prev };
}

/* =====================================================================
   Progression vers objectif (barres)
   ===================================================================== */
export function objectiveProgress(current, t) {
  if (!t || typeof t.floor !== 'number') return null;
  const span = t.floor - t.baseline;
  if (span <= 0) return current >= t.floor ? 1 : 0;
  return clamp((current - t.baseline) / span, 0, 1);
}

/* Projection de la charge de travail vers le 30 août (tendance linéaire) */
export function projectWorkTarget(history, mv, today, endDate = '2026-08-30') {
  const h = (history || []).filter(p => p && p.date && p.weight != null);
  if (h.length < 2 || !mv || mv.workTarget == null) return null;
  const first = h[0], last = h[h.length - 1];
  const weeksElapsed = Math.max(0.5, daysBetween(first.date, last.date) / 7);
  const ratePerWeek = (last.weight - first.weight) / weeksElapsed;
  const weeksRemaining = Math.max(0, daysBetween(today, endDate) / 7);
  const projected = Math.round((last.weight + ratePerWeek * weeksRemaining) * 10) / 10;
  return { projected, target: mv.workTarget, onTrack: projected >= mv.workTarget - 0.01, ratePerWeek: Math.round(ratePerWeek * 100) / 100 };
}

/* Progression de la CHARGE DE TRAVAIL : départ S1 -> cible de travail ~S11 */
export function workProgress(currentWorkingWeight, mv) {
  if (!mv || mv.workTarget == null) return null;
  const span = mv.workTarget - mv.start;
  if (span <= 0) return currentWorkingWeight >= mv.workTarget ? 1 : 0;
  return clamp((currentWorkingWeight - mv.start) / span, 0, 1);
}

/* Conseil double-progression pour un accessoire (reps puis charge).
   scheme ex. "3 × 10-12" ; lastSets = [{reps,weight}] */
export function accessoryAdvice(scheme, lastSets) {
  const m = String(scheme).match(/[×x]\s*(\d+)(?:\s*-\s*(\d+))?/);
  if (!m) return null;
  const low = +m[1], high = m[2] ? +m[2] : +m[1];
  if (!lastSets || !lastSets.length) return { text: `Vise ${low}${high > low ? '-' + high : ''} reps propres, puis ajoute des reps avant la charge.` };
  const minReps = Math.min(...lastSets.map(s => Number(s.reps) || 0));
  const w = lastSets.find(s => s.weight != null) ? Math.max(...lastSets.map(s => Number(s.weight) || 0)) : null;
  if (minReps >= high) {
    return { text: `Tu as bouclé le haut de la fourchette (${high} reps)${w ? ` à ${w} kg` : ''} → monte la charge et redescends à ${low} reps.`, action: 'load' };
  }
  return { text: `La dernière fois ${minReps} reps${w ? ` à ${w} kg` : ''} → vise ${Math.min(minReps + 1, high)} reps cette fois (jusqu'à ${high}, puis +charge).`, action: 'reps' };
}

/* Tendance RPE : RPE moyen qui grimpe a charge ~egale sur N seances => alerte */
export function rpeTrendAlert(history, lookback = 3) {
  const hist = (history || []).filter(p => p && Array.isArray(p.sets) && p.sets.length);
  if (hist.length < lookback) return { alert: false };
  const recent = hist.slice(-lookback);
  const avg = p => {
    const r = p.sets.filter(s => s.rpe != null).map(s => Number(s.rpe));
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
  };
  const loads = recent.map(p => Number(p.weight));
  const sameLoad = Math.max(...loads) - Math.min(...loads) <= 0.001;
  const rpes = recent.map(avg);
  if (rpes.some(r => r == null)) return { alert: false };
  const rising = rpes.every((r, i) => i === 0 || r >= rpes[i - 1]) && rpes[rpes.length - 1] > rpes[0];
  return { alert: sameLoad && rising, rpes, loads };
}
