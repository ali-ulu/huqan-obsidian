import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const manifest = readJson('manifest.json');
const versions = readJson('versions.json');
const packageJson = readJson('package.json');

if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error(`manifest.version must be x.y.z, got ${manifest.version}`);
}
if (manifest.version !== packageJson.version) {
  throw new Error(`package.json version ${packageJson.version} does not match manifest.version ${manifest.version}`);
}
if (!/^[a-z-]+$/.test(manifest.id) || manifest.id.includes('obsidian') || manifest.id.endsWith('plugin')) {
  throw new Error(`invalid Obsidian plugin id: ${manifest.id}`);
}
if (typeof manifest.minAppVersion !== 'string' || !manifest.minAppVersion) {
  throw new Error('manifest.minAppVersion is required');
}
if (typeof manifest.description !== 'string' || manifest.description.length > 250 || !manifest.description.endsWith('.')) {
  throw new Error('manifest.description must be <= 250 characters and end with a period');
}
if (manifest.isDesktopOnly !== true) {
  throw new Error('manifest.isDesktopOnly must be true for this plugin');
}
if (versions[manifest.version] && versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error(`versions.json mismatch for ${manifest.version}`);
}
for (const file of ['README.md', 'LICENSE', 'main.js', 'manifest.json', 'styles.css', 'versions.json']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`missing release/submission file: ${file}`);
}

const sourceFiles = ['src/main.ts', 'main.js'];
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/document\.createElement\s*\(/.test(source)) {
    throw new Error(`${file} must use Obsidian DOM helpers instead of document.createElement`);
  }
  if (/\.createEl\(\s*['"](?:div|span)['"]/.test(source)) {
    throw new Error(`${file} should use createDiv/createSpan for generic elements`);
  }
  if (/\.setDynamicTooltip\(\s*\)/.test(source)) {
    throw new Error(`${file} must not use deprecated setDynamicTooltip()`);
  }
  if (/setName\(\s*['"]HUQAN Trust Panel['"]\s*\)/.test(source)) {
    throw new Error(`${file} must not use the plugin name in a settings heading`);
  }
}

const pluginSource = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
if (!/getSettingDefinitions\s*\(\s*\)/.test(pluginSource)) {
  throw new Error('PluginSettingTab must implement getSettingDefinitions()');
}

console.log(`PLUGIN_ID=${manifest.id}`);
console.log(`PLUGIN_VERSION=${manifest.version}`);
console.log(`MIN_APP_VERSION=${manifest.minAppVersion}`);
console.log('RELEASE_CONTRACT=PASS');
