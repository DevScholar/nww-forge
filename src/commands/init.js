import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { log, info, ok, warn, error } from '../utils/log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const SUPPORTED_TEMPLATES = ['vanilla', 'vanilla-ts'];

function parseArgs(args) {
  let appName = null;
  let template = 'vanilla';
  for (const arg of args) {
    if (arg.startsWith('--template=')) template = arg.slice(11);
    else if (!appName && !arg.startsWith('-'))  appName = arg;
  }
  return { appName, template };
}

/** Replace {{name}}, {{displayName}} placeholders in a string. */
function applyVars(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? _);
}

/** Copy a template directory into destDir, substituting template vars. */
function copyTemplate(templateDir, destDir, vars) {
  for (const entry of fs.readdirSync(templateDir, { withFileTypes: true })) {
    const srcPath  = path.join(templateDir, entry.name);
    // Strip .tmpl extension from destination filename
    const destName = entry.name.endsWith('.tmpl') ? entry.name.slice(0, -5) : entry.name;
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTemplate(srcPath, destPath, vars);
    } else {
      const raw = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(destPath, applyVars(raw, vars));
    }
  }
}

/** Install npm deps in the given directory. */
function npmInstall(dir) {
  info('Running npm install...');
  const isWin = process.platform === 'win32';
  const result = spawnSync(isWin ? 'npm.cmd' : 'npm', ['install'], {
    stdio: 'inherit',
    cwd: dir,
    shell: isWin,
  });
  return result.status === 0;
}

/** Download WebView2 DLLs using the node-with-window install script. */
function downloadWebView2(dir) {
  const installScript = path.join(
    dir, 'node_modules', '@devscholar', 'node-with-window', 'scripts', 'webview2-install.js'
  );
  if (!fs.existsSync(installScript)) {
    warn('WebView2 install script not found — skipping WebView2 download.');
    warn(`Run manually: node node_modules/@devscholar/node-with-window/scripts/webview2-install.js install`);
    return;
  }
  info('Downloading WebView2 SDK DLLs...');
  const result = spawnSync(process.execPath, [installScript, 'install'], {
    stdio: 'inherit',
    cwd: dir,
  });
  if (result.status !== 0) {
    warn('WebView2 download failed. Run manually: node node_modules/@devscholar/node-with-window/scripts/webview2-install.js install');
  }
}

export default async function init(args) {
  const { appName: rawName, template } = parseArgs(args);

  if (!SUPPORTED_TEMPLATES.includes(template)) {
    error(`Unknown template '${template}'. Supported: ${SUPPORTED_TEMPLATES.join(', ')}`);
    process.exit(1);
  }

  const appName = rawName ?? 'my-nww-app';
  const destDir  = path.resolve(process.cwd(), appName);

  if (fs.existsSync(destDir)) {
    error(`Directory '${appName}' already exists.`);
    process.exit(1);
  }

  // Display name: capitalise words, replace hyphens/underscores with spaces
  const displayName = appName.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const vars = { name: appName, displayName };

  log(`Creating a new node-with-window app in ${destDir}`);
  log(`Template: ${template}`);

  // Copy template
  const templateDir = path.join(TEMPLATES_DIR, template);
  fs.mkdirSync(destDir, { recursive: true });
  copyTemplate(templateDir, destDir, vars);
  ok('Template files created.');

  // npm install
  if (!npmInstall(destDir)) {
    error('npm install failed.');
    process.exit(1);
  }
  ok('Dependencies installed.');

  // WebView2 (Windows only)
  if (process.platform === 'win32') {
    downloadWebView2(destDir);
  }

  console.log('');
  ok(`Done! Your app is ready at ${destDir}`);
  console.log('');
  console.log('  To start developing:');
  console.log('');
  console.log(`    cd ${appName}`);
  console.log('    npm start');
  console.log('');
}
