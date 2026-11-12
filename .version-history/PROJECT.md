# Badger Supports Public

The Public repository is [nicholas-badgersupports/badgersupports](https://github.com/nicholas-badgersupports/badgersupports). Its software history is [docs/VERSION-HISTORY.md](../docs/VERSION-HISTORY.md). Staff edit history records changes to individual content items. The About → History page tells the organization's story. Neither is a software release record.

## Before writing

1. Read [AGENTS.md](../AGENTS.md), [the documentation map](../docs/README.md), [active rules](../docs/ACTIVE-RULES.md), [decisions](../docs/DECISIONS.md) and [WORK.md](../WORK.md). The rebuild brief, earlier site inventory and Exchange records referenced by those files may be available only in the maintainer's local working folder. Note missing records.
2. Review Public's implementation and questions separately from Connect's exports and SPILL's service. Identify which side changed, what the other site must provide, whether the feature is enabled and what each audience can actually do. For a form, distinguish its availability, submission acceptance, downstream PDF receipt, optional email and backup.
3. For a published date, check the production deploy's publication timestamp, project, context and displayed source revision against the candidate. The Public release script runs from the owner's laptop. A GitHub push, build, preview or title alone does not prove publication. Use America/Chicago dates for local records and retain UTC timestamps when checking a midnight boundary. Team-only publication, public access at Netlify and a custom-domain switch are separate facts. [Netlify configuration](../netlify.toml) · [Domain switch procedure](../docs/SWITCH.md)
4. Write for visitors, authorized staff and maintainers. Keep real profiles, form answers, mailboxes, hidden access details and private Exchange records out of this public repository. Keep the trace and unresolved questions in the reviewer's local gate record. Put only safe file paths and evidence links in the changelog.
5. Run the [shared history workflow](RUNBOOK.md) and the repository checks before handing off the candidate. The owner makes the publication and access decisions. The history workflow requires no account sign-in or production write.

## Historical starting points

The first reachable main commit is `ed4ac3a` (20 October 2026). The [owner brief](../docs/DECISIONS.md) and [predecessor route inventory](../docs/research/ROUTES.md) date to 19 October. The [23 October](../docs/OVERNIGHT-RUN-2026-10-23.md) and [24–25 October](../docs/OVERNIGHT-RUN-2026-10-24.md) records describe several changes inside broad commits. Check dated records against newer deploys and current code, especially before carrying forward a blocker or saying a form is open.
