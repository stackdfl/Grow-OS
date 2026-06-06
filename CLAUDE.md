# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run lint     # ESLint (Next.js core-web-vitals + TypeScript rules)
npx tsc --noEmit # type-check without building
```

## Stack

- **Next.js 16.2.7** with App Router (`src/app/`) — see AGENTS.md: this version has breaking changes from prior versions. Check `node_modules/next/dist/` for current APIs before assuming conventions from training data.
- **React 19** — new hooks and concurrent features are available
- **TypeScript** strict mode; `@/*` maps to `src/*`
- **Tailwind CSS v4** — configured via `@import` in `globals.css`, no `tailwind.config.js`. Theme tokens are CSS custom properties defined in `globals.css` under `@theme inline`.
- **shadcn/ui** — components live in `src/components/ui/`. **Critical:** this version uses `@base-ui/react` as the primitive layer, not Radix UI. Do not import from `@radix-ui/*`.
- **Supabase** — `@supabase/supabase-js` + `@supabase/ssr` installed, not yet configured. Use `@supabase/ssr` for server-side auth (middleware + Server Components); use `createBrowserClient` only in Client Components.
- **Toasts** — use `sonner`, not a toast component.
- **`cn()`** — `src/lib/utils.ts`, wraps `clsx` + `tailwind-merge`.

## Planned Application Architecture

Weedsmith is a cannabis cultivation and recipe management app (BeerSmith analog for home growers). These are the core domains:

| Domain | BeerSmith Analog | Description |
|---|---|---|
| **Strain Library** | Ingredient database | Strains with genetics, THC/CBD profiles, growth characteristics |
| **Grow Journal** | Brew sessions | Track grow cycles: medium, environment, feeding, watering, photos |
| **Harvest Tracker** | Batch logs | Yield, cure progress, quality notes per harvest |
| **Recipe Builder** | Recipe editor | Edibles, tinctures, concentrates — dose calculations from harvest weight |
| **Dashboard** | Home screen | Active grows at a glance, upcoming tasks |

### Planned Route Structure

```
src/app/
  (auth)/            # login, signup — unauthenticated layout
  (app)/             # main app — authenticated layout with sidebar
    dashboard/
    strains/
    grows/
      [id]/
    harvests/
    recipes/
      [id]/
```

### Supabase Auth Pattern

- Middleware (`src/middleware.ts`) handles session refresh using `@supabase/ssr` `createServerClient`
- Server Components use `createServerClient` with `cookies()` from `next/headers`
- Client Components use `createBrowserClient`
- Never share a single Supabase client instance across server and client

### Key Conventions

- Tailwind classes only — no inline styles, no CSS modules
- shadcn/ui for all UI primitives; extend with `cva` + `cn` for variants
- `date-fns` for all date formatting and arithmetic
- Supabase Row Level Security enforces per-user data isolation; never bypass with service role key on the client
