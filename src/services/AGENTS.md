# AI Services

## Overview

You get Gemini calls here for screenshot reads plus bankroll advice. Each call sends a prompt and expects JSON back with a safe fallback when parsing fails.

## Key files

* `src/services/gemini.ts` : Gemini client plus screenshot analysis plus strategy advice
* `src/components/Dashboard.tsx` : file upload plus strategy button plus result display
* `.env.example` : `GEMINI_API_KEY` plus `APP_URL` placeholders for local setup

## Conventions

* You may resolve the key from custom key first then `GEMINI_API_KEY` from Vite defines
* You may ask for JSON only with `responseMimeType` set to `application/json`
* You may strip the data URL prefix before you send image bytes to Gemini
* You may keep model id in one place when you upgrade (`gemini-3-flash-preview` is current)

## Gotchas

* Screenshot analysis expects indexes 0 to 24 left to right top to bottom on a 5 by 5 grid
* Strategy advice uses only the latest 10 history items plus current balance
* Parse failures return a default pick so the UI never blocks on AI output
* Custom key is stored in app state and local storage so you must treat it as sensitive

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
