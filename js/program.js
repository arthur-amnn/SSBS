/* =====================================================================
   program.js — Contenu du programme Street Lifting (source de verite :
   Programme_Street_Lifting_11_Semaines.html), structure pour l'app.
   4 seances de force / semaine. AUCUN HIIT (suivi ailleurs).
   ===================================================================== */

export const ATHLETE = {
  taille: '1,69 m', poids: '65,8 kg', imc: 23, niveau: 'intermédiaire',
  objectif1: 'Physique athlétique sec, veineux, musclé (recomposition).',
  objectif2: '+10 kg minimum sur chaque mouvement principal en 12 semaines.',
  stretch: 'Traction +45 kg × 2 · Dips +50 kg × 2 (selon épaule).',
  vigilance: 'Épaule sensible — facteur limitant des dips. Suivi prioritaire.',
};

export const WELCOME_PHRASE = 'La version que tu suis bat la version parfaite que tu abandonnes.';

export const WARMUP = '3 min cardio léger + rotations d\'épaules + band pull-aparts ×15 + montée progressive sur le 1er exercice.';

/* Couleur par type de seance */
export const SESSION_COLORS = { lundi: 'pull', mardi: 'push', jeudi: 'legs', vendredi: 'vol' };

/* ---------- Les 4 seances ----------
   Chaque exercice : { key, name, scheme, tempo, rest, note, main }
   main:true => mouvement principal (autoregulation, cle = engine MAIN_MOVEMENTS)
   pain:true => saisie douleur epaule pertinente                               */
