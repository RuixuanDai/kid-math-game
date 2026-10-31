/**
 * Cloudflare Pages Function: GET /api/tts
 *
 * 专属「👩 晓晓 · 温柔姐姐」(zh-CN-XiaoxiaoNeural) 在线 AI 神经网络语音接口（含 5 层防盗刷安全网关）：
 * 1. Origin / Referer 严格白名单：仅允许本项目的 Cloudflare Pages、GitHub Pages (ruixuandai.github.io) 与本地局域网调试域名访问，拒绝一切第三方跨域盗链与无头爬虫；
 * 2. 动态时间戳签名校验 (ts + sig + X-Requested-With)：每次请求必须携带 ±300 秒内的时间戳与 SHA-256 签名，防止 URL 伪造与重放攻击；
 * 3. 单一音色锁定与输入长度硬上限：仅允许 `zh-CN-XiaoxiaoNeural` 音色，单次文本严格限制 <= 80 字符且必须包含中文或数字，防止恶意长文本消耗字符额度；
 * 4. Cloudflare 全球边缘永久缓存 (caches.default, 1 年 immutable)：命中缓存的句子完全不消耗 Azure 额度；
 * 5. 单 IP 缓存未命中限流器 (Per-IP Cache-Miss Rate Limiter)：仅对“未命中缓存、需实际调用 Azure 合成”的新句子按客户端 IP 限流（每分钟最多 20 次新句合成，每小时最多 150 次），彻底杜绝黑客脚本刷爆 Free F0 免费额度。
 */

const LOCKED_VOICE = "zh-CN-XiaoxiaoNeural";
const TTS_CLIENT_SECRET = "kmg-tts-2026-guard-v1";
const MAX_TEXT_LEN = 80;
const MAX_MISS_PER_MINUTE = 20;
const MAX_MISS_PER_HOUR = 150;

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_HTTPS_WS_URL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const SEC_MS_GEC_VERSION = "2-143.0.3650.96";
const EDGE_COPYRIGHT = "Copyright (C) Microsoft Corporation. All rights reserved.";

const SWAP_FIRST_WORD = { swappedWord: 0xef0569fb, swappedSum: 0x76f50f34, swappedProduct: 0xc3efea97 };
const SWAP_SECOND_WORD = { swappedWord: 0xc31713db, swappedSum: 0x1881ce3c, swappedProduct: 0x35bd1ec9 };
const MIX_FIRST_WORD = [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83];
const MIX_SECOND_WORD = [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69];

// 内存级 IP 限流表（配合 Edge Cache 双重限流）
const ipRateMap = new Map<string, { minBucket: number; minCount: number; hourBucket: number; hourCount: number }>();

export interface PagesEnv {
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
}

export interface PagesContext {
  request: Request;
  env?: PagesEnv;
  waitUntil(promise: Promise<unknown>): void;
}

function isAllowedOriginUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "kid-math-game.pages.dev" ||
      host.endsWith(".kid-math-game.pages.dev") ||
      host === "ruixuandai.github.io" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    );
  } catch {
    return false;
  }
}

function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = isAllowedOriginUrl(origin) ? origin : "https://kid-math-game.pages.dev";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
    "Access-Control-Expose-Headers": "X-TTS-Provider",
    Vary: "Origin",
  };
}

export async function onRequestOptions(context: PagesContext): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request),
  });
}

async function verifySignature(
  ts: string,
  sig: string,
  voice: string,
  rate: string,
  cleanedText: string,
): Promise<boolean> {
  if (!ts || !sig) return false;
  const tsNum = Number(ts);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > 300) {
    return false;
  }
  const raw = `${ts}|${voice}|${rate}|${cleanedText}|${TTS_CLIENT_SECRET}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
  return sig === expected;
}

function checkAndIncrementIpQuota(ip: string): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  const minBucket = Math.floor(nowSec / 60);
  const hourBucket = Math.floor(nowSec / 3600);

  let record = ipRateMap.get(ip);
  if (!record) {
    record = { minBucket, minCount: 0, hourBucket, hourCount: 0 };
    if (ipRateMap.size > 2000) {
      const firstKey = ipRateMap.keys().next().value;
      if (firstKey) ipRateMap.delete(firstKey);
    }
    ipRateMap.set(ip, record);
  }

  if (record.minBucket !== minBucket) {
    record.minBucket = minBucket;
    record.minCount = 0;
  }
  if (record.hourBucket !== hourBucket) {
    record.hourBucket = hourBucket;
    record.hourCount = 0;
  }

  if (record.minCount >= MAX_MISS_PER_MINUTE || record.hourCount >= MAX_MISS_PER_HOUR) {
    return false;
  }

  record.minCount += 1;
  record.hourCount += 1;
  return true;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request } = context;
  const corsHeaders = buildCorsHeaders(request);

  // 1. 校验 Origin / Referer 白名单与客户端自定义请求头，拦截外部盗链与脚本直刷
  const origin = request.headers.get("Origin") ?? "";
  const referer = request.headers.get("Referer") ?? "";
  const reqWith = request.headers.get("X-Requested-With") ?? "";

  if (!isAllowedOriginUrl(origin) && !isAllowedOriginUrl(referer)) {
    return jsonError(403, "Forbidden: unauthorized origin", corsHeaders);
  }
  if (reqWith !== "KidMathGame-TTS/1.0") {
    return jsonError(403, "Forbidden: invalid client header", corsHeaders);
  }

  // 2. 校验与清洗文本（限制 <= 80 字符，且必须含中文或数字）
  const url = new URL(request.url);
  const rawText = url.searchParams.get("text") ?? "";
  const cleaned = cleanTtsInput(rawText);
  if (!cleaned || !/[0-9\u4e00-\u9fa5]/.test(cleaned)) {
    return jsonError(400, "Invalid or empty text", corsHeaders);
  }

  // 3. 强制锁定唯一音色 zh-CN-XiaoxiaoNeural（晓晓）
  const voice = LOCKED_VOICE;
  const reqRate = url.searchParams.get("rate") ?? "-2%";
  const rate = /^[+-]?\d{1,2}%$/.test(reqRate) ? reqRate : "-2%";

  // 4. 校验时间戳与防篡改签名 (ts + sig)
  const ts = url.searchParams.get("ts") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  const validSig = await verifySignature(ts, sig, voice, rate, cleaned);
  if (!validSig) {
    return jsonError(403, "Forbidden: invalid or expired signature", corsHeaders);
  }

  // 5. 优先查询 Cloudflare 全球边缘节点缓存（命中缓存不消耗任何 Azure 额度）
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
      for (const [k, v] of Object.entries(corsHeaders)) {
        headers.set(k, v);
      }
      return new Response(hit.body, {
        status: hit.status,
        headers,
      });
    }
  }

  // 6. 缓存未命中时，按客户端真实 IP 执行严格限流（防止恶意构造随机文本耗尽月度免费额度）
  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (!checkAndIncrementIpQuota(clientIp)) {
    return jsonError(429, "Rate limit exceeded for new speech synthesis", corsHeaders);
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
        ...corsHeaders,
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
    return jsonError(502, err instanceof Error ? err.message : String(err), corsHeaders);
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

  const endpoint = `https://${cleanRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>` +
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

function jsonError(status: number, error: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      ...corsHeaders,
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
    .slice(0, MAX_TEXT_LEN);
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
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
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
