/**
 * WebNaturalTTS - 高品质、零依赖的前端 Web 自然人声语音合成库
 * 
 * 特色功能:
 * 1. 智能分级语音优选: 优先匹配微软自然人声 (Xiaoxiao/Yunxi/Neural)、苹果增强人声 (Ting-Ting Enhanced/Siri) 等高品质音色，杜绝机械刺耳音
 * 2. 智能 Emoji 过滤: 采用 Unicode 属性正则彻底剥离各类表情符号，防止朗读时读出"派对礼花"、"肌肉"等多余文字
 * 3. 口语化数学符号润色: 自动将 +、-、×、÷、= 等符号转换为自然口语表达（"加"、"减"、"等于"等）
 * 4. 移动端与 Safari 静音解锁: 针对 iOS/iPadOS/Android 自动监听首次用户手势激活 SpeechSynthesis 与 Web Audio
 * 5. Chrome 长文本保活: 防止 Chromium 内核在朗读长文本时超过 15 秒卡死
 * 6. Promise 异步友好: speak() 返回 Promise，支持 await 或事件监听
 * 
 * 兼容性: 现代浏览器 (Chrome, Edge, Safari iOS/macOS, Firefox, Android Chrome/WebView)
 */

(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    global = typeof globalThis !== 'undefined' ? globalThis : global || self;
    global.NaturalTTS = factory();
  }
})(this, function () {
  'use strict';

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
    // 微软高质量自然神经人声 (Windows / Edge / 云端注入)
    'xiaoxiao', 'yunxi', 'xiaoyi', 'natural', 'neural',
    // Apple 官方高品质自然人声 (iOS / iPadOS / macOS)
    'tingting (enhanced)', 'ting-ting (enhanced)', 'tingting', 'ting-ting',
    'yu-shu', 'sin-ji', 'meijia', 'siri', 'lili',
    // Android / Google / Chrome 原生优化语音
    'cce-network', 'cce-local', '普通话', 'google'
  ];

  // 高品质英文人声优选名单
  const PREFERRED_ENGLISH_VOICES = [
    'jenny', 'guy', 'aria', 'neural', 'natural',
    'samantha (enhanced)', 'samantha', 'siri', 'daniel', 'karen', 'victoria',
    'google us english'
  ];

  class NaturalTTS {
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

    /**
     * 检测浏览器是否支持 Web Speech API
     * @returns {boolean}
     */
    static isSupported() {
      return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    }

    /**
     * 初始化并监听声音列表加载事件
     * @private
     */
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

      // 立即触发一次获取
      refreshVoice();
    }

    /**
     * 智能优选系统最佳自然人声
     * @param {string} [lang] 语言代码，默认取实例配置
     * @returns {SpeechSynthesisVoice|null}
     */
    getBestVoice(lang = this.options.lang) {
      if (!NaturalTTS.isSupported()) return null;
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return null;

      const targetLang = (lang || 'zh-CN').toLowerCase();

      // 中文语系匹配
      if (targetLang.includes('zh') || targetLang.includes('cmn')) {
        // 梯队 1: 优先匹配高品质神经网络 / 自然人声关键字
        for (const pref of PREFERRED_CHINESE_VOICES) {
          const match = voices.find(v => {
            const name = (v.name || '').toLowerCase();
            const voiceLang = (v.lang || '').toLowerCase();
            return (voiceLang.includes('zh') || voiceLang.includes('cmn')) && name.includes(pref);
          });
          if (match) return match;
        }

        // 梯队 2: 大陆普通话标准音 (zh-CN 或 cmn-Hans-CN)
        const zhCn = voices.find(v => {
          const voiceLang = (v.lang || '').toLowerCase();
          return voiceLang === 'zh-cn' || voiceLang === 'cmn-hans-cn' || voiceLang === 'zh_cn';
        });
        if (zhCn) return zhCn;

        // 梯队 3: 任意标准中文 (排除粤语优先)
        const anyZh = voices.find(v => {
          const voiceLang = (v.lang || '').toLowerCase();
          return (voiceLang.includes('zh') || voiceLang.includes('cmn')) && !voiceLang.includes('hk') && !voiceLang.includes('yue');
        });
        if (anyZh) return anyZh;

        // 兜底中文
        return voices.find(v => (v.lang || '').toLowerCase().includes('zh')) || null;
      }

      // 英文语系匹配
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

      // 其他语言按语言前缀匹配
      return voices.find(v => (v.lang || '').toLowerCase().startsWith(targetLang.split('-')[0])) || null;
    }

    /**
     * 手动指定声音 (支持声音对象或声音名称关键字)
     * @param {SpeechSynthesisVoice|string|null} voiceOrName 
     */
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

    /**
     * 获取系统支持的声音列表
     * @param {string} [filterLang] 可选的语言过滤关键字
     * @returns {SpeechSynthesisVoice[]}
     */
    getVoices(filterLang) {
      if (!NaturalTTS.isSupported()) return [];
      const voices = window.speechSynthesis.getVoices() || [];
      if (!filterLang) return voices;
      const target = filterLang.toLowerCase();
      return voices.filter(v => (v.lang || '').toLowerCase().includes(target));
    }

    /**
     * 文本润色与清洗: 剥离 Emoji 表情与转化口语符号
     * @param {string} text 原始文本
     * @param {Object} [opts] 自定义选项
     * @returns {string} 处理后的纯净文本
     */
    cleanText(text, opts = {}) {
      if (!text || typeof text !== 'string') return '';
      const filterEmojis = opts.filterEmojis !== undefined ? opts.filterEmojis : this.options.filterEmojis;
      const normalizeMath = opts.normalizeMath !== undefined ? opts.normalizeMath : this.options.normalizeMath;
      const isChinese = (opts.lang || this.options.lang || '').toLowerCase().includes('zh');

      let result = text;

      // 1. 过滤 Emoji 表情符号与组合字元（杜绝读出“派对礼花”、“肌肉”等表情名字）
      if (filterEmojis) {
        result = result.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F6FF}\u{FE00}-\u{FE0F}\u{200D}\u{2300}-\u{23FF}\u{2B50}]/gu, '');
      }

      // 2. 数学与特殊符号口语化
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

      // 3. 标点符号规范化与多余空格折叠
      result = result
        .replace(/[！!]+/g, '！')
        .replace(/[？?]+/g, '？')
        .replace(/\s+/g, ' ')
        .trim();

      return result;
    }

    /**
     * 静态方法: 文本清理
     */
    static cleanText(text, options) {
      return new NaturalTTS(options).cleanText(text);
    }

    /**
     * 自动绑定首击交互解锁移动端限制 (iOS Safari / iPadOS / Android)
     */
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

    /**
     * 唤醒并解锁 Web Audio 与 SpeechSynthesis
     */
    unlock() {
      if (this.isUnlocked) return;
      this.isUnlocked = true;

      // 1. 若存在 AudioContext，激活 resume
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const testCtx = new AudioCtx();
          if (testCtx.state === 'suspended') {
            testCtx.resume();
          }
        }
      } catch (_) {}

      // 2. 发送一个静音短片段激活 iOS SpeechSynthesis 队列
      if (NaturalTTS.isSupported()) {
        try {
          const blankUtterance = new SpeechSynthesisUtterance('');
          blankUtterance.volume = 0;
          window.speechSynthesis.speak(blankUtterance);
        } catch (_) {}
      }
    }

    /**
     * 静态解锁入口
     */
    static unlock() {
      const instance = new NaturalTTS({ autoUnlock: false });
      instance.unlock();
    }

    /**
     * 朗读文本
     * @param {string} text 要朗读的文本
     * @param {Object} [overrideOptions] 本次调用的覆盖配置 (rate, pitch, lang, onStart, onEnd, onError 等)
     * @returns {Promise<void>} 语音播放结束时 resolve
     */
    speak(text, overrideOptions = {}) {
      return new Promise((resolve, reject) => {
        if (!NaturalTTS.isSupported()) {
          console.warn('[NaturalTTS] Web Speech API 不被当前浏览器支持');
          resolve();
          return;
        }

        const opts = Object.assign({}, this.options, overrideOptions);

        // 如果配置了打断，先取消之前的播放
        if (opts.cancelPrevious) {
          this.stop();
        }

        // 清理与润色文本
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

          // 匹配自然语音
          let voice = this.customVoice || this.cachedVoice;
          if (!voice || (opts.lang && opts.lang !== this.options.lang)) {
            voice = this.getBestVoice(opts.lang);
          }
          if (voice) {
            utterance.voice = voice;
          }

          // Chrome 长时间朗读保活机制 (解决 Chromium > 15s 自动挂起问题)
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
            // 如果是被手动 cancel 的不算异常
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

    /**
     * 停止所有发音
     */
    stop() {
      this._clearKeepAlive();
      if (NaturalTTS.isSupported()) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
    }

    /**
     * 暂停发音
     */
    pause() {
      if (NaturalTTS.isSupported()) {
        try {
          window.speechSynthesis.pause();
        } catch (_) {}
      }
    }

    /**
     * 恢复发音
     */
    resume() {
      if (NaturalTTS.isSupported()) {
        try {
          window.speechSynthesis.resume();
        } catch (_) {}
      }
    }

    /**
     * 当前是否正在朗读
     * @returns {boolean}
     */
    isSpeaking() {
      return NaturalTTS.isSupported() && window.speechSynthesis.speaking;
    }

    /**
     * 当前是否处于暂停状态
     * @returns {boolean}
     */
    isPaused() {
      return NaturalTTS.isSupported() && window.speechSynthesis.paused;
    }

    /**
     * Chromium 长音频保活心跳
     * @private
     */
    _startKeepAlive() {
      this._clearKeepAlive();
      if (!NaturalTTS.isSupported()) return;

      this.keepAliveTimer = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          this._clearKeepAlive();
          return;
        }
        // 快速微暂停+恢复，刷新 Chromium 内部超时计时器
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 10000);
    }

    /**
     * 清除保活定时器
     * @private
     */
    _clearKeepAlive() {
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
    }
  }

  return NaturalTTS;
});
