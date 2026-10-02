import os
import sys
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler

# 兼容 Windows 控制台 UTF-8 输出
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

def get_local_ip():
    """获取本机局域网 IP"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def find_available_port(start_port=8088):
    for port in [start_port, 8089, 8000, 3000, 5000, 8888]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            res = s.connect_ex(('0.0.0.0', port))
            if res != 0:
                return port
    return start_port

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.css'):
            return 'text/css; charset=utf-8'
        if path.endswith('.html'):
            return 'text/html; charset=utf-8'
        if path.endswith('.svg'):
            return 'image/svg+xml'
        return super().guess_type(path)

    def do_GET(self):
        if self.path == '/qr':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            ip = get_local_ip()
            port = self.server.server_port
            game_url = f"http://{ip}:{port}/"
            qr_api = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={game_url}"
            html = f"""<!DOCTYPE html>
            <html lang="zh-CN">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>iPad 扫码直达 - 数学小王国</title>
              <style>
                body {{ font-family: -apple-system, system-ui, sans-serif; background: #FFF6E9; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }}
                .card {{ background: white; padding: 32px; border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 3px solid #FFD166; max-width: 420px; }}
                h1 {{ color: #FF5E7E; margin-top: 0; font-size: 24px; }}
                img {{ width: 240px; height: 240px; border-radius: 16px; margin: 16px 0; border: 2px solid #E2E8F0; }}
                .url-box {{ background: #FEF3C7; padding: 12px 14px; border-radius: 12px; font-weight: 700; color: #B45309; word-break: break-all; margin: 12px 0; font-size: 18px; }}
                .tip {{ font-size: 13px; color: #718096; line-height: 1.6; }}
              </style>
            </head>
            <body>
              <div class="card">
                <h1>iPad 扫一扫即开</h1>
                <p>用 iPad 相机对准二维码扫描即可打开：</p>
                <img src="{qr_api}" alt="QR Code">
                <div class="url-box">{game_url}</div>
                <div class="tip">
                  1. 请确保 iPad 和电脑连接在<strong>同一个 Wi-Fi</strong>。<br>
                  2. 也可以直接在 iPad Safari 顶部输入上面的网址。<br>
                  3. 打开后点“分享 ➔ 添加到主屏幕”可全屏体验！
                </div>
              </div>
            </body>
            </html>"""
            self.wfile.write(html.encode('utf-8'))
            return

        return super().do_GET()

def main():
    port = find_available_port(8088)
    local_ip = get_local_ip()

    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, CustomHandler)

    banner = f"""
=============================================================================
  [童趣数学小王国] iPad 局域网服务器已就绪！
=============================================================================

  【iPad 打开方法】：
  
  1. 请确保 iPad 和本电脑连接在【同一个 Wi-Fi】网络下。
  
  2. 方式一（手动输入）：
     打开 iPad 的 Safari 浏览器，在顶部地址栏输入：
     >> http://{local_ip}:{port}
     
  3. 方式二（扫码直达）：
     在电脑浏览器打开下方二维码页面，用 iPad 相机一扫即可：
     >> http://localhost:{port}/qr

  4. 【iPad 最佳体验技巧】：
     在 iPad Safari 打开后，点击底部的【分享】按钮 -> 选择【添加到主屏幕】
     之后就可以像原生 App 一样，满屏横屏免地址栏流畅游玩啦！

  电脑本机访问：http://localhost:{port}
  服务运行中 (按 Ctrl+C 可停止)...
=============================================================================
"""
    print(banner, flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已安全停止。")
        httpd.server_close()

if __name__ == '__main__':
    main()
