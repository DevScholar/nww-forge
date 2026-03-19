import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Load forge.config.js (or forge.config.mjs) from the given project root.
 * Falls back to the `forge` field in package.json.
 * Returns {} if no config is found.
 */
export async function loadForgeConfig(projectDir) {
  const candidates = [
    path.join(projectDir, 'forge.config.js'),
    path.join(projectDir, 'forge.config.mjs'),
    path.join(projectDir, 'forge.config.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const mod = await import(pathToFileURL(candidate).href);
      return mod.default ?? mod;
    }
  }

  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.forge) return pkg.forge;
    } catch { /* ignore */ }
  }

  return {};
}

/**
 * Read package.json from projectDir; returns {} on failure.
 */
export function readPackageJson(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Resolve the main entry file from package.json.
 * Falls back to main.js, then main.ts.
 */
export function resolveMainEntry(projectDir, pkg) {
  if (pkg.main) return path.resolve(projectDir, pkg.main);
  const js = path.join(projectDir, 'main.js');
  if (fs.existsSync(js)) return js;
  return path.join(projectDir, 'main.ts');
}

/**
 * Normalise a maker entry from forge.config makers array.
 * Accepts both `{ name, config }` objects and plain name strings.
 */
export function normaliseMaker(maker) {
  if (typeof maker === 'string') return { name: maker, config: {} };
  return { name: maker.name ?? '', config: maker.config ?? {} };
}
