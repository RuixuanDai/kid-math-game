/**
 * WebNaturalTTS (ESM Version) - 高品质、零依赖的前端 Web 自然人声语音合成库
 * 
 * 用法:
 * import { NaturalTTS } from './web-natural-tts.esm.js';
 * const tts = new NaturalTTS();
 * tts.speak('你好，小朋友！🌟');
 */

// 默认配置
const DEFAULT_OPTIONS = {
  lang: 'zh-CN',
  rate: 0.92,       // 稍慢且从容的自然语速，特别适合儿童教育与朗读
  pitch: 1.0,      // 1.0 还原原声自然声调，避免尖锐电子音
  volume: 1.0,
  filterEmojis: true,
  normalizeMath: true,
  cancelPrevious: true,
  autoUnlock: true
};

// 高品质中文自然人声优选名单（按推荐优先级排列）
const PREFERRED_CHINESE_VOICES = [
  'xiaoxiao', 'yunxi', 'xiaoyi', 'natural', 'neural',
  'tingting (enhanced)', 'ting-ting (enhanced)', 'tingting', 'ting-ting',
  'yu-shu', 'sin-ji', 'meijia', 'siri', 'lili',
  'cce-network', 'cce-local', '普通话', 'google'
];

// 高品质英文人声优选名单
const PREFERRED_ENGLISH_VOICES = [
  'jenny', 'guy', 'aria', 'neural', 'natural',
  'samantha (enhanced)', 'samantha', 'siri', 'daniel', 'karen', 'victoria',
  'google us english'
];

export class NaturalTTS {
  /**
   * @param {Object} [options] 配置项
   * @param {string} [options.lang='zh-CN'] 默认语言代码 ('zh-CN', 'en-US' 等)
   * @param {number} [options.rate=0.92] 语速 (0.1 ~ 10，建议 0.85 ~ 1.1)
   * @param {number} [options.pitch=1.0] 音调 (0 ~ 2，建议 1.0)
   * @param {number} [options.volume=1.0] 音量 (0 ~ 1)
   * @param {boolean} [options.filterEmojis=true] 是否自动过滤 Emoji 表情
   * @param {boolean} [options.normalizeMath=true] 是否自动将数学符号转换为中文/英文口语
   * @param {boolean} [options.cancelPrevious=true] 朗读新句子前是否打断上一次发音
   * @param {boolean} [options.autoUnlock=true] 是否在首次用户点击/触摸时自动解锁移动端限制
   */
  constructor(options = {}) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.cachedVoice = null;
    this.customVoice = null;
    this.isUnlocked = false;
    this.keepAliveTimer = null;

