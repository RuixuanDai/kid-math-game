/**
 * Cloudflare Pages Function: GET /api/tts?voice=zh-CN-XiaoyiNeural&rate=-2%&text=...
 *
 * 通用在线 AI 神经网络真人语音接口（兼容 Cloudflare Pages / Workers 及跨域静态站点调用）：
 * 1. 优先调用微软官方 Azure AI Speech REST API（需在 Cloudflare Pages Secrets 配置 AZURE_SPEECH_KEY 与 AZURE_SPEECH_REGION，
 *    F0 免费层每月 50 万神经字符额度，支持云函数机房 IP 直连，彻底规避消费端 IP 封禁）；
 * 2. 若未配置 Azure 密钥（如本地 wrangler pages dev 调试），自动回退至 Edge ReadAloud WebSocket 通道（内置纯 WebCrypto Sec-MS-GEC 签名）；
 * 3. 利用 Cloudflare 全球边缘缓存（caches.default）将同一句朗读永久缓存在就近节点（1 年 immutable），同一句话全网只消耗一次合成额度；
 * 4. 内置 CORS 支持（Access-Control-Allow-Origin: *），允许 GitHub Pages 等静态托管域名直接跨域获取神经语音；
 * 5. 若上游连接超时或受限，快速返回 502 JSON（绝不返回 SPA index.html），使前端平滑回退到本机 Web Speech（web-natural-tts）。
 */

const ALLOWED_VOICES = new Set([
  // 中文精选自然神经音色
  "zh-CN-XiaoyiNeural",           // 👧 晓伊 · 甜美童趣（绘本/儿童/游戏默认推荐）
  "zh-CN-XiaoxiaoNeural",         // 👩 晓晓 · 温柔自然女声（通用播报/助手推荐）
  "zh-CN-YunxiaNeural",           // 👦 云夏 · 元气阳光少年
  "zh-CN-liaoning-XiaobeiNeural", // 🎭 晓北 · 亲切幽默东北腔
  "zh-CN-YunjianNeural",          // 🦁 云健 · 温暖浑厚鼓励男声
  "zh-CN-YunxiNeural",            // 🧑 云希 · 清朗故事青年男声
  "zh-CN-shaanxi-XiaoniNeural",   // 🏮 晓妮 · 俏皮陕西腔女声
  // 英文精选自然神经音色
  "en-US-AnaNeural",              // 👧 Ana · 英文纯真童声
  "en-US-JennyNeural",            // 👩 Jenny · 英文亲切女声
  "en-US-GuyNeural",              // 🧑 Guy · 英文自然男声
]);
const DEFAULT_VOICE = "zh-CN-XiaoyiNeural";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-TTS-Provider",
};

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_HTTPS_WS_URL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const SEC_MS_GEC_VERSION = "2-143.0.3650.96";
const EDGE_COPYRIGHT = "Copyright (C) Microsoft Corporation. All rights reserved.";

const SWAP_FIRST_WORD = { swappedWord: 0xef0569fb, swappedSum: 0x76f50f34, swappedProduct: 0xc3efea97 };
const SWAP_SECOND_WORD = { swappedWord: 0xc31713db, swappedSum: 0x1881ce3c, swappedProduct: 0x35bd1ec9 };
const MIX_FIRST_WORD = [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83];
const MIX_SECOND_WORD = [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69];

export interface PagesEnv {
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
}

export interface PagesContext {
  request: Request;
  env?: PagesEnv;
  waitUntil(promise: Promise<unknown>): void;
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const rawText = url.searchParams.get("text") ?? "";
  const cleaned = cleanTtsInput(rawText);
  if (!cleaned) {
    return jsonError(400, "Empty text");
  }

  const reqVoice = url.searchParams.get("voice") ?? DEFAULT_VOICE;
  const voice = ALLOWED_VOICES.has(reqVoice) ? reqVoice : DEFAULT_VOICE;
  const reqRate = url.searchParams.get("rate") ?? "-2%";
  const rate = /^[+-]?\d{1,2}%$/.test(reqRate) ? reqRate : "-2%";

