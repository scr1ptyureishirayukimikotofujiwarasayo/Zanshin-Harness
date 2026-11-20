const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zanshinDesktop', {
  isDesktop: true,
  platform: process.platform,
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  chat: (model, messages) => ipcRenderer.invoke('ollama:chat', model, messages),
});
