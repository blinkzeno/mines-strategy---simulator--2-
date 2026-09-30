# Game Views

## Overview

You get two main views here. Dashboard owns the real bankroll plan plus session gates. Simulator owns a virtual practice grid with its own local balance.

## Key files

* `src/App.tsx` : tab nav plus global state plus local storage sync
* `src/components/Dashboard.tsx` : bankroll view plus martingale steps plus pattern picks plus withdrawal form
* `src/components/Simulator.tsx` : virtual grid plus local martingale plus cashout flow
* `src/types.ts` : shared records for games plus sessions plus withdrawals

## Conventions

* You may keep Dashboard on 6 stars and 3 mines for every real plan pick
* You may compute the advised bet as base bet times martingale factor to the power of consecutive losses
* You may gate play with session goal plus daily goal plus stop loss plus 30 turns plus wait timer
* You may store history newest first and cap lists at 50 items
* You may use French labels plus Franc formatting (Franc is shown as F after amounts)

## Gotchas

* The multiplier table lives in both Dashboard and Simulator so you must update both spots together
* Simulator bet math is fixed at 500 with factor 1.5 while Dashboard reads base bet from state
* Balance floor in App keeps real balance at 1 or more never zero
* `express` plus `better-sqlite3` are listed in `package.json` but have no imports so you may ignore them

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