  // 归一化缓存键，利用 Cloudflare 全球边缘节点缓存合成结果
  const cacheUrl = new URL("/__tts_cache_v1", url.origin);
  cacheUrl.searchParams.set("v", voice);
  cacheUrl.searchParams.set("r", rate);
  cacheUrl.searchParams.set("t", cleaned);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const edgeCache = (caches as unknown as { default?: Cache }).default;

  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) {
      const headers = new Headers(hit.headers);
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        headers.set(k, v);
      }
      return new Response(hit.body, {
        status: hit.status,
        headers,
      });
    }
  }

  const azureKey = context.env?.AZURE_SPEECH_KEY?.trim() ?? "";
  const azureRegion = context.env?.AZURE_SPEECH_REGION?.trim() ?? "";
  const useAzure = Boolean(azureKey && azureRegion);

  try {
    const mp3 = useAzure
      ? await synthesizeAzureMp3(azureKey, azureRegion, voice, cleaned, rate)
      : await synthesizeEdgeMp3(voice, cleaned, rate);
    const body = new Uint8Array(mp3).buffer;
    const response = new Response(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(mp3.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-TTS-Provider": useAzure ? "azure-neural" : "edge-readaloud",
      },
    });
    if (edgeCache) {
      context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    }
    return response;
  } catch (err) {
    return jsonError(502, err instanceof Error ? err.message : String(err));
  }
}

async function synthesizeAzureMp3(
  apiKey: string,
  region: string,
  voice: string,
  text: string,
  rate: string,
): Promise<Uint8Array> {
  const cleanRegion = region.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(cleanRegion)) {
    throw new Error("Invalid AZURE_SPEECH_REGION format");
  }

  const xmlLang = voice.startsWith("en-") ? "en-US" : "zh-CN";
  const endpoint = `https://${cleanRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${xmlLang}'>` +
    `<voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice>` +
    `</speak>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "WebOnlineTTS/1.0",
      },
      body: ssml,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Azure Speech HTTP ${res.status}`);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 128) {
      throw new Error("Azure Speech returned empty audio");
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanTtsInput(raw: string): string {
  return raw
    .replace(/(\d{1,2}):00/g, "$1点整")
    .replace(/(\d{1,2}):30/g, "$1点半")
    .replace(/(\d{1,2}):(\d{2})/g, "$1点$2分")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, "")
    .replace(/[✓✔✕✖✗▶◀▲▼•·|]/g, " ")
    .replace(/\+/g, " 加 ")
    .replace(/[−-]/g, " 减 ")
    .replace(/[×*]/g, " 乘 ")
    .replace(/[÷]/g, " 除以 ")
    .replace(/=/g, " 等于 ")
    .replace(/(\d+)\s*\/\s*(\d+)/g, "$2个里完成了$1个")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function synthesizeEdgeMp3(voice: string, text: string, rate: string): Promise<Uint8Array> {
  const connId = crypto.randomUUID();
  const secMsGec = await generateSecMsGec();
  const wsTarget =
    `${EDGE_HTTPS_WS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;

  const upgradeRes = await fetch(wsTarget, {
    headers: {
      Upgrade: "websocket",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    },
  });

  const ws = (upgradeRes as Response & { webSocket?: WebSocket }).webSocket;
  if (!ws) {
    throw new Error(`Edge TTS upgrade failed: HTTP ${upgradeRes.status}`);
  }
  (ws as WebSocket & { accept(): void }).accept();

  const xmlLang = voice.startsWith("en-") ? "en-US" : "zh-CN";
  const reqId = randomHex(16);
  const configFrame =
    "Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
    JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
          },
        },
      },
    });

  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'>` +
    `<voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice>` +
    `</speak>`;
  const ssmlFrame = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;

  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let settled = false;
    const decoder = new TextDecoder();
    const audioDelim = new TextEncoder().encode("Path:audio\r\n");

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Edge TTS synthesis timeout")));
    }, 3500);

    ws.addEventListener("message", (ev: MessageEvent) => {
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) {
          const total = chunks.reduce((s, c) => s + c.byteLength, 0);
          if (total < 128) {
            finish(() => reject(new Error("Empty audio received")));
            return;
          }
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.byteLength;
          }
          finish(() => resolve(merged));
        }
        return;
      }

      if (ev.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(ev.data);
        const idx = indexOfBytes(bytes, audioDelim);
        if (idx >= 0) {
          const audioPart = bytes.subarray(idx + audioDelim.byteLength);
          if (audioPart.byteLength > 0) chunks.push(audioPart);
        } else {
          const asText = decoder.decode(bytes);
          if (asText.includes("Path:turn.end")) {
            const total = chunks.reduce((s, c) => s + c.byteLength, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const c of chunks) {
              merged.set(c, offset);
              offset += c.byteLength;
            }
            finish(() => (merged.byteLength >= 128 ? resolve(merged) : reject(new Error("Empty audio"))));
          }
        }
      }
    });

    ws.addEventListener("error", () => {
      finish(() => reject(new Error("Edge TTS WebSocket error")));
    });

    ws.addEventListener("close", () => {
      finish(() => reject(new Error("Edge TTS closed before turn.end")));
    });

    ws.send(configFrame);
    ws.send(ssmlFrame);
  });
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

