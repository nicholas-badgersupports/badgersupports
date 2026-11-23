# Badger Supports — public website

This repository holds the source of the public Badger Supports website, badgersupports.org:
the pages a visitor reads, the forms they can send, and the small API behind the forms.
Badger Supports is a student-run peer support organisation at UW–Madison.

The repository is public. Keep credentials, form responses and private student information out of
its files. The fixtures in this repository use fictional people only.

One caution: `www.badgersupports.org` still shows the older Google Sites site. The owner will say
when it moves. Nothing in this repository changes that address by itself.

## If you are taking this over

1. Read `docs/README.md`. It gives the commands, the folder layout and what each check does.
2. Read `docs/ARCHITECTURE.md` for how the build, the API and the database fit together.
3. Read `docs/DESIGN.md` before changing how a page looks.

## What is in the repository

| Folder or file | What it is |
|---|---|
| `content/` | Everything a visitor reads: one JSON file per page, the form definitions, site settings, interface text |
| `src/` | The page builder, the browser code, and the styles |
| `netlify/` | The API function, its library, and the numbered database migrations |
| `media/` | Photo metadata only. The photos themselves are never in this repository |
| `assets/` | Fonts and brand marks |
| `ops/` | The build, the development server, the checks, screenshots |
| `test/` | The test suites |
| `docs/` | The written record: development guide, architecture, design, decisions |
| `WORK.md` | Where the work stands and what is left, in order |

## Run it

Node 22 or later. Run from the repository root.

```bash
npm ci
npm run build     # build the site into dist/
npm run dev       # build, then serve it locally (default port 8899)
npm test          # every suite in test/
npm run check     # the gates in order, ending in a one-line verdict
```

A gate's result is its printed line, not its exit code. Read the output. `docs/README.md` lists
what each gate checks.

## How a change reaches the site

Work happens on a branch. Finished branches are gathered into one set on `main`, rehearsed once in
a clean copy (fresh install, the real build, a test deploy that does not go live), and published by
the owner's publisher file. Screenshots of every visual change go to the owner before the set
ships. A local build or a passing check does not show what is live; the published set is the only
proof.

## Rules a reader needs

- Every word a visitor sees lives in `content/`. Code never prints its own wording; the
  `editable` check enforces this and its answer must be zero.
- A photo is used once across the site. Directions photos of the same destination are the one
  exception.
- Underlines are only for links.
- Real names never go into `content/`, the fixtures, the tests or the docs. The team shown on the
  site comes from Connect at runtime.

## The other two sites

Connect (`bss-intranet`) is the members' site at home.badgersupports.org. Badger SPILL
(`badger-spill`) is the confidential peer support service at badgerspill.org. The three are
separate repositories and separate identities. This site never receives SPILL case content.

## Who decides

Badger Supports is run by its student leaders. The Board Alumni Advisor advises; decisions stay
with the student leaders, the Board, and university offices. Settled decisions for this site are in
`docs/DECISIONS.md`; the standing work record is `WORK.md`.
