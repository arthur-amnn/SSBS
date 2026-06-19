# PROMPT FINAL — App de suivi & progression « Street Lifting 11 semaines »

> Version fusionnée et **déjà remplie** avec mes données. À envoyer tel quel à un constructeur d'app IA, ou à pousser sur GitHub Pages.
> **Joindre le document source** : `Programme_Street_Lifting_12_Semaines.html` (il fait foi pour le détail des séances).

---

## 0. INSTRUCTIONS AU CONSTRUCTEUR
Tu es **développeur front-end + coach sportif & préparateur physique**. Construis une **application web (PWA) de suivi et de progression dédiée UNIQUEMENT au programme ci-dessous et dans le document joint**.
- Le **document source fait foi** : extrais-le et reproduis-le fidèlement. Le §3 structure ces données ; en cas de doute, le document/§3 prime.
- Construis l'app **complète et fonctionnelle de bout en bout, sans reposer de questions.**
- **Priorité produit absolue : simplicité et zéro friction.** L'utilisateur a abandonné tous ses anciens suivis car trop complexes. **Logger une séance doit prendre < 1 min, l'app ne harcèle jamais et ne culpabilise jamais.** Une app utilisée chaque séance vaut mieux qu'une usine à gaz.

---

## 1. RÔLE & OBJECTIF
- **Type de programme :** force / street lifting + **recomposition corporelle**.
- **But de l'app :** me faire réaliser, mesurer et progresser, et surtout **tenir la régularité**.
- **Ce qu'elle doit résoudre :** mon manque de discipline/structure, mon besoin de progression mesurée, et le risque d'abandon.
- **EXCLUSION :** **pas de HIIT** (suivi dans une autre appli). Cette app ne gère **que les 4 séances de musculation** (lundi, mardi, jeudi, vendredi) et leurs finishers.

---

## 2. PROFIL ATHLÈTE
- 1m69, 65,8 kg, niveau **intermédiaire**, reprise après une période irrégulière.
- **Objectif n°1 (prioritaire) :** physique athlétique **sec, veineux, musclé** (recomposition).
- **Objectif n°2 :** **+10 kg minimum** sur les barres (la force est un bonus, pas la priorité).
- **Performance — planchers réalistes / stretch :**

| Mouvement | Test actuel (1RM est.) | Plancher | Stretch |
|---|---|---|---|
| Squat | 110×2 (~116 kg) | atteint → 120-125 kg | — |
| Soulevé de terre | 120×1 (~122 kg) | 130-135 kg | — |
| Muscle-up | 2 au poids du corps | +5 kg × 2 | — |
| Chin-up | +25 clean (~+28) | +25 × 2 et + | — |
| Traction | +30 clean (~+33) | +40 clean | +45 kg × 2 |
| Dips | +35×2 (épaule, ~+40) | propre & sans douleur | +50 kg × 2 |

- **Contraintes :** **épaule sensible** = facteur limitant, surtout aux dips. Préparation **Hyrox après le 30 août** → ne pas se cramer avant. Salle complète + barre de traction/dips.

---

## 3. DONNÉES DU PROGRAMME

