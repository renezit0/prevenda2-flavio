const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow = null;

const sendToRenderer = (channel, payload) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
};

const createWindow = () => {
  const { width: screenWidth, height: screenHeight } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  const winWidth = Math.min(1400, Math.max(1100, Math.floor(screenWidth * 0.9)));
  const winHeight = Math.min(900, Math.max(750, Math.floor(screenHeight * 0.9)));

  mainWindow = new BrowserWindow({
    title: 'Prevenda - Flavio',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    width: winWidth,
    height: winHeight,
    minWidth: 1100,
    minHeight: 750,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    mainWindow.loadURL(startUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

app.whenReady().then(() => {
  app.setAppUserModelId('com.seellbr.prevenda');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
