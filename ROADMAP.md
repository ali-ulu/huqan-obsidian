# HUQAN Obsidian Plugin Roadmap

This roadmap describes the planned evolution of the HUQAN Obsidian plugin while preserving its local-first, read-only, fail-closed security boundary.

> The roadmap is directional rather than a promise of delivery dates. Security, compatibility, and user feedback can change the order of work.

## Product direction

HUQAN should make it easier to inspect the evidence behind bounded statements in Obsidian notes without sending sensitive notes or API keys to a hosted service. The plugin should remain a small local client: it reads note text, calls only the configured loopback verification endpoint, presents the returned evidence, and leaves the note and HUQAN runtime state unchanged unless a user explicitly saves a local report in the vault.

## Completed foundation

| Area | Current capability |
|---|---|
| Local verification | Verifies the current note or selected text through the local `/v2/verify` endpoint. |
| Result semantics | Shows `verified`, `contradicted`, and `unknown`, with confidence, explanations, evidence summaries, and risk labels when returned. |
| Safety boundary | Accepts only loopback endpoints and never calls ingest, learn, approval, mutation, or action surfaces. |
| Privacy | Stores the API key in local Obsidian plugin data and sends it only to the configured loopback endpoint. |
| Bounded work | Limits full-note verification to 1–40 statements, with 20 as the default. |
| Compatibility | Supports the declarative settings API on newer Obsidian versions and retains the legacy settings display for older supported versions. |
| Release integrity | Uses reproducible committed bundles, pinned release automation, and provenance attestations for release assets. |

## Released in 1.1.6

Release 1.1.6 addresses the Community listing warning and delivers the first safe part of issue #7. The exact release scan completed successfully in the Community review panel.

| Work item | Acceptance criteria |
|---|---|
| Community name compliance | The manifest uses title-case `Huqan`, while the technical ID `huqan-trust-panel` remains unchanged for installed-user and update continuity. |
| Local verification reports | The result modal offers **Save report to vault** and creates a Markdown file under `HUQAN Reports`. |
| Contradiction preservation | Saved reports include the checked statement, status, contradiction reason, explanation, evidence summaries, confidence, and risk labels when available. |
| User awareness | The UI and documentation warn that saved reports contain checked text and returned evidence. |
| Regression protection | Tests cover report formatting, contradiction details, file naming, and local vault creation. |
| Community validation | The exact 1.1.6 release ref completed its Community scan with release, network, behavior, dependency, obfuscation, and build checks passing. |

## Released in 1.2.0 — Contradiction-first results and diagnostics

Version 1.2.0 implements the first concrete user-facing result improvement: a user can see whether attention is required, identify contradiction cards immediately, read the reason and returned evidence in place, and filter the result list by status. The release preserves the local-only and read-only boundary.

The first minor release must improve the moment where a user asks, “What needs my attention?” The result modal should not make users scan a list of similarly styled cards or interpret raw status values. A contradiction must be visible immediately, explain why it was flagged, and lead the user to the returned evidence without implying that HUQAN has independently proven a universal truth.

| User problem | Concrete 1.2 behavior | Acceptance test |
|---|---|---|
| “Did this verification find a conflict?” | The result summary shows a prominent `N contradictions found — review below` banner when at least one result is `contradicted`; otherwise it shows `No contradictions returned`. | A response containing one contradiction renders the warning banner before the result list. |
| “Which item should I inspect first?” | Each result card uses a high-signal status label; contradictions are labeled `CONTRADICTION` and retain the red left border. | The contradiction card is visually distinct from verified and unknown cards. |
| “Why was this marked as contradictory?” | The card displays `Why this is flagged:` followed by `contradictionReason`, or a safe fallback if the runtime did not return one. | The reason is visible without opening a secondary view. |
| “What should I do with the evidence?” | The card states `Conflict detected — review this statement against the evidence below.` and labels the evidence as returned by the local runtime. | The guidance appears directly beneath the checked statement. |
| “How do I focus only on problems?” | Status filter buttons show counts, including `Contradicted (n)`, and hide unrelated cards when selected. | Selecting the contradiction filter leaves only contradiction cards visible. |
| “Does unknown mean false?” | Unknown results show `Not enough evidence — this does not mean the statement is false.` | The clarification is rendered for every unknown result. |
| “Can I preserve what I found?” | The existing explicit `Save report to vault` action remains available; it writes a local Markdown report and does not mutate HUQAN runtime state. | The report includes status, reason, explanation and evidence while the runtime receives no write request. |

The 1.2.0 result experience is complete. The first-run setup checklist, actionable local connection messages, and safe diagnostics were delivered in 1.3.0. These features distinguish a local connection problem from an evidence problem and never recommend sending a note, API key, or raw log to a remote service.

## Released in 1.3.0 — Evidence and report usability

