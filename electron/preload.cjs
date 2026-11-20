const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('zanshinDesktop', {
  isDesktop: true,
  platform: process.platform,
});
