import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestNextLoad, epley1RM, estimate1RM,
  getWeekNumber, getPhase, isDeloadWeek,
  buildSchedule, adherenceStats, currentStreak, redLineState,
  objectiveProgress, rpeTrendAlert, MAIN_MOVEMENTS, TARGETS,
  workProgress, accessoryAdvice, projectWorkTarget,
} from '../js/engine.js';

/* helper : construit une perf "parfaite" pour un mouvement */
function perfectPerf(mvKey, weight, rpe) {
  const mv = MAIN_MOVEMENTS[mvKey];
  return { weight, sets: Array.from({ length: mv.sets }, () => ({ reps: mv.reps, rpe })) };
}
function close(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }

/* ================= AUTOREGULATION ================= */

test('1re seance sans historique -> charge de depart (chaque mouvement)', () => {
  for (const [key, mv] of Object.entries(MAIN_MOVEMENTS)) {
    const r = suggestNextLoad(key, []);
    assert.equal(r.status, 'start', `${key} devrait etre 'start'`);
    assert.equal(r.load, mv.start, `${key} charge de depart`);
  }
});

test('toutes les series au RPE cible ou en dessous -> montee (+increment)', () => {
  const cases = [
    ['traction', 17.5, 18.75, 1.25],
    ['chinup', 12.5, 13.75, 1.25],
    ['dips', 15, 16.25, 1.25],
    ['squat', 100, 102.5, 2.5],
    ['souleve', 100, 102.5, 2.5],   // RPE 8 (> 7) -> petit incrément
  ];
  for (const [key, w, expected, delta] of cases) {
    const mv = MAIN_MOVEMENTS[key];
    const r = suggestNextLoad(key, [perfectPerf(key, w, mv.rpe)], { shoulderPainToday: 0 });
    assert.equal(r.status, 'increase', `${key} devrait monter`);
    assert.equal(r.load, expected, `${key} nouvelle charge`);
    assert.equal(r.delta, delta, `${key} increment`);
  }
});

test('soulevé : +5 si la séance était facile (RPE ≤ 7), +2,5 sinon', () => {
  const easy = suggestNextLoad('souleve', [perfectPerf('souleve', 100, 7)]);
  assert.equal(easy.status, 'increase');
  assert.equal(easy.load, 105);
  assert.equal(easy.delta, 5);
  const hard = suggestNextLoad('souleve', [perfectPerf('souleve', 100, 8)]);
  assert.equal(hard.load, 102.5);
  assert.equal(hard.delta, 2.5);
});

test('RPE au-dessus de la cible -> maintien', () => {
  const r = suggestNextLoad('traction', [perfectPerf('traction', 17.5, 9)]);
  assert.equal(r.status, 'hold');
  assert.equal(r.load, 17.5);
});

test('reps manquees -> maintien', () => {
  const perf = { weight: 17.5, sets: [{ reps: 3, rpe: 8 }, { reps: 4, rpe: 8 }, { reps: 4, rpe: 8 }, { reps: 4, rpe: 8 }] };
  const r = suggestNextLoad('traction', [perf]);
  assert.equal(r.status, 'hold');
  assert.equal(r.load, 17.5);
});

test('DIPS : douleur epaule > 3/10 -> pas de montee meme si perf parfaite', () => {
  const perf = perfectPerf('dips', 15, 7);
  const r = suggestNextLoad('dips', [perf], { shoulderPainToday: 4 });
  assert.equal(r.status, 'hold_pain');
  assert.equal(r.load, 15);
});

test('DIPS : douleur epaule <= 3/10 + perf parfaite -> montee autorisee', () => {
  const perf = perfectPerf('dips', 15, 7);
  const r = suggestNextLoad('dips', [perf], { shoulderPainToday: 2 });
  assert.equal(r.status, 'increase');
  assert.equal(r.load, 16.25);
});

