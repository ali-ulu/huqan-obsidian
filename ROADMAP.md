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

Onboarding and diagnostics remain part of 1.2, but they are secondary to this visible result improvement. The first-run path should include a clear local setup checklist, explicit loopback endpoint validation, and actionable messages for a missing server, invalid workspace, and authentication failure. A copy-safe diagnostic summary may be added, but it must exclude API keys, note text, vault content, authorization headers, and raw sensitive logs.

The diagnostic surface should make it easy to distinguish a local connection problem from an evidence problem. It should never recommend sending a note, API key, or raw log to a remote service.

## 1.3 — Evidence and report usability

The next phase should improve how users review and reuse results. Candidate features include a report index note, links from a report back to the originating note, filters for risk labels, a compact summary view, and an optional report naming template. Status filtering is now part of the 1.2.0 result modal rather than a future candidate. Any generated links must remain local vault links, and report creation must remain an explicit user action.

A redaction-aware export option may be added only if it can reliably remove API keys, authorization headers, and user-selected sensitive text before a report leaves the vault. Until then, reports are local artifacts and should not be pasted into public issues without review.

## 1.4 — Verification workflow improvements

This phase can explore incremental verification, better selection handling, result comparison across runs, and a lightweight review queue inside the vault. The plugin should avoid repeated requests for unchanged text where a local cache can be implemented safely, transparently, and without storing secrets unnecessarily.

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
