const { contextBridge, ipcRenderer } = require('@devscholar/node-with-window');

contextBridge.exposeInMainWorld('api', {
  send:   (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on:     (channel, listener) => ipcRenderer.on(channel, listener),
});
