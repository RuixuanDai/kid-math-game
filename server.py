import os
import re
import sys
import time
import json
import socket
import hashlib
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# 兼容 Windows 控制台 UTF-8 输出
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

TTS_CACHE_DIR = os.path.join(BASE_DIR, '.local-data', 'tts-cache')
os.makedirs(TTS_CACHE_DIR, exist_ok=True)

ALLOWED_VOICES = {
    'zh-CN-XiaoxiaoNeural',
}
DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
TTS_CLIENT_SECRET = 'kmg-tts-2026-guard-v1'
CLOUDFLARE_TTS_FALLBACK = 'https://kid-math-game.pages.dev/api/tts'


def load_azure_speech_credentials():
    """从环境变量或本地 .env.db.local / .env.local 自动读取共享的 Azure Speech 免费层密钥"""
    key = os.environ.get('AZURE_SPEECH_KEY', '').strip()
    region = os.environ.get('AZURE_SPEECH_REGION', '').strip()
    if key and region:
        return key, region

    candidate_files = [
        os.path.join(BASE_DIR, '.env.db.local'),
        os.path.join(BASE_DIR, '.env.local'),
        os.path.join(BASE_DIR, '.env'),
        os.path.abspath(os.path.join(BASE_DIR, '..', '..', 'kid_incentive', 'opus', '.env.db.local')),
    ]
    for path in candidate_files:
        if os.path.isfile(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith('#') or '=' not in line:
                            continue
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k == 'AZURE_SPEECH_KEY' and not key:
                            key = v
                        elif k == 'AZURE_SPEECH_REGION' and not region:
                            region = v
            except Exception:
                pass
        if key and region:
            break
    return key, region


AZURE_KEY, AZURE_REGION = load_azure_speech_credentials()


def clean_tts_text(raw: str) -> str:
    if not raw:
        return ''
    text = re.sub(r'(\d{1,2}):00', r'\1点整', raw)
    text = re.sub(r'(\d{1,2}):30', r'\1点半', text)
    text = re.sub(r'(\d{1,2}):(\d{2})', r'\1点\2分', text)
    text = text.replace('+', ' 加 ').replace('−', ' 减 ').replace('-', ' 减 ')
    text = text.replace('×', ' 乘 ').replace('*', ' 乘 ').replace('÷', ' 除以 ').replace('=', ' 等于 ')
    text = re.sub(r'[✓✔✕✖✗▶◀▲▼•·|]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:80]


def escape_xml(text: str) -> str:
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def synthesize_tts_mp3(voice: str, rate: str, cleaned_text: str) -> tuple[bytes, str]:
    """合成或从本地磁盘缓存读取 MP3，返回 (mp3_bytes, provider_name)"""
    cache_key = hashlib.sha256(f"v1|{voice}|{rate}|{cleaned_text}".encode('utf-8')).hexdigest()
    cache_path = os.path.join(TTS_CACHE_DIR, f"{cache_key}.mp3")

    if os.path.isfile(cache_path):
        try:
            with open(cache_path, 'rb') as f:
                data = f.read()
            if len(data) >= 128:
                return data, 'local-disk-cache'
        except Exception:
            pass

    mp3_data = None
    provider = 'unknown'

    # 1. 优先使用本机配置的 Azure AI Speech REST API (Free F0)
    if AZURE_KEY and AZURE_REGION:
        xml_lang = 'en-US' if voice.startswith('en-') else 'zh-CN'
        endpoint = f"https://{AZURE_REGION.lower()}.tts.speech.microsoft.com/cognitiveservices/v1"
        ssml = (
            f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' "
            f"xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='{xml_lang}'>"
            f"<voice name='{voice}'><prosody pitch='+0Hz' rate='{rate}' volume='+0%'>"
            f"{escape_xml(cleaned_text)}</prosody></voice></speak>"
        ).encode('utf-8')
        req = urllib.request.Request(
            endpoint,
            data=ssml,
            method='POST',
            headers={
                'Ocp-Apim-Subscription-Key': AZURE_KEY,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                'User-Agent': 'MathGameLocalServer/1.0',
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read()
            if len(data) >= 128:
                mp3_data = data
                provider = 'azure-neural-local'

    # 2. 若未配置本地密钥，自动带签名代理至线上 Cloudflare Pages 边缘函数并缓存到本地磁盘
    if not mp3_data:
        ts = str(int(time.time()))
        raw_sig = f"{ts}|{voice}|{rate}|{cleaned_text}|{TTS_CLIENT_SECRET}"
        sig = hashlib.sha256(raw_sig.encode('utf-8')).hexdigest()[:32]
        qs = urllib.parse.urlencode({'voice': voice, 'rate': rate, 'text': cleaned_text, 'ts': ts, 'sig': sig})
        req = urllib.request.Request(
            f"{CLOUDFLARE_TTS_FALLBACK}?{qs}",
            method='GET',
            headers={
                'User-Agent': 'MathGameLocalServer/1.0',
                'Origin': 'http://localhost:8088',
                'X-Requested-With': 'KidMathGame-TTS/1.0',
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read()
            if len(data) >= 128:
                mp3_data = data
                provider = 'cloudflare-edge-proxy'

    if not mp3_data or len(mp3_data) < 128:
        raise RuntimeError('Empty TTS audio bytes')

    try:
        tmp_path = f"{cache_path}.{os.getpid()}.tmp"
        with open(tmp_path, 'wb') as f:
            f.write(mp3_data)
        os.replace(tmp_path, cache_path)
    except Exception:
        pass

    return mp3_data, provider


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
        if not self.path.startswith('/api/tts'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.css'):
            return 'text/css; charset=utf-8'
        if path.endswith('.html'):
            return 'text/html; charset=utf-8'
        if path.endswith('.svg'):
            return 'image/svg+xml'
        return super().guess_type(path)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        # 在线 AI 神经网络语音接口 (/api/tts)
        if parsed.path == '/api/tts':
            qs = urllib.parse.parse_qs(parsed.query)
            raw_text = (qs.get('text') or [''])[0]
            cleaned = clean_tts_text(raw_text)
            if not cleaned:
                body = json.dumps({'error': 'Empty text'}).encode('utf-8')
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            req_voice = (qs.get('voice') or [DEFAULT_VOICE])[0]
            voice = req_voice if req_voice in ALLOWED_VOICES else DEFAULT_VOICE
            req_rate = (qs.get('rate') or ['-2%'])[0]
            rate = req_rate if re.match(r'^[+-]?\d{1,2}%$', req_rate) else '-2%'

            try:
                mp3_bytes, provider = synthesize_tts_mp3(voice, rate, cleaned)
                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', str(len(mp3_bytes)))
                self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
                self.send_header('X-TTS-Provider', provider)
                self.end_headers()
                self.wfile.write(mp3_bytes)
            except Exception as e:
                body = json.dumps({'error': str(e)}).encode('utf-8')
                self.send_response(502)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            return

        if parsed.path == '/qr':
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
    httpd = ThreadingHTTPServer(server_address, CustomHandler)

    tts_mode = f"Azure AI Speech ({AZURE_REGION})" if (AZURE_KEY and AZURE_REGION) else "Cloudflare Edge Proxy"
    banner = f"""
=============================================================================
  [童趣数学小王国] iPad 局域网服务器已就绪！
  [在线语音引擎] Web-Online-TTS 已挂载 (/api/tts -> {tts_mode} + 本地磁盘缓存)
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