export const SESSIONS = {
  lundi: {
    key: 'lundi', day: 'Lundi', title: 'Tirage + Muscle-up', focus: 'Force traction max',
    color: 'pull', duration: '~60 min', shoulder: true,
    warmupSpecial: 'Bandes épaules + dead hang 20 s + scapula pulls ×10 + 3-4 tractions corps lentes + 1-2 muscle-ups de mise en route avant les séries de MU. Puis montée progressive sur la traction lestée.',
    finisher: 'Grip + biceps (~6 min, à zapper sans jus) : Curl « 21 » barre légère 2 séries, puis dead hang 2 séries.',
    exercises: [
      { key: 'muscleup', name: 'Muscle-up',                scheme: '4 × 2-3',  tempo: 'explosif', rest: '2-3 min', note: 'En premier, bien échauffé : le mouvement le plus technique et explosif doit être frais. Lesté si propre. Tractions explosives poitrine-barre + négatives lentes 4 s + transitions élastique.', main: true, king: true },
      { key: 'traction', name: 'Traction lestée',          scheme: '4 × 4',    tempo: '2-0-1', rest: '3 min',   note: 'Mouvement roi de force, juste après le MU. RIR 1-2. Poitrine vers la barre, amplitude complète.', main: true, king: true },
      { key: 'chinup',   name: 'Chin-up lesté',            scheme: '3 × 5',    tempo: '2-1-1', rest: '2 min',   note: 'Prise supination. Biceps + dos.', main: true },
      { key: 'rowing',   name: 'Rowing barre ou haltère',  scheme: '3 × 8',    tempo: '2-1-2', rest: '90 s',    note: 'Dos épais, omoplates serrées.' },
      { key: 'curl',     name: 'Curl barre',               scheme: '3 × 10',   tempo: 'contrôlé', rest: '60 s',  note: 'Supination complète, esthétique bras.' },
    ],
  },
  mardi: {
    key: 'mardi', day: 'Mardi', title: 'Poussée lourde', focus: 'Force dips max',
    color: 'push', duration: '~55 min', shoulder: true,
    warmupSpecial: 'Bandes épaules → pompage tendineux (10-15 dips au corps lents) → pompes lentes ×10 → montée progressive dips lestés.',
    finisher: 'Rameur (~8 min) : 6 × (30 s fort / 30 s souple). Conditioning sans charger l\'épaule.',
    exercises: [
      { key: 'dips',     name: 'Dips lestés',                  scheme: '4 × 5',     tempo: '2-1-1', rest: '3 min', note: 'Forme parfaite + zéro douleur AVANT la charge (RPE 7-8). C\'est l\'épaule qui dicte, pas l\'ego.', main: true, king: true, pain: true },
      { key: 'dinc',     name: 'Développé incliné haltères',   scheme: '4 × 8',     tempo: '2-0-1', rest: '2 min', note: 'Pec haut. Plus doux pour l\'épaule qu\'un développé barre.' },
      { key: 'dipsbw',   name: 'Dips poids de corps (pump)',   scheme: '3 × 10-12', tempo: 'contrôlé', rest: '90 s', note: 'Volume sans charge. Épaule sensible ? Remplace par développé machine ou pompes.', pain: true },
      { key: 'triceps',  name: 'Extensions triceps corde',     scheme: '3 × 12',    tempo: '2-1-1', rest: '60 s', note: 'Coudes fixes, contraction forte en bas.' },
      { key: 'facepull', name: 'Face pulls',                   scheme: '3 × 15',    tempo: '1-1-1', rest: '45 s', note: 'Santé épaule — NON optionnel. Rotateurs externes.' },
    ],
  },
  jeudi: {
    key: 'jeudi', day: 'Jeudi', title: 'Squat + Soulevé', focus: 'Force basse',
    color: 'legs', duration: '~55 min',
    warmupSpecial: 'Mobilité hanches/chevilles + squats BW ×10 + montée progressive squat (barre → 40 → 60 kg).',
    finisher: 'Fentes + mollets (~7 min) : fentes marchées 3 × 20 pas + mollets debout 3 × 20.',
    exercises: [
      { key: 'squat',    name: 'Back Squat',                 scheme: '5 × 3',  tempo: '2-1-1', rest: '3 min', note: 'Profondeur complète. +2,5 kg quand 5×3 propres.', main: true, king: true },
      { key: 'souleve',  name: 'Soulevé de terre',           scheme: '3 × 4',  tempo: 'contrôlé', rest: '3 min', note: 'Dos neutre, jamais arrondi. +2,5-5 kg quand propre.', main: true, king: true },
      { key: 'rdl',      name: 'Soulevé roumain (RDL)',      scheme: '3 × 10', tempo: '3-0-1', rest: '2 min', note: 'Ischios. Descente lente, étirement.' },
      { key: 'fentes',   name: 'Fentes marchées ou presse',  scheme: '3 × 12', tempo: 'contrôlé', rest: '90 s', note: 'Volume quadriceps.' },
      { key: 'gainage',  name: 'Planche ou hollow hold',     scheme: '3 × 40 s', tempo: 'tension', rest: '60 s', note: 'Core. Gainage actif = transfert MU.' },
    ],
  },
  vendredi: {
    key: 'vendredi', day: 'Vendredi', title: 'Haut du corps volume', focus: 'Hypertrophie + skill MU',
    color: 'vol', duration: '~55 min', shoulder: true,
    warmupSpecial: 'Cardio léger 3 min + bandes épaules + 5 tractions corps.',
    finisher: 'Farmer carry (~6 min) : 4 × 30-40 m lourds. Grip, gainage, trapèzes — zéro charge sur l\'épaule.',
    exercises: [
      { key: 'tracvol',  name: 'Traction (corps ou +5/10 kg)',       scheme: '4 × 6-8',  tempo: '3-0-1', rest: '2 min', note: 'Volume dos, tempo lent, contrôle total.' },
      { key: 'mutech',   name: 'Muscle-up technique (sans lest)',    scheme: '4 × 3',    tempo: 'propre', rest: '90 s', note: 'Travail du geste, fluidité. PAS de fatigue.', pain: true },
      { key: 'dipsvol',  name: 'Dips poids de corps',                scheme: '4 × 10',   tempo: 'contrôlé', rest: '90 s', note: 'Volume push.', pain: true },
      { key: 'latrel',   name: 'Élévations latérales',               scheme: '3 × 15',   tempo: '1-0-1', rest: '45 s', note: 'Épaules larges — silhouette en V.' },
      { key: 'superset', name: 'Superset curl + extension triceps',  scheme: '3 × 12/12', tempo: 'contrôlé', rest: '60 s', note: 'Bras (esthétique).' },
      { key: 'ttb',      name: 'Toes-to-bar / relevés de jambes',    scheme: '3 × 10',   tempo: 'contrôlé', rest: '60 s', note: 'Abdos + transfert MU.' },
    ],
  },
};

