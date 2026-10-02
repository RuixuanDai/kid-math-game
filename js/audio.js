// 音频合成与语音助手模块 (纯 Web Audio API + SpeechSynthesis 优选自然人声)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.voiceEnabled = true;
    this.cachedVoice = null;
    this.initAudioContext();
    this.initVoiceListener();
  }

  initAudioContext() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  ensureContext() {
    if (!this.ctx) this.initAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  initVoiceListener() {
    if ('speechSynthesis' in window) {
      // 监听语音库加载 (在 iOS Safari 与 Chrome 中初始为异步加载)
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoice = this.getBestChineseVoice();
      };
      this.cachedVoice = this.getBestChineseVoice();
    }
  }

  // 智能优选高品质自然中文人声 (过滤掉机械刺耳的底层合成音)
  getBestChineseVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 优先选择微软、iOS/iPadOS 官方的高品质自然温柔人声
    const preferredNames = [
      // 微软自然人声 (极度柔和拟真)
      'xiaoxiao', 'yunxi', 'xiaoyi', 'natural', 'neural',
      // iOS / iPadOS 高级自然女声 (iPad 上音质最佳)
      'tingting (enhanced)', 'ting-ting (enhanced)', 'tingting', 'ting-ting',
      'yu-shu', 'sin-ji', 'meijia', 'siri', 'lili',
      // Android / Chrome 原生优化语音
      'cce-network', 'cce-local', '普通话'
    ];

    // 梯队 1: 命中精选自然人声名单且语言为中文
    for (const pref of preferredNames) {
      const match = voices.find(v => {
        const name = (v.name || '').toLowerCase();
        const lang = (v.lang || '').toLowerCase();
        return (lang.includes('zh') || lang.includes('cmn')) && name.includes(pref);
      });
      if (match) return match;
    }

    // 梯队 2: 大陆普通话 (zh-CN 或 cmn-Hans-CN)
    const zhCn = voices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang === 'zh-cn' || lang === 'cmn-hans-cn' || lang === 'zh_cn';
    });
    if (zhCn) return zhCn;

    // 梯队 3: 任意标准中文 (排除粤语优先)
    const anyZh = voices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      return (lang.includes('zh') || lang.includes('cmn')) && !lang.includes('hk') && !lang.includes('yue');
    });
    if (anyZh) return anyZh;

    return voices.find(v => (v.lang || '').toLowerCase().includes('zh')) || null;
  }

  // 点击泡泡音效
  playPop() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 答对音效：欢快和弦琶音
  playCorrect() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + index * 0.07;
        const duration = 0.25;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 温柔提示音效（答错时不给挫败感，是温和的弹性声）
  playWrong() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(240, now + 0.18);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 过关/大奖励欢庆喇叭
  playFanfare() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const melody = [
        { f: 523.25, d: 0.1, t: 0 },
        { f: 523.25, d: 0.1, t: 0.12 },
        { f: 523.25, d: 0.1, t: 0.24 },
        { f: 659.25, d: 0.15, t: 0.36 },
        { f: 783.99, d: 0.15, t: 0.52 },
        { f: 1046.50, d: 0.45, t: 0.68 }
      ];

      melody.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + note.t;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, start);

        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + note.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + note.d);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 获得金星光效声
  playStar() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.25);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 倒计时滴答声 / 时钟滴答声
  playTick() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 连击连对爆发音
  playCombo() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const freqs = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + i * 0.05;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 语音播报（升级自然柔和幼教人声：语调设为1.0自然真声，语速从容，杜绝尖锐电子音）
  speak(text) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // 停止当前正在说的内容

      // 文本语感润色：将数学符号替换为自然口语词汇，避免生硬读出
      const polished = text
        .replace(/\+/g, ' 加 ')
        .replace(/-/g, ' 减 ')
        .replace(/=/g, ' 等于 ')
        .replace(/\?/g, '？')
        .replace(/!/g, '！');

      const utterance = new SpeechSynthesisUtterance(polished);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.92; // 稍慢从容，方便6岁儿童听清
      utterance.pitch = 1.0; // 关键：恢复自然人声音高（此前1.25会导致机械变声严重）
      utterance.volume = 1.0;

      // 动态匹配当前系统最自然的中文人声
      if (!this.cachedVoice) {
        this.cachedVoice = this.getBestChineseVoice();
      }
      if (this.cachedVoice) {
        utterance.voice = this.cachedVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech error:", e);
    }
  }
}

window.soundManager = new SoundManager();
