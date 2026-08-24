import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  SettingDefinition,
  TFile,
  requestUrl,
} from 'obsidian';

type VerifyStatus = 'verified' | 'contradicted' | 'unknown' | (string & {});
type VerifyScope = 'current_note' | 'selection';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVerifyEnvelope(value: unknown): value is VerifyEnvelope {
  if (!isRecord(value) || !isRecord(value.data)) return false;
  return typeof value.data.status === 'string';
}

interface HuqanSettings {
  endpoint: string;
  apiKey: string;
  workspaceId: string;
  maxStatements: number;
  reportNameTemplate: string;
}

interface VerifyEnvelope { ok?: boolean;
  data?: {
    status?: VerifyStatus;
    confidence?: number;
    explanation?: string;
    evidenceSummary?: string[];
    contradictionReason?: string;
    risk?: { labels?: string[] };
  };
  evidence?: Array<{ text?: string; kind?: string; confidence?: number }>; error?: { code?: string; message?: string } | string | null; }

interface StatementResult { statement: string; envelope?: VerifyEnvelope; error?: string; }

function quoteMarkdown(value: string): string {
  return String(value || '').split('\n').map(line => `> ${line}`).join('\n');
}

function reportStem(sourceLabel: string): string {
  const base = String(sourceLabel || 'note').replace(/\\/g, '/').split('/').pop() || 'note';
  const withoutExtension = base.replace(/\.md$/i, '');
  return withoutExtension.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'note';
}

function reportTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

const DEFAULT_REPORT_NAME_TEMPLATE = 'HUQAN Report - {note} - {timestamp}';

function sourceVaultLink(sourceLabel: string): string | undefined {
  if (!/\.md$/i.test(sourceLabel)) return undefined;
  return `[[${sourceLabel.replace(/\\/g, '/').replace(/\.md$/i, '')}]]`;
}

function reportFileName(sourceLabel: string, timestamp: string, template: string): string {
  const rendered = String(template || DEFAULT_REPORT_NAME_TEMPLATE)
    .replace(/\{note\}/g, reportStem(sourceLabel))
    .replace(/\{timestamp\}/g, timestamp)
    .replace(/\.md$/i, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^a-zA-Z0-9._() -]+/g, '-')
    .trim()
    .replace(/[ .-]+$/g, '');
  return `${rendered || `HUQAN Report - ${reportStem(sourceLabel)} - ${timestamp}`}.md`;
}

function reportIndexTitle(reportPath: string): string {
  return reportPath.split('/').pop()?.replace(/\.md$/i, '') || 'HUQAN Verification Report';
}

function resultCounts(results: StatementResult[]): { verified: number; contradicted: number; unknown: number; error: number } {
  const counts = { verified: 0, contradicted: 0, unknown: 0, error: 0 };
  results.forEach(result => {
    const status = statusOf(result);
    if (status === 'verified') counts.verified += 1;
    else if (status === 'contradicted') counts.contradicted += 1;
    else if (status === 'error') counts.error += 1;
    else counts.unknown += 1;
  });
  return counts;
}

export function buildReportIndexEntry(
  sourceLabel: string,
  reportPath: string,
  results: StatementResult[],
  generatedAt = new Date(),
): string {
  const counts = resultCounts(results);
  return `- ${generatedAt.toISOString()} · [[${reportIndexTitle(reportPath)}]] · ${sourceLabel} · Contradicted ${counts.contradicted} · Unknown ${counts.unknown} · Verified ${counts.verified} · Errors ${counts.error}`;
}

