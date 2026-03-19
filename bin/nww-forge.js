#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

const commands = {
  init:    () => import('../src/commands/init.js'),
  start:   () => import('../src/commands/start.js'),
  package: () => import('../src/commands/package.js'),
  make:    () => import('../src/commands/make.js'),
  publish: () => import('../src/commands/publish.js'),
};

function showHelp() {
  console.log(`
  Usage: nww-forge <command> [options]

  Commands:
    init [name] [--template=vanilla]   Scaffold a new app
    start [--runtime=node]             Start the app in dev mode
    package                            Bundle the app
    make                               Bundle + create distributables
    publish                            Publish to GitHub Releases

  Templates:
    vanilla (default)    Plain JavaScript, no build step
    vanilla-ts           TypeScript (compiled with esbuild)
`);
}

if (!command || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

if (!commands[command]) {
  console.error(`nww-forge: unknown command '${command}'`);
  showHelp();
  process.exit(1);
}

const mod = await commands[command]();
await mod.default(commandArgs);
