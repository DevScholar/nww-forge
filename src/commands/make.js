import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadForgeConfig, readPackageJson, normaliseMaker } from '../utils/forge-config.js';
import { info, ok, warn, error } from '../utils/log.js';
import packageCmd from './package.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Built-in makers: short name → module path mapping. */
const BUILTIN_MAKERS = {
  'zip':              path.join(__dirname, '..', 'makers', 'zip.js'),
  '@nww-forge/maker-zip': path.join(__dirname, '..', 'makers', 'zip.js'),
};

async function loadMaker(name, projectDir) {
  // 1. Built-in
  if (BUILTIN_MAKERS[name]) {
    const mod = await import(BUILTIN_MAKERS[name]);
    return mod;
  }
  // 2. Installed npm package
  const local = path.join(projectDir, 'node_modules', ...name.split('/'), 'index.js');
  if (fs.existsSync(local)) {
    const { pathToFileURL } = await import('node:url');
    const mod = await import(pathToFileURL(local).href);
    return mod;
  }
  error(`Maker '${name}' not found. Install it with: npm install ${name}`);
  process.exit(1);
}

export default async function make(args) {
  const cwd     = process.cwd();
  const pkg     = readPackageJson(cwd);
  const config  = await loadForgeConfig(cwd);
  const appName = config.packagerConfig?.executableName ?? pkg.name ?? 'app';
  const version = pkg.version ?? '1.0.0';
  const platform = process.platform === 'win32' ? 'win32' : 'linux';
  const arch    = process.arch;

  // Run package step first
  const outDir = await packageCmd([]);

  const makeDir = path.join(cwd, 'out', 'make');
  fs.mkdirSync(makeDir, { recursive: true });

  const makers = (config.makers ?? [{ name: '@nww-forge/maker-zip' }]).map(normaliseMaker);

  if (makers.length === 0) {
    warn('No makers configured. Add makers to forge.config.js.');
    return;
  }

  info(`Running ${makers.length} maker(s)...`);

  const outputs = [];
  for (const { name, config: makerConfig } of makers) {
    const maker = await loadMaker(name, cwd);
    const result = await maker.make({
      outDir,
      appName,
      version,
      platform,
      arch,
      makeDir,
      config: makerConfig,
    });
    if (result) outputs.push(result);
  }

  console.log('');
  ok('make complete.');
  if (outputs.length > 0) {
    console.log('  Output files:');
    for (const f of outputs) console.log(`    ${path.relative(cwd, f)}`);
    console.log('');
  }
}
