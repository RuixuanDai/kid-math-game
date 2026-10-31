/**
 * 通用纯 JS (ES Module) 在线 AI 神经网络语音客户端 + 本机离线自动兜底 (`online-tts.esm.js`)
 * 适用于 Vue 3 / Svelte / 原生 HTML 等非 React 或纯 JS 项目。
 */

import { NaturalTTS } from "./web-natural-tts.esm.js";

export const TTS_VOICE_OPTIONS = [
  {
    id: "zh-CN-XiaoyiNeural",
    emoji: "👧",
    shortLabel: "晓伊",
    name: "晓伊 · 甜美童趣",
    hint: "AI 真人神经语音 · 活泼甜美绘本音（默认推荐）",
    sample: "太棒啦！我是甜美小精灵晓伊，点任何题目我都会读给你听哦！",
  },
  {
    id: "zh-CN-XiaoxiaoNeural",
    emoji: "👩",
    shortLabel: "晓晓",
    name: "晓晓 · 温柔姐姐",
    hint: "AI 真人神经语音 · 自然柔和故事音",
    sample: "你好呀，我是温柔姐姐晓晓，今天也要开开心心学数学哦。",
  },
  {
    id: "zh-CN-YunxiaNeural",
    emoji: "👦",
    shortLabel: "云夏",
    name: "云夏 · 元气少年",
    hint: "AI 真人神经语音 · 阳光清脆卡通哥哥音",
    sample: "嗨！我是元气小哥哥云夏，我们一起开启数学大闯关吧！",
  },
  {
    id: "zh-CN-liaoning-XiaobeiNeural",
    emoji: "🎭",
    shortLabel: "晓北",
    name: "晓北 · 欢乐姐姐",
    hint: "AI 真人神经语音 · 亲切幽默东北腔",
    sample: "哎呀太棒啦！我是欢乐姐姐晓北，咱今天表现老好啦！",
  },
  {
    id: "zh-CN-YunjianNeural",
    emoji: "🦁",
    shortLabel: "云健",
    name: "云健 · 故事爸爸",
    hint: "AI 真人神经语音 · 温暖浑厚鼓励男声",
    sample: "干得漂亮！我是故事爸爸云健，为你今天的努力点赞！",
  },
  {
    id: "local",
    emoji: "📱",
    shortLabel: "离线",
    name: "本机离线语音",
    hint: "不走网络 · 直接调用平板/电脑系统自带语音库",
    sample: "当前使用的是这台设备自带的本机离线语音。",
  },
];

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export class OnlineNeuralTTS {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "/api/tts";
    this.fallbackEndpoint = options.fallbackEndpoint || "https://kid-math-game.pages.dev/api/tts";
    this.voice = options.voice || "zh-CN-XiaoyiNeural";
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
      .trim();
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
        const params = new URLSearchParams({
          voice,
          rate: this.rate,
          text: cleanedText,
        });
        const res = await fetch(`${this.endpoint}?${params.toString()}`, { signal });
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

  async speak(rawText, voiceOverride) {
    if (this.muted) return;
    const cleaned = this.cleanText(rawText);
    if (!cleaned) return;

    this.unlockAudio();
    if (voiceOverride && voiceOverride !== "local") {
      this.neuralBackoffUntil = 0;
    }

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

    const voice = voiceOverride || this.voice || "zh-CN-XiaoyiNeural";

    if (voice !== "local" && el && Date.now() >= this.neuralBackoffUntil) {
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

  setVoice(voiceId) {
    this.voice = voiceId;
    if (voiceId !== "local") this.neuralBackoffUntil = 0;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this.stop();
  }
}

export default OnlineNeuralTTS;
