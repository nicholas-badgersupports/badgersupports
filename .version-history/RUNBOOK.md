# Run a version-history review

Use this procedure when asked for a changelog, when preparing release notes, or when closing out a release candidate. The author writes the history and the reviewer runs the check. Passing the check records a local review result. The owner still controls publication.

## Choose the range

Read the root repository instructions, documentation map and [.version-history project notes](PROJECT.md). Trace the Version History page or release process to its editable source. Keep that file's identity, schema, version labels and approved wording. Confirm the checkout includes the relevant refs and sources. Run the following from the repository root in a clean local candidate worktree. Use Python 3.9+ and Git.

| Purpose | Local command |
| --- | --- |
| First complete history, repair of material gaps, or explicit request for project beginnings | `python3 .version-history/version_history.py start --full` |
| Next candidate after an agreed baseline | `python3 .version-history/version_history.py start --base LAST_REVIEWED_REVISION` |
| Check the finished record | `python3 .version-history/version_history.py check` |

Use the actual previous approved or reviewed revision for the baseline. Record why you chose it. A recent commit or the current production deploy may be the wrong starting point. For a full review, check other branches for unreleased differences, tags, published releases, verified production deployments and earlier documentation. For a routine update, follow up on changed historical evidence and outstanding gaps only. Full mode inventories commits reachable from the candidate. Record relevant work from outside that ancestry separately.

Start prepares a private JSON ledger inside this worktree's Git metadata and reports the path. Repeating the command for the same range resumes it. To replace a different or stale review, re-run the intended start command with `--restart`. It backs up the previous ledger. When the baseline is unchanged, it carries forward entries and dispositions for the same commits and requires a fresh review decision. Keep sensitive records out of commit subjects, review notes, and the changelog. A clean local candidate can include local commits. Starting or checking a review performs no remote Git or hosting action.

## Authoring task

**Produce the actual changelog in the configured source.** Read the release records, then check the implementation and tests for the period. Compare the source with what the example illustrates: a descriptive heading, concrete effects, relevant conditions and a supported date or range. A sample's assertions and versions belong to the site it describes. If editing is unavailable, return the complete draft and identify the source still needing integration.

1. Put **Unreleased** first, including when empty. Place notable candidate changes here while release is pending. List existing releases and retrospective development periods newest first. Preserve approved numbers. Use an approved retrospective label with the words *retrospective development* in the heading. An unnumbered development period can use an evidenced range. Mark an uncertain beginning explicitly. A commit, tag, merge, branch name, build or preview alone cannot establish that it shipped.
2. Group entries under **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, or **Security**, using only categories that apply. A verified **Known Issues** subsection is an optional project supplement. Use audience subheadings inside each category when they help. Keep already approved bullets intact. If a historic source uses another schema, map its fields to these headings for checking and preserve protected wording. Seek the existing approver's decision if a change to approved text or UI structure is required.
3. Write one verifiable outcome per bullet: what changed, who encounters it and what they can do or must do. Include administrative and operational effects. Check permissions, privacy, accessibility, preservation and recovery, compatibility and required actions. Preserve feature switches, eligibility and initially hidden states. Trace removals and fixes forward before describing availability or listing an issue as current. Use plain descriptions of security outcomes. Exclude identities, secrets and exploit details.
4. Combine related commits, retries and duplicates under the same entry. Split genuinely distinct effects from one commit into multiple entries. Look at the diff before excluding a merge. Exclude generated refreshes, pure checkpoints, debugging attempts and routine merges with no independent effect. Record the concrete reason in the ledger. Group non-Git records by source and period, including records that predate the repository. Record sources unavailable, superseded proposals, and the resulting coverage limits.
5. Link significant claims to stable, relative paths or immutable records, using the project adapter's placement rules. Confirm a published date with a production deployment, a published release or a dated release announcement tied to the stated revision and environment. A live revision can contain features hidden by configuration. Where the evidence ends, describe a development period or an unresolved gap.

When reaching release, move eligible Unreleased entries under the approved version and confirmed date. Use ISO dates for new dated headings; retain established labels and approved wording. Keep an empty Unreleased section for the next cycle. Compare links or repository tags are useful navigation when they exist.

## Complete the review ledger

Open the path printed by `start`. The file is private working evidence. Use source identifiers sufficient for a second maintainer to check the decision without access to personal data.

- **commits** contains the exact candidate SHAs. Leave its keys intact. Each value takes an array of entry IDs and an empty `exclude`, or an empty array and a specific exclusion reason. Multiple commits can cite one ID.
- **records** uses the same format with a `source` field for pre-Git documents, other branches, approvals, releases, deployments, fixes and material gaps. Give duplicate sources the existing entry IDs.
- **entries** maps a short local ID to the exact canonical bullet text, category, date status and evidence. For duplicate text, add `period` containing the exact Markdown heading text without its hashes. The date kinds are `unreleased`, `development`, `published`, and `undated`. For published entries, use a `publication` value beginning with `production-deploy `, `published-release `, or `release-announcement `, followed by the specific record. Open it and verify scope, date, time zone and audience.
- **coverage** identifies the baseline, branches, releases, deployments, pre-Git sources and unavailable evidence actually reviewed. Be explicit about omissions and their effect. **reviewed** becomes true only after the writer checks facts and conditions, preserves approved entries, rechecks open issues, and runs the project's native validation.
- **corrections** is optional. If fixing or withdrawing a previously recorded bullet, give its exact old `period`, `category` and `text` along with the `reason` and a specific `approval` reference. Keep superseded behavior visible when it matters to the chronology. Moving an unchanged Unreleased bullet into its proper period does not need a correction.

Illustrative entry object for a development period:

```json
{
  "review-export": {
    "text": "Reviewers can export the selected reporting period without including other periods.",
    "category": "Added",
    "evidence": ["implementation path at reviewed revision", "test or dated historical record"],
    "date_kind": "development",
    "publication": ""
  }
}
```

## Run the gate

Run the native history/schema check and relevant tests. For a page, verify the renderer, order, affected audiences, switch state, privacy, and stored or imported data where applicable. Then run `check`. It compares the candidate and Git inventory, requires a disposition for each item, checks exact bullets and categories, checks the placement of Unreleased, and requires publication references for released entries. It checks all canonical bullets in a full review and new or moved bullets in an incremental review. For dates in existing non-ISO formats, also inspect ordering manually.

The gate checks references and structure. A maintainer must open the evidence, decide whether an exclusion is justified, and verify claims. For release-candidate handoff, commit the history locally, refresh the review for the new head with the same range and `--restart`, account for the history commit, and run `check --committed`. This binds the result to committed history. A draft check may use local history edits. Keep the ledger private and put the required evidence summary in the existing maintainer handoff. Report the history file, review range, actual checks and unresolved limitations. Stop there unless the owner separately authorizes the next action.

## Guidance applied

- Curate changes for readers, keep Unreleased at the top and group meaningful changes by type. [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)
- Follow the project's established version policy. SemVer describes compatibility against a declared public API. A retrospective label documents an agreed development period and does not establish a release. [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- Use GitHub's generated notes, PR categories, labels and exclusions as leads. Read the merged work and earlier historical records before writing reader-facing bullets. [GitHub release-note documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