Version 1.3.0 makes verification results reusable without silently changing notes or runtime state. Reports now include a local link back to the originating Markdown note, every saved report is listed in `HUQAN Reports/HUQAN Reports Index.md`, report filenames support `{note}` and `{timestamp}` templates, and the result modal adds a `Risk signals` filter. The release also adds safe diagnostics and a session-local cache for unchanged statements.

| User-facing improvement | Delivered behavior |
|---|---|
| Find an earlier report | The local report index records timestamp, source note, report link, and result counts. |
| Return to the note | Markdown reports include a local Obsidian link such as `[[notes/example]]` when the source is a note path. |
| Keep filenames predictable | Settings accept `{note}` and `{timestamp}` placeholders with path-safe sanitization. |
| Focus on risky results | The result modal filters cards carrying risk labels, independently of their status. |
| Share a diagnostic without leaking secrets | Safe diagnostics copy only version, loopback endpoint, configuration flags, and statement cap. |
| Avoid duplicate checks in one session | Unchanged statements reuse an in-memory result; settings changes clear the cache. |

A redaction-aware export option remains future work and may be added only if it can reliably remove API keys, authorization headers, and user-selected sensitive text before a report leaves the vault. Until then, reports are local artifacts and should not be pasted into public issues without review.

## 1.4 — Read-only trust graph signals

The first 1.4 graph slice is implemented as a cross-repository, read-only projection. **Open trust graph** shows the configured workspace graph, marks runtime-returned candidate conflict signals in red, highlights low-confidence or stale attention signals in amber, and exposes bounded node/evidence details without writing to the note or HUQAN runtime. Candidate conflicts remain derived review signals; the plugin does not approve, persist, or admit them.

| User problem | Concrete 1.4 behavior | Boundary and acceptance test |
|---|---|---|
| “Where is the conflict?” | The graph overlays a red dashed conflict edge or red node ring and exposes a conflict count. | Runtime projection is bounded and workspace-filtered; plugin graph-model tests assert explicit and relation-based conflict signals. |
| “What should I inspect next?” | Filters show all, conflict, attention, and evidence-bearing nodes/edges. | Low confidence and stale metadata are amber; no background network activity is introduced. |
| “What evidence supports this marker?” | Selecting a node shows bounded confidence, evidence count, source labels, related edges, and returned candidate conflict reasons. | The detail view is derived from `GET /graph-data`; no mutation, ingest, learn, approval, memory write, or action request is sent. |

The remaining workflow work can explore better selection handling, result comparison across runs, and a lightweight review queue inside the vault. Session-local reuse for unchanged text is already delivered in 1.3.0; any future persistent cache must have an explicit retention policy, clear invalidation behavior, and no unnecessary secret or note storage.

Performance work should preserve the existing statement bound and should not introduce background network activity, telemetry, remote asset loading, or automatic note edits.

## Research track: contradiction persistence

The plugin-side report portion of issue #7 is implemented in 1.1.6. The remaining issue describes a deeper runtime feature: persisting contradictions in HUQAN candidate or graph structures. That work is intentionally separate from the plugin’s current report feature. The plugin must not silently call HUQAN ingest, learn, approval, mutation, or action endpoints.

A runtime-side contradiction graph would require a separate HUQAN design proposal, explicit user intent, provenance rules, review semantics, authorization boundaries, migration planning, and cross-repository compatibility tests. Until those conditions are met, HUQAN Obsidian will preserve contradictions in user-requested local Markdown reports rather than mutating runtime state.

## Non-goals

HUQAN is not intended to become a hosted fact-checking service, an autonomous note editor, a replacement for human review, or a system that promises to eliminate hallucinations. `unknown` must remain a meaningful fail-closed result rather than being converted into a guess.

The plugin will not collect telemetry, upload vaults, send note content to arbitrary hosts, store API keys in a remote service, or perform silent writes to notes or HUQAN memory.

## Feedback and prioritization

Feature priority should be based on reproducible user problems rather than speculative breadth. Useful reports include the Obsidian version, plugin version, operating system, minimal reproduction steps, and a redacted error message. Public reports must not contain API keys, private note text, vault exports, or unredacted authorization headers. Security concerns should use the private reporting route in the repository security policy.

Community feedback should be grouped into onboarding, result interpretation, evidence presentation, report workflow, compatibility, and security. A feature should enter implementation only after its user value, local-only behavior, failure mode, and regression test are clear.

## Release gates

Every release candidate should pass the following gates before publication:

1. The manifest, package version, tag, and committed bundle agree.
2. The release contract and static safety guards pass.
3. The complete test suite, TypeScript check, dependency audit, and runtime compatibility check pass.
4. Only the intended release assets are published, with provenance attestations verified by exit status.
5. The exact Community ref is checked after the release is visible, and historical scans are not conflated with the new result.
6. Documentation and public examples do not request secrets or private vault data.
