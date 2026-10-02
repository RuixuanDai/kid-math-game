const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_DIR = __dirname;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const port = 8088;
const localIp = getLocalIp();

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  if (reqPath === '/qr') {
    const gameUrl = `http://${localIp}:${port}/`;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(gameUrl)}`;
    const html = `<!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>iPad 扫码直达 - 数学小王国</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; background: #FFF6E9; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
        .card { background: white; padding: 32px; border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 3px solid #FFD166; max-width: 400px; }
        h1 { color: #FF5E7E; margin-top: 0; font-size: 24px; }
        img { width: 240px; height: 240px; border-radius: 16px; margin: 16px 0; border: 2px solid #E2E8F0; }
        .url-box { background: #FEF3C7; padding: 10px 14px; border-radius: 12px; font-weight: 700; color: #B45309; word-break: break-all; margin: 10px 0; }
        .tip { font-size: 13px; color: #718096; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📱 iPad 扫一扫即开</h1>
        <p>用 iPad 相机对准二维码扫描：</p>
        <img src="${qrApi}" alt="QR Code">
        <div class="url-box">${gameUrl}</div>
        <div class="tip">或者直接在 iPad Safari 浏览器中输入上方地址。<br>确保 iPad 和电脑连接在同一个 Wi-Fi 哦！</div>
      </div>
    </body>
    </html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(BASE_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 未找到该文件');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`服务器错误: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`
=============================================================================
  🦁 童趣数学小王国 · iPad 局域网服务器已就绪！
=============================================================================

  【在 iPad 上的打开方法】：
  
  1. 请确保 iPad 和本电脑连接在【同一个 Wi-Fi】网络下。
  
  2. 方式一（手动输入）：
     打开 iPad 的 Safari 浏览器，在顶部地址栏输入：
     👉 http://${localIp}:${port}
     
  3. 方式二（扫码直达）：
     在电脑浏览器打开下方二维码页面，用 iPad 相机一扫即可打开：
     👉 http://localhost:${port}/qr

  4. 【iPad 沉浸体验小技巧】：
     在 iPad Safari 打开后，点击底部的【分享】按钮 ➔ 选择【添加到主屏幕】
     之后就可以像原生 App 一样，满屏无地址栏流畅游玩啦！

  电脑本机访问：http://localhost:${port}
=============================================================================
  `);
});
