# SSBS · Street Lifting — App de suivi (PWA)

Application web **installable sur iPhone** et **100 % hors-ligne** pour suivre et faire progresser
le programme Street Lifting de 11 semaines, avec le **moteur d'autorégulation SSBS** intégré.

- **Aucun serveur, aucun compte.** Données 100 % locales (localStorage).
- **Aucune dépendance CDN** : polices système, code maison. Le hors-ligne marche pour de vrai.
- **Pré-chargée** avec ton programme et tes baselines : utilisable dès la 1ʳᵉ ouverture.

---

## 1. Lancer en local

Le Service Worker et les modules ES nécessitent `http://` (pas `file://`). Un serveur statique
sans dépendance est fourni :

```bash
npm run serve
# → http://localhost:8080
```

Alternatives si tu préfères :

```bash
npx http-server -p 8080      # nécessite Node + npx
python -m http.server 8080   # si tu as Python
```

Ouvre ensuite **http://localhost:8080** dans le navigateur.

## 2. Lancer les tests

Tests automatisés sur la **logique critique** (moteur d'autorégulation, persistance, semaine/phase,
1RM, adhérence, garde-fou). Aucune dépendance — runner natif de Node :

```bash
npm test
# équivaut à : node --test
```

> 38 tests ciblés couvrent : tous les cas RPE par mouvement, 1ʳᵉ séance → charge de départ,
> reps manquées → maintien, douleur épaule > 3/10 sur dips → pas de montée, 2 échecs d'affilée → −5 %,
> soulevé +5 si RPE ≤ 7 (sinon +2,5), **forme basse (readiness) → pas de montée**, autorégulation en
> pause en décharge S5/S9, Epley (1RM), **progression de charge de travail**, **projection vers le
> 30 août**, **double progression accessoires**, calcul semaine/phase depuis le 15 juin (11 semaines,
> tests S11), adhérence, garde-fou
> « jamais deux d'affilée », sauvegarde→rechargement, export/import JSON, export CSV, migration/intégrité
> (ne bloque jamais le démarrage).

## 3. (Re)générer les icônes

Les icônes PNG sont déjà dans `icons/`. Pour les régénérer (encodeur PNG maison, sans dépendance) :

```bash
npm run icons
```

---

## 4. Déployer sur GitHub Pages

L'app est 100 % statique → GitHub Pages suffit. Tout doit rester **à la racine** du dépôt.

1. **Crée un dépôt** GitHub (ex. `ssbs-street-lifting`), public ou privé.
2. **Pousse les fichiers** (depuis ce dossier) :
   ```bash
   git init
   git add .
   git commit -m "App SSBS Street Lifting (PWA)"
   git branch -M main
   git remote add origin https://github.com/<ton-pseudo>/ssbs-street-lifting.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages**.
4. **Build and deployment → Source : _Deploy from a branch_**.
5. **Branch : `main`** · **Folder : `/ (root)`** → **Save**.
6. Attends ~1 min. L'URL s'affiche en haut de la page Pages :
   `https://<ton-pseudo>.github.io/ssbs-street-lifting/`
7. **Ouvre cette URL sur ton iPhone (Safari)** et installe-la (voir ci-dessous).

> Les chemins sont **relatifs** (`./js/...`, `start_url: "."`, `scope: "."`), donc l'app fonctionne
> aussi bien à la racine d'un domaine que dans un sous-dossier `…github.io/<repo>/`. Rien à modifier.

> **Mise à jour** : après un nouveau `git push`, incrémente la version du cache dans `sw.js`
> (`const CACHE = 'ssbs-v2';`) pour forcer le rafraîchissement hors-ligne sur les appareils déjà installés.

---

## 5. Installer sur iPhone (écran d'accueil, plein écran, hors-ligne)

