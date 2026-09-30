# 0001. Mise uniforme, 8 cases et pause 90 secondes

**Date**: 2026-09-30
**Status**: In Progress

## Summary

Tu passes à une mise fixe de 200 pour tout le cycle, même après une perte. La prédiction affiche 8 cases pour viser la cote 3.17 (la cote est le multiplicateur appliqué à ta mise). Après chaque tour, la prochaine prédiction reste verrouillée pendant 1 minute 30 avec un compte à rebours. Le système stop loss (la limite de perte qui bloque la session) reste strictement inchangé.

## Requirements

**User stories**:
* En tant que joueur, je veux une mise fixe de 200 sur tout le cycle afin de lisser mes mises même après une perte
* En tant que joueur, je veux une prédiction de 8 cases visant la cote 3.17 afin de suivre une cible claire
* En tant que joueur, je veux une pause de 1 minute 30 après chaque tour afin de rester discipliné

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
* **AC-1**: la mise jouée vaut `baseBet` (200 par défaut, réglable en réglages) du début à la fin du cycle, après un gain comme après une perte, dans le Dashboard et dans le Simulateur
* **AC-2**: la prédiction affiche 8 cases et annonce la cible cote 3.17 avec 3 mines, dans le Dashboard et comme référence dans le Simulateur
* **AC-3**: les patterns optimaux du Dashboard sont adaptés à 8 cases en gardant leur esprit (coins plus bords) avec scores mis à jour
* **AC-4**: les invites Gemini demandent 8 cases au lieu de 6, pour la capture comme pour le conseil stratégique
* **AC-5**: après chaque tour (gain ou perte), la prochaine prédiction est verrouillée pendant 90 secondes avec grille masquée et compte à rebours `mm:ss`
* **AC-6**: la fin de pause est persistée en local storage via `nextPredictionAt`, donc un reload reprend la même échéance au lieu de repartir à zéro
* **AC-7**: tout le système stop loss reste identique (seuils, blocage de session, blocage retrait, modale prioritaire sur la pause)
* **AC-8**: l affichage martingale (paliers de mises) est remplacé par une carte mise fixe avec profit de session et perte cumulée du cycle

## Decision

**Chosen option**: Option 1: Mise uniforme plus 8 cases plus pause 90 secondes

Tu passes tout le projet en mise fixe, prédiction à 8 cases pour la cote 3.17, et pause verrouillée de 90 secondes après chaque tour.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `tailwind-design-system` (`wshobson/agents`, `.agents/skills/tailwind-design-system/`)

## Rationale

Reasoning and options: see rationale.md.

## Feature design

**Data model sketch**:
* `AppState.baseBet` réutilisé comme mise fixe du cycle (nombre, requis, 200 par défaut, réglable en réglages)
* `AppState.nextPredictionAt` ajouté (timestamp en millisecondes, optionnel, absent veut dire prédiction prête, persisté dans `mines_pro_state`)
* `AppState.martingaleFactor` conservé mais non utilisé pour le calcul de mise (compatibilité des états stockés, suppression décidée plus tard)
* Patterns optimaux en dur dans `src/components/Dashboard.tsx`, chaque entrée étendue à 8 indexes de 0 à 24 avec score mis à jour
* Aucune table nouvelle, aucune migration de données, l ancien état stocké reste lisible (pause absente veut dire déverrouillé)

**State transitions** (if applicable):
* Prédiction: prête → verrouillée (au log d un tour) → prête (à `nextPredictionAt` atteint)
* Tour Dashboard: saisie du résultat (gagné ou perdu) → pause prédiction 90 secondes → prédiction visible
* Tour Simulateur: démarrage → jeu → cashout ou mine (cashout veut dire encaisser le gain) → pause prédiction 90 secondes → prédiction visible
* Session: en cours → bloquée (objectif, stop loss, 30 tours, attente) avec modale prioritaire sur l affichage de pause

**API surface**:
| Action | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|
| `logTurn` Dashboard | résultat gagné ou perdu | enregistrement + `nextPredictionAt` à now plus 90 secondes | aucune (app locale) | état bloqué, saisie ignorée |
| `startGame` Simulateur | mise `baseBet` | grille neuve, 3 mines posées | aucune | solde virtuel insuffisant, démarrage refusé |
| `cashout` Simulateur | étoiles révélées 1 à 10 | gain au multiplicateur, `nextPredictionAt` à now plus 90 secondes | aucune | zéro étoile, encaissement refusé |
| `hitMine` Simulateur | case minée | défaite, `nextPredictionAt` à now plus 90 secondes | aucune | état non playing, clic ignoré |
| `tick` minuteur | `nextPredictionAt`, horloge locale | compte à rebours `mm:ss`, déverrouillage à échéance | aucune | horloge incohérente, verrou conservé par prudence |