async function generateSecMsGec(): Promise<string> {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10000000;
  const message = new TextEncoder().encode(`${EDGE_COPYRIGHT}${windowsTicks}${TRUSTED_CLIENT_TOKEN}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", message));
  return `${toUpperHex(cs64(message, digest))}-${toUpperHex(digest)}`;
}

function cs64(message: Uint8Array, digest: Uint8Array): Uint8Array {
  const digestView = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const firstKey = (digestView.getUint32(0, true) | 1) >>> 0;
  const secondKey = (digestView.getUint32(4, true) | 1) >>> 0;
  const padded = new Uint8Array(Math.ceil(message.length / 8) * 8);
  padded.set(message);
  const words = new DataView(padded.buffer);
  let swapSum = 0;
  let lastSwap = 0;
  let mix = 0;
  let mixSum = 0;
  for (let offset = 0; offset < padded.length; offset += 8) {
    const firstWord = words.getUint32(offset, true);
    const secondWord = words.getUint32(offset + 4, true);
    const firstSwap = swapTerm(firstWord, firstKey, SWAP_FIRST_WORD);
    lastSwap = swapTerm(secondWord, secondKey, SWAP_SECOND_WORD);
    swapSum = (swapSum + firstSwap + lastSwap) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + firstWord, firstKey), MIX_FIRST_WORD);
    mixSum = (mixSum + mix) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + secondWord, secondKey), MIX_SECOND_WORD);
    mixSum = (mixSum + mix) >>> 0;
  }
  const checksum = new Uint8Array(8);
  const checksumView = new DataView(checksum.buffer);
  checksumView.setUint32(0, lastSwap ^ mix, true);
  checksumView.setUint32(4, swapSum ^ mixSum, true);
  return checksum;
}

function swapTerm(
  word: number,
  key: number,
  multipliers: { swappedWord: number; swappedSum: number; swappedProduct: number },
): number {
  const sum = Math.imul(word, key) + Math.imul(swapHalves(word), multipliers.swappedWord);
  const product = Math.imul(swapHalves(sum), multipliers.swappedSum) >>> 0;
  return (Math.imul(swapHalves(product), multipliers.swappedProduct) + product) >>> 0;
}

function swapAndMultiply(value: number, multipliers: number[]): number {
  let cur = value;
  for (const m of multipliers) {
    cur = Math.imul(swapHalves(cur), m) >>> 0;
  }
  return cur;
}

function swapHalves(value: number): number {
  return ((value << 16) | (value >>> 16)) >>> 0;
}

function toUpperHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
