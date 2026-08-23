import { readFileSync, writeFileSync } from 'node:fs';

const targetVersion = process.argv[2];
if (!targetVersion || !/^\d+\.\d+\.\d+$/.test(targetVersion)) {
  console.error('Usage: node version-bump.mjs <x.y.z>');
  process.exit(1);
}

const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.version = targetVersion;
writeJson('manifest.json', manifest);

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = manifest.minAppVersion;
writeJson('versions.json', versions);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
packageJson.version = targetVersion;
writeJson('package.json', packageJson);

const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
packageLock.version = targetVersion;
if (packageLock.packages?.['']) packageLock.packages[''].version = targetVersion;
writeJson('package-lock.json', packageLock);

console.log(`Updated plugin version to ${targetVersion}`);
