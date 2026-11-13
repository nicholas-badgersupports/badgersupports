# The verification rhythm

Added 13 November 2026 (proposal C-40 of the 12 November 2026 audit). The full check is the
publish gate and runs before a publish. This page records the rest of the rhythm: the runs
that used to happen only when a person remembered them, in one command —

```bash
npm run scheduled              # the full gate with the browser, then the production-data accessibility run
node ops/scheduled.mjs --list  # the stages, named, running nothing
```

- **When:** after every merge pass, before the publish that follows it; and weekly whether
  or not anything merged. `node ops/scheduled.mjs --print-plist` prints a launchd entry for
  the weekly run (Saturday 09:30 local); installing it is the owner's one step, and until it
  is installed the weekly run is a command a person runs, not a timer.
- **Stage 1 is the full gate with the browser** (`ops/check.mjs --browser`): every source
  gate, the build, the unit tests, screenshots, the accessibility pass, and the twelve
  interact groups.
- **The behaviour suite is twelve files.** `ops/interact.mjs` never completed a run — it
  stalled idle three times and printed nothing until the end (audit item P1, register R24).
  Its part-groups are now `ops/interact-*.mjs` over the shared `ops/interact-harness.mjs`,
  each printing its results as they happen and tallying under its own name in
  `ops/suites.mjs`. A group that stalls fails under its own name and leaves the other
  groups' reports standing.
- **Stage 2 is the production-data accessibility run — UNVERIFIED.** The axe pass has only
  ever run against the demonstration build (hand-typed fixture events and resources;
  register R7, finding F-ACC-1). This stage builds with Connect's live public lists
  (`node ops/build.mjs --connect`), serves that build locally, and runs `ops/a11y.mjs`
  against it; the forms it sends answer to the local server's fresh database, so nothing
  reaches the live site. It needs `CONNECT_URL`, `PUBLIC_SITE_SERVICE_KEY_ID` and
  `PUBLIC_SITE_SERVICE_SECRET` in the environment — the same three Netlify's production
  build uses. They are not set on this machine, so the stage currently reports DID NOT RUN
  with the reason, in its own line, on every run. **It has never yet run.** The first run
  that has the configuration runs it; a pass then, and only then, closes R7's open half.
- **A stage's failure stops nothing.** Each stage is reported under its own name with its
  duration; a stage that could not run says DID NOT RUN; the run's verdict names every
  failure and repeats the production-data stage's UNVERIFIED state until it has run. Every
  stage's full output is one log in `local/scheduled-runs/` on the machine that ran it.
- **The standing `tabindex="0"` red is decided.** It was the editability scan reading an
  attribute as a word: `cards.mjs` renders a nested template that is only the attribute
  `tabindex="0"`, and a bare fragment has no tag for the scan to strip. The scan now strips
  attribute assignments from a template's text as a category — an attribute is not a word —
  while an attribute a person hears (aria-label, alt, title, placeholder) is still judged.
  The calibration in `test/text.test.mjs` proves both directions, and
  `node ops/editable.mjs` reports 0 words not editable. No permanent red stands.
