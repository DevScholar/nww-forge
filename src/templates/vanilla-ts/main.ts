import { app, BrowserWindow, ipcMain } from '@devscholar/node-with-window';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.on('ready', () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  ipcMain.on('ping', (_event: unknown, msg: string) => {
    console.log('[main] received:', msg);
    win.webContents.send('pong', 'Hello from main process!');
  });
});
