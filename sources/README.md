# Source register

`register.json` is the spine of every condition pack: one entry per published document a rule may cite, with its tier, edition and the date it was retrieved. Stored copies of each document go in this directory alongside it.

Only sources in the evidence hierarchy may be registered (Build Spec, "Where the rules come from"). An individual vet's opinion, forums, owner groups, blogs, manufacturer marketing and AI output are never sources.

Stored copies live in `stored/`. Each entry records the copy's `sha256`, and `npm run check:packs` fails if a copy is missing or no longer matches. To register a new document: add the file to `stored/`, add its entry with `sha256sum`, and note in `note` anything a reviewer must know.

`addisons-coverage.md` maps the Build Spec's Addison's rules to what these documents actually say, and lists the gaps.