**Value sourcing** (every value each action produces, computes, or displays names where it comes from; a required value with no named source is an undecided input, resolve it before this spec is done, do NOT leave the build to invent it):
| Action | Value produced / displayed | Source |
|---|---|---|
| `logTurn` | montant joué constant | `AppState.baseBet` |
| `logTurn` | profit si gagné | dérivé de `baseBet` fois multiplicateur 8 étoiles moins `baseBet` |
| `logTurn` | 8 cases affichées | patterns adaptés en dur ou réponse Gemini à 8 cases |
| `logTurn`, `cashout`, `hitMine` | échéance de pause | dérivé de now plus 90 secondes, stocké en `nextPredictionAt` |
| `tick` | compte à rebours affiché | dérivé de `nextPredictionAt` moins now, format `mm:ss` |
| `cashout` | gain encaissé | dérivé de mise fois table `MULTIPLIERS` à N étoiles (N libre de 1 à 10) |
| Session | profit et perte cumulée du cycle | dérivé de `realBalance` moins `sessionStartBalance` et historique |
| Session | blocage stop loss | seuils et flags existants, inchangés |

**Key invariants**:
* La mise jouée vaut toujours `baseBet` pendant un cycle, jamais une valeur multipliée par les pertes
* La prédiction montre toujours 8 cases quand elle est déverrouillée
* `nextPredictionAt` absent ou dépassé veut dire prédiction visible, jamais de verrou fantôme
* Les règles stop loss, objectifs, 30 tours et retraits restent celles du code actuel

**Security model**:
Aucune surface réseau nouvelle, app 100 pour 100 locale. La clé Gemini perso reste dans l état et le local storage comme aujourd hui, à traiter comme sensible. Pas de scope réglementaire nouveau.

**Configuration required**:
Aucune variable nouvelle. `GEMINI_API_KEY` existant réutilisé.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
* Happy path: log d un gain à 200 avec 8 cases affichées et pause 90 secondes qui se déverrouille, verifies **AC-1**, **AC-2**, **AC-5**
* Failure case: reload pendant la pause puis retour, l échéance est conservée et le compte reprend, verifies **AC-6**
* Failure case: série de 3 pertes, la mise reste à 200 à chaque tour, verifies **AC-1**
* Auth/permission: sans objet (app locale sans rôles), la clé custom reste locale et non exposée, verifies **AC-7**
* Edge: objectif ou stop loss atteint pendant la pause, la modale passe devant et la pause reprend après, verifies **AC-7**

## Build plan

1. Ajouter `nextPredictionAt` à `AppState` avec relecture tolérante de l ancien état stocké (absent veut dire prêt), satisfies **AC-6**
2. Basculer le Dashboard en mise fixe `baseBet` avec carte mise fixe plus profit et cumul, profit gagnant au barème 8 étoiles, satisfies **AC-1**, **AC-8**
3. Étendre les patterns optimaux à 8 cases avec scores et libellés mis à jour, satisfies **AC-2**, **AC-3**
4. Mettre à jour les invites Gemini (capture et conseil) pour demander 8 cases avec repli par défaut à 8 cases, satisfies **AC-4**
5. Ajouter le verrou prédiction 90 secondes au Dashboard (déclenché au log gagné ou perdu, grille masquée, compte `mm:ss`, persisté), satisfies **AC-5**, **AC-6**
6. Basculer le Simulateur en mise fixe `baseBet` avec cible libre 1 à 10 et même verrou 90 secondes au cashout et à la mine, satisfies **AC-1**, **AC-2**, **AC-5**, **AC-6**
7. Garantir la priorité modale session sur l affichage de pause et le stop loss inchangé de bout en bout, satisfies **AC-7**
8. Vérifier l ensemble (`pnpm lint`, `pnpm build`, parcours manuel des AC), satisfies **AC-1** à **AC-8**

## Consequences

**Positive**:
* Mises prévisibles et risque lissé sur tout le cycle
* Une seule cible (8 cases, cote 3.17) partagée par le réel, le virtuel et l IA
* Pause imposée et persistée qui soutient la discipline

**Negative / tradeoffs**:
* Récupération plus lente après une série de pertes, sans montée de mise
* Patterns à 8 cases non validés par une simulation neuve, efficacité incertaine
* Verrou limité à la prédiction, un joueur peut toujours logger vite

**Neutral**:
* `martingaleFactor` reste en état sans effet, à nettoyer dans une spec ultérieure
* L historique stocké garde son format, les anciennes sessions restent lisibles

## Follow-up

* [ ] Lancer une vraie simulation pour valider ou remplacer les patterns à 8 cases et leurs scores
* [ ] Observer l usage du verrou prédiction seule, envisager un verrou tour complet si la discipline reste faible
* [ ] Décider du sort de `martingaleFactor` (suppression du champ et des réglages liés)
* [ ] Enroller la feature miroir dans `docs/scope/` pour lier cette spec au suivi de build

## Migration plan

**Strategy**: no migration needed
**Phases**:
1. Livraison unique, champ `nextPredictionAt` additif avec défaut déverrouillé, ancien local storage relu sans perte
**Rollback**: revert du commit, l état stocké reste lisible par l ancien code (champ inconnu ignoré, patterns anciens restaurés)
**Risks**: horloge locale modifiée pendant une pause (verrou conservé par prudence), double écriture du timer entre les deux vues (source unique `nextPredictionAt` comme garde)
