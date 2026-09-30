# Rationale: 0001. Mise uniforme, 8 cases et pause 90 secondes

## Context

> ⚠️ Premise note: verrouiller la prédiction seule laisse les boutons de log actifs, donc un joueur rapide peut enchaîner les tours sans voir la prochaine prédiction. Si ton but est la discipline, ce réglage peut ne pas suffire et tu devras peut être verrouiller tout le tour plus tard. De plus, adapter les patterns actuels à 8 cases sans nouvelle simulation reste une heuristique (une règle pratique non mesurée), pas un avantage prouvé.

Aujourd hui le Dashboard calcule chaque mise avec une formule martingale (la mise grimpe après chaque perte en multipliant par un facteur). Le Simulateur fait pareil avec des valeurs figées à 500 et facteur 1.5. La prédiction affiche 6 cases. Tu veux lisser le risque avec une mise constante, viser une cote plus haute avec 8 cases, et imposer une pause entre les tours.

Les forces en jeu sont simples. L app est locale avec persistance en local storage (le stockage du navigateur qui survit au reload). L UI est en français avec un thème sombre. Les deux vues partagent les types de `src/types.ts`. L IA Gemini fournit des conseils au format JSON avec repli par défaut en cas d échec.

## Options considered

### Option 1: Mise uniforme plus 8 cases plus pause 90 secondes

Passer en mise fixe `baseBet` sur les deux vues, étendre les patterns à 8 cases, demander 8 cases à Gemini, et verrouiller la prédiction 90 secondes après chaque tour avec persistance.

**Pros**:
* Risque lissé et lisible, une seule valeur à suivre
* Cible unique et cohérente entre réel et virtuel
* Pause imposée qui freine l enchaînement des tours

**Cons**:
* Sans montée de mise, une série de pertes se récupère plus lentement
* Les patterns étendus à 8 sans simulation neuve restent une heuristique
* Un verrou sur la prédiction seule n empêche pas de logger vite

### Option 2: Garder la martingale à 6 cases

Ne rien changer, garder la montée de mise et les 6 cases actuelles.

**Pros**:
* Aucun travail, comportement connu
* Récupération plus rapide après une perte isolée

**Cons**:
* Les mises explosent en série de pertes, contre ton objectif de lissage
* Cible 6 cases conservée alors que tu vises 3.17
* Aucune pause, donc aucune discipline imposée

### Option 3: Mise uniforme sans pause

Appliquer la mise fixe et les 8 cases mais sans minuteur entre les tours.

**Pros**:
* Plus simple à construire, aucun état de verrou à gérer
* Rythme de jeu inchangé pour les joueurs rapides

**Cons**:
* Aucun frein à l enchaînement, l objectif discipline est perdu
* Les patterns à 8 cases arrivent sans garde fou temporel

## Rationale

Le contexte impose une décision lisible et cohérente sur les deux vues, avec un état local persisté et une UI française simple. La mise fixe répond à ta demande de lissage et supprime la formule qui faisait grimper les mises. Les 8 cases alignent l optimal, le Simulateur et Gemini sur la même cible 3.17. La pause persistée répond au besoin de discipline sans nouveau backend, et la priorité donnée à la modale stop loss évite tout conflit avec la sécurité existante.
