import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadForgeConfig, readPackageJson, resolveMainEntry } from '../utils/forge-config.js';
import { info, ok, warn, error } from '../utils/log.js';

/** Dirs to always exclude when copying the project (at any depth). */
const COPY_EXCLUDE_DIRS = new Set(['node_modules', 'out', 'dist', '.git', '.cache']);
/** File extensions to exclude from copy (compiled away by esbuild). */
const COPY_EXCLUDE_EXTS = new Set(['.ts', '.tsx']);

/** Copy a directory recursively, skipping excluded dirs/extensions at every level. */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && COPY_EXCLUDE_DIRS.has(entry.name)) continue;
    if (!entry.isDirectory() && COPY_EXCLUDE_EXTS.has(path.extname(entry.name))) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/** Copy a specific node_modules package (and resolve its deps transitively — one level). */
function copyNodeModule(srcModules, destModules, pkgName) {
  const parts = pkgName.split('/');          // e.g. ['@devscholar', 'node-ps1-dotnet']
  const srcPkg  = path.join(srcModules, ...parts);
  const destPkg = path.join(destModules, ...parts);
  if (!fs.existsSync(srcPkg)) return;
  if (fs.existsSync(destPkg)) return;        // already copied

  copyDir(srcPkg, destPkg);

  // Copy transitive deps listed in that package's dependencies
  const subPkg = path.join(srcPkg, 'package.json');
  if (!fs.existsSync(subPkg)) return;
  try {
    const meta = JSON.parse(fs.readFileSync(subPkg, 'utf8'));
    for (const dep of Object.keys(meta.dependencies ?? {})) {
      copyNodeModule(srcModules, destModules, dep);
    }
  } catch { /* ignore */ }
}

/** Find esbuild binary: local node_modules, then npx. */
function findEsbuild(cwd) {
  const isWin = process.platform === 'win32';
  const local = path.join(cwd, 'node_modules', '.bin', isWin ? 'esbuild.cmd' : 'esbuild');
  if (fs.existsSync(local)) return { cmd: local, pre: [] };
  return { cmd: isWin ? 'npx.cmd' : 'npx', pre: ['esbuild'] };
}

/** Detect WebView2 DLL directory from node-with-window runtimes. */
function findWebView2Dir(cwd) {
  const fromEnv = process.env.NODE_WITH_WINDOW_WEBVIEW2_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const local = path.join(cwd, 'node_modules', '@devscholar', 'node-with-window', 'runtimes', 'webview2');
  if (fs.existsSync(local)) {
    // read current.txt to find the versioned subdir
    const currentTxt = path.join(local, 'current.txt');
    if (fs.existsSync(currentTxt)) {
      const ver = fs.readFileSync(currentTxt, 'utf8').trim();
      const verDir = path.join(local, ver);
      if (fs.existsSync(verDir)) return verDir;
    }
    return local;
  }
  return null;
}

export default async function packageCmd(args) {
  const cwd      = process.cwd();
  const pkg      = readPackageJson(cwd);
  const config   = await loadForgeConfig(cwd);
  const appName  = config.packagerConfig?.executableName ?? pkg.name ?? 'app';
  const platform = process.platform === 'win32' ? 'win32' : 'linux';
  const arch     = process.arch;
  const outName  = `${appName}-${platform}-${arch}`;
  const outDir   = path.join(cwd, 'out', outName);

  info(`Packaging ${appName} → out/${outName}/`);

  // Clean output dir
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Copy project source files (excluding node_modules, out, dist, .git)
  info('Copying project files...');
  copyDir(cwd, outDir);
  ok('Project files copied.');

  // 2. Bundle main entry with esbuild (overwrite in output)
  const mainEntry = resolveMainEntry(cwd, pkg);
  if (!fs.existsSync(mainEntry)) {
    error(`Main entry not found: ${mainEntry}`);
    process.exit(1);
  }

  const bundledMain = path.join(outDir, 'main.js');
  const { cmd: esbuild, pre } = findEsbuild(cwd);
  const externals = ['@devscholar/node-ps1-dotnet', '@devscholar/node-with-gjs'];

  info(`Bundling ${path.relative(cwd, mainEntry)}...`);
  const buildResult = spawnSync(
    esbuild,
    [
      ...pre, mainEntry,
      '--bundle',
      `--outfile=${bundledMain}`,
      '--format=esm',
      '--platform=node',
      '--target=node18',
      '--sourcemap',
      ...externals.map(e => `--external:${e}`),
    ],
    { stdio: 'inherit', cwd, shell: process.platform === 'win32' }
  );
  if (buildResult.status !== 0) {
    error('esbuild failed.');
    process.exit(1);
  }
  ok('Main process bundled.');

  // 3. Copy external native modules
  const srcModules  = path.join(cwd, 'node_modules');
  const destModules = path.join(outDir, 'node_modules');
  for (const ext of externals) {
    const pkgPath = path.join(srcModules, ...ext.split('/'));
    if (fs.existsSync(pkgPath)) {
      info(`Copying ${ext}...`);
      copyNodeModule(srcModules, destModules, ext);
    }
  }

  // 4. Copy WebView2 DLLs (Windows)
  if (process.platform === 'win32') {
    const wv2Dir = findWebView2Dir(cwd);
    if (wv2Dir) {
      info('Copying WebView2 DLLs...');
      const destWv2 = path.join(outDir, 'runtimes', 'webview2');
      copyDir(wv2Dir, destWv2);
      ok('WebView2 DLLs copied.');
    } else {
      warn('WebView2 DLLs not found. Run: node node_modules/@devscholar/node-with-window/scripts/webview2-install.js install');
    }
  }

  // 5. Write minimal package.json for the output
  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    JSON.stringify({ name: appName, version: pkg.version ?? '1.0.0', type: 'module', main: 'main.js' }, null, 2)
  );

  // 6. Bundle Node.js binary
  const nodeSrc = process.execPath;
  const nodeExt = process.platform === 'win32' ? '.exe' : '';
  const nodeDest = path.join(outDir, `node${nodeExt}`);
  info(`Copying Node.js binary from ${nodeSrc}...`);
  fs.copyFileSync(nodeSrc, nodeDest);
  if (process.platform !== 'win32') fs.chmodSync(nodeDest, 0o755);
  ok('Node.js binary bundled.');

  // 7. Write launch scripts
  if (process.platform === 'win32') {
    const bat = [
      '@echo off',
      'chcp 65001>nul',
      'set "DIR=%~dp0"',
      'set "NODE_WITH_WINDOW_WEBVIEW2_DIR=%DIR%runtimes\\webview2"',
      '"%DIR%node.exe" --enable-source-maps "%DIR%main.js" %*',
    ].join('\r\n') + '\r\n';
    fs.writeFileSync(path.join(outDir, 'start.bat'), bat);
  } else {
    const sh = [
      '#!/bin/sh',
      'DIR="$(dirname "$(readlink -f "$0")")"',
      '"$DIR/node" "$DIR/main.js" "$@"',
    ].join('\n') + '\n';
    const shPath = path.join(outDir, 'start.sh');
    fs.writeFileSync(shPath, sh);
    fs.chmodSync(shPath, 0o755);
  }

  ok(`Package complete → out/${outName}/`);
  return outDir;
}
