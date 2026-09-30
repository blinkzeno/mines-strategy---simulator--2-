# Verify: mise uniforme 8 cases et pause 90 secondes · spec 0001 · updated 2026-09-30
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
## UI / manual
- [ ] Dashboard: cliquer J ai Gagné avec mise 200 → profit +434 F affiché et prédiction masquée avec 01:30 → AC-1, AC-2, AC-5
- [ ] Dashboard: attendre 90 secondes → grille de 8 cases visible avec cible 3.17 → AC-2, AC-5
- [ ] Dashboard: logger 3 pertes de suite → mise affichée toujours 200 → AC-1
- [ ] Dashboard: recharger la page pendant la pause → même échéance reprise, pas de remise à zéro → AC-6
- [ ] Dashboard: vérifier la carte mise fixe (mise, profit session, perte cumulée) et l absence des paliers martingale → AC-8
- [ ] Simulateur: Jouer à 200 puis cashout à 8 étoiles → gain 634 F et référence masquée avec 01:30 → AC-1, AC-2, AC-5
- [ ] Simulateur: cliquer une mine → défaite à mise fixe 200 puis pause 01:30 → AC-1, AC-5
- [ ] Session: atteindre objectif ou stop loss pendant une pause → modale prioritaire devant le minuteur → AC-7
- [ ] Réglages: changer la mise de base à 300 → les deux vues jouent 300 fixes → AC-1
- [ ] Gemini: scanner une capture → 8 cases conseillées au lieu de 6 → AC-4
## Commands
- [ ] `pnpm lint` → propre, zéro erreur → AC-1 à AC-8
- [ ] `pnpm build` → dossier `dist/` généré sans erreur → AC-1 à AC-8
## Acceptance-criteria coverage
- AC-1 … couvert par les étapes gain, pertes, Simulateur, réglages · AC-2 … couvert par les étapes 8 cases et référence · AC-3 … couvert par l étape patterns (10 entrées à 8 cases en dur) · AC-4 … couvert par l étape scan Gemini · AC-5 … couvert par les étapes pause Dashboard et Simulateur · AC-6 … couvert par l étape reload · AC-7 … couvert par l étape modale · AC-8 … couvert par l étape carte mise fixe
