# Condition packs

One `<condition>.pack.json` per condition, in the format defined in `src/packs/schema.ts`. `npm run check:packs` validates every pack here against `sources/register.json` and fails the build on any uncited rule, any citation to an unregistered source, or anything resembling a dose.

The Addison's pack is built here from the source register during Phase 2. Packs are immutable once published: a change is a new version with a changelog entry naming the source that prompted it.
