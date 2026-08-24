const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const path = require('node:path');


function loadPlugin({ settings, requestHandler, activeView = null }) {
  const commands = [];
  const notices = [];
  const vaultFolders = [];
  const vaultCreates = [];
  const vaultModifies = [];
  const originalLoad = Module._load;

  class Element {
    constructor() {
      this.style = {};
      this.classList = { toggle() {} };
    }
    empty() {}
    addClass() {}
    setAttribute() {}
    createDiv() { return new Element(); }
    createEl() { return new Element(); }
    createSpan() { return new Element(); }
    addEventListener() {}
  }
  const settingTabs = [];
  class Plugin {
    constructor() {
      this.app = {
        workspace: { getActiveViewOfType: () => activeView },
        vault: {
          getAbstractFileByPath: () => null,
          createFolder: async folderPath => { vaultFolders.push(folderPath); },
          create: async (filePath, content) => { vaultCreates.push({ filePath, content }); },
          read: async file => file.content || '',
          modify: async (file, content) => { file.content = content; vaultModifies.push({ file, content }); },
        },
      };
      this.manifest = { id: 'huqan-trust-panel', version: '1.2.0' };
    }
    async loadData() { return settings; }
    async saveData() {}
    addSettingTab(tab) { settingTabs.push(tab); }
    addRibbonIcon() {}
    addCommand(command) { commands.push(command); }
  }
  class Modal {
    constructor() { this.contentEl = new Element(); }
    open() { this.onOpen?.(); }
  }
  class Notice { constructor(message) { notices.push(String(message)); } }
  class PluginSettingTab { constructor() { this.containerEl = new Element(); } }
  class Setting {
    setName() { return this; }
    setHeading() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addSlider() { return this; }
    addButton() { return this; }
  }

  const obsidian = {
    Plugin,
    Modal,
    Notice,
    PluginSettingTab,
    Setting,
    TFile: class {},
    MarkdownView: class {},
    Editor: class {},
    requestUrl: requestHandler,
  };
  Module._load = function(request, parent, isMain) {
    if (request === 'obsidian') return obsidian;
    return originalLoad.call(this, request, parent, isMain);
  };

  const target = path.resolve(__dirname, '..', 'main.js');
  delete require.cache[target];
  const pluginModule = require(target);
  const PluginClass = pluginModule.default;
  Module._load = originalLoad;
  return {
    plugin: new PluginClass(),
    commands,
    notices,
    settingTabs,
    vaultFolders,
    vaultCreates,
    vaultModifies,
    buildVerificationReport: pluginModule.buildVerificationReport,
    buildReportIndexEntry: pluginModule.buildReportIndexEntry,
    buildDiagnosticSummary: pluginModule.buildDiagnosticSummary,
    explainConnectionError: pluginModule.explainConnectionError,
    resultGuidance: pluginModule.resultGuidance,
  };
}

const waitForAsyncCallback = () => new Promise(resolve => setImmediate(resolve));

test('settings expose searchable declarative definitions without plugin-name headings', async () => {
  const { plugin, settingTabs, commands } = loadPlugin({
    settings: { endpoint: 'http://127.0.0.1:3000', apiKey: '', workspaceId: 'default', maxStatements: 20 },
    requestHandler: async () => ({ status: 200, json: { ok: true } }),
  });
  await plugin.onload();
  const definitions = settingTabs[0].getSettingDefinitions();
  assert.equal(require('../manifest.json').name, 'Huqan');
  assert.equal(definitions[0].name, 'Verification');
  assert.ok(definitions.every(definition => definition.name !== 'HUQAN'));
  assert.deepEqual(commands.map(command => command.name), ['Verify current note', 'Verify selected text', 'Test connection']);
  assert.deepEqual(
    definitions.filter(definition => 'control' in definition).map(definition => definition.control.key),
    ['endpoint', 'workspaceId', 'maxStatements', 'reportNameTemplate'],
  );
  assert.equal(typeof definitions.find(definition => definition.name === 'Safe diagnostics').render, 'function');
  assert.match(definitions.find(definition => definition.name === 'Safe diagnostics').desc, /Show version/);
  assert.equal(typeof definitions.find(definition => definition.name === 'API key').render, 'function');
  assert.equal(typeof definitions.find(definition => definition.name === 'Connection test').render, 'function');
});