### 3.1 Calendrier
- **Du lundi 15 juin au 30 août 2026 — 11 semaines.** Afficher un compte à rebours.
- **Mapping :** Lundi = Tirage · Mardi = Poussée · **Mercredi = repos** · Jeudi = Jambes · Vendredi = Volume · *(Samedi = HIIT, EXCLU)* · **Dimanche = repos**.
- **Arc / phases :** S1-S3 accumulation · S4 pic · **S5 décharge** · S6-S8 accumulation 2 · **S9 décharge légère** · S10 intensification · **S11 tests** (traction, chin-up, squat, soulevé — dips selon l'épaule) + photo + mensurations.

### 3.2 Bibliothèque des séances

**Légende des tempos** (à afficher dans l'app — onglet Programme + accessible en mode exécution, ex. via un « ? » sur le champ tempo) : les chiffres « 2-1-1 » = la vitesse de chaque phase d'une rép en secondes — **1er = descente (négative), 2e = pause (en bas/étiré), 3e = montée (effort)** ; un **0** = pas de pause. Mots : **« explosif »** = montée la plus rapide possible ; **« contrôlé »** = ~2 s dans chaque sens sans à-coup ; **« tension »** = gainage tenu. Règle : descendre plus lentement qu'on monte.

**LUNDI — Tirage + Muscle-up (bleu #4aa3ff)** · échauffement : bandes épaules + dead hang + tractions légères.
| Exercice | Séries × Reps | RPE cible | Départ | Incrément | Type |
|---|---|---|---|---|---|
| Muscle-up (explosif) | 4 × 2-3 | — | poids du corps | +2,5 kg / 2 reps propres | principal/skill |
| Traction lestée | 4 × 4 | 8 | +17,5 kg | +1,25 kg | principal |
| Chin-up lesté | 3 × 5 | 8 | +12,5 kg | +1,25 kg | principal |
| Rowing barre/haltère | 3 × 8 | — | — | reps puis charge | accessoire |
| Curl barre | 3 × 10 | — | — | reps puis charge | accessoire |
| Finisher (optionnel) | Curl « 21 » léger ×2 + dead hang ×2 | — | — | — | finisher |

**MARDI — Poussée (ambre #e8a33d)** · échauffement : bandes + **pompage tendineux** + montée progressive.
| Exercice | Séries × Reps | RPE cible | Départ | Incrément | Type |
|---|---|---|---|---|---|
| Dips lestés ⚠️ épaule | 4 × 5 | 7-8 | +15 kg strict | +1,25 kg **si 0 douleur** | principal |
| Développé incliné haltères | 4 × 8 | — | — | reps puis charge | accessoire |
| Dips poids de corps | 3 × 10-12 | — | — | (option : développé machine/pompes si épaule) | accessoire |
| Extensions triceps corde | 3 × 12 | — | — | reps puis charge | accessoire |
| Face pulls (santé épaule) | 3 × 15 | — | — | — | accessoire clé |
| Finisher (optionnel) | Rameur 6 × (30 s fort / 30 s souple) | — | — | — | finisher |

**JEUDI — Jambes (vert #4cce72)** · échauffement : mobilité hanches/chevilles + montée squat puis soulevé.
| Exercice | Séries × Reps | RPE cible | Départ | Incrément | Type |
|---|---|---|---|---|---|
| Back Squat | 5 × 3 | 8 | 100 kg | +2,5 kg | principal |
| Soulevé de terre | 3 × 4 | 8 | 100 kg | +2,5 à +5 kg | principal |
| Soulevé roumain (RDL) | 3 × 10 | — | — | reps puis charge | accessoire |
| Fentes ou presse | 3 × 12 | — | — | reps puis charge | accessoire |
| Planche ou hollow hold | 3 × 40 s | — | — | + durée | accessoire |
| Finisher (optionnel) | Fentes marchées 3×20 pas + Mollets 3×20 | — | — | — | finisher |

**VENDREDI — Volume haut du corps (violet #a878ff)** · échauffement : cardio léger + bandes.
| Exercice | Séries × Reps | Type |
|---|---|---|
| Traction (corps ou +5/10 kg, tempo lent) | 4 × 6-8 | volume |
| Muscle-up technique (sans lest) | 4 × 3 | skill |
| Dips poids de corps | 4 × 10 | volume |
| Élévations latérales | 3 × 15 | accessoire |
| Superset curl + extension triceps | 3 × 12/12 | accessoire |
| Toes-to-bar / relevés de jambes | 3 × 10 | accessoire |
| Finisher (optionnel) | Farmer carry 4 × 30-40 m | finisher |

### 3.3 Attributs & modèle de données
- ⭐ **Modèle de données chiffré et structuré** : stocke TOUTES les valeurs en **nombres** (reps, séries, charges en kg, RPE, secondes), jamais en texte d'affichage — sinon impossible de calculer tonnage et progressions. Ajoute un **`schemaVersion` + migration** dès le départ.
- **Couleurs par séance** : tirage bleu, poussée ambre, jambes vert, volume violet.
- **Types de séances spéciales** : **jour de test (S11)** = tentative de PR (règle stricte) · **décharge (S5, S9)** = aucune cible de perf, volume −40 %, **finishers masqués** · **dips** = forme stricte, montée bloquée si douleur épaule.
- **Mantra de coach à afficher** : « La régularité bat l'intensité. Un plan suivi à 85 % écrase un plan parfait abandonné. »

### 3.4 ⭐ MOTEUR D'AUTORÉGULATION (le cœur intelligent — méthode SSBS)
À implémenter strictement. Après chaque séance, pour **chaque mouvement principal**, calcule le poids suggéré de la **prochaine** séance et **pré-remplis-le** (modifiable) :
- Toutes les séries au nombre de reps prescrit **ET** RPE max ≤ RPE cible → **+ incrément**.
- Reps réussies mais RPE = cible +0,5 à +1 → **garder le même poids**.
- Reps manquées **OU** RPE ≥ cible +1,5 → **garder + flag « répète, soigne la forme »**. Échec marqué 2 séances de suite → suggérer **−5 %**.
- Incréments : traction/dips/chin-up **+1,25 kg** · squat **+2,5 kg** · soulevé **+2,5 (ou +5 si RPE ≤ 7)**.
- **Dips :** jamais de montée si une **douleur épaule > 3/10** a été loggée → « on garde, priorité forme/épaule ».
- Accessoires : double progression (ajoute des reps dans la fourchette, puis de la charge).

---

## 4. FONCTIONNALITÉS

### 4.1 Aujourd'hui / Prochaine séance
Séance du jour selon le calendrier (tag, couleur, phase, compte à rebours), poids **pré-remplis par l'autorégulation**. Gère **repos / test / décharge** (pas de bouton Démarrer les jours off) et l'état **« programme terminé »**.

### 4.2 Mode exécution (cœur de l'usage)
Affichage exercice par exercice avec **cases à cocher par série** ; **chrono global** ; ⭐ **écran toujours allumé (Wake Lock)** ; ⭐ **minuteur de repos automatique** (réglable, ex. 3 min sur les principaux, 60-90 s sur les accessoires) ; **bips audio** + **vibration** en fin de repos (mute global) ; affichage de la **note de coach** ; saisie fin de séance : **RPE par exercice principal**, **ressenti épaule (0-10)**, énergie, note libre. Bouton **complétée / abandonnée + raison**. ⭐ **Check-in rapide avant la séance (optionnel, un geste)** : sommeil (h), énergie (1-5), courbatures (1-5) — alimente la détection de fatigue.

### 4.3 Saisie des métriques
Champs : **charge (kg) + reps réalisées + RPE** par série des mouvements principaux ; reps/charge pour les accessoires. **Cardio / montre : OPTIONNEL** — si l'utilisateur n'a pas de montre cardio, ne pas afficher cette section. Si activé : FC moy/max, import `.FIT`/`.CSV` sans serveur, croisement FC vs RPE.

### 4.4 Journal & historique
Séances horodatées, filtrables par séance et par phase.

### 4.5 Système de DISCIPLINE (priorité — attaque mon vrai point faible)
⭐ **Streak** · ⭐ **% d'adhérence avec ligne d'objectif à 85 %** · ⭐ **calendrier heatmap** (fait / manqué / repos-décharge / à venir) · badges de jalons. **Garde-fou « jamais deux d'affilée »** : si la dernière séance prévue est manquée, bannière douce « Ne saute pas deux séances de suite — même la version courte compte ». **Bouton « Pas de jus aujourd'hui »** → propose la **version 20 min** (mouvement principal + 1 accessoire). **Ton encourageant, jamais culpabilisant** (un jour manqué n'est pas un échec, cadrage 85 %).

### 4.6 Moteur de progression & amélioration
**Charge, reps, tonnage (kg × reps), PR par exercice, 1RM estimé (Epley)**, surcharge progressive via l'autorégulation (§3.4). **Détection de régression/plateau** (même poids + RPE élevé sur 3 séances → suggère mini-décharge ou focus technique). **Projection d'objectif** : « dans les temps / en retard » par cible pour le 30 août.

### 4.7 Onglet « Mon programme » (référence intégrée — plus jamais besoin du PDF)
**Intègre directement et fidèlement TOUT le contenu du document source joint** (`Programme_Street_Lifting…html`), en **lecture seule**, pour que l'utilisateur ait son programme complet dans l'app sans jamais rouvrir le PDF/HTML. L'onglet contient, en sections navigables :
- **Les 4 séances en détail** (cartes dépliables, couleur par séance) : échauffement spécifique, chaque exercice avec **séries × reps × RPE cible × charge de départ × note de coach**, et le finisher — chaque séance **lançable directement** en mode exécution (§4.2).
- **L'arc des 11 semaines** (phases, décharges S5/S9, tests S11).
- **La nutrition recomp** (cibles jours d'entraînement / repos, journée type, garde-manger).
- **Le système de discipline** (règle 85 %, « jamais deux d'affilée », séance minimum 20 min).
- **L'optimisation & garde-fous épaule** (sommeil, récup, gestion de l'épaule, erreurs à éviter, indicateurs).
- **Les objectifs** (planchers réalistes / stretch + bascule Hyrox après le 30 août).

### 4.8 Stats & visualisations
Courbes des charges / 1RM estimé dans le temps (SVG/canvas natif) + **section Records/PR** + meilleur streak.

### 4.9 Nutrition (LÉGÈRE) + mesures corporelles & bilan hebdo
- **Nutrition volontairement légère — PAS de compteur de calories** (l'utilisateur a déjà abandonné ce type de suivi). Affiche seulement : **cible du jour** selon le type (entraînement **2500 kcal / 160 P / 320 G / 65 L** · repos **2100 / 160 / 230 / 60**), **case « protéines atteintes »**, et la **tendance du poids de corps**.
- **Poids de corps** en **moyenne mobile hebdo** (pas de chiffre brut quotidien) + aide à l'ajustement recomp (poids ~stable + tour de taille qui baisse = ça marche). **Tour de taille** (toutes les 2 semaines), **photos de progression (IndexedDB)** mensuelles avec comparaison côte à côte.
- ⭐ **Bilan hebdomadaire automatique** (chaque dimanche) : charges qui montent/stagnent, tendance RPE, % d'adhérence, tendance poids, état épaule, **+ une phrase de coaching actionnable**.
- ⭐ **Logs quotidiens rapides (optionnels, un geste)** : sommeil (h), pas, hydratation (L) — ils alimentent le bilan hebdo et la détection de fatigue/récup. (Les pas = ton meilleur levier de sèche pour le côté veineux, sans fatigue en plus.)

### 4.10 Réglages
Préférences, toggles (son/vibration/cardio), durées de repos par défaut, **sauvegarde/restauration**, rappel de sauvegarde.

### 4.11 Bilan final du programme (30 août)
Écran « diplôme » récapitulant l'arc complet (perfs début → fin par mouvement, adhérence, meilleur streak, tonnage cumulé), export/partage, puis **proposition de bascule vers un bloc Hyrox**.

---

## 5. RÈGLES PAR TYPE DE SÉANCE
- **Jour de test (S11)** : tentative de PR, pas de cible imposée, on enregistre le meilleur.
- **Décharge (S5, S9)** : aucune cible de perf, volume −40 %, **finishers masqués**, bannière « on récupère ».
- **Dips** : montée de charge **bloquée si douleur épaule > 3/10** ; priorité forme stricte.
- **Séances normales** : autorégulation §3.4 active.

---

## 6. GARDE-FOUS SANTÉ & COHÉRENCE
- **Épaule (zone à risque n°1)** : champ **ressenti épaule 0-10** sur les jours poussée/tirage, rappel **« STOP si douleur > 3/10 »**, et **rappel récurrent « fais voir ton épaule à un kiné »** tant que ce n'est pas coché « bilan fait ».
- **Hyrox après le 30 août** : si fatigue/récup dégradée plusieurs jours (sommeil bas, énergie basse, RPE en hausse) → **alerte « envisage une décharge / un jour de repos »**. Ne pas pousser à se cramer avant le bloc Hyrox.
- **Rappel d'échauffement** avant chaque séance. **Matériel/lieu** : salle complète + barre traction/dips.

---

## 7. DESIGN & UX
- **Thème sombre** (fond ~#0e0e11), **accent ambre #e8a33d**, **une couleur par séance** (bleu/ambre/vert/violet), titres en **police condensée sportive** (Oswald/Anton), corps lisible (Barlow). Esthétique « carnet d'athlète premium ».
- **Mobile-first** (utilisable en plein effort), **gros boutons tactiles**, lisible d'un coup d'œil.
- Navigation : **Aujourd'hui · Calendrier · Programme · Historique · Stats · Réglages** (+ Mesures). Éviter de multiplier les onglets (regrouper Records dans Stats). L'onglet **Programme** = la référence complète intégrée (§4.7).
- **Zéro friction pour logger** : ouverture directe sur la séance du jour, série loggée en **3 taps max**, tout pré-rempli.

---

## 8. CONTRAINTES TECHNIQUES (ne pas changer)
- **PWA hébergée sur GitHub Pages** (HTTPS, une seule URL) : **ouvrable sur PC** (installable bureau) et **installable sur iPhone** (écran d'accueil, plein écran), **hors-ligne** après la 1ʳᵉ visite.
- Livrables : `index.html`, `manifest.json`, `sw.js` (cache hors-ligne), dossier `icons/` (180/192/512), `README.md` d'installation. Balises iOS (`apple-mobile-web-app-capable`, `apple-touch-icon`…). **Icône** : fond sombre, motif barre de traction/haltère, accent ambre ; nom court `SSBS`.
- ⭐ **Données chiffrées structurées** + **`schemaVersion` + migration** ; **code modulaire et commenté** (données / logique / UI séparées) pour étendre sans casse.
- Persistance **`localStorage`** (données) + **IndexedDB** (photos). **Export/Import JSON + export CSV + rappel de sauvegarde** (le cache iOS peut être purgé).
- **APIs avec repli propre, sans bloquer l'app** : Wake Lock, Web Audio, Vibration, Notifications (repli alerte in-app).
- **Aucun serveur**, aucune base externe. Graphiques en **SVG/canvas natif** (pas de CDN requis pour le hors-ligne).

---

## 9. CRITÈRES DE RÉUSSITE
1. Je vois en 1 coup d'œil ma prochaine séance, ma phase et mon streak.
2. Je logge une séance complète sans friction (écran allumé, minuteur de repos, RPE).
3. Avant chaque séance, l'app me donne une **charge cible chiffrée** (autorégulation).
4. Mon historique survit fermeture / mise à jour / changement d'appareil (localStorage + export).
5. L'app est **ouvrable sur PC et installable sur iPhone, hors-ligne**.
6. Design cohérent et soigné ; code **modulaire à schéma versionné**.

---

## 10. ROBUSTESSE, CAS LIMITES & PRÉCISIONS TECHNIQUES (à respecter)
- **Polices hors-ligne :** ne PAS dépendre du CDN Google Fonts (l'app doit marcher hors-ligne) → embarque les polices localement OU prévois un repli sur polices système (condensée type Oswald → fallback `Arial Narrow` / `system-ui`).
- **Premier lancement :** court onboarding qui confirme la **date de départ (15 juin 2026)** et les **charges de départ** du §3.2 (modifiables), puis calcule automatiquement la **semaine et la phase courantes** depuis cette date.
- **Édition libre :** permettre de **corriger ou supprimer** n'importe quelle entrée passée (faute de saisie), et de **logger une séance à n'importe quelle date** — ne PAS verrouiller au jour du calendrier (l'utilisateur a démarré en milieu de semaine, la vie réelle décale).
- **Autorégulation — cas de départ :** pour la **1ʳᵉ séance** de chaque mouvement, utiliser la charge de départ du §3.2 ; ensuite seulement, calculer depuis la dernière séance loggée.
- **Décharge (S5, S9) — mécanique précise :** réduire les séries d'~40 % (ex. 4×4 → 2-3 séries), charges légères (~RPE 5-6), **autorégulation en pause** (aucune montée proposée), finishers masqués.
- **Granularité de charge :** pas de **+1,25 kg** (microplaques), arrondis cohérents.
- **iOS — limites à gérer proprement :** les **notifications push sont peu fiables sur PWA iOS** → rappels **in-app en priorité**, jamais bloquants. Le **stockage local peut être purgé par iOS** → rappel de sauvegarde régulier (hebdo). **Wake Lock** avec repli silencieux s'il n'est pas supporté.
- **Date/heure :** « aujourd'hui » et le calcul de semaine se basent sur la **date locale** de l'appareil.

> **CONSIGNE FINALE.** Construis l'app complète et fonctionnelle de bout en bout, prête à pousser sur GitHub Pages, **sans reposer de questions**.
> **OPTION DE PHASAGE (pour préserver la simplicité).** Si l'app devient volumineuse, livre d'abord un **NOYAU** = Aujourd'hui + Mode exécution (Wake Lock, minuteur, cases, RPE) + Autorégulation + Log + Discipline (streak/adhérence/heatmap/garde-fous) + PWA hors-ligne. Puis les **EXTENSIONS** = Stats avancées, Nutrition légère, Mesures/photos, Bilan hebdo, Bilan final, cardio optionnel.