export const SESSION_ORDER = ['lundi', 'mardi', 'jeudi', 'vendredi'];

/* ---------- Seances "minimum viable" (20 min, jours sans motivation) ---------- */
export const MINIMUM_VIABLE = {
  lundi:    'Traction lestée 4×4 + Muscle-up 3×3',
  mardi:    'Dips lestés 4×5 + Face pulls 3×15',
  jeudi:    'Back Squat 5×3',
  vendredi: 'Tractions 4×8 + Dips 4×10',
};
export const MINIMUM_VIABLE_MSG = '20 minutes battent zéro, à chaque fois.';

/* ---------- Baselines (tests des 4-5 juin) ---------- */
export const BASELINES = [
  { key: 'squat',    label: 'Squat',           test: '110 × 2', est1rm: 116, cible: 'cap 120-125' },
  { key: 'souleve',  label: 'Soulevé de terre', test: '120 × 1', est1rm: 122, cible: '135' },
  { key: 'muscleup', label: 'Muscle-up',       test: '2 au PdC', est1rm: null, cible: '+5 kg × 2' },
  { key: 'traction', label: 'Traction',        test: '+30 clean', est1rm: 32, cible: 'plancher +40, stretch +45×2' },
  { key: 'chinup',   label: 'Chin-up',         test: '+25 clean', est1rm: 27, cible: '+25 × 2' },
  { key: 'dips',     label: 'Dips',            test: '~+40 (épaule)', est1rm: null, cible: 'propre & sans douleur' },
];

/* ---------- Arc des 11 semaines (affichage) ---------- */
export const WEEK_ARC = [
  { weeks: 'S1 – S3', label: 'Accumulation', desc: 'Montée linéaire, on ancre la régularité.', type: 'normal' },
  { weeks: 'S4',      label: 'Pic du bloc',  desc: 'Dernières charges hautes du 1er bloc.', type: 'normal' },
  { weeks: 'S5',      label: 'Décharge',     desc: 'Volume −40 % (2-3 séries), charges légères. Tu récupères.', type: 'deload' },
  { weeks: 'S6 – S8', label: 'Accumulation 2', desc: 'On dépasse les charges de S4.', type: 'normal' },
  { weeks: 'S9',      label: 'Décharge légère', desc: 'Légère, optionnelle si grosse fatigue.', type: 'deload' },
  { weeks: 'S10',     label: 'Intensification', desc: 'Charges de travail maximales.', type: 'normal' },
  { weeks: 'S11',     label: 'Tests',        desc: 'Traction, chin-up, squat, soulevé (dips selon épaule). Mensurations + bilan.', type: 'test' },
];

/* ---------- Légende des tempos (§3.2) ---------- */
export const TEMPO_LEGEND = {
  intro: 'Les chiffres (ex. « 2-1-1 ») = la vitesse de chaque phase d\'une répétition, en secondes.',
  phases: [
    ['1ᵉʳ chiffre', 'descente (la négative, contrôlée)'],
    ['2ᵉ chiffre', 'pause en bas (position étirée)'],
    ['3ᵉ chiffre', 'montée (l\'effort)'],
    ['un 0', 'pas de pause, tu enchaînes'],
  ],
  words: [
    ['explosif', 'monte le plus vite possible'],
    ['contrôlé', '~2 s dans chaque sens, sans à-coup'],
    ['tension', 'gainage, tu tiens la position'],
  ],
  rule: 'Réflexe clé : descends toujours plus lentement que tu montes.',
};

