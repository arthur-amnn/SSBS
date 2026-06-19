import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultData, migrate, loadData, saveData,
  exportJSON, importJSON, exportCSV,
  movementHistory, lastPerf, sessionTonnage, SCHEMA_VERSION,
} from '../js/storage.js';

/* mock localStorage */
function mockStore(initial = null) {
  let v = initial;
  return {
    getItem: () => v,
    setItem: (_k, val) => { v = String(val); },
    removeItem: () => { v = null; },
    _raw: () => v,
  };
}

const sampleLog = {
  id: 'log1', date: '2026-06-15', sessionKey: 'lundi', weekNumber: 1, phase: 'Accumulation 1',
  status: 'done', readiness: { energy: 4, sleep: 4, soreness: 2 }, shoulderPain: 1, notes: 'ok', durationSec: 3000,
  exercises: [{
    key: 'traction', name: 'Traction lestée', main: true,
    sets: [{ weight: 17.5, reps: 4, rpe: 7 }, { weight: 17.5, reps: 4, rpe: 8 }],
  }],
};

/* ================= PERSISTANCE ================= */

test('sauvegarde -> rechargement : donnees intactes', () => {
  const store = mockStore();
  const data = migrate({ ...defaultData(), logs: [sampleLog] });
  assert.ok(saveData(data, store));
  const back = loadData(store);
  assert.equal(back.logs.length, 1);
  assert.deepEqual(back.logs[0], data.logs[0]);
  assert.equal(back.logs[0].exercises[0].sets[1].weight, 17.5);
});

test('export/import JSON aller-retour', () => {
  const data = migrate({ ...defaultData(), logs: [sampleLog], bodyweight: [{ date: '2026-06-15', kg: 65.8 }] });
  const text = exportJSON(data);
  const back = importJSON(text);
  assert.deepEqual(back.logs, data.logs);
  assert.deepEqual(back.bodyweight, data.bodyweight);
  assert.equal(back.schemaVersion, SCHEMA_VERSION);
});

test('import JSON invalide -> jette (capturable par l\'UI)', () => {
  assert.throws(() => importJSON('{ pas du json'));
});

/* ================= EXPORT CSV ================= */

test('export CSV : entete + une ligne par serie', () => {
  const data = migrate({ ...defaultData(), logs: [sampleLog] });
  const csv = exportCSV(data);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'date,semaine,phase,seance,statut,exercice,principal,serie,charge_kg,reps,rpe,douleur_epaule');
  assert.equal(lines.length, 3); // entete + 2 series
  assert.ok(lines[1].startsWith('2026-06-15,1,Accumulation 1,lundi,done,Traction'));
  assert.ok(lines[1].includes('17.5'));
});

test('export CSV : echappement des champs avec virgule/guillemet', () => {
  const log = { ...sampleLog, phase: 'Accu, test "x"' };
  const data = migrate({ ...defaultData(), logs: [log] });
  const csv = exportCSV(data);
  assert.ok(csv.includes('"Accu, test ""x"""'));
});

/* ================= INTEGRITE / MIGRATION ================= */

test('migration : objet vide -> structure complete, ne bloque pas', () => {
  const d = migrate({});
  assert.equal(d.schemaVersion, SCHEMA_VERSION);
  for (const k of ['logs', 'bodyweight', 'sleep', 'nutrition', 'measures', 'photos']) {
    assert.ok(Array.isArray(d[k]), `${k} doit etre un tableau`);
  }
  assert.ok(d.settings.restDefaultSec > 0);
});

test('migration : champs corrompus normalises sans throw', () => {
  const d = migrate({ logs: 'pas-un-tableau', settings: null, schemaVersion: 'x' });
  assert.deepEqual(d.logs, []);
  assert.equal(d.schemaVersion, SCHEMA_VERSION);
});

test('migration : null/undefined -> defaut', () => {
  assert.equal(migrate(null).schemaVersion, SCHEMA_VERSION);
  assert.equal(migrate(undefined).logs.length, 0);
});

test('chargement : JSON corrompu en storage -> defaut, jamais de crash', () => {
  const store = mockStore('{{{ corrompu ]]]');
  const d = loadData(store);
  assert.equal(d.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(d.logs, []);
});

test('normalizeLog : log sans date ou sessionKey est ecarte', () => {
  const d = migrate({ logs: [{ status: 'done' }, sampleLog] });
  assert.equal(d.logs.length, 1);
  assert.equal(d.logs[0].sessionKey, 'lundi');
});

/* ================= SELECTEURS ================= */

test('movementHistory : perfs chrono d\'un mouvement principal', () => {
  const log2 = { ...sampleLog, id: 'log2', date: '2026-06-22', exercises: [{ key: 'traction', name: 'Traction lestée', main: true, sets: [{ weight: 18.75, reps: 4, rpe: 8 }] }] };
  const data = migrate({ ...defaultData(), logs: [sampleLog, log2] });
  const hist = movementHistory(data, 'traction');
  assert.equal(hist.length, 2);
  assert.equal(hist[0].weight, 17.5);
  assert.equal(hist[1].weight, 18.75);
  assert.equal(hist[1].sets[0].rpe, 8);
});

test('lastPerf : derniere perf d\'un exercice', () => {
  const data = migrate({ ...defaultData(), logs: [sampleLog] });
  const p = lastPerf(data, 'traction');
  assert.equal(p.sets.length, 2);
  assert.equal(lastPerf(data, 'inexistant'), null);
});

test('sessionTonnage : somme charge x reps', () => {
  // 17.5*4 + 17.5*4 = 140
  assert.equal(sessionTonnage(sampleLog), 140);
});
