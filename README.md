# @devscholar/nww-forge

Build toolchain for [node-with-window](https://www.npmjs.com/package/@devscholar/node-with-window) apps, inspired by [Electron Forge](https://www.electronforge.io/).

## Requirements

- Node.js 18+
- **Windows:** PowerShell 5.1, .NET Framework 4.8, WebView2 runtime
- **Linux:** GJS, GTK 4, WebKitGTK 6.0 (`sudo apt install gjs gir1.2-gtk-4.0 gir1.2-webkit-6.0`)

## Scaffold a new app

```sh
npx @devscholar/nww-forge init my-app
npx @devscholar/nww-forge init my-app --template=vanilla-ts
```

This creates a new directory, copies the template, runs `npm install`, and downloads WebView2 DLLs on Windows automatically.

### Templates

| Name | Description |
|------|-------------|
| `vanilla` (default) | Plain JavaScript, no build step |
| `vanilla-ts` | TypeScript, compiled with esbuild |

## Development

```sh
cd my-app
npm start          # nww-forge start
```

For TypeScript projects, the main entry is compiled with esbuild before running.

## Package & distribute

```sh
npm run package    # nww-forge package  →  out/<name>-<platform>-<arch>/
npm run make       # nww-forge make     →  out/make/<name>-<version>-<platform>-<arch>.zip
```

`package` creates a folder bundle containing:
- Bundled `main.js` (via esbuild)
- `@devscholar/node-with-window` and its runtime scripts/DLLs
- `launch.bat` (Windows) / `launch.sh` (Linux) launcher script

`make` runs `package` first, then passes the output through each configured maker.
The default maker produces a `.zip` archive.

The target machine must have Node.js installed to run the bundled app.

## Configuration

Create `forge.config.js` in your project root:

```js
export default {
  packagerConfig: {
    name: 'My App',
    executableName: 'my-app',
  },
  makers: [
    { name: '@nww-forge/maker-zip' },
  ],
};
```

The `forge` field in `package.json` is also supported as an alternative.

## CLI reference

```
nww-forge init [name] [--template=<template>]
nww-forge start [--runtime=node|bun|deno]
nww-forge package
nww-forge make
nww-forge publish   (not yet implemented)
```

## Using as a local dev dependency

```sh
npm install --save-dev @devscholar/nww-forge
```

Then the `nww-forge` binary is available via `npm run` scripts without a global install.