/* ---------- Nutrition (recomposition) ---------- */
export const NUTRITION = {
  intro: 'Recomposition à maintenance — surtout pas de surplus. Protéines hautes pour garder/construire du muscle pendant que le gras descend. Le physique sec/veineux se joue sur le taux de gras.',
  train: { tag: 'Jours d\'entraînement · Lun Mar Jeu Ven', kcal: 2500, p: 160, c: 320, f: 65 },
  rest:  { tag: 'Jours de repos · Mer Sam Dim',           kcal: 2100, p: 160, c: 230, f: 60 },
  moyenne: 'Moyenne ~2 400 kcal/jour ≈ maintenance · protéines ~2,4 g/kg · lipides ≥ 60 g (plancher hormonal). Jamais sous ~2 000 kcal.',
  timing: [
    '60-90 min avant — glucides + protéines modérées : flocons + skyr, ou riz + œufs.',
    'Juste avant — banane + café (caféine si tu en prends). Pas de graisses lourdes.',
    'Dans l\'heure après — 30-40 g protéines + glucides : whey + fruit, ou repas viande/riz.',
    'Sur la journée — protéines en 4 prises de ~30-40 g.',
  ],
  ajustement: [
    'Poids ~stable (±1 kg) + tour de taille qui baisse + charges qui montent → la recomp marche.',
    'Pas assez sec après 3-4 sem → −150-200 kcal (glucides).',
    'Charges qui baissent / énergie au sol → tu as trop coupé, +150 kcal.',
    'Jamais sous ~2 000 kcal : tu es déjà léger.',
  ],
  supplements: 'Créatine monohydrate 5 g/jour (tous les jours). Whey : pratique, pas obligatoire. Caféine pré-séance : optionnelle, max 400 mg/jour.',
};

/* ---------- Discipline ---------- */
export const DISCIPLINE_RULES = [
  { n: 1, title: 'La règle des 85 %', text: 'Vise 85 % des séances faites, pas 100 %. Rater une séance n\'est PAS un échec — c\'est prévu.' },
  { n: 2, title: 'Jamais deux d\'affilée', text: 'Tu peux rater une séance. Jamais deux planifiées de suite. C\'est la seule ligne rouge.' },
  { n: 3, title: 'Show up > performance', text: 'Le jour J, l\'objectif n\'est pas un record, c\'est d\'y aller. Une séance moyenne faite vaut 100× une parfaite imaginée.' },
  { n: 4, title: 'Un seul suivi', text: 'Tu notes tes charges sur les mouvements rois. Pas de pesée quotidienne, pas de 10 mesures.' },
];

/* ---------- Optimisation / recuperation ---------- */
export const OPTIMISATION = {
  sommeil: '7-9 h par nuit, horaires réguliers. Levier n°1 de récupération et de force.',
  fatigue: 'Signaux : force qui baisse 2 séances de suite, sommeil dégradé, motivation au sol, douleur articulaire → avance la décharge ou ajoute un repos.',
  leviers: [
    'Pas quotidiens : 8-10 000/jour. Le meilleur outil de sèche pour le côté veineux.',
    'Retour au calme ~5 min : étirements épaules + hanches.',
    'Hydratation 2,5-3 L/jour.',
    'Décharges (S5, S9) : pas de finisher, tout en mode tranquille.',
    'Grip qui lâche avant le dos ? Sangles — le dos doit être le facteur limitant.',
  ],
  epaule: [
    'Fais voir cette épaule par un kiné — action n°1.',
    'Dips en mode forme + zéro douleur : propre et léger, le chiffre suivra.',
    'Face pulls, band pull-aparts, pompage tendineux : jamais optionnels.',
    'Toute douleur > 3/10 sur dips/MU/pressings → réduis charge/amplitude le jour même.',
  ],
};

/* ---------- Objectifs ---------- */
export const OBJECTIVES = {
  plancher: [
    'Squat : déjà atteint (110×2) → cap 120-125',
    'Soulevé 120 → 130-135 kg',
    'Muscle-up → +5 kg × 2',
    'Chin-up +25 → +25 × 2',
    'Traction +30 → +40 clean',
    'Dips → propres & sans douleur',
  ],
  stretch: [
    'Traction +45 kg × 2 (ambitieux)',
    'Dips +50 kg × 2 (selon l\'épaule — santé d\'abord)',
  ],
};
