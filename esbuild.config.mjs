import esbuild from 'esbuild';
import process from 'node:process';
import { builtinModules } from 'node:module';
import { copyFile } from 'node:fs/promises';

const prod = process.argv[2] === 'production';
const stylesSource = 'src/styles.css';
const stylesTarget = 'styles.css';
const builtinExternals = [...new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)])];

const copyStylesPlugin = {
  name: 'copy-styles',
  setup(build) {
    build.onEnd(async () => {
      await copyFile(stylesSource, stylesTarget);
    });
  },
};

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    'better-sqlite3',
    ...builtinExternals,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  plugins: [copyStylesPlugin],
});

if (prod) {
  await context.rebuild();
  await copyFile(stylesSource, stylesTarget);
  process.exit(0);
} else {
  await context.watch();
}
