# CLAUDE.md — badgersupports

The rebuild of www.badgersupports.org. Where it stands: `WORK.md`. How it is built: `docs/ARCHITECTURE.md`.
The site's brief is `MASTER-PROMPT.md` in the folder above this repository, on Nicholas's laptop only. A session
that cloned this repository cannot read it, so a rule from it that a session needs belongs in this file.

## Repository hygiene (approved 30 Oct 2026)

Plan: Repository Clarity Review, https://claude.ai/artifact/HsS2C3et5GR4wSDqkCyY1G. These are the rules from it that bind work inside this repository, numbered as in the working folder's `CLAUDE.md` on the laptop, which holds all seven.

- **Rule 3.** A commit subject reads `area: what now works (ITEM-ID)`, using the queue or Exchange item ID where there is one. Aim for 50 characters and never exceed 72. Under the subject go one line each for Why, Proof and Limits. Hand Nicholas a commit command as `git commit -m "…" -m "…"`, never as a heredoc.
- **Rule 4.** A code comment states a rule, an invariant, a side effect, failure behaviour or a compatibility constraint. Dates, rulings, quotations, run IDs, line numbers in other files and counts go in the commit or the decision record. A TODO names the queue item that tracks it, as in `TODO(AUDIT-14): what remains`.
- **Rule 6.** Open no pull request on bss-intranet, badger-spill or badgersupports until Nicholas confirms that Netlify Deploy Previews are switched off. According to Netlify's agent guidance, which has not been checked on a live page, a preview gets a copy of the production database.
- **Rule 7.** On badger-spill and badgersupports, a commit that changes only documentation carries `[skip netlify]` in its message. This holds until each repository has a `[build] ignore` rule. Until then, every push to `main` starts a production build, which costs 15 credits.

## Exchange inbox

On Nicholas's laptop this session's inbox is `../../Admin/Handoffs/Exchange/to-public/`. List it at the start and again before
finishing, handle each `open` item as `../../Admin/Handoffs/Exchange/README.md` says, and send requests for Connect to
`to-intranet/` and for Badger SPILL to `to-spill/`. A session that cloned this repository cannot reach that folder: it says so
and leaves the inbox to the next laptop session.
