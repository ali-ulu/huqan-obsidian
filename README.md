# HUQAN

Verify statements in an **Obsidian note** against a **real local HUQAN runtime**.
The plugin does not use a mock verifier and does not send note text or API keys
to a remote service. It is read-only: it never writes to HUQAN memory or executes actions.

## What it does

- **Verify current note** — scans a bounded number of Markdown statements and
  checks each one with HUQAN `/v2/verify`.
- **Verify selected text** — checks the selected passage against HUQAN.
- Shows HUQAN's canonical `verified`, `contradicted`, and `unknown` statuses.
- Shows confidence, explanation, evidence summaries, and manipulation-risk
  labels returned by the HUQAN runtime.
- Keeps the configured endpoint loopback-only (`127.0.0.1`, `localhost`, or
  `::1`) so a saved API key cannot be sent to an arbitrary host.
- Bounds full-note scans to 1–40 statements (20 by default).
- Lets you save a verification report as a Markdown file in a local `HUQAN Reports` vault folder.

## Requirements

- Obsidian desktop 1.5.0 or newer.
- A local HUQAN server from the [HUQAN repository](https://github.com/ali-ulu/huqan).
- A `HUQAN_API_KEY` configured on that local server.

## How changes flow between repositories

The plugin source of truth is this repository. Plugin TypeScript, committed bundle,
manifest, tests, and releases are updated here; they are not copied back and forth
with the HUQAN runtime repository.

The [HUQAN repository](https://github.com/ali-ulu/huqan) owns the local server and
runtime API. When a runtime/API surface changes, its CI checks the current plugin
`main` against the proposed server. This is a compatibility gate, not a source
synchronization step: the plugin source remains here and the runtime source remains
in the HUQAN repository.

Typical update flow:
1. Make plugin changes in this repository and run `npm run check`.
2. For a runtime change, update HUQAN and let its Obsidian compatibility workflow
   run against this repository's `main`.
3. When the compatibility check is green, update the affected side in its own PR.
4. For a plugin release, run `node version-bump.mjs <version>`, run the checks,
   merge to `main`, and create the matching Git tag here.

## Run HUQAN locally

From a HUQAN checkout:

```bash
npm ci
HUQAN_API_KEY="replace-with-a-long-random-key" npm run server
```

On Windows PowerShell:

```powershell
$env:HUQAN_API_KEY="replace-with-a-long-random-key"
npm run server
```

The server listens on `http://127.0.0.1:3000` by default.

## Configure the plugin

Open **Settings → Community plugins → HUQAN** and set:
1. Local HUQAN endpoint (default: `http://127.0.0.1:3000`)
2. The same HUQAN API key used to start the server
3. HUQAN workspace (default: `default`)
4. Maximum statements to check per note

Use **Test HUQAN** before the first verification. From the results modal, choose **Save report to vault** to keep the checked statements, statuses, explanations, evidence summaries, contradiction reasons, and risk labels as a local Markdown report. The report contains note text and returned evidence, so review it before sharing.

## Reading verification results

The result modal is designed to make attention items visible at a glance. If one or more statements are returned as `contradicted`, the summary shows a prominent **N contradictions found — review below** banner before the result list. Each affected statement has a red `CONTRADICTION` label, a visible **Why this is flagged** explanation, and the evidence returned by the local runtime directly below it.

Use the status filters to show only **Contradicted**, **Unknown**, **Verified**, or **Errors**. The filter counts tell you how many statements need review without opening every card. `Unknown` is intentionally explained as **not enough evidence**, not as proof that the statement is false. A contradiction signal is a reason to inspect the evidence and context, not an instruction to silently rewrite the note.

## Commands

- `Verify current note`
- `Verify selected text`
- `Test connection`

The shield ribbon icon runs **Verify current note**.

## Privacy and security boundary

The plugin stores its settings in Obsidian's local plugin data. The API key is
therefore a local secret, not an encrypted credential store. To reduce its
blast radius, the plugin refuses to send the key to non-loopback hosts.

The plugin has no telemetry, advertising, remote asset loading, self-update,
or dependency-install behavior. Network access is limited to the configured
loopback HUQAN server.

Verification is read-only. This plugin does not call HUQAN ingest, learn,
approval, mutation, or action endpoints.

## What a result means

HUQAN verifies a statement against the evidence available in the configured
HUQAN workspace. `unknown` means HUQAN did not have enough evidence. It is not
a claim that the statement is false. Likewise, this plugin is not a universal
fact checker and does not promise truth or hallucination elimination.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned onboarding, evidence UX, report workflow, compatibility, and safe contradiction-persistence research.

## Development

```bash
npm ci
npm run check
```

Release artifacts are:
- `main.js`
- `manifest.json`
- `styles.css`

Create a Git tag that exactly matches `manifest.json` and `package.json` `version`.
The release workflow builds the bundle, validates the Community Plugins contract,
generates GitHub artifact provenance attestations, and publishes the three files
that Obsidian downloads to the GitHub Release.

The `version-bump.mjs` helper updates `manifest.json`, `versions.json`,
`package.json`, and `package-lock.json` together. `versions.json` is maintained
for compatibility when the plugin's `minAppVersion` changes.

> The technical plugin ID remains `huqan-trust-panel` to preserve installed-user
> settings and the existing Community listing/update path. The HUQAN brand is used
> throughout the UI and documentation; the Community manifest label is title-cased
> as **Huqan** to satisfy the directory’s naming convention.
