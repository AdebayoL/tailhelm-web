# Tailhelm

A home-screen web app that keeps UK owners of dogs with lifelong conditions on their vet's plan. The source of truth for what to build is the Build Spec, Build Plan and Launch To-Do List in the Tailhelm project.

@AGENTS.md

## Rules that never bend

- **Tailhelm never calculates or suggests a dose.** No condition pack may contain a dose, a dose range or a formula producing one. This applies equally to every screen, email, PDF, calendar event and notification. Doses exist only in the prescribed layer, exactly as the owner typed them from their vet's instructions, with the date the vet set them.
- **Every rule cites a published source** in `sources/register.json`, at the highest tier available. Tier 4 reference texts may back definitions only. Where no source covers a point there is no rule; never fill a gap by inference.
- **The owner's own vet wins.** The prescribed layer overrides the published layer wherever they touch.
- **Safety features are free on every plan**: reminders, all escalation, crisis alerts, the emergency card, Happening now, the household and the double-dose guard.
- **Voice**: never "safe", "normal", "fine", "streak", "compliance", "administer" or "dosage". Never describe the dog's health as good or bad. State numbers and dates, and the only action ever suggested is to contact the vet.
- UK only, GBP only.

## Working here

- One task at a time. Each ends with passing tests and a commit.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run check:packs` and `npm run build` must all pass; CI runs them on every PR.
- Database changes are migrations in `supabase/migrations/`. `npm run test:db` applies them to a fresh Postgres (set `DATABASE_URL`) and runs `supabase/tests/*.test.sql`; CI runs it too. Every table has row-level security scoped to the dog's household.
- Condition packs live in `packs/` and are validated by `src/packs/validate.ts`. Packs under `src/packs/fixtures/` are test-only and cite fixture sources.
