const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
const rendererUrl = !app.isPackaged && process.env.ELECTRON_RENDERER_URL === 'http://127.0.0.1:5173'
  ? 'http://127.0.0.1:5173/'
  : pathToFileURL(indexPath).href;
let mainWindow;

function trusted(event) {
  return mainWindow && event.sender === mainWindow.webContents
    && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === rendererUrl;
}

ipcMain.handle('workspace:choose', async (event) => {
  if (!trusted(event)) return null;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle('ollama:chat', async (event, model, messages) => {
  if (!trusted(event)) return { error: 'Chat is only available in the desktop window.' };
  if (typeof model !== 'string' || !/^[\w./:-]{1,200}$/.test(model)
    || !Array.isArray(messages) || messages.length > 200
    || messages.some((message) => !message || !['system', 'user', 'assistant'].includes(message.role)
      || typeof message.content !== 'string')
    || messages.reduce((total, message) => total + message.content.length, 0) > 100000) {
    return { error: 'Invalid model name or conversation is too large.' };
  }
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      redirect: 'error',
      signal: AbortSignal.timeout(180000),
    });
    if (response.status === 404) return { error: `Model not found. Run ollama pull ${model} or choose an installed model.` };
    if (!response.ok) return { error: `Ollama returned HTTP ${response.status}.` };
    const { message } = await response.json();
    return typeof message?.content === 'string' && message.content.trim()
      ? { content: message.content }
      : { error: 'Ollama returned an empty response.' };
  } catch (error) {
    return { error: error.name === 'TimeoutError'
      ? 'Ollama did not respond in time.'
      : 'Could not reach Ollama. Start it on 127.0.0.1:11434 and try again.' };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    title: 'Zanshin Harness',
    backgroundColor: '#190d1c',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  void mainWindow.loadURL(rendererUrl).catch((error) => {
    dialog.showErrorBox('Zanshin Harness could not start', error.message);
    app.quit();
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