test('echec deux fois de suite -> -5 %', () => {
  const fail = { weight: 100, sets: [{ reps: 2, rpe: 9 }, { reps: 2, rpe: 9 }, { reps: 1, rpe: 10 }, { reps: 2, rpe: 9 }, { reps: 2, rpe: 9 }] };
  const r = suggestNextLoad('squat', [fail, fail]);
  assert.equal(r.status, 'reduce');
  assert.equal(r.load, 95);           // 100 * 0.95 arrondi a 2.5
  assert.ok(r.delta < 0);
});

test('un seul echec -> maintien (pas de -5 %)', () => {
  const ok = perfectPerf('squat', 100, 8);
  const fail = { weight: 100, sets: [{ reps: 2, rpe: 9 }, { reps: 3, rpe: 9 }, { reps: 3, rpe: 9 }, { reps: 3, rpe: 9 }, { reps: 3, rpe: 9 }] };
  const r = suggestNextLoad('squat', [ok, fail]);
  assert.equal(r.status, 'hold');
  assert.equal(r.load, 100);
});

test('forme basse (readiness) -> pas de montee, on consolide', () => {
  const perf = perfectPerf('traction', 17.5, 7);   // monterait normalement
  const r = suggestNextLoad('traction', [perf], { readinessLow: true });
  assert.equal(r.status, 'hold');
  assert.equal(r.load, 17.5);
});

test('progression charge de travail : depart -> cible ~S11', () => {
  assert.equal(workProgress(17.5, MAIN_MOVEMENTS.traction), 0);     // depart
  assert.equal(workProgress(28, MAIN_MOVEMENTS.traction), 1);       // cible
  assert.equal(workProgress(22.75, MAIN_MOVEMENTS.traction), 0.5);  // a mi-chemin
});

test('projection vers le 30 août : tendance linéaire + dans les temps', () => {
  const hist = [{ date: '2026-06-15', weight: 100 }, { date: '2026-06-29', weight: 105 }];
  const p = projectWorkTarget(hist, MAIN_MOVEMENTS.squat, '2026-06-29');
  assert.equal(p.ratePerWeek, 2.5);            // +5 kg en 2 semaines
  assert.ok(p.projected > 113);                 // dépasse la cible de travail
  assert.equal(p.onTrack, true);
  // pas assez d'historique
  assert.equal(projectWorkTarget([{ date: '2026-06-15', weight: 100 }], MAIN_MOVEMENTS.squat, '2026-06-29'), null);
});

test('double progression accessoire : reps puis charge', () => {
  const top = accessoryAdvice('3 × 10-12', [{ reps: 12, weight: 20 }, { reps: 12, weight: 20 }]);
  assert.equal(top.action, 'load');
  const mid = accessoryAdvice('3 × 10-12', [{ reps: 10, weight: 20 }]);
  assert.equal(mid.action, 'reps');
  assert.ok(mid.text.includes('11'));
});

test('semaine de decharge (S5/S9) -> autoregulation en pause', () => {
  const perf = perfectPerf('traction', 17.5, 7);   // parfait, monterait normalement
  const r = suggestNextLoad('traction', [perf], { isDeloadWeek: true });
  assert.equal(r.status, 'deload');
  assert.equal(r.load, 17.5);          // aucune montee
});

test('muscle-up : reps propres au PdC -> propose de lester', () => {
  const perf = { weight: 0, sets: [{ reps: 3 }, { reps: 3 }, { reps: 2 }, { reps: 2 }] };
  const r = suggestNextLoad('muscleup', [perf]);
  assert.equal(r.status, 'increase');
  assert.equal(r.load, 2.5);
});

/* ================= 1RM EPLEY ================= */

test('Epley : valeurs connues', () => {
  assert.ok(close(epley1RM(110, 2), 117.333));
  assert.equal(epley1RM(100, 1), 100);
  assert.equal(epley1RM(0, 5), 0);
  assert.ok(close(epley1RM(100, 5), 116.667));
});

test('1RM ajuste au RPE (reps en reserve = 10 - RPE)', () => {
  // 100 x 3 @ RPE 8 -> RIR 2 -> reps effectives 5
  assert.ok(close(estimate1RM(100, 3, 8), epley1RM(100, 5)));
});

/* ================= SEMAINE & PHASE ================= */

