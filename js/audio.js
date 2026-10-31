// 音频合成与语音助手模块 (Web Audio API + WebOnlineTTS 在线 AI 真人神经语音 + NaturalTTS 离线兜底)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.voiceEnabled = true;
    this.onlineTts = null;
    this.tts = null;
    this.cachedVoice = null;
    this.prewarmed = false;
    this.initAudioContext();
    this.initTTS();
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
      this.ctx.resume().catch(() => {});
    }
    if (this.onlineTts && typeof this.onlineTts.unlockAudio === 'function') {
      this.onlineTts.unlockAudio();
      if (!this.prewarmed) {
        this.prewarmed = true;
        this.onlineTts.prewarm([
          '太棒啦！答对啦，奖励你一颗小金星！',
          '好厉害呀！你的小脑袋转得真快！',
          '别灰心，仔细看一看，再试一次吧！',
          '语音朗读打开啦！'
        ]);
      }
    } else if (this.tts && typeof this.tts.unlock === 'function') {
      this.tts.unlock();
    }
  }

  initTTS() {
    if (typeof window.OnlineNeuralTTS === 'function') {
      this.onlineTts = new window.OnlineNeuralTTS({
        endpoint: '/api/tts',
        fallbackEndpoint: 'https://kid-math-game.pages.dev/api/tts',
        rate: '-2%',
        autoUnlock: true
      });
      this.voiceEnabled = !this.onlineTts.muted;
      this.tts = this.onlineTts.offlineTts || null;
      return;
    }

    if (typeof window.NaturalTTS === 'function') {
      this.tts = new window.NaturalTTS({
        lang: 'zh-CN',
        rate: 0.92,
        pitch: 1.0,
        volume: 1.0,
        filterEmojis: true,
        normalizeMath: true,
        cancelPrevious: true,
        autoUnlock: true
      });
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoice = this.getBestChineseVoice();
      };
      this.cachedVoice = this.getBestChineseVoice();
    }
  }

  getActiveVoiceOption() {
    if (this.onlineTts && typeof this.onlineTts.getActiveVoiceOption === 'function') {
      return this.onlineTts.getActiveVoiceOption();
    }
    return {
      id: 'local',
      emoji: '📱',
      shortLabel: '离线',
      name: '本机离线语音',
      hint: '直接调用系统自带语音库',
      sample: '当前使用的是本机离线语音。'
    };
  }

  cycleVoice() {
    if (this.onlineTts && typeof this.onlineTts.cycleVoice === 'function') {
      if (!this.voiceEnabled) {
        this.setVoiceEnabled(true);
      }
      return this.onlineTts.cycleVoice(true);
    }
    return this.getActiveVoiceOption();
  }

  setVoiceEnabled(enabled) {
    this.voiceEnabled = Boolean(enabled);
    if (this.onlineTts && typeof this.onlineTts.setMuted === 'function') {
      this.onlineTts.setMuted(!this.voiceEnabled);
    } else if (!this.voiceEnabled && this.tts) {
      this.tts.stop();
    }
    return this.voiceEnabled;
  }

  stopSpeaking() {
    if (this.onlineTts && typeof this.onlineTts.stop === 'function') {
      this.onlineTts.stop();
    } else if (this.tts && typeof this.tts.stop === 'function') {
      this.tts.stop();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // 智能优选高品质自然中文人声 (后备方案)
  getBestChineseVoice() {
    if (this.tts) return this.tts.getBestVoice('zh-CN');
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const preferredNames = [
      'xiaoxiao', 'yunxi', 'xiaoyi', 'natural', 'neural',
      'tingting (enhanced)', 'ting-ting (enhanced)', 'tingting', 'ting-ting',
      'yu-shu', 'sin-ji', 'meijia', 'siri', 'lili',
      'cce-network', 'cce-local', '普通话'
    ];

    for (const pref of preferredNames) {
      const match = voices.find(v => {
        const name = (v.name || '').toLowerCase();
        const lang = (v.lang || '').toLowerCase();
        return (lang.includes('zh') || lang.includes('cmn')) && name.includes(pref);
      });
      if (match) return match;
    }

    const zhCn = voices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang === 'zh-cn' || lang === 'cmn-hans-cn' || lang === 'zh_cn';
    });
    if (zhCn) return zhCn;

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
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.075);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.075);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.075);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 魔法闪烁音效 (用于凑十动画、透视切换等)
  playMagic() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const notes = [659.25, 783.99, 987.77, 1318.51, 1567.98];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + i * 0.045;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.005, t + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // 扭蛋机旋转音乐音效
  playGashaponRoll() {
    if (!this.soundEnabled) return;
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const seq = [392, 440, 493.88, 523.25, 587.33, 659.25, 783.99, 880];
      seq.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.11;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
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
        const startTime = now + index * 0.065;
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

      gain.gain.setValueAtTime(0.24, now);
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

  // 过滤 Emoji 表情与特殊图形符号，并将钟表时间和算式转化为自然中文口语
  cleanSpeechText(text) {
    if (!text || typeof text !== 'string') return '';
    // 先把钟表时间如 3:00 转化为 3点整，3:30 转化为 3点半，3:15 转化为 3点15分
    let normalized = text
      .replace(/(\d{1,2}):00/g, '$1点整')
      .replace(/(\d{1,2}):30/g, '$1点半')
      .replace(/(\d{1,2}):(\d{2})/g, '$1点$2分');

    if (this.onlineTts && typeof this.onlineTts.cleanText === 'function') {
      return this.onlineTts.cleanText(normalized);
    }

    if (this.tts) {
      return this.tts.cleanText(normalized);
    }

    return normalized
      .replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F6FF}\u{FE00}-\u{FE0F}\u{200D}\u{2300}-\u{23FF}\u{2B50}]/gu, '')
      .replace(/\+/g, ' 加 ')
      .replace(/-/g, ' 减 ')
      .replace(/[×*]/g, ' 乘 ')
      .replace(/[÷/]/g, ' 除以 ')
      .replace(/=/g, ' 等于 ')
      .replace(/\?/g, '？')
      .replace(/!/g, '！')
      .replace(/[！!]+/g, '！')
      .replace(/[？?]+/g, '？')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 语音播报 (优先调用在线 AI 真人神经语音 WebOnlineTTS，断网或离线音色自动无缝回退 NaturalTTS)
  speak(text, voiceOverride) {
    if (!this.voiceEnabled) return;
    const polished = this.cleanSpeechText(text);
    if (!polished) return;

    if (this.onlineTts) {
      this.onlineTts.speak(polished, voiceOverride);
      return;
    }

    if (this.tts) {
      this.tts.speak(polished);
      return;
    }

    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(polished);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

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
