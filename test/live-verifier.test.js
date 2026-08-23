const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const path = require('node:path');


function loadPlugin({ settings, requestHandler, activeView = null }) {
  const commands = [];
  const notices = [];
  const originalLoad = Module._load;

  class Element {
    empty() {}
    addClass() {}
    createDiv() { return new Element(); }
    createEl() { return new Element(); }
    createSpan() { return new Element(); }
  }
  const settingTabs = [];
  class Plugin {
    constructor() {
      this.app = { workspace: { getActiveViewOfType: () => activeView } };
      this.manifest = { id: 'huqan-trust-panel' };
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
  const PluginClass = require(target).default;
  Module._load = originalLoad;
  return { plugin: new PluginClass(), commands, notices, settingTabs };
}

const waitForAsyncCallback = () => new Promise(resolve => setImmediate(resolve));

test('settings expose searchable declarative definitions without plugin-name headings', async () => {
  const { plugin, settingTabs } = loadPlugin({
    settings: { endpoint: 'http://127.0.0.1:3000', apiKey: '', workspaceId: 'default', maxStatements: 20 },
    requestHandler: async () => ({ status: 200, json: { ok: true } }),
  });
  await plugin.onload();
  const definitions = settingTabs[0].getSettingDefinitions();
  assert.equal(definitions[0].name, 'Verification');
  assert.ok(definitions.every(definition => !definition.name.includes('HUQAN Trust Panel')));
  assert.deepEqual(
    definitions.filter(definition => 'control' in definition).map(definition => definition.control.key),
    ['endpoint', 'workspaceId', 'maxStatements'],
  );
  assert.equal(typeof definitions.find(definition => definition.name === 'API key').render, 'function');
  assert.equal(typeof definitions.find(definition => definition.name === 'Connection test').render, 'function');
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