test('calcul de la semaine depuis le 15 juin 2026', () => {
  assert.equal(getWeekNumber('2026-06-14'), 0);   // avant le depart
  assert.equal(getWeekNumber('2026-06-15'), 1);   // jour 1 (lundi)
  assert.equal(getWeekNumber('2026-06-21'), 1);   // dimanche -> encore S1
  assert.equal(getWeekNumber('2026-06-22'), 2);   // lundi suivant -> S2
  assert.equal(getWeekNumber('2026-07-13'), 5);   // 28 jours -> S5
  assert.equal(getWeekNumber('2030-01-01'), 11);  // bornee a 11
});

test('phases : decharges S5/S9, intensif S10, tests S11', () => {
  assert.equal(isDeloadWeek(5), true);
  assert.equal(isDeloadWeek(9), true);
  assert.equal(isDeloadWeek(4), false);
  assert.equal(getPhase(2).type, 'accumulation');
  assert.equal(getPhase(5).deload, true);
  assert.equal(getPhase(9).deload, true);
  assert.equal(getPhase(10).type, 'intensification');
  assert.equal(getPhase(11).type, 'test');
});

/* ================= ADHERENCE / STREAK / GARDE-FOU ================= */

test('buildSchedule : seances planifiees jusqu\'a aujourd\'hui', () => {
  const sched = buildSchedule('2026-06-15', '2026-06-22'); // 7 jours
  assert.equal(sched.length, 5);  // S1 (lun/mar/jeu/ven) + S2 lundi
  assert.equal(sched[0].sessionKey, 'lundi');
  assert.equal(sched[4].week, 2);
});

test('adherence : taux = faites / planifiees, cible 85 %', () => {
  const planned = [{}, {}, {}, {}];
  const statuses = ['done', 'done', 'missed', 'partial'];
  let i = 0;
  const r = adherenceStats(planned, () => statuses[i++]);
  assert.equal(r.done, 3);
  assert.equal(r.missed, 1);
  assert.equal(r.rate, 0.75);
  assert.equal(r.onTarget, false);
});

test('streak : seances faites consecutives depuis la fin', () => {
  assert.equal(currentStreak(['done', 'missed', 'done', 'done']), 2);
  assert.equal(currentStreak(['done', 'done', 'done']), 3);
  assert.equal(currentStreak(['missed']), 0);
});

test('garde-fou "jamais deux d\'affilee"', () => {
  assert.deepEqual(redLineState(['done', 'missed']), { atRisk: true, violated: false, last: 'missed', prev: 'done' });
  assert.deepEqual(redLineState(['missed', 'missed']), { atRisk: true, violated: true, last: 'missed', prev: 'missed' });
  assert.equal(redLineState(['done', 'done']).atRisk, false);
});

/* ================= OBJECTIFS / TENDANCE RPE ================= */

test('progression objectif : baseline -> plancher', () => {
  // traction baseline 30, plancher 40 ; actuel 35 -> 50 %
  assert.equal(objectiveProgress(35, TARGETS.traction), 0.5);
  assert.equal(objectiveProgress(30, TARGETS.traction), 0);
  assert.equal(objectiveProgress(40, TARGETS.traction), 1);
  assert.equal(objectiveProgress(50, TARGETS.traction), 1); // borne
});

test('alerte tendance RPE : RPE qui grimpe a charge egale', () => {
  const hist = [
    { weight: 100, sets: [{ reps: 3, rpe: 7 }] },
    { weight: 100, sets: [{ reps: 3, rpe: 8 }] },
    { weight: 100, sets: [{ reps: 3, rpe: 9 }] },
  ];
  assert.equal(rpeTrendAlert(hist).alert, true);
  // charge differente -> pas d'alerte
  const hist2 = [
    { weight: 100, sets: [{ reps: 3, rpe: 7 }] },
    { weight: 102.5, sets: [{ reps: 3, rpe: 8 }] },
    { weight: 105, sets: [{ reps: 3, rpe: 9 }] },
  ];
  assert.equal(rpeTrendAlert(hist2).alert, false);
});
