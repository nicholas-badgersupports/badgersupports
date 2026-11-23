# Contributing to the public website

This repository is public so the site's source can be read. Development is done by Badger
Supports' own maintainers through the process below; the repository does not take outside
contributions.

## The route

1. Work on a branch off `main`.
2. Run the checks before you call anything finished:
   - `npm run check` — the gates in order, ending in a one-line verdict.
   - `npm test` — every suite in `test/`.
   A gate's result is its printed line, not its exit code. Read the output.
3. Screenshots of every visual change go to the owner before the set ships.
4. Finished branches are gathered into one set on `main`, rehearsed once in a clean copy
   (fresh install, the real build, a test deploy that does not go live), and published by the
   owner's publisher file. A local build or a passing check does not show what is live; the
   published set is the only proof.

## Rules that bind every change

- Every word a visitor sees lives in `content/`. Code never prints its own wording; the
  `editable` check enforces this and its answer must be zero.
- A photo is used once across the site. Directions photos of the same destination are the one
  exception.
- Underlines are only for links.
- Real names never go into `content/`, the fixtures, the tests or the docs. Fixtures use
  fictional people only. Credentials and form responses never go into this repository.
- Retired documents go to `docs/archive/` with a line in its index. Nothing is deleted.
- Settled decisions for this site are in `docs/DECISIONS.md`; the standing work record is
  `WORK.md`.

## Who decides

Badger Supports is run by its student leaders. The Board Alumni Advisor advises; decisions stay
with the student leaders, the Board, and university offices.
