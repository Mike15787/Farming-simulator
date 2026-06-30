// Electron 主行程 —— 保持極薄:只負責開窗 + 透過自訂 app:// protocol 載入遊戲。
// 用 custom protocol 而非直接 file://,是為了讓 ES modules 正常載入(file:// 會被 CORS 擋),
// 同時不必關閉 webSecurity。存檔走 localStorage,初版不需要 IPC。
const { app, BrowserWindow, protocol, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 副檔名 → MIME。模組腳本(type=module)需要正確的 text/javascript,否則 Chromium 會拒絕載入。
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

// 必須在 app ready 前註冊 scheme 權限。standard+secure 讓模組、localStorage、fetch 都可用。
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 560,
    useContentSize: true, // 480x560 指的是內容區(畫布),不含視窗邊框
    resizable: false,
    autoHideMenuBar: true,
    title: '種田小遊戲',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadURL('app://local/index.html');
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const filePath = path.join(__dirname, pathname);
    try {
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return new Response(data, { headers: { 'content-type': MIME[ext] || 'application/octet-stream' } });
    } catch (err) {
      return new Response('Not found: ' + pathname, { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