export function buildDiagnosticSummary(settings: HuqanSettings, pluginVersion = 'unknown'): string {
  let endpointSummary = 'invalid loopback endpoint';
  try {
    const endpoint = new URL(settings.endpoint);
    endpointSummary = `${endpoint.protocol}//${endpoint.hostname}${endpoint.port ? `:${endpoint.port}` : ''}`;
  } catch {
    // Keep diagnostics copy-safe even when the endpoint setting is malformed.
  }
  return [
    `HUQAN plugin version: ${pluginVersion}`,
    `Loopback endpoint: ${endpointSummary}`,
    `API key configured: ${settings.apiKey ? 'yes' : 'no'}`,
    `Workspace configured: ${settings.workspaceId.trim() ? 'yes' : 'no'}`,
    `Statement cap: ${settings.maxStatements}`,
  ].join('\n');
}

export function buildVerificationReport(
  sourceLabel: string,
  scope: VerifyScope,
  results: StatementResult[],
  generatedAt = new Date(),
): string {
  const counts = { verified: 0, contradicted: 0, unknown: 0, error: 0 };
  results.forEach(result => {
    const status = statusOf(result);
    if (status === 'verified') counts.verified += 1;
    else if (status === 'contradicted') counts.contradicted += 1;
    else if (status === 'error') counts.error += 1;
    else counts.unknown += 1;
  });

  const sections = results.map((result, index) => {
    const status = statusOf(result);
    const confidence = result.envelope?.data?.confidence;
    const lines = [
      `### ${index + 1}. ${status}`,
      '',
      '**Statement**',
      quoteMarkdown(result.statement),
    ];
    if (typeof confidence === 'number') lines.push('', `**Confidence:** ${Math.round(confidence * 100)}%`);
    if (result.error) lines.push('', `**Error:** ${result.error}`);
    const explanation = result.envelope?.data?.explanation;
    if (explanation) lines.push('', `**Explanation:** ${explanation}`);
    const contradictionReason = result.envelope?.data?.contradictionReason;
    if (contradictionReason) lines.push('', `**Contradiction reason:** ${contradictionReason}`);
    const evidence = evidenceLines(result.envelope);
    if (evidence.length > 0) lines.push('', '**Evidence**', ...evidence.map(item => `- ${item}`));
    const riskLabels = result.envelope?.data?.risk?.labels;
    if (Array.isArray(riskLabels) && riskLabels.length > 0) lines.push('', `**Risk signals:** ${riskLabels.join(', ')}`);
    return lines.join('\n');
  });

  return [
    '# HUQAN Verification Report',
    '',
    `- Source: ${sourceLabel}`,
    ...(sourceVaultLink(sourceLabel) ? [`- Open in vault: ${sourceVaultLink(sourceLabel)}`] : []),
    `- Scope: ${scope}`,
    `- Generated: ${generatedAt.toISOString()}`,
    '',
    '## Summary',
    '',
    `- Statements checked: ${results.length}`,
    `- Verified: ${counts.verified}`,
    `- Contradicted: ${counts.contradicted}`,
    `- Unknown: ${counts.unknown}`,
    `- Errors: ${counts.error}`,
    '',
    '## Results',
    '',
    ...sections,
    '',
    '> This report was created locally in the Obsidian vault. Review the evidence before changing any note. An unknown result is not a claim that a statement is false.',
    '',
  ].join('\n');
}

const DEFAULT_SETTINGS: HuqanSettings = {
  endpoint: 'http://127.0.0.1:3000',
  apiKey: '',
  workspaceId: 'default',
  maxStatements: 20,
  reportNameTemplate: DEFAULT_REPORT_NAME_TEMPLATE,
};

const MAX_STATEMENT_LENGTH = 480;

function normalizeEndpoint(value: string): string {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('HUQAN endpoint must use http:// or https://');
  }
  const host = parsed.hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) {
    throw new Error('HUQAN only sends API keys to a local loopback server.');
  }
  return `${parsed.protocol}//${parsed.host}`;
}

