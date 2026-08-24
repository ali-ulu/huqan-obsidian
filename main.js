var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  buildDiagnosticSummary: () => buildDiagnosticSummary,
  buildGraphViewModel: () => buildGraphViewModel,
  buildReportIndexEntry: () => buildReportIndexEntry,
  buildVerificationReport: () => buildVerificationReport,
  default: () => HuqanTrustPanelPlugin,
  explainConnectionError: () => explainConnectionError,
  resultGuidance: () => resultGuidance
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function isVerifyEnvelope(value) {
  if (!isRecord(value) || !isRecord(value.data)) return false;
  return typeof value.data.status === "string";
}
function quoteMarkdown(value) {
  return String(value || "").split("\n").map((line) => `> ${line}`).join("\n");
}
function reportStem(sourceLabel) {
  const base = String(sourceLabel || "note").replace(/\\/g, "/").split("/").pop() || "note";
  const withoutExtension = base.replace(/\.md$/i, "");
  return withoutExtension.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "note";
}
function reportTimestamp(date) {
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}
var DEFAULT_REPORT_NAME_TEMPLATE = "HUQAN Report - {note} - {timestamp}";
function sourceVaultLink(sourceLabel) {
  if (!/\.md$/i.test(sourceLabel)) return void 0;
  return `[[${sourceLabel.replace(/\\/g, "/").replace(/\.md$/i, "")}]]`;
}
function reportFileName(sourceLabel, timestamp, template) {
  const rendered = String(template || DEFAULT_REPORT_NAME_TEMPLATE).replace(/\{note\}/g, reportStem(sourceLabel)).replace(/\{timestamp\}/g, timestamp).replace(/\.md$/i, "").replace(/[\\/]/g, "-").replace(/[^a-zA-Z0-9._() -]+/g, "-").trim().replace(/[ .-]+$/g, "");
  return `${rendered || `HUQAN Report - ${reportStem(sourceLabel)} - ${timestamp}`}.md`;
}
function reportIndexTitle(reportPath) {
  var _a;
  return ((_a = reportPath.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/i, "")) || "HUQAN Verification Report";
}
function resultCounts(results) {
  const counts = { verified: 0, contradicted: 0, unknown: 0, error: 0 };
  results.forEach((result) => {
    const status = statusOf(result);
    if (status === "verified") counts.verified += 1;
    else if (status === "contradicted") counts.contradicted += 1;
    else if (status === "error") counts.error += 1;
    else counts.unknown += 1;
  });
  return counts;
}
function buildReportIndexEntry(sourceLabel, reportPath, results, generatedAt = /* @__PURE__ */ new Date()) {
  const counts = resultCounts(results);
  return `- ${generatedAt.toISOString()} \xB7 [[${reportIndexTitle(reportPath)}]] \xB7 ${sourceLabel} \xB7 Contradicted ${counts.contradicted} \xB7 Unknown ${counts.unknown} \xB7 Verified ${counts.verified} \xB7 Errors ${counts.error}`;
}
function buildDiagnosticSummary(settings, pluginVersion = "unknown") {
  let endpointSummary = "invalid loopback endpoint";
  try {
    const endpoint = new URL(settings.endpoint);
    endpointSummary = `${endpoint.protocol}//${endpoint.hostname}${endpoint.port ? `:${endpoint.port}` : ""}`;
  } catch (e) {
  }
  return [
    `HUQAN plugin version: ${pluginVersion}`,
    `Loopback endpoint: ${endpointSummary}`,
    `API key configured: ${settings.apiKey ? "yes" : "no"}`,
    `Workspace configured: ${settings.workspaceId.trim() ? "yes" : "no"}`,
    `Statement cap: ${settings.maxStatements}`
  ].join("\n");
}
function buildVerificationReport(sourceLabel, scope, results, generatedAt = /* @__PURE__ */ new Date()) {
  const counts = { verified: 0, contradicted: 0, unknown: 0, error: 0 };
  results.forEach((result) => {
    const status = statusOf(result);
    if (status === "verified") counts.verified += 1;
    else if (status === "contradicted") counts.contradicted += 1;
    else if (status === "error") counts.error += 1;
    else counts.unknown += 1;
  });
  const sections = results.map((result, index) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const status = statusOf(result);
    const confidence = (_b = (_a = result.envelope) == null ? void 0 : _a.data) == null ? void 0 : _b.confidence;
    const lines = [
      `### ${index + 1}. ${status}`,
      "",
      "**Statement**",
      quoteMarkdown(result.statement)
    ];
    if (typeof confidence === "number") lines.push("", `**Confidence:** ${Math.round(confidence * 100)}%`);
    if (result.error) lines.push("", `**Error:** ${result.error}`);
    const explanation = (_d = (_c = result.envelope) == null ? void 0 : _c.data) == null ? void 0 : _d.explanation;
    if (explanation) lines.push("", `**Explanation:** ${explanation}`);
    const contradictionReason = (_f = (_e = result.envelope) == null ? void 0 : _e.data) == null ? void 0 : _f.contradictionReason;
    if (contradictionReason) lines.push("", `**Contradiction reason:** ${contradictionReason}`);
    const evidence = evidenceLines(result.envelope);
    if (evidence.length > 0) lines.push("", "**Evidence**", ...evidence.map((item) => `- ${item}`));
    const riskLabels2 = (_i = (_h = (_g = result.envelope) == null ? void 0 : _g.data) == null ? void 0 : _h.risk) == null ? void 0 : _i.labels;
    if (Array.isArray(riskLabels2) && riskLabels2.length > 0) lines.push("", `**Risk signals:** ${riskLabels2.join(", ")}`);
    return lines.join("\n");
  });
  return [
    "# HUQAN Verification Report",
    "",
    `- Source: ${sourceLabel}`,
    ...sourceVaultLink(sourceLabel) ? [`- Open in vault: ${sourceVaultLink(sourceLabel)}`] : [],
    `- Scope: ${scope}`,
    `- Generated: ${generatedAt.toISOString()}`,
    "",
    "## Summary",
    "",
    `- Statements checked: ${results.length}`,
    `- Verified: ${counts.verified}`,
    `- Contradicted: ${counts.contradicted}`,
    `- Unknown: ${counts.unknown}`,
    `- Errors: ${counts.error}`,
    "",
    "## Results",
    "",
    ...sections,
    "",
    "> This report was created locally in the Obsidian vault. Review the evidence before changing any note. An unknown result is not a claim that a statement is false.",
    ""
  ].join("\n");
}
var DEFAULT_SETTINGS = {
  endpoint: "http://127.0.0.1:3000",
  apiKey: "",
  workspaceId: "default",
  maxStatements: 20,
  reportNameTemplate: DEFAULT_REPORT_NAME_TEMPLATE
};
var MAX_STATEMENT_LENGTH = 480;
function normalizeEndpoint(value) {
  const parsed = new URL(String(value || "").trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("HUQAN endpoint must use http:// or https://");
  }
  const host = parsed.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(host)) {
    throw new Error("HUQAN only sends API keys to a local loopback server.");
  }
  return `${parsed.protocol}//${parsed.host}`;
}
function splitStatements(markdown, limit) {
  const withoutFrontmatter = String(markdown || "").replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "");
  const withoutCode = withoutFrontmatter.replace(/```[\s\S]*?```/g, " ");
  const candidates = withoutCode.split(/\n+/).map((line) => line.replace(/^\s{0,3}(?:#{1,6}|[-*+]|\d+[.)]|>)\s+/, "").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\s+/g, " ").trim()).filter((line) => line.length >= 8);
  const result = [];
  for (const candidate of candidates) {
    const words = candidate.split(/\s+/).filter(Boolean);
    let chunk = "";
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
function statusOf(result) {
  var _a, _b;
  if (result.error) return "error";
  return ((_b = (_a = result.envelope) == null ? void 0 : _a.data) == null ? void 0 : _b.status) || "unknown";
}
function evidenceLines(envelope) {
  var _a;
  const summary = (_a = envelope == null ? void 0 : envelope.data) == null ? void 0 : _a.evidenceSummary;
  if (Array.isArray(summary) && summary.length > 0) return summary.slice(0, 4).map(String);
  return ((envelope == null ? void 0 : envelope.evidence) || []).map((item) => typeof (item == null ? void 0 : item.text) === "string" ? item.text : "").filter(Boolean).slice(0, 4);
}
function resultGuidance(status) {
  if (status === "contradicted") return "Conflict detected \u2014 review this statement against the evidence below.";
  if (status === "verified") return "Supporting evidence returned \u2014 review it before relying on the statement.";
  if (status === "unknown") return "Not enough evidence \u2014 this does not mean the statement is false.";
  if (status === "error") return "Verification failed \u2014 no conclusion was produced for this statement.";
  return "Review the returned context before relying on this statement.";
}
function riskLabels(result) {
  var _a, _b, _c;
  const labels = (_c = (_b = (_a = result.envelope) == null ? void 0 : _a.data) == null ? void 0 : _b.risk) == null ? void 0 : _c.labels;
  return Array.isArray(labels) ? labels.map(String).filter(Boolean) : [];
}
function hasRiskSignal(result) {
  return riskLabels(result).length > 0;
}
function explainConnectionError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/loopback|http:\/\/|https:\/\//i.test(message) && /local|endpoint|host|server/i.test(message)) return message;
  if (/401|403|authentication|unauthori[sz]ed|api key/i.test(message)) return "HUQAN rejected the API key. Check the local runtime key and try again.";
  if (/404|endpoint/i.test(message)) return "The local HUQAN endpoint was not found. Check the server URL and runtime version.";
  if (/network|fetch|refused|econn|failed to connect|timed out/i.test(message)) return "The local HUQAN server could not be reached. Start it and check the loopback endpoint.";
  return `HUQAN connection failed: ${message}`;
}
function statusPriority(status) {
  if (status === "contradicted") return 0;
  if (status === "error") return 1;
  if (status === "unknown") return 2;
  if (status === "verified") return 3;
  return 4;
}
var GRAPH_VIEW_TYPE = "huqan-trust-graph";
var GRAPH_VIEW_TITLE = "HUQAN Trust Graph";
var GRAPH_STALE_MS = 30 * 24 * 60 * 60 * 1e3;
function createGraphSvg(parent, tag, options) {
  return parent.createSvg(tag, options);
}
function graphId(value) {
  return String(value != null ? value : "").trim();
}
function graphLinkKey(link) {
  return `${graphId(link.source)}\\u0000${graphId(link.target)}\\u0000${graphId(link.relation || link.type)}`;
}
function relationText(link) {
  return String(link.relation || link.type || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
}
function isConflictRelation(link) {
  return /contradict|conflict|disagree|inconsist|oppos|negat|deny|reject|celisk|degil/.test(relationText(link));
}
function isStaleGraphItem(value) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && Date.now() - timestamp > GRAPH_STALE_MS;
}
function conflictMatchesLink(conflict, link) {
  const proposed = conflict.proposedEdge;
  if (!proposed) return false;
  return graphId(proposed.from) === graphId(link.source) && graphId(proposed.to) === graphId(link.target) && (!proposed.relation || relationText(link) === relationText({ relation: proposed.relation }));
}
function buildGraphViewModel(data) {
  const nodes = Array.isArray(data.nodes) ? data.nodes.map((node) => ({ ...node })) : [];
  const links = Array.isArray(data.links) ? data.links.map((link) => ({ ...link })) : [];
  const conflicts = Array.isArray(data.conflicts) ? data.conflicts.map((conflict) => ({ ...conflict })) : [];
  const nodeById = new Map(nodes.map((node) => [graphId(node.id), node]));
  const ensureNode = (id) => {
    if (!id || nodeById.has(id)) return;
    const node = { id, label: id, confidence: 0, evidenceCount: 0, edgeCount: 0 };
    nodes.push(node);
    nodeById.set(id, node);
  };
  conflicts.forEach((conflict) => {
    var _a, _b, _c, _d, _e, _f;
    const from = graphId((_a = conflict.proposedEdge) == null ? void 0 : _a.from);
    const to = graphId((_b = conflict.proposedEdge) == null ? void 0 : _b.to);
    ensureNode(from);
    ensureNode(to);
    if (!from || !to) return;
    const virtualLink = {
      source: from,
      target: to,
      relation: ((_c = conflict.proposedEdge) == null ? void 0 : _c.relation) || "CONFLICT",
      confidence: (_d = conflict.proposedEdge) == null ? void 0 : _d.confidence,
      type: "conflict-signal",
      evidenceCount: (((_e = conflict.existingEvidence) == null ? void 0 : _e.length) || 0) + (((_f = conflict.proposedEvidence) == null ? void 0 : _f.length) || 0),
      sourceRef: conflict.sourceRef
    };
    if (!links.some((link) => link.type === "conflict-signal" && conflictMatchesLink(conflict, link))) links.push(virtualLink);
  });
  const nodeSignals = /* @__PURE__ */ new Map();
  const linkSignals = /* @__PURE__ */ new Map();
  const markNode = (id, signal) => {
    if (!id) return;
    const previous = nodeSignals.get(id);
    const rank = { normal: 0, evidence: 1, attention: 2, conflict: 3 };
    if (!previous || rank[signal] > rank[previous]) nodeSignals.set(id, signal);
  };
  links.forEach((link) => {
    var _a, _b;
    const explicitConflict = Boolean(link.conflict || link.contradiction);
    const matchedConflict = conflicts.some((conflict) => conflictMatchesLink(conflict, link));
    const signal = explicitConflict || matchedConflict || isConflictRelation(link) ? "conflict" : Number((_b = (_a = link.confidence) != null ? _a : link.weight) != null ? _b : 1) < 0.35 || isStaleGraphItem(link.updatedAt || link.createdAt) ? "attention" : Number(link.evidenceCount || 0) > 0 ? "evidence" : "normal";
    linkSignals.set(graphLinkKey(link), signal);
    markNode(graphId(link.source), signal);
    markNode(graphId(link.target), signal);
  });
  nodes.forEach((node) => {
    var _a, _b;
    const id = graphId(node.id);
    if (!nodeSignals.has(id)) {
      const signal = Number((_b = (_a = node.confidence) != null ? _a : node.weight) != null ? _b : 1) < 0.35 || isStaleGraphItem(node.last_seen || node.created_at) ? "attention" : Number(node.evidenceCount || 0) > 0 ? "evidence" : "normal";
      markNode(id, signal);
    }
  });
  return {
    nodes,
    links,
    conflicts,
    nodeSignals,
    linkSignals,
    conflictCount: [...linkSignals.values()].filter((signal) => signal === "conflict").length,
    attentionCount: [...nodeSignals.values()].filter((signal) => signal === "attention").length,
    evidenceCount: nodes.filter((node) => Number(node.evidenceCount || 0) > 0).length
  };
}
var VerificationModal = class extends import_obsidian.Modal {
  constructor(app, verifyScope, sourceLabel, results, onSaveReport) {
    super(app);
    this.verifyScope = verifyScope;
    this.sourceLabel = sourceLabel;
    this.results = results;
    this.onSaveReport = onSaveReport;
  }
  onOpen() {
    var _a, _b, _c, _d, _e, _f;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("huqan-trust-panel-modal");
    const shell = contentEl.createDiv({ cls: "huqan-trust-panel" });
    const header = shell.createDiv({ cls: "huqan-trust-panel__header" });
    header.createDiv({ cls: "huqan-trust-panel__eyebrow", text: "Live HUQAN verification" });
    header.createEl("h2", { text: "Evidence & Trust" });
    header.createDiv({ cls: "huqan-trust-panel__source", text: this.sourceLabel });
    const counts = { verified: 0, contradicted: 0, unknown: 0, error: 0, risk: 0 };
    for (const result of this.results) {
      const status = statusOf(result);
      if (status === "verified") counts.verified += 1;
      else if (status === "contradicted") counts.contradicted += 1;
      else if (status === "error") counts.error += 1;
      else counts.unknown += 1;
      if (hasRiskSignal(result)) counts.risk += 1;
    }
    const summary = shell.createDiv({ cls: "huqan-trust-panel__summary" });
    summary.createEl("strong", { text: `${this.results.length} statement${this.results.length === 1 ? "" : "s"} checked` });
    summary.createDiv({
      cls: `huqan-trust-panel__headline ${counts.contradicted > 0 ? "has-contradictions" : "is-clear"}`,
      text: counts.contradicted > 0 ? `${counts.contradicted} contradiction${counts.contradicted === 1 ? "" : "s"} found \u2014 review below` : "No contradictions returned"
    });
    summary.createDiv({
      cls: "huqan-trust-panel__count-line",
      text: `Verified ${counts.verified} \xB7 Contradicted ${counts.contradicted} \xB7 Unknown ${counts.unknown} \xB7 Errors ${counts.error}`
    });
    summary.createDiv({ cls: "huqan-trust-panel__scope", text: `Scope: ${this.verifyScope}` });
    const actions = shell.createDiv({ cls: "huqan-trust-panel__actions" });
    actions.createEl("button", { text: "Save report to vault", cls: "huqan-trust-panel__save-report" }).addEventListener("click", () => {
      void this.onSaveReport();
    });
    actions.createDiv({ cls: "huqan-trust-panel__privacy-note", text: "The report includes the checked text and returned evidence." });
    const cards = [];
    const filterButtons = [];
    const applyFilter = (filter) => {
      cards.forEach(({ status, hasRisk, element }) => {
        element.style.display = filter === "all" || status === filter || filter === "risk" && hasRisk ? "" : "none";
      });
      filterButtons.forEach(({ key, button }) => {
        const active = key === filter;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };
    const filterBar = shell.createDiv({ cls: "huqan-trust-panel__filters", attr: { "aria-label": "Filter verification results" } });
    const filterOptions = [
      { key: "all", label: `All (${this.results.length})` },
      { key: "contradicted", label: `Contradicted (${counts.contradicted})` },
      { key: "unknown", label: `Unknown (${counts.unknown})` },
      { key: "verified", label: `Verified (${counts.verified})` },
      { key: "risk", label: `Risk signals (${counts.risk})` },
      { key: "error", label: `Errors (${counts.error})` }
    ];
    filterOptions.forEach(({ key, label }) => {
      const button = filterBar.createEl("button", { cls: "huqan-trust-panel__filter", text: label });
      button.type = "button";
      button.addEventListener("click", () => applyFilter(key));
      filterButtons.push({ key, button });
    });
    const list = shell.createDiv({ cls: "huqan-trust-panel__results" });
    const orderedResults = [...this.results].sort((left, right) => statusPriority(statusOf(left)) - statusPriority(statusOf(right)));
    for (const result of orderedResults) {
      const status = statusOf(result);
      const card = list.createDiv({ cls: `huqan-trust-panel__result is-${status}` });
      cards.push({ status, hasRisk: hasRiskSignal(result), element: card });
      const top = card.createDiv({ cls: "huqan-trust-panel__result-top" });
      top.createSpan({ cls: "huqan-trust-panel__status", text: status === "contradicted" ? "CONTRADICTION" : status.toUpperCase() });
      const confidence = (_b = (_a = result.envelope) == null ? void 0 : _a.data) == null ? void 0 : _b.confidence;
      if (typeof confidence === "number") {
        top.createSpan({ cls: "huqan-trust-panel__confidence", text: `${Math.round(confidence * 100)}% confidence` });
      }
      card.createDiv({ cls: "huqan-trust-panel__statement", text: result.statement });
      card.createDiv({ cls: "huqan-trust-panel__guidance", text: resultGuidance(status) });
      if (status === "contradicted") {
        card.createDiv({
          cls: "huqan-trust-panel__contradiction-reason",
          text: `Why this is flagged: ${((_d = (_c = result.envelope) == null ? void 0 : _c.data) == null ? void 0 : _d.contradictionReason) || "The local runtime returned a contradiction signal."}`
        });
      }
      if (result.error) {
        card.createDiv({ cls: "huqan-trust-panel__error", text: result.error });
        continue;
      }
      const explanation = (_f = (_e = result.envelope) == null ? void 0 : _e.data) == null ? void 0 : _f.explanation;
      if (explanation) card.createDiv({ cls: "huqan-trust-panel__explanation", text: explanation });
      const evidence = evidenceLines(result.envelope);
      if (evidence.length > 0) {
        const evidenceEl = card.createDiv({ cls: "huqan-trust-panel__evidence" });
        evidenceEl.createEl("strong", { text: "Evidence returned by local runtime" });
        const ul = evidenceEl.createEl("ul");
        evidence.forEach((line) => ul.createEl("li", { text: line }));
      } else {
        card.createDiv({ cls: "huqan-trust-panel__no-evidence", text: "No evidence summary was returned for this result." });
      }
      const labels = riskLabels(result);
      if (labels.length > 0) {
        card.createDiv({ cls: "huqan-trust-panel__risk", text: `Risk signals: ${labels.join(", ")}` });
      }
    }
    applyFilter("all");
  }
  onClose() {
    this.contentEl.empty();
  }
};
var HuqanGraphView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.model = buildGraphViewModel({});
    this.filter = "all";
    this.selectedNodeId = "";
    this.plugin = plugin;
    this.navigation = false;
    this.icon = "git-branch";
  }
  getViewType() {
    return GRAPH_VIEW_TYPE;
  }
  getDisplayText() {
    return GRAPH_VIEW_TITLE;
  }
  async onOpen() {
    await this.renderView();
  }
  async onClose() {
    this.contentEl.empty();
  }
  async renderView() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("huqan-graph-view-host");
    const shell = contentEl.createDiv({ cls: "huqan-graph-view" });
    const header = shell.createDiv({ cls: "huqan-graph-view__header" });
    const title = header.createDiv({ cls: "huqan-graph-view__title" });
    title.createDiv({ cls: "huqan-graph-view__eyebrow", text: "Read-only graph signals" });
    title.createEl("h2", { text: "Trust Graph" });
    title.createDiv({ cls: "huqan-graph-view__subtitle", text: `Workspace: ${this.plugin.settings.workspaceId || "default"}` });
    const actions = header.createDiv({ cls: "huqan-graph-view__actions" });
    const refresh = actions.createEl("button", { cls: "huqan-graph-view__refresh", text: "Refresh graph" });
    refresh.type = "button";
    refresh.addEventListener("click", () => {
      void this.loadGraph();
    });
    this.statusEl = shell.createDiv({ cls: "huqan-graph-view__status", text: "Loading graph data\u2026" });
    const legend = shell.createDiv({ cls: "huqan-graph-view__legend", attr: { "aria-label": "Graph signal legend" } });
    this.addLegendItem(legend, "conflict", "Conflict signal", "Derived from runtime conflict metadata or conflict-like relation labels.");
    this.addLegendItem(legend, "attention", "Attention", "Low confidence or stale graph metadata.");
    this.addLegendItem(legend, "evidence", "Evidence-bearing", "The runtime returned one or more evidence references.");
    const filterBar = shell.createDiv({ cls: "huqan-graph-view__filters", attr: { "aria-label": "Graph filters" } });
    [
      ["all", "All"],
      ["conflict", "Conflict signals"],
      ["attention", "Attention"],
      ["evidence", "Evidence-bearing"]
    ].forEach(([key, label]) => {
      const button = filterBar.createEl("button", { cls: "huqan-graph-view__filter", text: label });
      button.type = "button";
      button.addEventListener("click", () => {
        this.filter = key;
        this.updateFilterButtons(filterBar);
        this.drawGraph();
      });
    });
    this.updateFilterButtons(filterBar);
    const layout = shell.createDiv({ cls: "huqan-graph-view__layout" });
    const graphPanel = layout.createDiv({ cls: "huqan-graph-view__canvas-panel" });
    this.graphSvg = createGraphSvg(graphPanel, "svg", {
      cls: "huqan-graph-view__svg",
      attr: { viewBox: "0 0 900 520", role: "img", "aria-label": "HUQAN trust graph" }
    });
    graphPanel.appendChild(this.graphSvg);
    this.detailsEl = layout.createDiv({ cls: "huqan-graph-view__details" });
    this.detailsEl.createEl("h3", { text: "Select a node" });
    this.detailsEl.createDiv({ cls: "huqan-graph-view__muted", text: "Click a node to inspect its bounded graph metadata and any conflict signal." });
    await this.loadGraph();
  }
  addLegendItem(parent, signal, label, description) {
    const item = parent.createDiv({ cls: "huqan-graph-view__legend-item" });
    item.createSpan({ cls: `huqan-graph-view__legend-dot is-${signal}` });
    item.createDiv({ cls: "huqan-graph-view__legend-copy", text: label });
    item.setAttribute("title", description);
  }
  updateFilterButtons(filterBar) {
    filterBar.querySelectorAll("button").forEach((button) => {
      var _a;
      const active = ((_a = button.textContent) == null ? void 0 : _a.toLowerCase().startsWith(this.filter === "all" ? "all" : this.filter)) || false;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  async loadGraph() {
    if (!this.statusEl) return;
    this.statusEl.setText("Loading graph data\u2026");
    try {
      const data = await this.plugin.getGraphData();
      this.model = buildGraphViewModel(data);
      this.statusEl.setText(`${this.model.nodes.length} nodes \xB7 ${this.model.links.length} relations \xB7 ${this.model.conflictCount} conflict signals \xB7 ${this.model.attentionCount} attention nodes`);
      this.drawGraph();
    } catch (error) {
      this.model = buildGraphViewModel({});
      this.statusEl.setText(`Graph unavailable: ${explainConnectionError(error)}`);
      this.drawGraph();
      if (this.detailsEl) {
        this.detailsEl.empty();
        this.detailsEl.createEl("h3", { text: "Graph unavailable" });
        this.detailsEl.createDiv({ cls: "huqan-graph-view__muted", text: "No runtime state was changed. Check the loopback server, workspace, and API key, then refresh." });
      }
    }
  }
  drawGraph() {
    const svg = this.graphSvg;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const visibleNodes = this.model.nodes.filter((node) => {
      const signal = this.model.nodeSignals.get(graphId(node.id)) || "normal";
      if (this.filter === "all") return true;
      if (this.filter === "conflict") return signal === "conflict";
      if (this.filter === "attention") return signal === "conflict" || signal === "attention";
      if (this.filter === "evidence") return Number(node.evidenceCount || 0) > 0;
      return true;
    }).slice(0, 60);
    const visibleIds = new Set(visibleNodes.map((node) => graphId(node.id)));
    const visibleLinks = this.model.links.filter((link) => visibleIds.has(graphId(link.source)) && visibleIds.has(graphId(link.target)));
    const positions = /* @__PURE__ */ new Map();
    const centerX = 450;
    const centerY = 260;
    const radiusX = Math.min(350, 100 + visibleNodes.length * 8);
    const radiusY = Math.min(190, 75 + visibleNodes.length * 4);
    visibleNodes.forEach((node, index) => {
      const angle = visibleNodes.length === 1 ? 0 : Math.PI * 2 * index / visibleNodes.length - Math.PI / 2;
      positions.set(graphId(node.id), {
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY
      });
    });
    const defs = createGraphSvg(svg, "defs");
    svg.appendChild(defs);
    const marker = createGraphSvg(defs, "marker", { attr: { id: "huqan-graph-arrow-conflict", markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: "auto", markerUnits: "strokeWidth" } });
    defs.appendChild(marker);
    const markerPath = createGraphSvg(marker, "path", { attr: { d: "M0,0 L8,4 L0,8 z", fill: "currentColor" } });
    marker.appendChild(markerPath);
    visibleLinks.forEach((link) => {
      const from = positions.get(graphId(link.source));
      const to = positions.get(graphId(link.target));
      if (!from || !to) return;
      const signal = this.model.linkSignals.get(graphLinkKey(link)) || "normal";
      const line = createGraphSvg(svg, "line", {
        cls: `huqan-graph-view__edge is-${signal}`,
        attr: { x1: from.x, y1: from.y, x2: to.x, y2: to.y, "data-relation": link.relation || link.type || "related" }
      });
      if (signal === "conflict") line.setAttribute("marker-end", "url(#huqan-graph-arrow-conflict)");
      const title = createGraphSvg(line, "title");
      title.textContent = `${link.relation || link.type || "related"} \xB7 ${signalLabel(signal)}`;
      line.appendChild(title);
      svg.appendChild(line);
    });
    if (visibleNodes.length === 0) {
      const empty = createGraphSvg(svg, "text", { cls: "huqan-graph-view__empty", attr: { x: centerX, y: centerY, "text-anchor": "middle" } });
      empty.textContent = "No nodes match this filter";
      svg.appendChild(empty);
      return;
    }
    visibleNodes.forEach((node) => {
      const id = graphId(node.id);
      const position = positions.get(id);
      if (!position) return;
      const signal = this.model.nodeSignals.get(id) || "normal";
      const group = createGraphSvg(svg, "g", { cls: `huqan-graph-view__node is-${signal}`, attr: { transform: `translate(${position.x} ${position.y})`, tabindex: "0", role: "button", "aria-label": `Inspect ${node.label || id}` } });
      group.addEventListener("click", () => this.selectNode(id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") this.selectNode(id);
      });
      const circle = createGraphSvg(group, "circle", { attr: { r: signal === "conflict" ? 17 : 14 } });
      const title = createGraphSvg(circle, "title");
      title.textContent = `${node.label || id} \xB7 ${signalLabel(signal)}`;
      circle.appendChild(title);
      group.appendChild(circle);
      const label = createGraphSvg(group, "text", { cls: "huqan-graph-view__node-label", attr: { x: 23, y: 4 } });
      label.textContent = String(node.label || id).slice(0, 42);
      group.appendChild(label);
      svg.appendChild(group);
    });
    const first = visibleNodes.find((node) => graphId(node.id) === this.selectedNodeId) || visibleNodes[0];
    if (first) this.selectNode(graphId(first.id));
    else if (this.detailsEl) {
      this.detailsEl.empty();
      this.detailsEl.createEl("h3", { text: "No matching nodes" });
      this.detailsEl.createDiv({ cls: "huqan-graph-view__muted", text: "Choose another filter or refresh the graph." });
    }
  }
  selectNode(nodeId) {
    var _a, _b;
    this.selectedNodeId = nodeId;
    const node = this.model.nodes.find((item) => graphId(item.id) === nodeId);
    if (!node || !this.detailsEl) return;
    this.detailsEl.empty();
    const signal = this.model.nodeSignals.get(nodeId) || "normal";
    this.detailsEl.createDiv({ cls: `huqan-graph-view__detail-signal is-${signal}`, text: signalLabel(signal) });
    this.detailsEl.createEl("h3", { text: String(node.label || nodeId) });
    this.detailsEl.createDiv({ cls: "huqan-graph-view__muted", text: "Derived graph signal \u2014 review evidence before changing any note." });
    const facts = this.detailsEl.createDiv({ cls: "huqan-graph-view__facts" });
    facts.createDiv({ text: `Confidence: ${formatConfidence((_a = node.confidence) != null ? _a : node.weight)}` });
    facts.createDiv({ text: `Evidence references: ${Number(node.evidenceCount || 0)}` });
    facts.createDiv({ text: `Relations: ${Number(node.edgeCount || 0)}` });
    if ((_b = node.sources) == null ? void 0 : _b.length) facts.createDiv({ text: `Sources: ${node.sources.join(", ")}` });
    const conflicts = this.model.conflicts.filter((conflict) => {
      var _a2, _b2;
      return graphId((_a2 = conflict.proposedEdge) == null ? void 0 : _a2.from) === nodeId || graphId((_b2 = conflict.proposedEdge) == null ? void 0 : _b2.to) === nodeId;
    });
    if (conflicts.length > 0) {
      this.detailsEl.createEl("h4", { text: "Conflict signals" });
      conflicts.slice(0, 6).forEach((conflict) => {
        var _a2;
        const card = (_a2 = this.detailsEl) == null ? void 0 : _a2.createDiv({ cls: "huqan-graph-view__conflict-detail" });
        card == null ? void 0 : card.createEl("strong", { text: conflict.type || "Conflict" });
        card == null ? void 0 : card.createDiv({ text: conflict.reason || "A candidate claim conflicts with graph-backed evidence." });
        if (conflict.claim) card == null ? void 0 : card.createDiv({ cls: "huqan-graph-view__muted", text: `Claim: ${conflict.claim}` });
      });
    }
    const related = this.model.links.filter((link) => graphId(link.source) === nodeId || graphId(link.target) === nodeId).slice(0, 12);
    if (related.length > 0) {
      this.detailsEl.createEl("h4", { text: "Related edges" });
      const list = this.detailsEl.createEl("ul", { cls: "huqan-graph-view__related" });
      related.forEach((link) => {
        const signalForLink = this.model.linkSignals.get(graphLinkKey(link)) || "normal";
        list.createEl("li", { cls: `is-${signalForLink}`, text: `${graphId(link.source)} \u2192 ${link.relation || link.type || "related"} \u2192 ${graphId(link.target)}` });
      });
    }
  }
};
function signalLabel(signal) {
  if (signal === "conflict") return "CONFLICT SIGNAL";
  if (signal === "attention") return "ATTENTION";
  if (signal === "evidence") return "EVIDENCE-BEARING";
  return "NORMAL";
}
function formatConfidence(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "\u2014";
}
var SafeDiagnosticsModal = class extends import_obsidian.Modal {
  constructor(app, summary) {
    super(app);
    this.summary = summary;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("huqan-trust-panel-modal");
    contentEl.createEl("h2", { text: "Safe diagnostics" });
    contentEl.createEl("p", { text: "This summary is safe to review manually. It contains no API key, note text, vault content, or authorization header." });
    contentEl.createEl("pre", { cls: "huqan-trust-panel__diagnostics", text: this.summary });
    contentEl.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};
var HuqanSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  getSettingDefinitions() {
    return [
      {
        name: "Verification",
        desc: "Configure the local HUQAN verification connection."
      },
      {
        name: "Setup checklist",
        desc: "1. Start the local HUQAN runtime. 2. Set the loopback endpoint and API key. 3. Test the connection. 4. Verify a note or selection."
      },
      {
        name: "Local endpoint",
        desc: "Loopback only. Your API key is never sent to a remote host.",
        control: {
          type: "text",
          key: "endpoint",
          placeholder: DEFAULT_SETTINGS.endpoint,
          validate: (value) => {
            try {
              normalizeEndpoint(value);
              return void 0;
            } catch (error) {
              return error instanceof Error ? error.message : String(error);
            }
          }
        }
      },
      {
        name: "API key",
        desc: "Stored in this plugin's local Obsidian data and sent only to the loopback endpoint.",
        render: (setting) => {
          setting.addText((text) => {
            text.inputEl.type = "password";
            text.setValue(this.plugin.settings.apiKey).onChange(async (value) => {
              this.plugin.settings.apiKey = value.trim();
              await this.plugin.saveSettings();
            });
          });
        }
      },
      {
        name: "Workspace",
        desc: "HUQAN workspace used by /v2/verify.",
        control: { type: "text", key: "workspaceId", defaultValue: DEFAULT_SETTINGS.workspaceId }
      },
      {
        name: "Statements per note",
        desc: "Bounds a full-note scan so a large note cannot flood the local verifier.",
        control: {
          type: "slider",
          key: "maxStatements",
          defaultValue: DEFAULT_SETTINGS.maxStatements,
          min: 1,
          max: 40,
          step: 1,
          displayFormat: (value) => `${Math.round(value)}`
        }
      },
      {
        name: "Report filename template",
        desc: "Optional local filename template. Use {note} and {timestamp}; no data leaves the vault.",
        control: { type: "text", key: "reportNameTemplate", defaultValue: DEFAULT_REPORT_NAME_TEMPLATE }
      },
      {
        name: "Safe diagnostics",
        desc: "Show version, endpoint, and configuration flags without API keys or note text.",
        render: (setting) => {
          setting.addButton((button) => button.setButtonText("Show safe diagnostics").onClick(() => {
            this.plugin.showDiagnosticSummary();
          }));
        }
      },
      {
        name: "Connection test",
        desc: "Checks the configured HUQAN /health endpoint.",
        render: (setting) => {
          setting.addButton((button) => button.setButtonText("Test HUQAN").onClick(async () => {
            var _a;
            button.setDisabled(true);
            try {
              const health = await this.plugin.testConnection();
              new import_obsidian.Notice(`HUQAN connected: ${health.service || "huqan"} \xB7 ${(_a = health.nodes) != null ? _a : "?"} nodes`);
            } catch (error) {
              new import_obsidian.Notice(explainConnectionError(error));
            } finally {
              button.setDisabled(false);
            }
          }));
        }
      }
    ];
  }
  getControlValue(key) {
    if (key in this.plugin.settings) return this.plugin.settings[key];
    return void 0;
  }
  async setControlValue(key, value) {
    switch (key) {
      case "endpoint":
        this.plugin.settings.endpoint = normalizeEndpoint(String(value != null ? value : ""));
        break;
      case "workspaceId":
        this.plugin.settings.workspaceId = String(value != null ? value : "").trim() || DEFAULT_SETTINGS.workspaceId;
        break;
      case "maxStatements": {
        const parsed = Number(value);
        this.plugin.settings.maxStatements = Number.isFinite(parsed) ? Math.min(40, Math.max(1, Math.round(parsed))) : DEFAULT_SETTINGS.maxStatements;
        break;
      }
      case "reportNameTemplate":
        this.plugin.settings.reportNameTemplate = String(value != null ? value : "").trim() || DEFAULT_REPORT_NAME_TEMPLATE;
        break;
      default:
        return;
    }
    await this.plugin.saveSettings();
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Verification").setHeading();
    new import_obsidian.Setting(containerEl).setName("Setup checklist").setDesc("1. Start the local HUQAN runtime. 2. Set the loopback endpoint and API key. 3. Test the connection. 4. Verify a note or selection.");
    new import_obsidian.Setting(containerEl).setName("Local HUQAN endpoint").setDesc("Loopback only. Your API key is never sent to a remote host.").addText((text) => text.setPlaceholder(DEFAULT_SETTINGS.endpoint).setValue(this.plugin.settings.endpoint).onChange(async (value) => {
      this.plugin.settings.endpoint = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("HUQAN API key").setDesc("Stored in this plugin's local Obsidian data and sent only to the loopback endpoint.").addText((text) => {
      text.inputEl.type = "password";
      text.setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Workspace").setDesc("HUQAN workspace used by /v2/verify.").addText((text) => text.setValue(this.plugin.settings.workspaceId).onChange(async (value) => {
      this.plugin.settings.workspaceId = value.trim() || "default";
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Statements per note").setDesc("Bounds a full-note scan so a large note cannot flood the local verifier.").addSlider((slider) => slider.setLimits(1, 40, 1).setValue(this.plugin.settings.maxStatements).onChange(async (value) => {
      this.plugin.settings.maxStatements = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Report filename template").setDesc("Optional local filename template. Use {note} and {timestamp}; no data leaves the vault.").addText((text) => text.setPlaceholder(DEFAULT_REPORT_NAME_TEMPLATE).setValue(this.plugin.settings.reportNameTemplate).onChange(async (value) => {
      this.plugin.settings.reportNameTemplate = value.trim() || DEFAULT_REPORT_NAME_TEMPLATE;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Safe diagnostics").setDesc("Show version, endpoint, and configuration flags without API keys or note text.").addButton((button) => button.setButtonText("Show safe diagnostics").onClick(() => {
      this.plugin.showDiagnosticSummary();
    }));
    new import_obsidian.Setting(containerEl).setName("Connection test").setDesc("Checks the configured HUQAN /health endpoint.").addButton((button) => button.setButtonText("Test HUQAN").onClick(async () => {
      var _a;
      button.setDisabled(true);
      try {
        const health = await this.plugin.testConnection();
        new import_obsidian.Notice(`HUQAN connected: ${health.service || "huqan"} \xB7 ${(_a = health.nodes) != null ? _a : "?"} nodes`);
      } catch (error) {
        new import_obsidian.Notice(explainConnectionError(error));
      } finally {
        button.setDisabled(false);
      }
    }));
  }
};
var HuqanTrustPanelPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.verificationCache = /* @__PURE__ */ new Map();
  }
  async onload() {
    const savedData = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS };
    if (isRecord(savedData)) {
      if (typeof savedData.endpoint === "string") this.settings.endpoint = savedData.endpoint;
      if (typeof savedData.apiKey === "string") this.settings.apiKey = savedData.apiKey;
      if (typeof savedData.workspaceId === "string") this.settings.workspaceId = savedData.workspaceId;
      if (typeof savedData.maxStatements === "number") this.settings.maxStatements = savedData.maxStatements;
      if (typeof savedData.reportNameTemplate === "string") this.settings.reportNameTemplate = savedData.reportNameTemplate.trim() || DEFAULT_REPORT_NAME_TEMPLATE;
    }
    this.addSettingTab(new HuqanSettingTab(this.app, this));
    this.registerView(GRAPH_VIEW_TYPE, (leaf) => new HuqanGraphView(leaf, this));
    this.addRibbonIcon("shield-check", "Verify current note", () => {
      void this.verifyCurrentNote();
    });
    this.addCommand({ id: "huqan-verify-current-note", name: "Verify current note", callback: () => {
      void this.verifyCurrentNote();
    } });
    this.addCommand({
      id: "huqan-verify-selected-text",
      name: "Verify selected text",
      editorCallback: (editor) => {
        void this.verifySelection(editor);
      }
    });
    this.addCommand({ id: "huqan-test-connection", name: "Test connection", callback: () => {
      void this.showConnectionTest();
    } });
    this.addCommand({ id: "huqan-open-trust-graph", name: "Open trust graph", callback: () => {
      void this.openGraphView();
    } });
  }
  async openGraphView() {
    const workspace = this.app.workspace;
    const existing = workspace.getLeavesOfType(GRAPH_VIEW_TYPE)[0];
    const leaf = existing || workspace.getRightLeaf(false) || workspace.getLeaf(true);
    await leaf.setViewState({ type: GRAPH_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }
  async saveSettings() {
    this.verificationCache.clear();
    await this.saveData(this.settings);
  }
  async saveVerificationReport(sourceLabel, scope, results) {
    try {
      const folderPath = "HUQAN Reports";
      if (!this.app.vault.getAbstractFileByPath(folderPath)) await this.app.vault.createFolder(folderPath);
      const timestamp = reportTimestamp(/* @__PURE__ */ new Date());
      let reportPath = `${folderPath}/${reportFileName(sourceLabel, timestamp, this.settings.reportNameTemplate)}`;
      let suffix = 2;
      while (this.app.vault.getAbstractFileByPath(reportPath)) {
        const extensionlessPath = reportPath.replace(/\.md$/i, "");
        reportPath = `${extensionlessPath} (${suffix}).md`;
        suffix += 1;
      }
      await this.app.vault.create(reportPath, buildVerificationReport(sourceLabel, scope, results));
      try {
        const indexPath = `${folderPath}/HUQAN Reports Index.md`;
        const indexFile = this.app.vault.getAbstractFileByPath(indexPath);
        const entry = buildReportIndexEntry(sourceLabel, reportPath, results);
        if (indexFile instanceof import_obsidian.TFile) {
          const current = await this.app.vault.read(indexFile);
          await this.app.vault.modify(indexFile, `${current.trim()}${current.trim() ? "\n" : ""}${entry}
`);
        } else {
          await this.app.vault.create(indexPath, `# HUQAN Reports Index

${entry}
`);
        }
      } catch (indexError) {
        new import_obsidian.Notice(`Report saved, but the report index could not be updated: ${indexError instanceof Error ? indexError.message : String(indexError)}`);
      }
      new import_obsidian.Notice(`Saved HUQAN report: ${reportPath}`);
    } catch (error) {
      new import_obsidian.Notice(`Could not save HUQAN report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  showDiagnosticSummary() {
    new SafeDiagnosticsModal(this.app, buildDiagnosticSummary(this.settings, this.manifest.version)).open();
  }
  async testConnection() {
    const endpoint = normalizeEndpoint(this.settings.endpoint);
    const response = await (0, import_obsidian.requestUrl)({ url: `${endpoint}/health`, method: "GET", throw: false });
    const body = response.json;
    if (response.status !== 200 || !isRecord(body) || body.ok !== true) throw new Error(`HTTP ${response.status}`);
    return body;
  }
  async getGraphData() {
    if (!this.settings.apiKey) throw new Error("Set the HUQAN API key in plugin settings first.");
    const endpoint = normalizeEndpoint(this.settings.endpoint);
    const workspaceId = this.settings.workspaceId || "default";
    const response = await (0, import_obsidian.requestUrl)({
      url: `${endpoint}/graph-data?workspaceId=${encodeURIComponent(workspaceId)}`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      throw: false
    });
    const body = response.json;
    if (response.status !== 200) {
      if (isRecord(body) && typeof body.error === "string") throw new Error(body.error);
      throw new Error(`HTTP ${response.status}`);
    }
    if (!isRecord(body) || body.nodes !== void 0 && !Array.isArray(body.nodes) || body.links !== void 0 && !Array.isArray(body.links)) {
      throw new Error("HUQAN returned an invalid graph-data response.");
    }
    return body;
  }
  async showConnectionTest() {
    try {
      const health = await this.testConnection();
      new import_obsidian.Notice(`HUQAN connected: ${String(health.service || "huqan")}`);
    } catch (error) {
      new import_obsidian.Notice(`HUQAN connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async verifyCurrentNote() {
    var _a;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!view) {
      new import_obsidian.Notice("Open a markdown note first.");
      return;
    }
    const statements = splitStatements(view.editor.getValue(), this.settings.maxStatements);
    await this.verifyStatements("current_note", statements, ((_a = view.file) == null ? void 0 : _a.path) || "Current note");
  }
  async verifySelection(editor) {
    const selection = editor.getSelection().trim();
    if (!selection) {
      new import_obsidian.Notice("Select text first.");
      return;
    }
    const statements = splitStatements(selection, this.settings.maxStatements);
    await this.verifyStatements("selection", statements.length > 0 ? statements : [selection.slice(0, MAX_STATEMENT_LENGTH)], "Selected text");
  }
  async verifyStatements(scope, statements, label) {
    if (!this.settings.apiKey) {
      new import_obsidian.Notice("Set the HUQAN API key in plugin settings first.");
      return;
    }
    if (statements.length === 0) {
      new import_obsidian.Notice("No verifiable text found.");
      return;
    }
    let endpoint;
    try {
      endpoint = normalizeEndpoint(this.settings.endpoint);
    } catch (error) {
      new import_obsidian.Notice(explainConnectionError(error));
      return;
    }
    new import_obsidian.Notice(`HUQAN is checking ${statements.length} statement${statements.length === 1 ? "" : "s"}\u2026`);
    const results = [];
    let reused = 0;
    for (const statement of statements) {
      const cacheKey = `${endpoint}\0${this.settings.workspaceId || "default"}\0${statement}`;
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
    if (reused > 0) new import_obsidian.Notice(`Reused ${reused} unchanged local result${reused === 1 ? "" : "s"}; no network request was needed.`);
    new VerificationModal(
      this.app,
      scope,
      label,
      results,
      () => this.saveVerificationReport(label, scope, results)
    ).open();
  }
  async verifyOne(endpoint, statement) {
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: `${endpoint}/v2/verify`,
        method: "POST",
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        contentType: "application/json",
        body: JSON.stringify({ claim: statement, workspaceId: this.settings.workspaceId || "default" }),
        throw: false
      });
      const body = response.json;
      if (response.status !== 200) {
        let message;
        if (isRecord(body)) {
          const error = body.error;
          if (typeof error === "string") message = error;
          else if (isRecord(error) && typeof error.message === "string") message = error.message;
        }
        return { statement, error: message || `HUQAN returned HTTP ${response.status}` };
      }
      if (!isVerifyEnvelope(body)) {
        return { statement, error: "HUQAN returned an invalid verify envelope." };
      }
      return { statement, envelope: body };
    } catch (error) {
      return { statement, error: error instanceof Error ? error.message : String(error) };
    }
  }
};
