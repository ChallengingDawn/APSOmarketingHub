# Shared creative workspace — first delivery

The first delivery fixes the foundation for handing content between existing
APSO Hub users. It does not introduce separate organizations or anonymous sharing.

## Available in this change

- Save and reopen canvas layers, typography, backgrounds and artboard dimensions.
- Keep the PNG preview separately from the editable document.
- Import/export editable design JSON; keep existing PNG export.
- Edit Library titles and copy with a Markdown preview.
- Copy an authenticated Library link for a teammate.
- Reject stale saves instead of overwriting someone else's version.
- Record previous content snapshots atomically with updates; show version history.
- Return changed creative content to draft while preserving its former state in history.
- Re-check active accounts and current roles on content routes; viewers cannot write.
- Preserve existing content and calendar dates through additive schema changes.

## Operation

Use **Save design** to persist a design. Export alone does not save it. Saving
text or a design creates a new revision. If another user saved first, keep the
local edits, copy the text or download the editable design, then open the latest
version and reconcile the changes. There is no silent retry that overwrites it.

The existing internal library is shared by active Hub users. Workspace/project
membership and reviewer-specific permissions are a later delivery. Existing
editor roles retain the current status controls; this is not yet an assigned
approval workflow. Old flattened images reopen as backgrounds because their
original layers cannot be reconstructed.

## Storage and deployment

`creative-schema.ts` is an additive, idempotent upgrade called by the existing
schema initialization. It adds a revision number, editable document, last editor
and history table. The database role needs ALTER/CREATE permissions, as it does
for the existing bootstrap. No database was modified during development.

The release must update frontend and API together: PATCH requests now require
`expectedRevision`. Previously open browser tabs must reload. Reverting to an old
application version would bypass revision/history protection; keep the additive
columns and table if rolling back and prevent mixed old/new writers.

This delivery retains the repository's inline-image PostgreSQL storage. Canvas
requests are limited to 16 MB, documents to 500 layers, and artboards to 32 million
pixels. History contains full prior snapshots. Object storage, history retention,
and asset deduplication should precede large-team/high-volume use.

The ECS rollout and existing master-to-ECR workflow are unchanged. The new PR
workflow runs database/domain tests, a production build, and browser checks.

## Validation

- `npm test`: embedded PostgreSQL tests for additive upgrades, document round trips,
  stale writers, immutable old snapshots and approval invalidation; validation,
  role policy and streamed body-limit tests.
- `npm run build`: production compilation, type checks and page generation.
- `npm run test:browser`: Playwright checks against the production build, with
  mocked content APIs and a test session. Checks save/reopen/source export,
  Library copy saving, and conflict preservation. These do not verify live AWS.

## Next deliveries from the product review

1. Workspace/project membership, comments, named reviewers and durable approval rules.
2. Source-linked translations, approved terminology, native-speaker review and
   revision-specific decisions; email delivery with persisted Governance routing.
3. Expanded artboards/layout tools, responsive newsletter blocks and pop-up formats.
4. Campaign calendar, review deadlines, publication tracking and versioned Brain.

Simultaneous live editing and external-review access remain product decisions.
No review emails are sent by this delivery.
