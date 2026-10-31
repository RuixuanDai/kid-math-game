/**
 * WebOnlineTTS (`lib/web-online-tts.js`)
 * 全栈在线 AI 神经网络真人语音客户端 + 边缘缓存 + 本机离线自动兜底 (UMD / Browser Global)
 *
 * 特性：
 * 1. 内置 5 款精选微软 Azure / Edge 真人神经音色（晓伊 / 晓晓 / 云夏 / 晓北 / 云健）+ 本机离线语音兜底；
 * 2. iPad / iPhone Safari 100% 兼容：首次触摸通过 44 字节静音 WAV 解锁并全局复用单 HTMLAudioElement；
 * 3. 客户端内存 Blob URL LRU 缓存（默认 80 条）+ 并发请求合并（inflightClient）+ 空闲预热（prewarm）；
 * 4. 智能多级端点路由：优先请求同源 `/api/tts`（本地 server.py 或 Cloudflare Pages），在 GitHub Pages 等纯静态域名下自动路由至 Cloudflare Pages 边缘函数端点，断网/超时（>4s）时触发 25 秒熔断退避并无缝切换 NaturalTTS 本机语音；
 * 5. 自动持久化音色与静音设置至 localStorage (`web-online-tts-settings`)。
 */
(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global = typeof globalThis !== 'undefined' ? globalThis : global || self;
    const exported = factory();
    global.OnlineNeuralTTS = exported.OnlineNeuralTTS;
    global.TTS_VOICE_OPTIONS = exported.TTS_VOICE_OPTIONS;
  }
})(this, function () {
  'use strict';

  const TTS_VOICE_OPTIONS = [
    {
      id: 'zh-CN-XiaoyiNeural',
      emoji: '👧',
      shortLabel: '晓伊',
      name: '晓伊 · 甜美童趣',
      hint: 'AI 真人神经语音 · 活泼甜美绘本音（默认推荐）',
      sample: '太棒啦！我是甜美小精灵晓伊，点任何题目我都会读给你听哦！'
    },
    {
      id: 'zh-CN-XiaoxiaoNeural',
      emoji: '👩',
      shortLabel: '晓晓',
      name: '晓晓 · 温柔姐姐',
      hint: 'AI 真人神经语音 · 自然柔和故事音',
      sample: '你好呀，我是温柔姐姐晓晓，今天也要开开心心学数学哦。'
    },
    {
      id: 'zh-CN-YunxiaNeural',
      emoji: '👦',
      shortLabel: '云夏',
      name: '云夏 · 元气少年',
      hint: 'AI 真人神经语音 · 阳光清脆卡通哥哥音',
      sample: '嗨！我是元气小哥哥云夏，我们一起开启数学大闯关吧！'
    },
    {
      id: 'zh-CN-liaoning-XiaobeiNeural',
      emoji: '🎭',
      shortLabel: '晓北',
      name: '晓北 · 欢乐姐姐',
      hint: 'AI 真人神经语音 · 亲切幽默东北腔',
      sample: '哎呀太棒啦！我是欢乐姐姐晓北，咱今天表现老好啦！'
    },
    {
      id: 'zh-CN-YunjianNeural',
      emoji: '🦁',
      shortLabel: '云健',
      name: '云健 · 故事爸爸',
      hint: 'AI 真人神经语音 · 温暖浑厚鼓励男声',
      sample: '干得漂亮！我是故事爸爸云健，为你今天的努力点赞！'
    },
    {
      id: 'local',
      emoji: '📱',
      shortLabel: '离线',
      name: '本机离线语音',
      hint: '不走网络 · 直接调用平板/电脑系统自带语音库',
      sample: '当前使用的是这台设备自带的本机离线语音。'
    }
  ];

  const STORAGE_KEY = 'web-online-tts-settings';
  const DEFAULT_CLOUDFLARE_ENDPOINT = 'https://kid-math-game.pages.dev/api/tts';
  const SILENT_WAV =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  function isStaticOnlyHost() {
    if (typeof window === 'undefined' || !window.location) return false;
    const host = (window.location.hostname || '').toLowerCase();
    const proto = window.location.protocol || '';
    return proto === 'file:' || host.endsWith('.github.io') || host === 'github.io';
  }

  class OnlineNeuralTTS {
    constructor(options = {}) {
      const persisted = this._loadSettings();
      this.endpoint = options.endpoint || persisted.endpoint || '/api/tts';
      this.fallbackEndpoint = options.fallbackEndpoint || DEFAULT_CLOUDFLARE_ENDPOINT;
      this.voice = options.voice || persisted.voice || 'zh-CN-XiaoyiNeural';
      this.rate = options.rate || persisted.rate || '-2%';
      this.muted = options.muted !== undefined ? Boolean(options.muted) : Boolean(persisted.muted);
      this.maxBlobCache = options.maxBlobCache || 80;
      this.backoffMs = options.backoffMs || 25000;

      this.blobCache = new Map();
      this.inflightClient = new Map();
      this.sharedAudio = null;
      this.audioUnlocked = false;
      this.activeSeq = 0;
      this.activeAbort = null;
      this.neuralBackoffUntil = 0;
      this.lastExplicitSpeakAt = 0;
      this.preferFallbackEndpoint = isStaticOnlyHost();

      const NaturalTTSClass =
        (typeof window !== 'undefined' && window.NaturalTTS) ||
        (typeof globalThis !== 'undefined' && globalThis.NaturalTTS) ||
        null;

      this.offlineTts = NaturalTTSClass
        ? new NaturalTTSClass({
            lang: 'zh-CN',
            rate: 0.94,
            pitch: 1.0,
            volume: 1.0,
            filterEmojis: true,
            normalizeMath: true,
            cancelPrevious: true,
            autoUnlock: true
          })
        : null;

      if (typeof window !== 'undefined' && options.autoUnlock !== false) {
        const unlock = () => this.unlockAudio();
        document.addEventListener('pointerdown', unlock, { once: true, passive: true });
        document.addEventListener('touchstart', unlock, { once: true, passive: true });
      }
    }

    _loadSettings() {
      if (typeof window === 'undefined' || !window.localStorage) return {};
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    _saveSettings() {
      if (typeof window === 'undefined' || !window.localStorage) return;
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            voice: this.voice,
            muted: this.muted,
            rate: this.rate,
            endpoint: this.endpoint
          })
        );
      } catch (e) {
        // ignore quota errors
      }
    }

    getVoices() {
      return TTS_VOICE_OPTIONS;
    }

    getActiveVoiceOption() {
      return TTS_VOICE_OPTIONS.find(v => v.id === this.voice) || TTS_VOICE_OPTIONS[0];
    }

    getSharedAudio() {
      if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
      if (!this.sharedAudio) {
        this.sharedAudio = new Audio();
        this.sharedAudio.preload = 'auto';
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
        if (p && typeof p.then === 'function') {
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
      } catch (e) {
        el.muted = false;
      }
      if (this.offlineTts && typeof this.offlineTts.unlock === 'function') {
        this.offlineTts.unlock();
      }
    }

    cleanText(raw) {
      if (!raw || typeof raw !== 'string') return '';
      return raw
        .replace(/(\d{1,2}):00/g, '$1点整')
        .replace(/(\d{1,2}):30/g, '$1点半')
        .replace(/(\d{1,2}):(\d{2})/g, '$1点$2分')
        .replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F6FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2300}-\u{23FF}\u{2B50}]/gu, ' ')
        .replace(/[✓✔✕✖✗▶◀▲▼•·|]/g, ' ')
        .replace(/\+/g, ' 加 ')
        .replace(/[−-]/g, ' 减 ')
        .replace(/[×*]/g, ' 乘 ')
        .replace(/[÷]/g, ' 除以 ')
        .replace(/=/g, ' 等于 ')
        .replace(/(\d+)\s*\/\s*(\d+)/g, '$2个里完成了$1个')
        .replace(/\?/g, '？')
        .replace(/!/g, '！')
        .replace(/[！!]+/g, '！')
        .replace(/[？?]+/g, '？')
        .replace(/\s+/g, ' ')
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

    async _fetchFromUrl(baseUrl, paramsStr, signal) {
      const res = await fetch(`${baseUrl}?${paramsStr}`, { signal });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('audio')) throw new Error('Non-audio TTS response');
      const blob = await res.blob();
      if (blob.size < 128) throw new Error('Empty TTS audio');
      return URL.createObjectURL(blob);
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
            text: cleanedText
          });
          const paramsStr = params.toString();

          const primaryUrl = this.preferFallbackEndpoint ? this.fallbackEndpoint : this.endpoint;
          try {
            const url = await this._fetchFromUrl(primaryUrl, paramsStr, signal);
            this._cacheBlobUrl(key, url);
            return url;
          } catch (primaryErr) {
            if (signal && signal.aborted) throw primaryErr;
            if (!this.preferFallbackEndpoint && this.fallbackEndpoint && this.fallbackEndpoint !== this.endpoint) {
              const fallbackUrl = await this._fetchFromUrl(this.fallbackEndpoint, paramsStr, signal);
              this.preferFallbackEndpoint = true;
              this._cacheBlobUrl(key, fallbackUrl);
              return fallbackUrl;
            }
            throw primaryErr;
          }
        } finally {
          this.inflightClient.delete(key);
        }
      })();

      this.inflightClient.set(key, task);
      return task;
    }

    prewarm(phrases = [], voiceOverride) {
      const voice = voiceOverride || this.voice;
      if (typeof window === 'undefined' || voice === 'local' || Date.now() < this.neuralBackoffUntil) return;
      const run = () => {
        for (const p of phrases) {
          const cleaned = this.cleanText(p);
          const key = `${voice}|${this.rate}|${cleaned}`;
          if (cleaned && !this.blobCache.has(key)) {
            this._fetchNeuralBlobUrl(voice, cleaned).catch(() => {});
          }
        }
      };
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(run);
      } else {
        setTimeout(run, 1000);
      }
    }

    async speak(rawText, voiceOverride) {
      this.lastExplicitSpeakAt = Date.now();
      if (this.muted) return;
      const cleaned = this.cleanText(rawText);
      if (!cleaned) return;

      this.unlockAudio();
      if (voiceOverride && voiceOverride !== 'local') {
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

      const voice = voiceOverride || this.voice || 'zh-CN-XiaoyiNeural';

      if (voice !== 'local' && el && Date.now() >= this.neuralBackoffUntil) {
        const controller = new AbortController();
        this.activeAbort = controller;
        const timeoutId = window.setTimeout(() => controller.abort(), 4200);
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
              reject(new Error('Audio playback error'));
            };
            el.play().catch(err => {
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
        await this.offlineTts.speak(cleaned).catch(() => {});
      }
    }

    stop() {
      this.lastExplicitSpeakAt = Date.now();
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
      if (voiceId !== 'local') this.neuralBackoffUntil = 0;
      this._saveSettings();
      return this.getActiveVoiceOption();
    }

    cycleVoice(includeOffline = true) {
      const list = includeOffline
        ? TTS_VOICE_OPTIONS
        : TTS_VOICE_OPTIONS.filter(v => v.id !== 'local');
      const curIdx = list.findIndex(v => v.id === this.voice);
      const next = list[(curIdx + 1) % list.length];
      this.setVoice(next.id);
      this.speak(next.sample, next.id);
      return next;
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      if (this.muted) this.stop();
      this._saveSettings();
      return this.muted;
    }
  }

  return {
    OnlineNeuralTTS,
    TTS_VOICE_OPTIONS
  };
});
