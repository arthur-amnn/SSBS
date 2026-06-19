/* =====================================================================
   storage.js — Persistance 100% locale + integrite + export/import.
   - Fonctions pures (migrate / exportJSON / importJSON / exportCSV)
     testables en Node.
   - load/save acceptent un "store" injectable (localStorage par defaut,
     mock en test).
   ===================================================================== */
import { getWeekNumber, getPhase, MAIN_MOVEMENTS } from './engine.js';

export const STORAGE_KEY = 'ssbs_data_v1';
export const SCHEMA_VERSION = 1;

/* Store memoire de repli (Node / environnements sans localStorage) */
function memoryStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}
const _fallback = memoryStore();
function defaultStore() {
  return (typeof localStorage !== 'undefined' && localStorage) ? localStorage : _fallback;
}

/* ---------- Donnees par defaut ---------- */
export function defaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: new Date().toISOString(), startDate: '2026-06-15' },
    settings: { restDefaultSec: 150, keepAwake: true, soundOnRestEnd: true, kineDone: false, autoRest: true },
    logs: [],          // seances loggees
    bodyweight: [],    // { date, kg }
    sleep: [],         // { date, hours }
    steps: [],         // { date, count }
    nutrition: [],     // { date, type:'train'|'rest', achieved:bool }
    measures: [],      // { date, waist, ... }
    seenInstall: false,
  };
}

/* ---------- Integrite / migration (ne jette JAMAIS, ne bloque jamais) ---------- */
const ARRAY_KEYS = ['logs', 'bodyweight', 'sleep', 'steps', 'nutrition', 'measures', 'photos'];

export function migrate(raw) {
  const base = defaultData();
  let data;
  try {
    data = (raw && typeof raw === 'object') ? { ...raw } : {};
  } catch { data = {}; }

  // Fusion non destructive avec la structure par defaut
  data.meta = { ...base.meta, ...(data.meta || {}) };
  data.settings = { ...base.settings, ...(data.settings || {}) };
  for (const k of ARRAY_KEYS) {
    if (!Array.isArray(data[k])) data[k] = [];
  }
  if (typeof data.seenInstall !== 'boolean') data.seenInstall = false;

  // Migrations futures par paliers (exemple de squelette)
  let v = Number(data.schemaVersion) || 0;
  // if (v < 2) { ...transformer... ; v = 2; }
  data.schemaVersion = SCHEMA_VERSION;
  void v;

  // Nettoyage doux des logs invalides (on ne supprime pas, on normalise)
  data.logs = data.logs.map(normalizeLog).filter(Boolean);
  return data;
}

function normalizeLog(log) {
  if (!log || typeof log !== 'object') return null;
  const out = {
    id: log.id || cryptoId(),
    date: typeof log.date === 'string' ? log.date.slice(0, 10) : null,
    sessionKey: log.sessionKey || null,
    weekNumber: Number(log.weekNumber) || 0,
    phase: log.phase || '',
    status: ['done', 'partial', 'missed', 'minimal'].includes(log.status) ? log.status : 'done',
    readiness: log.readiness && typeof log.readiness === 'object' ? log.readiness : null,
    shoulderPain: log.shoulderPain == null ? null : Number(log.shoulderPain),
    notes: typeof log.notes === 'string' ? log.notes : '',
    durationSec: Number(log.durationSec) || 0,
    finisherDone: !!log.finisherDone,
    finisherText: typeof log.finisherText === 'string' ? log.finisherText : '',
    exercises: Array.isArray(log.exercises) ? log.exercises.map(normalizeExercise).filter(Boolean) : [],
  };
  if (!out.date || !out.sessionKey) return null;
  return out;
}
function normalizeExercise(ex) {
  if (!ex || typeof ex !== 'object') return null;
  return {
    key: ex.key || '',
    name: ex.name || ex.key || '',
    main: !!ex.main,
    sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({
      weight: s.weight == null ? null : Number(s.weight),
      reps: s.reps == null ? null : Number(s.reps),
      rpe: s.rpe == null ? null : Number(s.rpe),
    })) : [],
  };
}

