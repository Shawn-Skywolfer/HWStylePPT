#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { transform } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sourceDir = path.join(root, 'packages/html-deck-to-pptx/src');
const outfile = path.join(root, 'assets/vendor/editable-pptx-browser.js');
const collectorSource = readFileSync(path.join(sourceDir, 'collector-functions.mjs'), 'utf8');
let coreSource = readFileSync(path.join(sourceDir, 'editable-core.mjs'), 'utf8');
let browserSource = readFileSync(path.join(sourceDir, 'editable-browser.mjs'), 'utf8');

// Browser entry imports the two shared modules. Compile each module into its own
// IIFE and replace those imports with destructuring from the generated globals;
// this avoids dependency on a repository-specific bundler while preserving the
// exact same source for browser-side and server-side export.
coreSource = coreSource.replace(
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/collector-functions\.mjs['"];?/,
  'const {$1} = __editablePptxCollector;',
);
browserSource = browserSource
  .replace(/import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/collector-functions\.mjs['"];?/, 'const {$1} = __editablePptxCollector;')
  .replace(/import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/editable-core\.mjs['"];?/, 'const {$1} = __editablePptxCore;')
  .replace(/export\s*\{\s*applyEditablePptxSnapshot\s*\}\s*from\s*['"]\.\/collector-functions\.mjs['"];?/, 'export { applyEditablePptxSnapshot };');

async function compile(source, globalName, sourcefile) {
  const result = await transform(source, {
    loader: 'js',
    format: 'iife',
    globalName,
    target: 'chrome109',
    minify: true,
    legalComments: 'none',
    sourcefile,
  });
  return result.code.trim();
}

const parts = await Promise.all([
  compile(collectorSource, '__editablePptxCollector', 'collector-functions.mjs'),
  compile(coreSource, '__editablePptxCore', 'editable-core.mjs'),
  compile(browserSource, '__editablePptxBrowser', 'editable-browser.mjs'),
]);
mkdirSync(path.dirname(outfile), { recursive: true });
writeFileSync(outfile, `/* Generated from packages/html-deck-to-pptx/src; do not edit directly. */\n${parts.join('\n')}\n`);

console.log(`Built ${path.relative(root, outfile)}`);