test('result guidance makes contradiction and unknown semantics explicit', () => {
  const { resultGuidance } = loadPlugin({ settings: {}, requestHandler: async () => ({ status: 200, json: { ok: true } }) });
  assert.match(resultGuidance('contradicted'), /Conflict detected/);
  assert.match(resultGuidance('unknown'), /does not mean the statement is false/);
  assert.match(resultGuidance('verified'), /Supporting evidence returned/);
});

test('verification reports preserve contradiction details and evidence in Markdown', () => {
  const { buildVerificationReport } = loadPlugin({ settings: {}, requestHandler: async () => ({ status: 200, json: { ok: true } }) });
  const report = buildVerificationReport(
    'notes/example.md',
    'current_note',
    [{
      statement: 'The example claim',
      envelope: {
        data: {
          status: 'contradicted',
          confidence: 0.25,
          explanation: 'A conflicting source was found.',
          contradictionReason: 'The local evidence disagrees.',
          evidenceSummary: ['Source A conflicts with the claim.'],
          risk: { labels: ['conflict'] },
        },
      },
    }],
    new Date('2026-08-24T12:00:00.000Z'),
  );
  assert.match(report, /# HUQAN Verification Report/);
  assert.ok(report.includes('- Open in vault: [[notes/example]]'));
  assert.match(report, /- Contradicted: 1/);
  assert.ok(report.includes('The local evidence disagrees.'));
  assert.ok(report.includes('Source A conflicts with the claim.'));
  assert.ok(report.includes('**Risk signals:** conflict'));
});

test('verification reports are saved, indexed, and use the configured filename template', async () => {
  const { plugin, notices, vaultFolders, vaultCreates } = loadPlugin({
    settings: { reportNameTemplate: 'Review - {note} - {timestamp}' },
    requestHandler: async () => ({ status: 200, json: { ok: true } }),
  });
  await plugin.onload();
  await plugin.saveVerificationReport('notes/Conflict note.md', 'current_note', [{
    statement: 'The example claim',
    envelope: { data: { status: 'contradicted', contradictionReason: 'Evidence disagrees.' } },
  }]);
  assert.deepEqual(vaultFolders, ['HUQAN Reports']);
  assert.equal(vaultCreates.length, 2);
  const reportFile = vaultCreates.find(file => file.filePath.startsWith('HUQAN Reports/Review - Conflict-note - '));
  const indexFile = vaultCreates.find(file => file.filePath === 'HUQAN Reports/HUQAN Reports Index.md');
  assert.ok(reportFile);
  assert.ok(indexFile);
  assert.match(reportFile.filePath, /\.md$/);
  assert.match(reportFile.content, /Contradicted: 1/);
  assert.ok(reportFile.content.includes('Evidence disagrees.'));
  assert.ok(indexFile.content.includes('[[Review - Conflict-note - '));
  assert.ok(notices.some(message => message.includes('Saved HUQAN report')));
});

test('safe diagnostics exclude API keys and note content', () => {
  const { buildDiagnosticSummary } = loadPlugin({ settings: {}, requestHandler: async () => ({ status: 200, json: { ok: true } }) });
  const summary = buildDiagnosticSummary({ endpoint: 'http://127.0.0.1:3000', apiKey: 'do-not-copy', workspaceId: 'vault-a', maxStatements: 20, reportNameTemplate: 'Review' }, '1.2.0');
  assert.ok(summary.includes('HUQAN plugin version: 1.2.0'));
  assert.ok(summary.includes('API key configured: yes'));
  assert.ok(!summary.includes('do-not-copy'));
  assert.ok(!summary.includes('private note text'));
});

test('connection errors are translated into actionable local guidance', () => {
  const { explainConnectionError } = loadPlugin({ settings: {}, requestHandler: async () => ({ status: 200, json: { ok: true } }) });
  assert.match(explainConnectionError(new Error('ECONNREFUSED')), /local HUQAN server could not be reached/i);
  assert.match(explainConnectionError(new Error('HTTP 401')), /API key/i);
});

test('unchanged statements reuse the in-memory result without a second network request', async () => {
  const calls = [];
  const { plugin, notices } = loadPlugin({
    settings: { endpoint: 'http://127.0.0.1:3000', apiKey: 'secret', workspaceId: 'vault-a', maxStatements: 20 },
    requestHandler: async options => {
      calls.push(options);
      return { status: 200, json: { ok: true, data: { status: 'contradicted', contradictionReason: 'The evidence conflicts.' } } };
    },
  });
  await plugin.onload();
  await plugin.verifyStatements('selection', ['Cats are animals'], 'Selected text');
  await plugin.verifyStatements('selection', ['Cats are animals'], 'Selected text');
  assert.equal(calls.length, 1);
  assert.ok(notices.some(message => message.includes('Reused 1 unchanged local result')));
});

test('selected text is verified through the local HUQAN v2 endpoint', async () => {
  const calls = [];
  const { plugin, commands } = loadPlugin({
    settings: { endpoint: 'http://127.0.0.1:3000', apiKey: 'secret', workspaceId: 'vault-a', maxStatements: 20 },
    requestHandler: async options => {
      calls.push(options);
      return { status: 200, json: { ok: true, data: { status: 'verified', confidence: 0.9, evidenceSummary: ['cat --[type]--> animal'] }, evidence: [] } };
    },
  });
  await plugin.onload();
  const command = commands.find(item => item.id === 'huqan-verify-selected-text');
  assert.ok(command);
  command.editorCallback({ getSelection: () => 'Cats are animals' });
  await waitForAsyncCallback();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:3000/v2/verify');
  assert.equal(calls[0].headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(calls[0].body), { claim: 'Cats are animals', workspaceId: 'vault-a' });
});

test('remote endpoints are rejected before the API key can leave the machine', async () => {
  const calls = [];
  const { plugin, commands, notices } = loadPlugin({
    settings: { endpoint: 'https://example.com', apiKey: 'secret', workspaceId: 'default', maxStatements: 20 },
    requestHandler: async options => { calls.push(options); throw new Error('should not be called'); },
  });
  await plugin.onload();
  const command = commands.find(item => item.id === 'huqan-verify-selected-text');
  command.editorCallback({ getSelection: () => 'Cats are animals' });
  await waitForAsyncCallback();
  assert.equal(calls.length, 0);
  assert.ok(notices.some(message => message.includes('loopback server')));
});

test('current-note verification strips frontmatter and fenced code and honors the statement limit', async () => {
  const calls = [];
  const activeView = {
    file: { path: 'notes/example.md' },
    editor: { getValue: () => '---\ntitle: Example\n---\n\n# Heading\nCats are animals\n```js\nsecret = true\n```\nDogs are animals\nBirds can fly\n' },
  };
  const { plugin, commands } = loadPlugin({
    settings: { endpoint: 'http://localhost:3000', apiKey: 'secret', workspaceId: 'default', maxStatements: 2 },
    activeView,
    requestHandler: async options => {
      calls.push(JSON.parse(options.body));
      return { status: 200, json: { ok: true, data: { status: 'unknown' } } };
    },
  });
  await plugin.onload();
  const command = commands.find(item => item.id === 'huqan-verify-current-note');
  command.callback();
  await waitForAsyncCallback();
  await waitForAsyncCallback();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.claim), ['Cats are animals', 'Dogs are animals']);
  assert.ok(calls.every(call => call.workspaceId === 'default'));
  assert.ok(!calls.some(call => call.claim.includes('secret')));
});

test('missing API keys fail locally without making a request', async () => {
  const calls = [];
  const { plugin, commands, notices } = loadPlugin({
    settings: { endpoint: 'http://127.0.0.1:3000', apiKey: '', workspaceId: 'default', maxStatements: 20 },
    requestHandler: async options => { calls.push(options); return { status: 200, json: { ok: true } }; },
  });
  await plugin.onload();
  const command = commands.find(item => item.id === 'huqan-verify-selected-text');
  command.editorCallback({ getSelection: () => 'Cats are animals' });
  await waitForAsyncCallback();
  assert.equal(calls.length, 0);
  assert.ok(notices.some(message => message.includes('API key')));
});

test('connection test uses the local health endpoint and rejects non-200 responses', async () => {
  const calls = [];
  const { plugin } = loadPlugin({
    settings: { endpoint: 'http://[::1]:3000', apiKey: 'secret', workspaceId: 'default', maxStatements: 20 },
    requestHandler: async options => {
      calls.push(options);
      return { status: 503, json: { ok: false } };
    },
  });
  await plugin.onload();
  await assert.rejects(() => plugin.testConnection(), /HTTP 503/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://[::1]:3000/health');
});