    this._initVoices();
    if (this.options.autoUnlock) {
      this.bindAutoUnlock();
    }
  }

  static isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  _initVoices() {
    if (!NaturalTTS.isSupported()) return;

    const refreshVoice = () => {
      if (!this.customVoice) {
        this.cachedVoice = this.getBestVoice(this.options.lang);
      }
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = refreshVoice;
    }
    refreshVoice();
  }

  getBestVoice(lang = this.options.lang) {
    if (!NaturalTTS.isSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetLang = (lang || 'zh-CN').toLowerCase();

    if (targetLang.includes('zh') || targetLang.includes('cmn')) {
      for (const pref of PREFERRED_CHINESE_VOICES) {
        const match = voices.find(v => {
          const name = (v.name || '').toLowerCase();
          const voiceLang = (v.lang || '').toLowerCase();
          return (voiceLang.includes('zh') || voiceLang.includes('cmn')) && name.includes(pref);
        });
        if (match) return match;
      }

      const zhCn = voices.find(v => {
        const voiceLang = (v.lang || '').toLowerCase();
        return voiceLang === 'zh-cn' || voiceLang === 'cmn-hans-cn' || voiceLang === 'zh_cn';
      });
      if (zhCn) return zhCn;

      const anyZh = voices.find(v => {
        const voiceLang = (v.lang || '').toLowerCase();
        return (voiceLang.includes('zh') || voiceLang.includes('cmn')) && !voiceLang.includes('hk') && !voiceLang.includes('yue');
      });
      if (anyZh) return anyZh;

      return voices.find(v => (v.lang || '').toLowerCase().includes('zh')) || null;
    }

    if (targetLang.includes('en')) {
      for (const pref of PREFERRED_ENGLISH_VOICES) {
        const match = voices.find(v => {
          const name = (v.name || '').toLowerCase();
          const voiceLang = (v.lang || '').toLowerCase();
          return voiceLang.includes('en') && name.includes(pref);
        });
        if (match) return match;
      }
      return voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || null;
    }

    return voices.find(v => (v.lang || '').toLowerCase().startsWith(targetLang.split('-')[0])) || null;
  }

  setVoice(voiceOrName) {
    if (!voiceOrName) {
      this.customVoice = null;
      this.cachedVoice = this.getBestVoice(this.options.lang);
      return;
    }
    if (typeof voiceOrName === 'string') {
      const voices = this.getVoices();
      const found = voices.find(v => (v.name || '').toLowerCase().includes(voiceOrName.toLowerCase()));
      if (found) {
        this.customVoice = found;
        this.cachedVoice = found;
      }
    } else if (typeof voiceOrName === 'object') {
      this.customVoice = voiceOrName;
      this.cachedVoice = voiceOrName;
    }
  }

  getVoices(filterLang) {
    if (!NaturalTTS.isSupported()) return [];
    const voices = window.speechSynthesis.getVoices() || [];
    if (!filterLang) return voices;
    const target = filterLang.toLowerCase();
    return voices.filter(v => (v.lang || '').toLowerCase().includes(target));
  }

  cleanText(text, opts = {}) {
    if (!text || typeof text !== 'string') return '';
    const filterEmojis = opts.filterEmojis !== undefined ? opts.filterEmojis : this.options.filterEmojis;
    const normalizeMath = opts.normalizeMath !== undefined ? opts.normalizeMath : this.options.normalizeMath;
    const isChinese = (opts.lang || this.options.lang || '').toLowerCase().includes('zh');

    let result = text;

    if (filterEmojis) {
      result = result.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F6FF}\u{FE00}-\u{FE0F}\u{200D}\u{2300}-\u{23FF}\u{2B50}]/gu, '');
    }

    if (normalizeMath) {
      if (isChinese) {
        result = result
          .replace(/\+/g, ' 加 ')
          .replace(/-/g, ' 减 ')
          .replace(/[×*]/g, ' 乘 ')
          .replace(/[÷/]/g, ' 除以 ')
          .replace(/=/g, ' 等于 ')
          .replace(/</g, ' 小于 ')
          .replace(/>/g, ' 大于 ')
          .replace(/%/g, ' 百分之 ');
      } else {
        result = result
          .replace(/\+/g, ' plus ')
          .replace(/-/g, ' minus ')
          .replace(/[×*]/g, ' times ')
          .replace(/[÷/]/g, ' divided by ')
          .replace(/=/g, ' equals ')
          .replace(/</g, ' less than ')
          .replace(/>/g, ' greater than ')
          .replace(/%/g, ' percent ');
      }
    }

    result = result
      .replace(/[！!]+/g, '！')
      .replace(/[？?]+/g, '？')
      .replace(/\s+/g, ' ')
      .trim();

    return result;
  }

  static cleanText(text, options) {
    return new NaturalTTS(options).cleanText(text);
  }

  bindAutoUnlock() {
    if (this.isUnlocked || typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlock();
      document.removeEventListener('pointerdown', unlockHandler, true);
      document.removeEventListener('touchstart', unlockHandler, true);
      document.removeEventListener('click', unlockHandler, true);
    };

    document.addEventListener('pointerdown', unlockHandler, true);
    document.addEventListener('touchstart', unlockHandler, true);
    document.addEventListener('click', unlockHandler, true);
  }

  unlock() {
    if (this.isUnlocked) return;
    this.isUnlocked = true;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const testCtx = new AudioCtx();
        if (testCtx.state === 'suspended') {
          testCtx.resume();
        }
      }
    } catch (_) {}

    if (NaturalTTS.isSupported()) {
      try {
        const blankUtterance = new SpeechSynthesisUtterance('');
        blankUtterance.volume = 0;
        window.speechSynthesis.speak(blankUtterance);
      } catch (_) {}
    }
  }

  static unlock() {
    const instance = new NaturalTTS({ autoUnlock: false });
    instance.unlock();
  }

  speak(text, overrideOptions = {}) {
    return new Promise((resolve, reject) => {
      if (!NaturalTTS.isSupported()) {
        console.warn('[NaturalTTS] Web Speech API 不被当前浏览器支持');
        resolve();
        return;
      }

      const opts = Object.assign({}, this.options, overrideOptions);

      if (opts.cancelPrevious) {
        this.stop();
      }

      const polishedText = this.cleanText(text, opts);
      if (!polishedText) {
        resolve();
        return;
      }

      try {
        const utterance = new SpeechSynthesisUtterance(polishedText);
        utterance.lang = opts.lang;
        utterance.rate = typeof opts.rate === 'number' ? opts.rate : 0.92;
        utterance.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1.0;
        utterance.volume = typeof opts.volume === 'number' ? opts.volume : 1.0;

        let voice = this.customVoice || this.cachedVoice;
        if (!voice || (opts.lang && opts.lang !== this.options.lang)) {
          voice = this.getBestVoice(opts.lang);
        }
        if (voice) {
          utterance.voice = voice;
        }

        this._startKeepAlive();

        utterance.onstart = (event) => {
          if (typeof opts.onStart === 'function') opts.onStart(event);
        };

        utterance.onend = (event) => {
          this._clearKeepAlive();
          if (typeof opts.onEnd === 'function') opts.onEnd(event);
          resolve();
        };

        utterance.onerror = (event) => {
          this._clearKeepAlive();
          if (event.error === 'canceled' || event.error === 'interrupted') {
            resolve();
            return;
          }
          if (typeof opts.onError === 'function') opts.onError(event);
          console.warn('[NaturalTTS] Speech error:', event.error || event);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        this._clearKeepAlive();
        console.warn('[NaturalTTS] speak() failed:', err);
        resolve();
      }
    });
  }

  stop() {
    this._clearKeepAlive();
    if (NaturalTTS.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  pause() {
    if (NaturalTTS.isSupported()) {
      try {
        window.speechSynthesis.pause();
      } catch (_) {}
    }
  }

  resume() {
    if (NaturalTTS.isSupported()) {
      try {
        window.speechSynthesis.resume();
      } catch (_) {}
    }
  }

  isSpeaking() {
    return NaturalTTS.isSupported() && window.speechSynthesis.speaking;
  }

  isPaused() {
    return NaturalTTS.isSupported() && window.speechSynthesis.paused;
  }

  _startKeepAlive() {
    this._clearKeepAlive();
    if (!NaturalTTS.isSupported()) return;

    this.keepAliveTimer = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        this._clearKeepAlive();
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);
  }

  _clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}

export default NaturalTTS;