1. Ouvre l'URL dans **Safari** (pas Chrome — l'ajout à l'écran d'accueil iOS passe par Safari).
2. Touche le bouton **Partager** (carré avec flèche ↑).
3. **« Sur l'écran d'accueil »** → **Ajouter**.
4. L'icône ambre apparaît sur l'écran d'accueil. Ouvre-la : elle démarre **en plein écran**.
5. **Première ouverture en ligne obligatoire** (le Service Worker met l'app en cache). Ensuite,
   elle fonctionne **entièrement hors-ligne**, y compris en salle sans réseau.

---

## 6. ✅ Checklist de QA manuelle (ce qui ne se teste pas en unitaire)

À faire une fois sur l'iPhone cible avant de t'y fier en salle :

- [ ] **Installation** : l'icône s'ajoute bien à l'écran d'accueil et l'app s'ouvre en plein écran
      (pas de barre Safari).
- [ ] **Hors-ligne** : après la 1ʳᵉ visite, active le **mode Avion** puis rouvre l'app → elle se charge
      et reste navigable (onglets, Programme, démarrer/logguer une séance).
- [ ] **Écran toujours allumé** : démarre une séance, ne touche pas l'écran 1-2 min → il ne s'éteint pas
      (Wake Lock ; iOS 16.4+). S'il s'éteint, vérifie Réglages → *Garder l'écran allumé* dans l'onglet Bilan.
- [ ] **Minuteur de repos** : valide une série → le minuteur démarre tout seul, décompte, bipe/vibre à 0,
      et les boutons **+30 s / Passer** marchent.
- [ ] **Logger une séance en < 1 min** : charge déjà suggérée + RPE pré-coché à la cible →
      « ✓ Valider toutes les séries » sur chaque exercice → « Terminer ». Chronomètre-toi.
- [ ] **Autorégulation** : après une séance bouclée au RPE cible, rouvre la même séance → la charge
      suggérée a monté (ex. traction +17,5 → +18,75). Si tu rates des reps → elle est maintenue.
- [ ] **Épaule (dips)** : mets la douleur du jour à 4/10 sur la séance Poussée → la suggestion dips
      affiche « pas de montée » même avec une perf parfaite.
- [ ] **Sauvegarde** : onglet Bilan → **Export JSON**, puis **Réinitialiser**, puis **Import JSON** →
      tes données reviennent. Pense à exporter régulièrement (les données vivent sur l'appareil).
- [ ] **Calculateur de disques** : en séance, le squat/SDT affiche « barre 20 + … /côté » et se met à jour quand tu changes la charge.
- [ ] **Suivi quotidien** : onglet Mesures → ajoute poids, pas, sommeil ; la moyenne 7 j s'affiche.

---

## 7. Choix de conception (et réconciliation des 2 documents source)

Le cahier des charges (`PROMPT_App_Suivi_Street_Lifting.md`) et le programme
(`Programme_Street_Lifting_11_Semaines.html`) divergent sur quelques points. Conformément à la
consigne « prends le plus simple et note-le », voici les arbitrages :

| Sujet | Décision | Raison |
|---|---|---|
| **Date de départ** | **lundi 15 juin 2026** | Date du HTML + des tests demandés ; le 15 juin **est un lundi**, ce qui cale le programme (Lundi = 1ʳᵉ séance). |
| **Durée / arc** | **11 semaines** (15 juin → 30 août), décharges **S5 & S9**, **S10 intensification, tests S11** | Les deux fichiers concordent désormais : 11 semaines, tests S11. |
| **Ordre Lundi** | **Muscle-up en 1ᵉʳ**, puis traction lestée | Le MU est le mouvement le plus technique/explosif : il doit être fait frais (cf. programme mis à jour). |
| **Séances suivies** | **4 séances de force** (Lun/Mar/Jeu/Ven), **aucun HIIT** | Le cahier des charges l'impose ; le HIIT est suivi ailleurs. Les 4 séances sont identiques dans les deux fichiers. |
| **Dips — règle épaule** | Montée bloquée si **douleur > 3/10** ; avertissement dès > 0 | Règle explicite du §3.4 + « douleur > 3/10 » du programme. Sécurité d'abord. |
| **Incréments** | traction/dips/chin-up **+1,25** · squat **+2,5** · **soulevé +2,5 (ou +5 si RPE ≤ 7)** · muscle-up **+2,5** | Règle §3.4 : le soulevé prend le gros incrément quand la séance était facile. |
| **1RM estimé** | **Epley sur la charge externe** (kg lestés pour la callisthénie, barre pour squat/SDT), **ajusté au RPE** (reps en réserve = 10 − RPE) | Reproduit les baselines du programme (ex. traction +30 → ~+32). |
| **Suivi épaule** | Séances **Lundi, Mardi, Vendredi** (push **et** muscle-up) | Le cahier des charges : « à chaque séance push et muscle-up ». |
| **Polices** | **Repli système** (pas de CDN) : stack condensée pour les titres, system-ui pour le corps | Garantit le vrai hors-ligne. Le rendu « athlétique » tient via majuscules + graisse + interlettrage. |
| **RPE par série** | **un RPE par exercice** appliqué à ses séries (ajustable) | Zéro friction : logger reste < 1 min. Le moteur évalue toutes les séries ≤ cible. |
| **Photos** | **retirées** (choix de l'athlète) | Remplacées par le suivi pas + sommeil. Le code IndexedDB a été retiré ; les photos se font via la pellicule du téléphone. |
| **Barres de progression** | **charge de travail ET 1RM estimé** affichés | La charge de travail (départ → cible ~S11) est plus motivante au quotidien ; le 1RM estimé garde la vision long terme. |
| **Soulevé — gros incrément** | +5 kg si la dernière séance était à **RPE ≤ 7** | Règle §3.4 ; sinon +2,5 kg. |
| **Décharge (S5/S9)** | l'app **réduit vraiment** : ~−40 % de séries + charge ~−15 % | Une décharge réelle, pas juste une bannière. |

### Intégrité des données
Au chargement, `migrate()` vérifie le `schemaVersion`, complète les champs manquants, normalise/écarte
les entrées invalides et **ne jette jamais** : un stockage corrompu repart sur des données par défaut
plutôt que de bloquer l'app. Le squelette de migration par paliers est prêt pour les versions futures.

---

## 8. Structure du projet

```
index.html              coquille de l'app + styles (thème sombre ambre, mobile-first)
manifest.json           PWA : nom, icônes, standalone, theme-color
sw.js                   Service Worker (precache + cache-first, hors-ligne)
icons/                  icônes 180 / 192 / 512 (+ maskable) — haltère + wordmark « SSBS », ambre sur fond sombre
js/
  app.js                contrôleur UI (onglets, mode exécution, Wake Lock, minuteur de repos)
  engine.js             ★ logique pure : autorégulation SSBS, Epley, semaine/phase, adhérence, garde-fou
  program.js            contenu du programme (4 séances, baselines, arc, nutrition, discipline…)
  storage.js            persistance locale, migration/intégrité, export/import JSON, export CSV
tests/
  engine.test.mjs       tests du moteur + logique
  storage.test.mjs      tests de persistance / export / migration
tools/
  gen-icons.mjs         générateur d'icônes (PNG sans dépendance)
  serve.mjs             serveur statique local
package.json            scripts : test / serve / icons
```

---

## 9. Fonctionnalités

**Noyau** — Aujourd'hui (séance du jour, streak, adhérence cible 85 %, garde-fou « jamais deux d'affilée »,
phrase d'accueil) · Mode exécution (écran allumé, **minuteur de repos plein écran** auto, saisie ultra-rapide
avec perf précédente, **rappel d'échauffement**, **calculateur de disques**, **finishers loggables**,
**réordonner / ajouter / retirer un exercice** en séance) · Autorégulation SSBS (charge suggérée selon le RPE
loggé, **ajustée à la readiness**, **double progression sur les accessoires**) · PWA hors-ligne.

**Suivi EN DIRECT (en séance)** — **aperçu des charges du jour** sur Aujourd'hui (précharge la barre) ·
**anneau de progression** + **tonnage live** · **feedback série par série** vs la dernière fois (↑ / = / ↓) ·
**record (PR) en direct 🏆** · **minuteur de repos plein écran** (gros chiffres + prochaine série) ·
**écran récap de fin** (tonnage, durée, PR, charges montées) · validation 1-tap, ré-édition d'une série ·
**reprise de séance auto** (si l'app se ferme en pleine séance, tu reprends où tu en étais).

**Coaching intelligent** — substitutions auto si **douleur épaule > 3/10** · **décharge réelle** (S5/S9 :
−40 % de séries, charge allégée) · **auto-décharge anticipée** si fatigue (readiness basse + RPE qui grimpe) ·
**verdict recomp automatique** (poids + charges) · **réordonner / ajouter / retirer un exercice** en séance ·
jour de test S11 (mode PR).

**Données & sécurité** — **« M'envoyer ma sauvegarde »** (partage iOS en 1 tap) + rappel de sauvegarde ·
Export/Import JSON · Export CSV · 100 % local, aucun compte.

**Extensions** — **Journal par semaine** (navigation ◀ ▶ : toutes les séances d'une semaine avec perfs
détaillées + **finishers**, résumé hebdo séances/tonnage, + poids/pas/sommeil/nutrition de chaque jour ;
suppression d'une entrée) · Stats (**Mes progrès depuis le départ** avec PR 🏆, **records personnels**,
**projection vers le 30 août**, 1RM estimé + **courbes SVG** + **double barre charge de travail / 1RM**,
tonnage/semaine, alerte tendance RPE — **100 % automatique, rien à saisir**) · Mesures (poids du matin +
**courbe** moy. 7 j, **pas**, sommeil, douleur épaule + alerte, nutrition recomp) · Bilan (résumé hebdo +
**badges/jalons** + **heatmap 11 semaines** + rappel kiné + bilan final S11).

Navigation (6 onglets) : **Aujourd'hui · Journal · Programme · Stats · Mesures · Bilan**.

Détails intégrés du programme dans l'onglet **Programme** : 4 séances avec **tempo + légende des tempos**,
arc des 11 semaines, nutrition, discipline, optimisation/épaule, objectifs. Logging à **n'importe quelle date**
(back-dating dans l'écran « Terminer »).

> *La version que tu suis bat la version parfaite que tu abandonnes.*