export function cryptoId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/* ---------- Chargement / sauvegarde ---------- */
export function loadData(store = defaultStore()) {
  let raw = null;
  try { raw = store.getItem(STORAGE_KEY); } catch { raw = null; }
  if (!raw) return defaultData();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return defaultData(); }
  const data = migrate(parsed);
  return data;
}
export function saveData(data, store = defaultStore()) {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

/* ---------- Export / import JSON ---------- */
export function exportJSON(data) {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString(), app: 'SSBS Street Lifting' }, null, 2);
}
export function importJSON(text) {
  const parsed = JSON.parse(text);          // jette si JSON invalide (capture par l'appelant)
  return migrate(parsed);
}

/* ---------- Export CSV (toutes les series loggees) ---------- */
export function exportCSV(data) {
  const header = ['date', 'semaine', 'phase', 'seance', 'statut', 'exercice', 'principal', 'serie', 'charge_kg', 'reps', 'rpe', 'douleur_epaule'];
  const rows = [header];
  const logs = [...(data.logs || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const log of logs) {
    (log.exercises || []).forEach(ex => {
      (ex.sets || []).forEach((s, i) => {
        rows.push([
          log.date, log.weekNumber, log.phase, log.sessionKey, log.status,
          ex.name, ex.main ? 'oui' : 'non', i + 1,
          s.weight ?? '', s.reps ?? '', s.rpe ?? '',
          log.shoulderPain ?? '',
        ]);
      });
    });
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* =====================================================================
   Selecteurs derives (connaissent la forme des donnees)
   ===================================================================== */
/* Historique chrono d'un mouvement principal -> perfs pour suggestNextLoad */
export function movementHistory(data, movementKey) {
  const out = [];
  const logs = [...(data.logs || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const log of logs) {
    const ex = (log.exercises || []).find(e => e.key === movementKey);
    if (!ex || !Array.isArray(ex.sets) || ex.sets.length === 0) continue;
    const validSets = ex.sets.filter(s => s.reps != null);
    if (!validSets.length) continue;
    const weight = Math.max(...validSets.map(s => Number(s.weight) || 0));
    out.push({
      date: log.date,
      weight,
      sets: validSets.map(s => ({ reps: Number(s.reps), rpe: s.rpe == null ? null : Number(s.rpe) })),
      shoulderPain: log.shoulderPain,
    });
  }
  return out;
}

/* Derniere perf d'un exercice (principal ou accessoire) pour l'affichage "precedent" */
export function lastPerf(data, exerciseKey) {
  const logs = [...(data.logs || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const log of logs) {
    const ex = (log.exercises || []).find(e => e.key === exerciseKey);
    if (ex && ex.sets && ex.sets.length) return { date: log.date, sets: ex.sets };
  }
  return null;
}

/* Statut d'une seance planifiee (par date + sessionKey) pour l'adherence */
export function sessionStatusMap(data) {
  const map = new Map();
  for (const log of (data.logs || [])) {
    map.set(log.date + '|' + log.sessionKey, log.status);
  }
  return map;
}

/* 1RM courant estime par mouvement principal (meilleure perf recente) */
export function currentBest(data, movementKey) {
  const hist = movementHistory(data, movementKey);
  if (!hist.length) return null;
  return hist[hist.length - 1].weight;
}

/* Enrichit un log avec semaine + phase calculees */
export function stampWeek(log) {
  const wk = getWeekNumber(log.date);
  return { ...log, weekNumber: wk, phase: getPhase(wk).name };
}

/* Tonnage d'une seance (somme charge*reps, charge externe) */
export function sessionTonnage(log) {
  let t = 0;
  (log.exercises || []).forEach(ex => (ex.sets || []).forEach(s => {
    t += (Number(s.weight) || 0) * (Number(s.reps) || 0);
  }));
  return t;
}

export { MAIN_MOVEMENTS };
