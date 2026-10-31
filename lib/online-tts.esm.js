/**
 * 通用纯 JS (ES Module) 在线 AI 神经网络语音客户端 + 本机离线自动兜底 (`online-tts.esm.js`)
 * 仅保留「晓晓 · 温柔姐姐」(zh-CN-XiaoxiaoNeural) 单一高品质音色，内置防刷签名与本机离线兜底。
 */

import { NaturalTTS } from "./web-natural-tts.esm.js";

export const TTS_VOICE_OPTIONS = [
  {
    id: "zh-CN-XiaoxiaoNeural",
    emoji: "👩",
    shortLabel: "晓晓",
    name: "晓晓 · 温柔姐姐",
    hint: "AI 真人神经语音 · 自然柔和故事音",
    sample: "你好呀，我是温柔姐姐晓晓，今天也要开开心心学数学哦。",
  },
];

const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";
const TTS_CLIENT_SECRET = "kmg-tts-2026-guard-v1";
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

function sha256PureJs(ascii) {
  const rightRotate = (v, a) => (v >>> a) | (v << (32 - a));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : "") + b.toString(16);
    }
  }
  return result;
}

async function signTtsRequest(voice, rate, text) {
  const ts = String(Math.floor(Date.now() / 1000));
  const raw = `${ts}|${voice}|${rate}|${text}|${TTS_CLIENT_SECRET}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
    return { ts, sig: hex };
  }
  const utf8Str = unescape(encodeURIComponent(raw));
  return { ts, sig: sha256PureJs(utf8Str).slice(0, 32) };
}

export class OnlineNeuralTTS {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "/api/tts";
    this.fallbackEndpoint = options.fallbackEndpoint || "https://kid-math-game.pages.dev/api/tts";
    this.voice = DEFAULT_VOICE;
    this.rate = options.rate || "-2%";
    this.muted = Boolean(options.muted);
    this.maxBlobCache = options.maxBlobCache || 80;
    this.backoffMs = options.backoffMs || 25000;

    this.blobCache = new Map();
    this.inflightClient = new Map();
    this.sharedAudio = null;
    this.audioUnlocked = false;
    this.activeSeq = 0;
    this.activeAbort = null;
    this.neuralBackoffUntil = 0;
    this.offlineTts =
      typeof window !== "undefined" && "speechSynthesis" in window
        ? new NaturalTTS({
            lang: "zh-CN",
            rate: 0.94,
            pitch: 1.0,
            filterEmojis: true,
            normalizeMath: true,
            cancelPrevious: true,
            autoUnlock: true,
          })
        : null;

    if (typeof window !== "undefined" && options.autoUnlock !== false) {
      const unlock = () => this.unlockAudio();
      document.addEventListener("pointerdown", unlock, { once: true, passive: true });
      document.addEventListener("touchstart", unlock, { once: true, passive: true });
    }
  }

  getSharedAudio() {
    if (typeof window === "undefined" || typeof Audio === "undefined") return null;
    if (!this.sharedAudio) {
      this.sharedAudio = new Audio();
      this.sharedAudio.preload = "auto";
    }
    return this.sharedAudio;
  }

  unlockAudio() {
    if (this.audioUnlocked) return;
    const el = this.getSharedAudio();
    if (!el) return;
    this.audioUnlocked = true;
    try {
      el.muted = true;
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          el.pause();
          el.muted = false;
          el.currentTime = 0;
        }).catch(() => {
          el.muted = false;
        });
      } else {
        el.muted = false;
      }
    } catch {
      el.muted = false;
    }
  }

  cleanText(raw) {
    if (!raw || typeof raw !== "string") return "";
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
      .slice(0, 80);
  }

  _cacheBlobUrl(key, url) {
    if (this.blobCache.has(key)) {
      this.blobCache.delete(key);
    } else if (this.blobCache.size >= this.maxBlobCache) {
      const oldestKey = this.blobCache.keys().next().value;
      if (oldestKey) {
        const oldUrl = this.blobCache.get(oldestKey);
        this.blobCache.delete(oldestKey);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
      }
    }
    this.blobCache.set(key, url);
  }

  async _fetchNeuralBlobUrl(voice, cleanedText, signal) {
    const key = `${voice}|${this.rate}|${cleanedText}`;
    const cached = this.blobCache.get(key);
    if (cached) {
      this.blobCache.delete(key);
      this.blobCache.set(key, cached);
      return cached;
    }

    const existing = this.inflightClient.get(key);
    if (existing) return existing;

    const task = (async () => {
      try {
        const { ts, sig } = await signTtsRequest(voice, this.rate, cleanedText);
        const params = new URLSearchParams({
          voice,
          rate: this.rate,
          text: cleanedText,
          ts,
          sig,
        });
        const res = await fetch(`${this.endpoint}?${params.toString()}`, {
          signal,
          headers: { "X-Requested-With": "KidMathGame-TTS/1.0" },
        });
        if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("audio")) throw new Error("Non-audio TTS response");
        const blob = await res.blob();
        if (blob.size < 128) throw new Error("Empty TTS audio");
        const url = URL.createObjectURL(blob);
        this._cacheBlobUrl(key, url);
        return url;
      } finally {
        this.inflightClient.delete(key);
      }
    })();

    this.inflightClient.set(key, task);
    return task;
  }

  async speak(rawText) {
    if (this.muted) return;
    const cleaned = this.cleanText(rawText);
    if (!cleaned) return;

    this.unlockAudio();

    this.activeSeq += 1;
    const seq = this.activeSeq;
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
    const el = this.getSharedAudio();
    if (el && !el.paused) {
      el.pause();
      el.currentTime = 0;
    }
    if (this.offlineTts) this.offlineTts.stop();

    const voice = DEFAULT_VOICE;

    if (el && Date.now() >= this.neuralBackoffUntil) {
      const controller = new AbortController();
      this.activeAbort = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 4000);
      try {
        const blobUrl = await this._fetchNeuralBlobUrl(voice, cleaned, controller.signal);
        window.clearTimeout(timeoutId);
        if (seq !== this.activeSeq) return;

        el.muted = false;
        el.src = blobUrl;
        el.currentTime = 0;
        await new Promise((resolve, reject) => {
          const cleanup = () => {
            el.onended = null;
            el.onerror = null;
          };
          el.onended = () => {
            cleanup();
            resolve();
          };
          el.onerror = () => {
            cleanup();
            reject(new Error("Audio playback error"));
          };
          el.play().catch((err) => {
            cleanup();
            reject(err);
          });
        });
        return;
      } catch (err) {
        window.clearTimeout(timeoutId);
        if (seq !== this.activeSeq) return;
        this.neuralBackoffUntil = Date.now() + this.backoffMs;
      } finally {
        if (this.activeAbort === controller) this.activeAbort = null;
      }
    }

    if (seq !== this.activeSeq) return;
    if (this.offlineTts) {
      await this.offlineTts.speak(cleaned).catch(() => undefined);
    }
  }

  stop() {
    this.activeSeq += 1;
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
    if (this.sharedAudio && !this.sharedAudio.paused) {
      this.sharedAudio.pause();
      this.sharedAudio.currentTime = 0;
    }
    if (this.offlineTts) this.offlineTts.stop();
  }

  setVoice() {
    this.voice = DEFAULT_VOICE;
    this.neuralBackoffUntil = 0;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this.stop();
  }
}

export default OnlineNeuralTTS;