function splitStatements(markdown: string, limit: number): string[] {
  const withoutFrontmatter = String(markdown || '').replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, '');
  const withoutCode = withoutFrontmatter.replace(/```[\s\S]*?```/g, ' ');
  const candidates = withoutCode
    .split(/\n+/)
    .map(line => line
      .replace(/^\s{0,3}(?:#{1,6}|[-*+]|\d+[.)]|>)\s+/, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(line => line.length >= 8);

  const result: string[] = [];
  for (const candidate of candidates) {
    const words = candidate.split(/\s+/).filter(Boolean);
    let chunk = '';
    for (const word of words) {
      const next = chunk ? `${chunk} ${word}` : word;
      if (next.length > MAX_STATEMENT_LENGTH && chunk) {
        result.push(chunk);
        chunk = word;
        if (result.length >= limit) return result;
      } else {
        chunk = next;
      }
    }
    if (chunk) result.push(chunk);
    if (result.length >= limit) break;
  }
  return result;
}
function statusOf(result: StatementResult): VerifyStatus | 'error' {
  if (result.error) return 'error';
  return result.envelope?.data?.status || 'unknown';
}
function evidenceLines(envelope?: VerifyEnvelope): string[] {
  const summary = envelope?.data?.evidenceSummary;
  if (Array.isArray(summary) && summary.length > 0) return summary.slice(0, 4).map(String);
  return (envelope?.evidence || [])
    .map(item => typeof item?.text === 'string' ? item.text : '')
    .filter(Boolean)
    .slice(0, 4);
}

export function resultGuidance(status: VerifyStatus | 'error'): string {
  if (status === 'contradicted') return 'Conflict detected — review this statement against the evidence below.';
  if (status === 'verified') return 'Supporting evidence returned — review it before relying on the statement.';
  if (status === 'unknown') return 'Not enough evidence — this does not mean the statement is false.';
  if (status === 'error') return 'Verification failed — no conclusion was produced for this statement.';
  return 'Review the returned context before relying on this statement.';
}

function riskLabels(result: StatementResult): string[] {
  const labels = result.envelope?.data?.risk?.labels;
  return Array.isArray(labels) ? labels.map(String).filter(Boolean) : [];
}

function hasRiskSignal(result: StatementResult): boolean {
  return riskLabels(result).length > 0;
}

export function explainConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/loopback|http:\/\/|https:\/\//i.test(message) && /local|endpoint|host|server/i.test(message)) return message;
  if (/401|403|authentication|unauthori[sz]ed|api key/i.test(message)) return 'HUQAN rejected the API key. Check the local runtime key and try again.';
  if (/404|endpoint/i.test(message)) return 'The local HUQAN endpoint was not found. Check the server URL and runtime version.';
  if (/network|fetch|refused|econn|failed to connect|timed out/i.test(message)) return 'The local HUQAN server could not be reached. Start it and check the loopback endpoint.';
  return `HUQAN connection failed: ${message}`;
}

function statusPriority(status: VerifyStatus | 'error'): number {
  if (status === 'contradicted') return 0;
  if (status === 'error') return 1;
  if (status === 'unknown') return 2;
  if (status === 'verified') return 3;
  return 4;
}

class VerificationModal extends Modal {
  constructor(
    app: App,
    private readonly verifyScope: VerifyScope,
    private readonly sourceLabel: string,
    private readonly results: StatementResult[],
    private readonly onSaveReport: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('huqan-trust-panel-modal');
    const shell = contentEl.createDiv({ cls: 'huqan-trust-panel' });
    const header = shell.createDiv({ cls: 'huqan-trust-panel__header' });
    header.createDiv({ cls: 'huqan-trust-panel__eyebrow', text: 'Live HUQAN verification' });
    header.createEl('h2', { text: 'Evidence & Trust' });
    header.createDiv({ cls: 'huqan-trust-panel__source', text: this.sourceLabel });

    const counts = { verified: 0, contradicted: 0, unknown: 0, error: 0, risk: 0 };
    for (const result of this.results) {
      const status = statusOf(result);
      if (status === 'verified') counts.verified += 1;
      else if (status === 'contradicted') counts.contradicted += 1;
      else if (status === 'error') counts.error += 1;
      else counts.unknown += 1;
      if (hasRiskSignal(result)) counts.risk += 1;
    }

    const summary = shell.createDiv({ cls: 'huqan-trust-panel__summary' });
    summary.createEl('strong', { text: `${this.results.length} statement${this.results.length === 1 ? '' : 's'} checked` });
    summary.createDiv({
      cls: `huqan-trust-panel__headline ${counts.contradicted > 0 ? 'has-contradictions' : 'is-clear'}`,
      text: counts.contradicted > 0
        ? `${counts.contradicted} contradiction${counts.contradicted === 1 ? '' : 's'} found — review below`
        : 'No contradictions returned',
    });
    summary.createDiv({
      cls: 'huqan-trust-panel__count-line',
      text: `Verified ${counts.verified} · Contradicted ${counts.contradicted} · Unknown ${counts.unknown} · Errors ${counts.error}`,
    });
    summary.createDiv({ cls: 'huqan-trust-panel__scope', text: `Scope: ${this.verifyScope}` });

    const actions = shell.createDiv({ cls: 'huqan-trust-panel__actions' });
    actions.createEl('button', { text: 'Save report to vault', cls: 'huqan-trust-panel__save-report' })
      .addEventListener('click', () => { void this.onSaveReport(); });
    actions.createDiv({ cls: 'huqan-trust-panel__privacy-note', text: 'The report includes the checked text and returned evidence.' });

    const cards: Array<{ status: string; hasRisk: boolean; element: HTMLElement }> = [];
    const filterButtons: Array<{ key: string; button: HTMLButtonElement }> = [];
    const applyFilter = (filter: string): void => {
      cards.forEach(({ status, hasRisk, element }) => {
        element.style.display = filter === 'all' || status === filter || (filter === 'risk' && hasRisk) ? '' : 'none';
      });
      filterButtons.forEach(({ key, button }) => {
        const active = key === filter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };

    const filterBar = shell.createDiv({ cls: 'huqan-trust-panel__filters', attr: { 'aria-label': 'Filter verification results' } });
    const filterOptions = [
      { key: 'all', label: `All (${this.results.length})` },
      { key: 'contradicted', label: `Contradicted (${counts.contradicted})` },
      { key: 'unknown', label: `Unknown (${counts.unknown})` },
      { key: 'verified', label: `Verified (${counts.verified})` },
      { key: 'risk', label: `Risk signals (${counts.risk})` },
      { key: 'error', label: `Errors (${counts.error})` },
    ];
    filterOptions.forEach(({ key, label }) => {
      const button = filterBar.createEl('button', { cls: 'huqan-trust-panel__filter', text: label });
      button.type = 'button';
      button.addEventListener('click', () => applyFilter(key));
      filterButtons.push({ key, button });
    });

    const list = shell.createDiv({ cls: 'huqan-trust-panel__results' });
    const orderedResults = [...this.results].sort((left, right) => statusPriority(statusOf(left)) - statusPriority(statusOf(right)));
    for (const result of orderedResults) {
      const status = statusOf(result);
      const card = list.createDiv({ cls: `huqan-trust-panel__result is-${status}` });
      cards.push({ status, hasRisk: hasRiskSignal(result), element: card });
      const top = card.createDiv({ cls: 'huqan-trust-panel__result-top' });
      top.createSpan({ cls: 'huqan-trust-panel__status', text: status === 'contradicted' ? 'CONTRADICTION' : status.toUpperCase() });
      const confidence = result.envelope?.data?.confidence;
      if (typeof confidence === 'number') {
        top.createSpan({ cls: 'huqan-trust-panel__confidence', text: `${Math.round(confidence * 100)}% confidence` });
      }
      card.createDiv({ cls: 'huqan-trust-panel__statement', text: result.statement });
      card.createDiv({ cls: 'huqan-trust-panel__guidance', text: resultGuidance(status) });
      if (status === 'contradicted') {
        card.createDiv({
          cls: 'huqan-trust-panel__contradiction-reason',
          text: `Why this is flagged: ${result.envelope?.data?.contradictionReason || 'The local runtime returned a contradiction signal.'}`,
        });
      }
      if (result.error) {
        card.createDiv({ cls: 'huqan-trust-panel__error', text: result.error });
        continue;
      }
      const explanation = result.envelope?.data?.explanation;
      if (explanation) card.createDiv({ cls: 'huqan-trust-panel__explanation', text: explanation });
      const evidence = evidenceLines(result.envelope);
      if (evidence.length > 0) {
        const evidenceEl = card.createDiv({ cls: 'huqan-trust-panel__evidence' });
        evidenceEl.createEl('strong', { text: 'Evidence returned by local runtime' });
        const ul = evidenceEl.createEl('ul');
        evidence.forEach(line => ul.createEl('li', { text: line }));
      } else {
        card.createDiv({ cls: 'huqan-trust-panel__no-evidence', text: 'No evidence summary was returned for this result.' });
      }
      const labels = riskLabels(result);
      if (labels.length > 0) {
        card.createDiv({ cls: 'huqan-trust-panel__risk', text: `Risk signals: ${labels.join(', ')}` });
      }
    }
    applyFilter('all');
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
class HuqanSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: HuqanTrustPanelPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinition<keyof HuqanSettings>[] {
    return [
      {
        name: 'Verification',
        desc: 'Configure the local HUQAN verification connection.',
      },
      {
        name: 'Setup checklist',
        desc: '1. Start the local HUQAN runtime. 2. Set the loopback endpoint and API key. 3. Test the connection. 4. Verify a note or selection.',
      },
      {
        name: 'Local endpoint',
        desc: 'Loopback only. Your API key is never sent to a remote host.',
        control: {
          type: 'text',
          key: 'endpoint',
          placeholder: DEFAULT_SETTINGS.endpoint,
          validate: (value: string) => {
            try {
              normalizeEndpoint(value);
              return undefined;
            } catch (error) {
              return error instanceof Error ? error.message : String(error);
            }
          },
        },
      },
      {
        name: 'API key',
        desc: 'Stored in this plugin\'s local Obsidian data and sent only to the loopback endpoint.',
        render: (setting: Setting) => {
          setting.addText(text => {
            text.inputEl.type = 'password';
            text.setValue(this.plugin.settings.apiKey)
              .onChange(async (value: string) => {
                this.plugin.settings.apiKey = value.trim();
                await this.plugin.saveSettings();
              });
          });
        },
      },
      {
        name: 'Workspace',
        desc: 'HUQAN workspace used by /v2/verify.',
        control: { type: 'text', key: 'workspaceId', defaultValue: DEFAULT_SETTINGS.workspaceId },
      },
      {
        name: 'Statements per note',
        desc: 'Bounds a full-note scan so a large note cannot flood the local verifier.',
        control: {
          type: 'slider',
          key: 'maxStatements',
          defaultValue: DEFAULT_SETTINGS.maxStatements,
          min: 1,
          max: 40,
          step: 1,
          displayFormat: (value: number) => `${Math.round(value)}`,
        },
      },
      {
        name: 'Report filename template',
        desc: 'Optional local filename template. Use {note} and {timestamp}; no data leaves the vault.',
        control: { type: 'text', key: 'reportNameTemplate', defaultValue: DEFAULT_REPORT_NAME_TEMPLATE },
      },
      {
        name: 'Safe diagnostics',
        desc: 'Copy version, endpoint, and configuration flags without API keys or note text.',
        render: (setting: Setting) => {
          setting.addButton(button => button.setButtonText('Copy safe diagnostics').onClick(async () => {
            button.setDisabled(true);
            try {
              await this.plugin.copyDiagnosticSummary();
            } finally {
              button.setDisabled(false);
            }
          }));
        },
      },
      {
        name: 'Connection test',
        desc: 'Checks the configured HUQAN /health endpoint.',
        render: (setting: Setting) => {
          setting.addButton(button => button.setButtonText('Test HUQAN').onClick(async () => {
            button.setDisabled(true);
            try {
              const health = await this.plugin.testConnection();
              new Notice(`HUQAN connected: ${health.service || 'huqan'} · ${health.nodes ?? '?'} nodes`);
            } catch (error) {
              new Notice(explainConnectionError(error));
            } finally {
              button.setDisabled(false);
            }
          }));
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key in this.plugin.settings) return this.plugin.settings[key as keyof HuqanSettings];
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key) {
      case 'endpoint':
        this.plugin.settings.endpoint = normalizeEndpoint(String(value ?? ''));
        break;
      case 'workspaceId':
        this.plugin.settings.workspaceId = String(value ?? '').trim() || DEFAULT_SETTINGS.workspaceId;
        break;
      case 'maxStatements': {
        const parsed = Number(value);
        this.plugin.settings.maxStatements = Number.isFinite(parsed)
          ? Math.min(40, Math.max(1, Math.round(parsed)))
          : DEFAULT_SETTINGS.maxStatements;
        break;
      }
      case 'reportNameTemplate':
        this.plugin.settings.reportNameTemplate = String(value ?? '').trim() || DEFAULT_REPORT_NAME_TEMPLATE;
        break;
      default:
        return;
    }
    await this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName('Verification').setHeading();
    new Setting(containerEl)
      .setName('Setup checklist')
      .setDesc('1. Start the local HUQAN runtime. 2. Set the loopback endpoint and API key. 3. Test the connection. 4. Verify a note or selection.');
    new Setting(containerEl)
      .setName('Local HUQAN endpoint')
      .setDesc('Loopback only. Your API key is never sent to a remote host.')
      .addText(text => text.setPlaceholder(DEFAULT_SETTINGS.endpoint).setValue(this.plugin.settings.endpoint)
        .onChange(async (value: string) => { this.plugin.settings.endpoint = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl)
      .setName('HUQAN API key')
      .setDesc('Stored in this plugin\'s local Obsidian data and sent only to the loopback endpoint.')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setValue(this.plugin.settings.apiKey)
          .onChange(async (value: string) => { this.plugin.settings.apiKey = value.trim(); await this.plugin.saveSettings(); });
      });
    new Setting(containerEl)
      .setName('Workspace')
      .setDesc('HUQAN workspace used by /v2/verify.')
      .addText(text => text.setValue(this.plugin.settings.workspaceId)
        .onChange(async (value: string) => { this.plugin.settings.workspaceId = value.trim() || 'default'; await this.plugin.saveSettings(); }));
    new Setting(containerEl)
      .setName('Statements per note')
      .setDesc('Bounds a full-note scan so a large note cannot flood the local verifier.')
      .addSlider(slider => slider.setLimits(1, 40, 1).setValue(this.plugin.settings.maxStatements)
        .onChange(async (value: number) => { this.plugin.settings.maxStatements = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl)
      .setName('Report filename template')
      .setDesc('Optional local filename template. Use {note} and {timestamp}; no data leaves the vault.')
      .addText(text => text.setPlaceholder(DEFAULT_REPORT_NAME_TEMPLATE).setValue(this.plugin.settings.reportNameTemplate)
        .onChange(async (value: string) => { this.plugin.settings.reportNameTemplate = value.trim() || DEFAULT_REPORT_NAME_TEMPLATE; await this.plugin.saveSettings(); }));
    new Setting(containerEl)
      .setName('Safe diagnostics')
      .setDesc('Copy version, endpoint, and configuration flags without API keys or note text.')
      .addButton(button => button.setButtonText('Copy safe diagnostics').onClick(async () => {
        button.setDisabled(true);
        try {
          await this.plugin.copyDiagnosticSummary();
        } finally {
          button.setDisabled(false);
        }
      }));
    new Setting(containerEl)
      .setName('Connection test')
      .setDesc('Checks the configured HUQAN /health endpoint.')
      .addButton(button => button.setButtonText('Test HUQAN').onClick(async () => {
        button.setDisabled(true);
        try {
          const health = await this.plugin.testConnection();
          new Notice(`HUQAN connected: ${health.service || 'huqan'} · ${health.nodes ?? '?'} nodes`);
        } catch (error) {
          new Notice(explainConnectionError(error));
        } finally {
          button.setDisabled(false);
        }
      }));
  }
}
export default class HuqanTrustPanelPlugin extends Plugin {
  settings: HuqanSettings = { ...DEFAULT_SETTINGS };
  private readonly verificationCache = new Map<string, StatementResult>();

  async onload(): Promise<void> {
    const savedData: unknown = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS };
    if (isRecord(savedData)) {
      if (typeof savedData.endpoint === 'string') this.settings.endpoint = savedData.endpoint;
      if (typeof savedData.apiKey === 'string') this.settings.apiKey = savedData.apiKey;
      if (typeof savedData.workspaceId === 'string') this.settings.workspaceId = savedData.workspaceId;
      if (typeof savedData.maxStatements === 'number') this.settings.maxStatements = savedData.maxStatements;
      if (typeof savedData.reportNameTemplate === 'string') this.settings.reportNameTemplate = savedData.reportNameTemplate.trim() || DEFAULT_REPORT_NAME_TEMPLATE;
    }
    this.addSettingTab(new HuqanSettingTab(this.app, this));
    this.addRibbonIcon('shield-check', 'Verify current note', () => { void this.verifyCurrentNote(); });
    this.addCommand({ id: 'huqan-verify-current-note', name: 'Verify current note', callback: () => { void this.verifyCurrentNote(); } });
    this.addCommand({
      id: 'huqan-verify-selected-text',
      name: 'Verify selected text',
      editorCallback: (editor: Editor) => { void this.verifySelection(editor); },
    });
    this.addCommand({ id: 'huqan-test-connection', name: 'Test connection', callback: () => { void this.showConnectionTest(); } });
  }

  async saveSettings(): Promise<void> {
    this.verificationCache.clear();
    await this.saveData(this.settings);
  }

  private async saveVerificationReport(sourceLabel: string, scope: VerifyScope, results: StatementResult[]): Promise<void> {
    try {
      const folderPath = 'HUQAN Reports';
      if (!this.app.vault.getAbstractFileByPath(folderPath)) await this.app.vault.createFolder(folderPath);

      const timestamp = reportTimestamp(new Date());
      let reportPath = `${folderPath}/${reportFileName(sourceLabel, timestamp, this.settings.reportNameTemplate)}`;
      let suffix = 2;
      while (this.app.vault.getAbstractFileByPath(reportPath)) {
        const extensionlessPath = reportPath.replace(/\.md$/i, '');
        reportPath = `${extensionlessPath} (${suffix}).md`;
        suffix += 1;
      }

      await this.app.vault.create(reportPath, buildVerificationReport(sourceLabel, scope, results));
      try {
        const indexPath = `${folderPath}/HUQAN Reports Index.md`;
        const indexFile = this.app.vault.getAbstractFileByPath(indexPath);
        const entry = buildReportIndexEntry(sourceLabel, reportPath, results);
        if (indexFile instanceof TFile) {
          const current = await this.app.vault.read(indexFile);
          await this.app.vault.modify(indexFile, `${current.trim()}${current.trim() ? '\n' : ''}${entry}\n`);
        } else {
          await this.app.vault.create(indexPath, `# HUQAN Reports Index\n\n${entry}\n`);
        }
      } catch (indexError) {
        new Notice(`Report saved, but the report index could not be updated: ${indexError instanceof Error ? indexError.message : String(indexError)}`);
      }
      new Notice(`Saved HUQAN report: ${reportPath}`);
    } catch (error) {
      new Notice(`Could not save HUQAN report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async copyDiagnosticSummary(): Promise<void> {
    const summary = buildDiagnosticSummary(this.settings, this.manifest.version);
    try {
      await navigator.clipboard.writeText(summary);
      new Notice('Safe diagnostics copied. It contains no API key or note text.');
    } catch (error) {
      new Notice(`Could not copy safe diagnostics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async testConnection(): Promise<Record<string, unknown>> {
    const endpoint = normalizeEndpoint(this.settings.endpoint);
    const response = await requestUrl({ url: `${endpoint}/health`, method: 'GET', throw: false });
    const body: unknown = response.json;
    if (response.status !== 200 || !isRecord(body) || body.ok !== true) throw new Error(`HTTP ${response.status}`);
    return body;
  }

  private async showConnectionTest(): Promise<void> {
    try {
      const health = await this.testConnection();
      new Notice(`HUQAN connected: ${String(health.service || 'huqan')}`);
    } catch (error) {
      new Notice(`HUQAN connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async verifyCurrentNote(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) { new Notice('Open a markdown note first.'); return; }
    const statements = splitStatements(view.editor.getValue(), this.settings.maxStatements);
    await this.verifyStatements('current_note', statements, view.file?.path || 'Current note');
  }

  private async verifySelection(editor: Editor): Promise<void> {
    const selection = editor.getSelection().trim();
    if (!selection) { new Notice('Select text first.'); return; }
    const statements = splitStatements(selection, this.settings.maxStatements);
    await this.verifyStatements('selection', statements.length > 0 ? statements : [selection.slice(0, MAX_STATEMENT_LENGTH)], 'Selected text');
  }

  private async verifyStatements(scope: VerifyScope, statements: string[], label: string): Promise<void> {
    if (!this.settings.apiKey) { new Notice('Set the HUQAN API key in plugin settings first.'); return; }
    if (statements.length === 0) { new Notice('No verifiable text found.'); return; }
    let endpoint: string;
    try { endpoint = normalizeEndpoint(this.settings.endpoint); }
    catch (error) { new Notice(explainConnectionError(error)); return; }

    new Notice(`HUQAN is checking ${statements.length} statement${statements.length === 1 ? '' : 's'}…`);
    const results: StatementResult[] = [];
    let reused = 0;
    for (const statement of statements) {
      const cacheKey = `${endpoint}\u0000${this.settings.workspaceId || 'default'}\u0000${statement}`;
      const cached = this.verificationCache.get(cacheKey);
      if (cached) {
        results.push(cached);
        reused += 1;
        continue;
      }
      const result = await this.verifyOne(endpoint, statement);
      results.push(result);
      if (!result.error) this.verificationCache.set(cacheKey, result);
    }
    if (reused > 0) new Notice(`Reused ${reused} unchanged local result${reused === 1 ? '' : 's'}; no network request was needed.`);
    new VerificationModal(
      this.app,
      scope,
      label,
      results,
      () => this.saveVerificationReport(label, scope, results),
    ).open();
  }

  private async verifyOne(endpoint: string, statement: string): Promise<StatementResult> {
    try {
      const response = await requestUrl({
        url: `${endpoint}/v2/verify`,
        method: 'POST',
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        contentType: 'application/json',
        body: JSON.stringify({ claim: statement, workspaceId: this.settings.workspaceId || 'default' }),
        throw: false,
      });
      const body: unknown = response.json;
      if (response.status !== 200) {
        let message: string | undefined;
        if (isRecord(body)) {
          const error = body.error;
          if (typeof error === 'string') message = error;
          else if (isRecord(error) && typeof error.message === 'string') message = error.message;
        }
        return { statement, error: message || `HUQAN returned HTTP ${response.status}` };
      }
      if (!isVerifyEnvelope(body)) {
        return { statement, error: 'HUQAN returned an invalid verify envelope.' };
      }
      return { statement, envelope: body };
    } catch (error) {
      return { statement, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
