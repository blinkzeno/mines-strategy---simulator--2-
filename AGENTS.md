# MinesPro Strategy Simulator

## Stack

* **Language / Runtime**: TypeScript on Node 20 plus Vite 6 (Vite is the build tool that serves your app in dev and bundles it for prod)
* **Framework**: React 19 with JSX (JSX lets you write UI markup inside your TypeScript)
* **Key dependencies**: `motion/react` for animation, `lucide-react` for icons, `@google/genai` for Gemini AI, Tailwind CSS 4 for styling
* **Package manager**: `pnpm` (lock file `pnpm-lock.yaml` is present)

## Build approach

<TBD, set by /scope>

## Commands

```bash
# Install
pnpm install

# Dev server
pnpm dev

# Build
pnpm build

# Type check
pnpm lint
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

* You may keep all game state in `src/App.tsx` and pass it down with props (props are inputs a parent passes to a child view)
* You may keep bankroll math explicit and in one place per view so you can review risk fast
* You may use TypeScript types from `src/types.ts` for every record you store
* You may persist app state only with the `mines_pro_state` key in local storage (local storage keeps data in the browser across reloads)
* You may keep UI copy in French to match the current screens
* You may keep the dark theme tokens already in use (`#080b12`, `#141828`, `#252d45`)
* You may add no new backend until a spec asks for it

## Agent skills

* [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React habits for clean components and state
* [tailwind-design-system](.agents/skills/tailwind-design-system/): `wshobson/agents`, Tailwind habits for steady styling

## Context files

* [src/components/AGENTS.md](src/components/AGENTS.md) (game views plus bankroll and session rules)
* [src/services/AGENTS.md](src/services/AGENTS.md) (Gemini AI calls plus prompts and fallbacks)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
