// 6岁儿童数学小王国 - 高级全能进阶版
// 8大关卡：森林数数、天平比大小、趣味加减、规律火车、十格阵凑十、奇妙时钟、空间数积木、60秒冲刺
// 3大难度：10以内基础、20以内进退位、100以内高阶挑战

class MathGameApp {
  constructor() {
    this.currentMode = 'counting'; // 'counting' | 'comparison' | 'arithmetic' | 'patterns' | 'tenframes' | 'clocks' | 'blocks' | 'speedrun'
    this.difficulty = '20';
    this.stars = parseInt(localStorage.getItem('kid_math_stars') || '8', 10);
    this.unlockedStickers = JSON.parse(localStorage.getItem('kid_math_stickers') || '["bunny", "sun", "icecream"]');
    this.bestSprintScore = parseInt(localStorage.getItem('kid_math_best_sprint') || '0', 10);
    this.playgroundScene = JSON.parse(localStorage.getItem('kid_math_playground') || '[]');
    this.playgroundBgIndex = parseInt(localStorage.getItem('kid_math_playground_bg') || '0', 10);

    this.streak = 0;
    this.currentQuestion = null;
    this.countedItems = new Set();
    this.eggCost = 3;
    this.nextQuestionTimer = null;
    this.lastClockMinute = null;

    // 60秒极速挑战模式状态
    this.speedrunActive = false;
    this.speedrunTimer = null;
    this.speedrunTimeLeft = 60;
    this.speedrunScore = 0;
    this.speedrunCombo = 0;

    // 空间积木透视开关
    this.xrayActive = false;

    // 12款超萌贴纸图鉴
    this.stickerLibrary = [
      { id: 'bunny', name: '蹦蹦兔', emoji: '🐰', title: '胡萝卜大王', soundText: '我是蹦蹦兔，最喜欢吃脆甜的胡萝卜啦！' },
      { id: 'sun', name: '微笑太阳', emoji: '☀️', title: '温暖守护', soundText: '今天也是元气满满的一天哦！' },
      { id: 'icecream', name: '草莓圣代', emoji: '🍨', title: '夏日甜心', soundText: '冰冰凉凉，甜甜蜜蜜！' },
      { id: 'lion', name: '小狮子波波', emoji: '🦁', title: '森林之王', soundText: '吼！我是勇敢聪明的森林之王！' },
      { id: 'panda', name: '胖达熊猫', emoji: '🐼', title: '竹林高手', soundText: '呼噜噜，翠绿的竹子真香呀！' },
      { id: 'unicorn', name: '七彩独角兽', emoji: '🦄', title: '彩虹精灵', soundText: '滴答滴答，彩虹魔法降临！' },
      { id: 'dino', name: '霸王龙豆豆', emoji: '🦖', title: '远古探险家', soundText: '嗷呜！我虽然个头大，但很爱交朋友！' },
      { id: 'rocket', name: '星空火箭', emoji: '🚀', title: '小小宇航员', soundText: '3、2、1，点火发射去月球探险！' },
      { id: 'crown', name: '闪亮王冠', emoji: '👑', title: '智慧国王', soundText: '戴上智慧王冠，你就是算术小达人！' },
      { id: 'cat', name: '猫咪乐乐', emoji: '🐱', title: '捕鱼能手', soundText: '喵呜！今天抓到了好多数学小鱼！' },
      { id: 'chick', name: '欢欢小鸡', emoji: '🐥', title: '早起鸣唱', soundText: '叽叽喳喳，早起学习真快乐！' },
      { id: 'star_wand', name: '魔法星杖', emoji: '🪄', title: '奇迹魔法', soundText: '奇妙能量，数学难题变简单！' }
    ];

    this.fruitEmojis = ['🍎', '🍓', '🍌', '🥕', '🍊', '🍇', '🍒', '🍉'];
    this.animalEmojis = ['🐥', '🐱', '🐶', '🐰', '🐸', '🐼', '🐧', '🐻'];
    this.playgroundThemes = ['theme-meadow', 'theme-space', 'theme-ocean'];

    this.initDOMElements();
    this.bindEvents();
    this.updateStatsUI();
    this.switchMode('counting');
  }

  initDOMElements() {
    this.starCountEl = document.getElementById('star-count');
    this.streakCountEl = document.getElementById('streak-count');
    this.questionTextEl = document.getElementById('question-text');
    this.questionZoneEl = document.getElementById('question-zone');
    this.optionsZoneEl = document.getElementById('options-zone');
    this.feedbackZoneEl = document.getElementById('feedback-zone');
    this.mascotMsgEl = document.getElementById('mascot-message');
    this.gashaponModal = document.getElementById('gashapon-modal');
    this.stickerBookModal = document.getElementById('sticker-book-modal');
    this.parentGuideModal = document.getElementById('parent-guide-modal');
    this.speedrunHud = document.getElementById('speedrun-hud');
    this.speedrunTimerEl = document.getElementById('speedrun-timer');
    this.speedrunScoreEl = document.getElementById('speedrun-score');
    this.speedrunComboEl = document.getElementById('speedrun-combo');
    this.speedrunBestEl = document.getElementById('speedrun-best');
    this.speedrunProgressEl = document.getElementById('speedrun-progress-fill');
    this.speedrunSummaryModal = document.getElementById('speedrun-summary-modal');
    this.difficultySelectorEl = document.getElementById('difficulty-selector');
  }

  clearPendingTimers() {
    if (this.nextQuestionTimer) {
      clearTimeout(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
    if (typeof this.blocksCleanup === 'function') {
      this.blocksCleanup();
      this.blocksCleanup = null;
    }
  }

  bindEvents() {
    // 首次交互激活 Web Audio
    const unlockAudio = () => {
      window.soundManager.ensureContext();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio, { passive: true });

    // 8大关卡模式切换
    document.querySelectorAll('.mode-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        window.soundManager.playPop();
        this.switchMode(mode);
      });
    });

    // 难度切换
    if (this.difficultySelectorEl) {
      this.difficultySelectorEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.diff-btn');
        if (!btn) return;
        this.difficultySelectorEl.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.difficulty = btn.dataset.diff;
        window.soundManager.playPop();
        this.setMascot(`难度切换为：${btn.textContent}！继续加油！`);
        this.generateQuestion();
      });
    }

    // 朗读题目
    const speakBtn = document.getElementById('speak-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        if (this.currentQuestion && this.currentQuestion.audioPrompt) {
          window.soundManager.speak(this.currentQuestion.audioPrompt);
        }
      });
    }

    // 吉祥物点击互动
    const mascotAvatar = document.querySelector('.mascot-avatar');
    if (mascotAvatar) {
      mascotAvatar.style.cursor = 'pointer';
      mascotAvatar.addEventListener('click', () => {
        window.soundManager.playPop();
        const tips = [
          '点喇叭按钮可以再听一遍题目哦！',
          '每集齐 3 颗小金星，就能去扭蛋机抽一次萌宠！',
          '遇到难题别着急，用凑十法和透视镜试试看！',
          '在贴纸册的创意乐园里，可以自由拖动你的宠物伙伴！'
        ];
        const msg = tips[Math.floor(Math.random() * tips.length)];
        this.setMascot(msg);
        window.soundManager.speak(msg);
      });
    }

    // 扭蛋屋
    const eggBtn = document.getElementById('egg-shop-btn');
    if (eggBtn) {
      eggBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        this.openGashapon();
      });
    }

    // 贴纸册
    const stickerBookBtn = document.getElementById('sticker-book-btn');
    if (stickerBookBtn) {
      stickerBookBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        this.openStickerBook();
      });
    }

    // 家长指导
    const guideBtn = document.getElementById('parent-guide-btn');
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        if (this.parentGuideModal) this.parentGuideModal.classList.add('active');
      });
    }

    // 弹窗关闭按钮与遮罩背景点击关闭
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundManager.playPop();
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          window.soundManager.playPop();
          overlay.classList.remove('active');
        }
      });
    });

    // 贴纸标签切换
    document.querySelectorAll('.sticker-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sticker-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sticker-tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        const panel = document.getElementById(`tab-${target}`);
        if (panel) panel.classList.add('active');
        if (target === 'playground') {
          this.renderPlaygroundBar();
        }
        window.soundManager.playPop();
      });
    });

    // 创意乐园工具栏按钮 (清空 & 切换背景)
    const clearPgBtn = document.getElementById('clear-playground-btn');
    if (clearPgBtn) {
      clearPgBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        this.playgroundScene = [];
        this.savePlaygroundScene();
        const pg = document.getElementById('sticker-playground-canvas');
        if (pg) pg.innerHTML = '';
      });
    }

    const bgSwitchBtn = document.getElementById('bg-switch-btn');
    if (bgSwitchBtn) {
      bgSwitchBtn.addEventListener('click', () => {
        window.soundManager.playMagic();
        this.playgroundBgIndex = (this.playgroundBgIndex + 1) % this.playgroundThemes.length;
        localStorage.setItem('kid_math_playground_bg', this.playgroundBgIndex.toString());
        this.applyPlaygroundTheme();
      });
    }

    // 冲刺重新开始
    const restartSprintBtn = document.getElementById('restart-sprint-btn');
    if (restartSprintBtn) {
      restartSprintBtn.addEventListener('click', () => {
        if (this.speedrunSummaryModal) this.speedrunSummaryModal.classList.remove('active');
        this.startSpeedrun();
      });
    }

    // 声音、AI 在线语音角色切换与全屏
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        window.soundManager.soundEnabled = !window.soundManager.soundEnabled;
        soundToggle.textContent = window.soundManager.soundEnabled ? '🔊 声音' : '🔇 静音';
        soundToggle.classList.toggle('off', !window.soundManager.soundEnabled);
      });
    }

    const voiceRoleBtn = document.getElementById('voice-role-btn');
    const voiceToggle = document.getElementById('voice-toggle');

    const syncVoiceUI = () => {
      const opt = window.soundManager.getActiveVoiceOption();
      if (voiceRoleBtn && opt) {
        voiceRoleBtn.textContent = `${opt.emoji} ${opt.shortLabel}`;
        voiceRoleBtn.title = `当前语音伙伴：${opt.name}（${opt.hint}）· 点击切换`;
      }
      if (voiceToggle) {
        voiceToggle.textContent = window.soundManager.voiceEnabled ? '🗣️ 读题开' : '🤐 读题关';
        voiceToggle.classList.toggle('off', !window.soundManager.voiceEnabled);
      }
    };
    syncVoiceUI();

    if (voiceRoleBtn) {
      voiceRoleBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        const nextOpt = window.soundManager.cycleVoice();
        syncVoiceUI();
        if (nextOpt) {
          this.setMascot(`已切换语音伙伴：${nextOpt.emoji} ${nextOpt.name}！`);
        }
      });
    }

    if (voiceToggle) {
      voiceToggle.addEventListener('click', () => {
        const nowEnabled = window.soundManager.setVoiceEnabled(!window.soundManager.voiceEnabled);
        syncVoiceUI();
        if (nowEnabled) {
          window.soundManager.speak('语音朗读打开啦！');
        } else {
          window.soundManager.stopSpeaking();
        }
      });
    }

    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    if (fullscreenToggle) {
      fullscreenToggle.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          fullscreenToggle.textContent = '🔲 退出全屏';
        } else {
          document.exitFullscreen().catch(() => {});
          fullscreenToggle.textContent = '🔳 全屏玩';
        }
      });
    }

    // 键盘快捷键支持 (数字键 1-4 选答案, Space/R 重读题目, Escape 关闭弹窗)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        return;
      }
      const anyModalOpen = document.querySelector('.modal-overlay.active');
      if (anyModalOpen) return;

      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const optBtns = this.optionsZoneEl.querySelectorAll('.option-card:not(:disabled):not(.disabled-opt)');
        if (optBtns[idx]) {
          optBtns[idx].click();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (this.currentQuestion && this.currentQuestion.audioPrompt) {
          window.soundManager.speak(this.currentQuestion.audioPrompt);
        }
      }
    });
  }

  switchMode(mode) {
    this.clearPendingTimers();
    if (this.speedrunTimer) {
      clearInterval(this.speedrunTimer);
      this.speedrunTimer = null;
    }
    this.speedrunActive = (mode === 'speedrun');

    if (this.speedrunHud) {
      this.speedrunHud.style.display = this.speedrunActive ? 'flex' : 'none';
    }

    this.currentMode = mode;
    this.updateDifficultySelector(mode);

    document.querySelectorAll('.mode-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const modeNames = {
      counting: '森林数一数 🍓',
      comparison: '天平比大小 ⚖️',
      arithmetic: '趣味加减法 🍩',
      patterns: '规律小火车 🚂',
      tenframes: '十格阵凑十 🧪',
      clocks: '奇妙时钟岛 ⏰',
      blocks: '空间数积木 🧩',
      speedrun: '60秒极速冲刺 ⚡'
    };

    this.setMascot(`欢迎来到 ${modeNames[mode]}！准备好了吗？`);

    if (mode === 'speedrun') {
      this.startSpeedrun();
    } else {
      this.generateQuestion();
    }
  }

  getModeDifficulties(mode) {
    const diffMap = {
      counting: [
        { diff: '10', label: '10以内点数', tip: '基础单体逐个点数' },
        { diff: '20', label: '20以内点数', tip: '十格对齐进阶点数挑战' },
        { diff: '100', label: '群组数数(分组)', tip: '2/5/10个一组，乘法启蒙群计数' }
      ],
      comparison: [
        { diff: '10', label: '单数比大小', tip: '10以内数字与点阵比较' },
        { diff: '20', label: '算式比大小', tip: '加减算式与双算式对比' },
        { diff: '100', label: '百数比大小', tip: '两位数与易混倒置数对比' }
      ],
      arithmetic: [
        { diff: '10', label: '10以内加减', tip: '基础加减法与视觉实物辅助' },
        { diff: '20', label: '20以内进退位', tip: '凑十破十与未知数填空' },
        { diff: '100', label: '100以内挑战', tip: '整十数、两位数与连加连减' }
      ],
      patterns: [
        { diff: '10', label: '图案规律', tip: 'AB / AAB / ABB / ABC 循环规律' },
        { diff: '20', label: '跳跃数数', tip: '2个一数、5个一数与倒数规律' },
        { diff: '100', label: '百数规律', tip: '等差阶梯与递增差值挑战' }
      ],
      tenframes: [
        { diff: '10', label: '单盒凑十', tip: '点击空位动手补齐10格阵' },
        { diff: '20', label: '双盒进位', tip: '双盒凑十进位加法动画演示' },
        { diff: '100', label: '破十挑战', tip: '20以内退位减法破十直观拆解' }
      ],
      clocks: [
        { diff: '10', label: '认识整点', tip: '分针指向12，整点认读 (如 3:00)' },
        { diff: '20', label: '整点与半点', tip: '整点与半点(30分)对比认读' },
        { diff: '100', label: '几时几分', tip: '一刻(15分)、三刻(45分)与5分刻度' }
      ],
      blocks: [
        { diff: '10', label: '初级 (4~6块)', tip: '2层基础立体积木堆' },
        { diff: '20', label: '进阶 (7~9块)', tip: '含隐藏遮挡积木，空间推理' },
        { diff: '100', label: '挑战 (10~14块)', tip: '3层立体建筑与柱体标数法' }
      ]
    };
    return diffMap[mode] || null;
  }

  updateDifficultySelector(mode) {
    if (!this.difficultySelectorEl) return;
    if (mode === 'speedrun') {
      this.difficultySelectorEl.style.display = 'none';
      return;
    }
    this.difficultySelectorEl.style.display = 'flex';
    const configs = this.getModeDifficulties(mode);
    if (!configs) return;

    this.difficultySelectorEl.innerHTML = configs.map(cfg => `
      <button class="diff-btn ${this.difficulty === cfg.diff ? 'active' : ''}" 
              data-diff="${cfg.diff}" 
              title="${cfg.tip}">${cfg.label}</button>
    `).join('');
  }

  setMascot(text) {
    if (this.mascotMsgEl) {
      this.mascotMsgEl.textContent = text;
      this.mascotMsgEl.classList.remove('bounce-in');
      void this.mascotMsgEl.offsetWidth;
      this.mascotMsgEl.classList.add('bounce-in');
    }
  }

  updateStatsUI() {
    if (this.starCountEl) this.starCountEl.textContent = this.stars;
    if (this.streakCountEl) this.streakCountEl.textContent = this.streak;
    if (this.speedrunBestEl) this.speedrunBestEl.textContent = this.bestSprintScore;

    const gashaponBadge = document.getElementById('egg-available-badge');
    if (gashaponBadge) {
      const availableDraws = Math.floor(this.stars / this.eggCost);
      gashaponBadge.textContent = availableDraws;
      gashaponBadge.style.display = availableDraws > 0 ? 'inline-flex' : 'none';
    }
  }

  saveStars() {
    localStorage.setItem('kid_math_stars', this.stars.toString());
    this.updateStatsUI();
  }

  saveStickers() {
    localStorage.setItem('kid_math_stickers', JSON.stringify(this.unlockedStickers));
  }

  savePlaygroundScene() {
    localStorage.setItem('kid_math_playground', JSON.stringify(this.playgroundScene));
  }

  // ================= 核心出题调度 =================
  generateQuestion() {
    this.clearPendingTimers();
    this.countedItems.clear();
    this.questionZoneEl.innerHTML = '';
    this.optionsZoneEl.innerHTML = '';
    this.optionsZoneEl.className = 'options-zone';
    this.feedbackZoneEl.innerHTML = '';
    this.feedbackZoneEl.className = 'feedback-zone';

    switch (this.currentMode) {
      case 'counting':
        this.generateCountingQuestion();
        break;
      case 'comparison':
        this.generateComparisonQuestion();
        break;
      case 'arithmetic':
        this.generateArithmeticQuestion();
        break;
      case 'patterns':
        this.generatePatternQuestion();
        break;
      case 'tenframes':
        this.generateTenFrameQuestion();
        break;
      case 'clocks':
        this.generateClockQuestion();
        break;
      case 'blocks':
        this.generateBlocksQuestion();
        break;
      case 'speedrun':
        this.generateSpeedrunQuestion();
        break;
    }

    if (!this.speedrunActive && this.currentQuestion && this.currentQuestion.audioPrompt) {
      setTimeout(() => {
        if (!this.speedrunActive && this.currentQuestion) {
          window.soundManager.speak(this.currentQuestion.audioPrompt);
        }
      }, 260);
    }
  }

  // ================= 1. 森林数一数 (严格区分 10以内 / 20以内 / 群组数数) =================
  generateCountingQuestion() {
    const itemPool = Math.random() > 0.5 ? this.fruitEmojis : this.animalEmojis;
    const emoji = itemPool[Math.floor(Math.random() * itemPool.length)];

    if (this.difficulty === '100') {
      // 群组数数：2个一组、5个一组 或 10个一组 (乘法启蒙与群计数)
      const groupSizes = [2, 5, 10];
      const groupSize = groupSizes[Math.floor(Math.random() * groupSizes.length)];
      const numGroups = groupSize === 10
        ? Math.floor(Math.random() * 4) + 2 // 20~50
        : (groupSize === 5 ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 5) + 3);
      const total = groupSize * numGroups;

      const title = `${groupSize}个一组数一数：一共有多少个 ${emoji}？`;
      const audioPrompt = `每盒有 ${groupSize} 个，一共有 ${numGroups} 盒，快数数看合起来是多少个呢？`;

      this.currentQuestion = {
        answer: total,
        audioPrompt: audioPrompt,
        type: 'counting'
      };

      this.questionTextEl.innerHTML = `<span>${title}</span> <span class="tip-sub">（点击每组可按 ${groupSize} 个一数累加）</span>`;

      const board = document.createElement('div');
      board.className = 'counting-board grouped-counting-board';

      for (let g = 1; g <= numGroups; g++) {
        const groupBox = document.createElement('div');
        groupBox.className = 'counting-group-box';
        groupBox.innerHTML = `
          <span class="group-tag">第 ${g} 组 (${groupSize}个)</span>
          <div class="group-items">${emoji.repeat(groupSize)}</div>
        `;
        groupBox.addEventListener('click', () => {
          if (!groupBox.classList.contains('counted')) {
            groupBox.classList.add('counted');
            window.soundManager.playPop();
            const countedCount = board.querySelectorAll('.counting-group-box.counted').length;
            const currentSubtotal = countedCount * groupSize;

            const badge = document.createElement('span');
            badge.className = 'count-bubble';
            badge.textContent = currentSubtotal;
            groupBox.appendChild(badge);

            window.soundManager.speak(currentSubtotal.toString());
          }
        });
        board.appendChild(groupBox);
      }

      this.questionZoneEl.appendChild(board);
      const step = groupSize;
      const choices = new Set([total]);
      [total - step, total + step, total + step * 2, total - step * 2].forEach(c => {
        if (c > 0 && choices.size < 4) choices.add(c);
      });
      while (choices.size < 4) {
        choices.add(total + (Math.floor(Math.random() * 5) - 2) * step || (total + step));
      }
      this.renderOptions(Array.from(choices).sort(() => 0.5 - Math.random()), total);

    } else {
      // 10以内点数 (4~10) 或 20以内点数 (11~20，采用10列对齐布局，直观看出“10和几”)
      const isTwenty = (this.difficulty === '20');
      const min = isTwenty ? 11 : 4;
      const max = isTwenty ? 20 : 10;
      const targetCount = Math.floor(Math.random() * (max - min + 1)) + min;

      const title = `数一数：草地上有几个 ${emoji} 呢？`;
      const audioPrompt = `数一数草地上有几个，点一点它们可以帮你标出数字哦！`;

      this.currentQuestion = {
        answer: targetCount,
        audioPrompt: audioPrompt,
        type: 'counting'
      };

      const subTip = isTwenty ? '（满一行是 10 个，看看是 10 加几呢？）' : '（点一点可以按顺序标出数字）';
      this.questionTextEl.innerHTML = `<span>${title}</span> <span class="tip-sub">${subTip}</span>`;

      const board = document.createElement('div');
      board.className = isTwenty ? 'counting-board counting-grid-10' : 'counting-board';

      for (let i = 1; i <= targetCount; i++) {
        const item = document.createElement('div');
        item.className = 'countable-item';
        item.textContent = emoji;
        item.dataset.index = i;

        item.addEventListener('click', () => {
          if (!item.classList.contains('counted')) {
            item.classList.add('counted');
            this.countedItems.add(i);
            window.soundManager.playPop();

            const countBadge = document.createElement('span');
            countBadge.className = 'count-bubble';
            countBadge.textContent = this.countedItems.size;
            item.appendChild(countBadge);

            window.soundManager.speak(this.countedItems.size.toString());
          }
        });

        board.appendChild(item);
      }

      this.questionZoneEl.appendChild(board);
      const options = this.generateChoices(targetCount, Math.max(1, targetCount - 3), targetCount + 4, 4);
      this.renderOptions(options, targetCount);
    }
  }

  // ================= 2. 天平比大小 (单数點阵对比 / 加减算式对比 / 倒置两位数对比) =================
  generateComparisonQuestion() {
    let leftExpr, rightExpr, leftVal, rightVal;

    if (this.difficulty === '10') {
      leftVal = Math.floor(Math.random() * 10) + 1;
      rightVal = Math.floor(Math.random() * 10) + 1;
      if (Math.random() < 0.25) rightVal = leftVal;
      leftExpr = leftVal.toString();
      rightExpr = rightVal.toString();

    } else if (this.difficulty === '20') {
      // 20以内算式对比：包含加法、减法、以及双边算式对比
      const modeType = Math.floor(Math.random() * 3);
      if (modeType === 0) {
        // 加法 vs 数字
        const a = Math.floor(Math.random() * 8) + 3;
        const b = Math.floor(Math.random() * 7) + 2;
        leftVal = a + b;
        leftExpr = `${a} + ${b}`;
        rightVal = Math.random() < 0.25 ? leftVal : leftVal + (Math.random() > 0.5 ? 1 : -1);
        rightExpr = rightVal.toString();
      } else if (modeType === 1) {
        // 减法 vs 数字
        const total = Math.floor(Math.random() * 8) + 11;
        const sub = Math.floor(Math.random() * 6) + 3;
        leftVal = total - sub;
        leftExpr = `${total} - ${sub}`;
        rightVal = Math.random() < 0.25 ? leftVal : Math.max(1, leftVal + (Math.random() > 0.5 ? 2 : -2));
        rightExpr = rightVal.toString();
      } else {
        // 双算式 PK (如 7 + 5 vs 6 + 6)
        const a1 = Math.floor(Math.random() * 7) + 3;
        const b1 = Math.floor(Math.random() * 6) + 2;
        leftVal = a1 + b1;
        leftExpr = `${a1} + ${b1}`;
        const delta = Math.random() < 0.3 ? 0 : (Math.random() > 0.5 ? 1 : -1);
        rightVal = Math.max(4, leftVal + delta);
        const a2 = Math.floor(rightVal / 2);
        const b2 = rightVal - a2;
        rightExpr = `${a2} + ${b2}`;
      }

      // 随机交换左右盘
      if (Math.random() > 0.5) {
        [leftExpr, rightExpr] = [rightExpr, leftExpr];
        [leftVal, rightVal] = [rightVal, leftVal];
      }

    } else {
      // 100以内挑战：易混淆倒置两位数 (如 47 vs 74) 或 整十加减对比
      if (Math.random() > 0.4) {
        const d1 = Math.floor(Math.random() * 8) + 1;
        let d2 = Math.floor(Math.random() * 8) + 1;
        if (d1 === d2 && Math.random() > 0.3) d2 = (d2 % 8) + 1;
        leftVal = d1 * 10 + d2;
        rightVal = d2 * 10 + d1;
        leftExpr = leftVal.toString();
        rightExpr = rightVal.toString();
      } else {
        const tens1 = (Math.floor(Math.random() * 5) + 2) * 10;
        const ones1 = Math.floor(Math.random() * 8) + 1;
        const tens2 = (Math.floor(Math.random() * 3) + 1) * 10;
        leftExpr = `${tens1 + ones1} + ${tens2}`;
        leftVal = tens1 + ones1 + tens2;
        rightVal = Math.random() < 0.28 ? leftVal : leftVal + (Math.random() > 0.5 ? 2 : -2);
        rightExpr = rightVal.toString();
      }
    }

    let answerSymbol = '=';
    if (leftVal > rightVal) answerSymbol = '>';
    if (leftVal < rightVal) answerSymbol = '<';

    const audioPrompt = `比一比，左边是 ${leftExpr}，右边是 ${rightExpr}，哪边更大呢？`;
    this.questionTextEl.innerHTML = `天平比大小：<span>比较左右两边谁更大！</span> <span class="tip-sub">（点击托盘可听读数）</span>`;

    this.currentQuestion = {
      answer: answerSymbol,
      leftVal,
      rightVal,
      audioPrompt: audioPrompt,
      type: 'comparison'
    };

    const balanceBox = document.createElement('div');
    balanceBox.className = 'balance-container';
    balanceBox.id = 'balance-container';

    // 左盘
    const leftPlate = document.createElement('div');
    leftPlate.className = 'scale-plate left-plate';
    const leftDots = (this.difficulty === '10') ? `<div class="plate-dots">${'🟢'.repeat(leftVal)}</div>` : `<div class="plate-hint-val" style="display:none;">= ${leftVal}</div>`;
    leftPlate.innerHTML = `<div class="plate-expr">${leftExpr}</div>${leftDots}`;
    leftPlate.addEventListener('click', () => {
      window.soundManager.playPop();
      window.soundManager.speak(`左边是 ${leftExpr}`);
      const hint = leftPlate.querySelector('.plate-hint-val');
      if (hint && leftExpr.includes('+')) hint.style.display = 'block';
    });

    // 中间鳄鱼嘴
    const midSymbol = document.createElement('div');
    midSymbol.className = 'scale-middle';
    midSymbol.id = 'scale-alligator';
    midSymbol.innerHTML = `<div class="mystery-box">❓</div>`;

    // 右盘
    const rightPlate = document.createElement('div');
    rightPlate.className = 'scale-plate right-plate';
    const rightDots = (this.difficulty === '10') ? `<div class="plate-dots">${'🟠'.repeat(rightVal)}</div>` : `<div class="plate-hint-val" style="display:none;">= ${rightVal}</div>`;
    rightPlate.innerHTML = `<div class="plate-expr">${rightExpr}</div>${rightDots}`;
    rightPlate.addEventListener('click', () => {
      window.soundManager.playPop();
      window.soundManager.speak(`右边是 ${rightExpr}`);
      const hint = rightPlate.querySelector('.plate-hint-val');
      if (hint && rightExpr.includes('+')) hint.style.display = 'block';
    });

    balanceBox.appendChild(leftPlate);
    balanceBox.appendChild(midSymbol);
    balanceBox.appendChild(rightPlate);
    this.questionZoneEl.appendChild(balanceBox);

    const optionsData = [
      { val: '>', label: '左边大 👈' },
      { val: '=', label: '一样大 🤝' },
      { val: '<', label: '右边大 👉' }
    ];

    this.optionsZoneEl.classList.add('has-3-options');

    optionsData.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-card balance-option-btn';
      btn.innerHTML = `<span class="big-symbol">${opt.val}</span><span class="sub-label">${opt.label}</span>`;
      btn.addEventListener('click', () => {
        this.checkAnswer(btn, opt.val, answerSymbol);
      });
      this.optionsZoneEl.appendChild(btn);
    });
  }

  // ================= 3. 趣味加减法 (精准进退位、未知数填空 & 凑十破十小妙招提示) =================
  generateArithmeticQuestion() {
    let promptHtml, audioText, answer, strategyTip = '';
    const isBlankMode = Math.random() > 0.65;

    if (this.difficulty === '10') {
      const isAdd = Math.random() > 0.4;
      const emoji = this.fruitEmojis[Math.floor(Math.random() * this.fruitEmojis.length)];
      if (isAdd) {
        const a = Math.floor(Math.random() * 7) + 1; // 1~7
        const b = Math.floor(Math.random() * (10 - a)) + 1;
        if (isBlankMode) {
          answer = b;
          promptHtml = `${a} + <span class="blank-box">?</span> = ${a + b}`;
          audioText = `${a} 加上几等于 ${a + b} 呢？`;
          strategyTip = `💡 想一想：已有 ${emoji.repeat(a)}，再添几个就是 ${a + b} 个？`;
        } else {
          answer = a + b;
          promptHtml = `${a} + ${b} = ?`;
          audioText = `${a} 加 ${b} 等于几呢？`;
          strategyTip = `${emoji.repeat(a)} ➕ ${emoji.repeat(b)}`;
        }
      } else {
        const a = Math.floor(Math.random() * 7) + 3; // 3~9
        const b = Math.floor(Math.random() * (a - 1)) + 1;
        answer = a - b;
        promptHtml = `${a} - ${b} = ?`;
        audioText = `${a} 减去 ${b} 等于几呢？`;
        strategyTip = `共有 ${a} 个 ${emoji}，拿走 ${b} 个，数数还剩几个？`;
      }

    } else if (this.difficulty === '20') {
      // 20以内核心：标准凑十法进位加法 (一位数+一位数>10) 与 破十法退位减法 (十几-一位数)
      const isAdd = Math.random() > 0.45;
      if (isAdd) {
        const a = Math.floor(Math.random() * 6) + 4; // 4~9
        const minB = 11 - a; // 确保 a + b >= 11
        const b = Math.floor(Math.random() * (9 - minB + 1)) + minB; // minB ~ 9
        const need10 = 10 - a;
        const leftOver = b - need10;

        if (isBlankMode) {
          promptHtml = `${a} + <span class="blank-box">?</span> = ${a + b}`;
          audioText = `${a} 加上几等于 ${a + b} 呢？`;
          answer = b;
          strategyTip = `💡 凑十思路：${a} 加 ${need10} 先凑成 10，10 再加 ${leftOver} 等于 ${a + b}，所以填 ${need10} + ${leftOver} = ${b}！`;
        } else {
          promptHtml = `${a} + ${b} = ?`;
          audioText = `${a} 加 ${b} 等于几呢？可以用凑十法算一算哦！`;
          answer = a + b;
          strategyTip = `💡 凑十妙招：把 ${b} 分成 ${need10} 和 ${leftOver}，先算 ${a} + ${need10} = 10，再算 10 + ${leftOver} = ?`;
        }
      } else {
        // 标准退位减法：total 为 11~18，sub 为 (total-9)~9，确保个位不够减
        const total = Math.floor(Math.random() * 7) + 11; // 11~17
        const minSub = total - 9; // 2~8
        const sub = Math.floor(Math.random() * (9 - minSub + 1)) + minSub; // minSub ~ 9
        const ones = total - 10;
        const afterBreak10 = 10 - sub;

        if (isBlankMode) {
          promptHtml = `${total} - <span class="blank-box">?</span> = ${total - sub}`;
          audioText = `${total} 减去几等于 ${total - sub} 呢？`;
          answer = sub;
          strategyTip = `💡 逆向思考：${total} 拿走多少还剩 ${total - sub} 呢？`;
        } else {
          promptHtml = `${total} - ${sub} = ?`;
          audioText = `${total} 减去 ${sub} 等于几呢？可以用破十法算一算！`;
          answer = total - sub;
          strategyTip = `💡 破十妙招：把 ${total} 分成 10 和 ${ones}，先算 10 - ${sub} = ${afterBreak10}，再算 ${afterBreak10} + ${ones} = ?`;
        }
      }

    } else {
      // 100以内高阶运算：整十数加减、两位数加减一位数、三数连加连减
      const qType = Math.floor(Math.random() * 3);
      if (qType === 0) {
        const t1 = (Math.floor(Math.random() * 5) + 1) * 10;
        const t2 = (Math.floor(Math.random() * 4) + 1) * 10;
        if (Math.random() > 0.5) {
          promptHtml = `${t1} + ${t2} = ?`;
          audioText = `${t1} 加 ${t2} 等于几呢？`;
          answer = t1 + t2;
          strategyTip = `💡 整十妙招：${t1 / 10} 个十加 ${t2 / 10} 个十，一共是 ${(t1 + t2) / 10} 个十！`;
        } else {
          const big = t1 + t2;
          promptHtml = `${big} - ${t1} = ?`;
          audioText = `${big} 减去 ${t1} 等于几呢？`;
          answer = t2;
          strategyTip = `💡 整十妙招：${big / 10} 个十减去 ${t1 / 10} 个十，还剩几个十？`;
        }
      } else if (qType === 1) {
        const tens = (Math.floor(Math.random() * 7) + 2) * 10;
        const ones = Math.floor(Math.random() * 5) + 1;
        const addOne = Math.floor(Math.random() * (8 - ones)) + 1;
        promptHtml = `${tens + ones} + ${addOne} = ?`;
        audioText = `${tens + ones} 加 ${addOne} 等于几呢？`;
        answer = tens + ones + addOne;
        strategyTip = `💡 数位对齐：十位还是 ${tens}，先把个位 ${ones} + ${addOne} 算出来！`;
      } else {
        const a = Math.floor(Math.random() * 6) + 2;
        const b = Math.floor(Math.random() * 5) + 2;
        const c = Math.floor(Math.random() * 4) + 1;
        if (Math.random() > 0.5) {
          promptHtml = `${a} + ${b} + ${c} = ?`;
          audioText = `${a} 加 ${b} 再加 ${c}，一共等于几？`;
          answer = a + b + c;
          strategyTip = `💡 分步心算：先算 ${a} + ${b} = ${a + b}，再加上 ${c}！`;
        } else {
          const total = a + b + c;
          promptHtml = `${total} - ${a} - ${b} = ?`;
          audioText = `${total} 减去 ${a} 再减去 ${b}，还剩几？`;
          answer = c;
          strategyTip = `💡 分步心算：先算 ${total} - ${a} = ${total - a}，再减去 ${b}！`;
        }
      }
    }

    this.questionTextEl.innerHTML = `魔法算术挑战：<span>算一算正确的得数吧！</span>`;
    this.currentQuestion = {
      answer: answer,
      audioPrompt: audioText,
      type: 'arithmetic'
    };

    const visualBox = document.createElement('div');
    visualBox.className = 'arithmetic-card-display';
    visualBox.innerHTML = `
      <div class="big-formula-text">${promptHtml}</div>
      ${strategyTip ? `<div class="arithmetic-strategy-pill" title="点击朗读算术小妙招">${strategyTip}</div>` : ''}
    `;

    const tipEl = visualBox.querySelector('.arithmetic-strategy-pill');
    if (tipEl) {
      tipEl.addEventListener('click', () => {
        window.soundManager.playMagic();
        window.soundManager.speak(strategyTip);
      });
    }

    this.questionZoneEl.appendChild(visualBox);

    const minChoice = Math.max(0, answer - 4);
    const options = this.generateChoices(answer, minChoice, answer + 5, 4);
    this.renderOptions(options, answer);
  }

  // ================= 4. 规律小火车 (支持 AB/AAB/ABB/ABC 图案规律 & 阶梯跳数规律) =================
  generatePatternQuestion() {
    let sequence = [];
    let answer;
    let descText;

    if (this.difficulty === '10') {
      // 丰富图案规律：ABABAB / AABAAB / ABBABB / ABCABC
      const pool = ['🌸', '⭐', '🎈', '🍎', '🍌', '🥕', '🍓', '🐳'];
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      const [p1, p2, p3] = shuffled;
      const patType = Math.floor(Math.random() * 4);

      if (patType === 0) {
        sequence = [p1, p2, p1, p2, p1, '?'];
        answer = p2;
        descText = 'AB交替规律：看一看小火车，最后一节装什么？';
      } else if (patType === 1) {
        sequence = [p1, p1, p2, p1, p1, '?'];
        answer = p2;
        descText = 'AAB循环规律：每两个一样的配一个不同的，最后装什么？';
      } else if (patType === 2) {
        sequence = [p1, p2, p2, p1, p2, '?'];
        answer = p2;
        descText = 'ABB循环规律：仔细观察车厢排列，最后一节装什么？';
      } else {
        sequence = [p1, p2, p3, p1, p2, '?'];
        answer = p3;
        descText = 'ABC三色规律：3节车厢一组循环，接下来装什么？';
      }

    } else if (this.difficulty === '20') {
      const patternType = Math.floor(Math.random() * 3);
      if (patternType === 0) {
        const start = (Math.floor(Math.random() * 4) + 1) * 2;
        sequence = [start, start + 2, start + 4, start + 6, '?'];
        answer = start + 8;
        descText = '2个2个数规律（每次+2）：后面应该是几呢？';
      } else if (patternType === 1) {
        const start = Math.random() > 0.5 ? 5 : 0;
        sequence = [start, start + 5, start + 10, start + 15, '?'];
        answer = start + 20;
        descText = '5个5个数规律（每次+5）：接下来装哪个数字？';
      } else {
        const step = Math.random() > 0.5 ? 1 : 2;
        const start = Math.floor(Math.random() * 5) + 14;
        sequence = [start, start - step, start - step * 2, start - step * 3, '?'];
        answer = start - step * 4;
        descText = `倒数小火车（每次减${step}）：下一个数字是几？`;
      }

    } else {
      const isGrowingStep = Math.random() > 0.65;
      if (isGrowingStep) {
        // 递增差值规律：+1, +2, +3, +4 (如 2, 3, 5, 8, 12, ?)
        const start = Math.floor(Math.random() * 4) + 1;
        sequence = [start, start + 1, start + 3, start + 6, '?'];
        answer = start + 10;
        descText = '阶梯递增规律（依次+1, +2, +3, +4）：下一节是几？';
      } else {
        const step = [3, 4, 10][Math.floor(Math.random() * 3)];
        const start = step === 10 ? (Math.floor(Math.random() * 4) + 1) * 10 : Math.floor(Math.random() * 6) + 2;
        sequence = [start, start + step, start + step * 2, start + step * 3, '?'];
        answer = start + step * 4;
        descText = `等差找规律（每次增加 ${step}）：下一节车厢是几？`;
      }
    }

    this.questionTextEl.innerHTML = `找规律小火车：<span>${descText}</span>`;
    const audioPrompt = typeof answer === 'number'
      ? `看一看小火车的车厢数字规律，最后一节车厢装什么呢？`
      : `看一看小火车的车厢图案规律，最后一节车厢装什么呢？`;

    this.currentQuestion = {
      answer: answer,
      audioPrompt: audioPrompt,
      type: 'pattern'
    };

    const trainBox = document.createElement('div');
    trainBox.className = 'train-track-container';
    trainBox.id = 'train-track-container';

    let trainHtml = `
      <div class="train-engine">
        <div class="engine-smoke">💨</div>
        <div class="engine-body">🚂</div>
      </div>
    `;

    sequence.forEach((item) => {
      if (item === '?') {
        trainHtml += `
          <div class="train-car target-car" id="target-train-car">
            <span class="mystery-q" id="mystery-train-q">❓</span>
            <div class="wheels"><span class="wheel"></span><span class="wheel"></span></div>
          </div>
        `;
      } else {
        trainHtml += `
          <div class="train-car">
            <span class="car-cargo">${item}</span>
            <div class="wheels"><span class="wheel"></span><span class="wheel"></span></div>
          </div>
        `;
      }
    });

    trainBox.innerHTML = trainHtml;
    this.questionZoneEl.appendChild(trainBox);

    let options;
    if (typeof answer === 'number') {
      options = this.generateChoices(answer, Math.max(0, answer - 6), answer + 8, 4);
    } else {
      options = [answer];
      const pool = ['🌸', '⭐', '🎈', '🍎', '🍌', '🥕', '🍓', '🐳'];
      while (options.length < 4) {
        const p = pool[Math.floor(Math.random() * pool.length)];
        if (!options.includes(p)) options.push(p);
      }
      options.sort(() => 0.5 - Math.random());
    }

    this.renderOptions(options, answer);
  }

  // ================= 5. 十格阵凑十 (单盒互动补十 / 双盒凑十动画 / 双盒破十减法) =================
  generateTenFrameQuestion() {
    if (this.difficulty === '10') {
      // 单十格阵：已有 N 个红点，点击空白圆点可亲手补齐 10 个
      const filled = Math.floor(Math.random() * 7) + 2; // 2~8
      const needed = 10 - filled;

      this.questionTextEl.innerHTML = `十格阵凑十：<span>已有 ${filled} 个 🔴，还差几个凑满 10？</span> <span class="tip-sub">（点一点空位试试）</span>`;
      const audioPrompt = `看一看十格阵，盒子里已经有 ${filled} 个红圆点，还差几个就能凑满 10 个呢？`;

      this.currentQuestion = {
        answer: needed,
        audioPrompt: audioPrompt,
        type: 'tenframe'
      };

      const container = document.createElement('div');
      container.className = 'ten-frame-wrapper single-frame';

      const frame = document.createElement('div');
      frame.className = 'ten-frame';

      let userFilledCount = 0;

      for (let i = 1; i <= 10; i++) {
        const cell = document.createElement('div');
        cell.className = 'ten-frame-cell';
        if (i <= filled) {
          cell.innerHTML = `<span class="ten-dot filled-dot">🔴</span>`;
        } else {
          cell.innerHTML = `<span class="ten-dot empty-dot">⚪</span>`;
          cell.dataset.empty = 'true';
        }
        cell.addEventListener('click', () => {
          window.soundManager.playPop();
          cell.classList.add('wobble');
          setTimeout(() => cell.classList.remove('wobble'), 350);

          if (cell.dataset.empty === 'true') {
            const dot = cell.querySelector('.ten-dot');
            if (cell.classList.toggle('user-filled')) {
              dot.textContent = '🟡';
              dot.classList.remove('empty-dot');
              userFilledCount++;
              window.soundManager.speak(userFilledCount.toString());
            } else {
              dot.textContent = '⚪';
              dot.classList.add('empty-dot');
              userFilledCount = Math.max(0, userFilledCount - 1);
            }
          }
        });
        frame.appendChild(cell);
      }

      container.appendChild(frame);
      this.questionZoneEl.appendChild(container);

      const options = this.generateChoices(needed, 1, 9, 4);
      this.renderOptions(options, needed);

    } else if (this.difficulty === '20') {
      // 双十格阵凑十进位加法 (如 8 + 5 = 13)，支持点击“演示凑十魔法”动态移位
      const num1 = Math.floor(Math.random() * 4) + 6; // 6, 7, 8, 9
      const minNum2 = 11 - num1;
      const num2 = Math.floor(Math.random() * (9 - minNum2 + 1)) + minNum2; // 确保进位且 <= 9
      const needToMake10 = 10 - num1;
      const remain = num2 - needToMake10;
      const total = num1 + num2;

      this.questionTextEl.innerHTML = `十格阵凑十法：<span>${num1} + ${num2} = ?</span> <span class="tip-sub">（先凑满第一盒10个，再加剩下的）</span>`;
      const audioPrompt = `${num1} 加 ${num2}，把第二盒分出 ${needToMake10} 个凑满第一盒的 10，合起来是多少？`;

      this.currentQuestion = {
        answer: total,
        audioPrompt: audioPrompt,
        type: 'tenframe'
      };

      const outer = document.createElement('div');
      outer.className = 'ten-frame-stage-col';

      const container = document.createElement('div');
      container.className = 'dual-ten-frame-wrapper';

      const renderFrames = (isMerged) => {
        if (!isMerged) {
          container.innerHTML = `
            <div class="ten-frame-box">
              <div class="frame-label">第一盒 (已有 ${num1} 个 🔴，还空 ${needToMake10} 格)</div>
              <div class="ten-frame">
                ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot ${i < num1 ? '' : 'empty-dot'}">${i < num1 ? '🔴' : '⚪'}</span></div>`).join('')}
              </div>
            </div>
            <div class="frame-plus">➕</div>
            <div class="ten-frame-box">
              <div class="frame-label">第二盒 (共有 ${num2} 个 🟡)</div>
              <div class="ten-frame">
                ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot ${i < num2 ? '' : 'empty-dot'}">${i < num2 ? '🟡' : '⚪'}</span></div>`).join('')}
              </div>
            </div>
          `;
        } else {
          container.innerHTML = `
            <div class="ten-frame-box">
              <div class="frame-label">✨ 第一盒已凑满 10！(🔴×${num1} + 🟡×${needToMake10})</div>
              <div class="ten-frame">
                ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot pop-in">${i < num1 ? '🔴' : '🟡'}</span></div>`).join('')}
              </div>
            </div>
            <div class="frame-plus">➕</div>
            <div class="ten-frame-box">
              <div class="frame-label">✨ 第二盒还剩 ${remain} 个 🟡 (10 + ${remain} = ${total})</div>
              <div class="ten-frame">
                ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot ${i < remain ? '' : 'empty-dot'}">${i < remain ? '🟡' : '⚪'}</span></div>`).join('')}
              </div>
            </div>
          `;
        }
        container.querySelectorAll('.ten-frame-cell').forEach(cell => {
          cell.addEventListener('click', () => {
            window.soundManager.playPop();
            cell.classList.add('wobble');
            setTimeout(() => cell.classList.remove('wobble'), 350);
          });
        });
      };

      let mergedState = false;
      renderFrames(false);

      const magicBtn = document.createElement('button');
      magicBtn.className = 'xray-toggle-btn';
      magicBtn.innerHTML = `✨ 点击演示“凑十魔法”（移动 ${needToMake10} 个 🟡 填满第一盒）`;
      magicBtn.addEventListener('click', () => {
        mergedState = !mergedState;
        window.soundManager.playMagic();
        renderFrames(mergedState);
        magicBtn.innerHTML = mergedState
          ? `🔄 还原初始点阵 (${num1} + ${num2})`
          : `✨ 点击演示“凑十魔法”（移动 ${needToMake10} 个 🟡 填满第一盒）`;
      });

      outer.appendChild(container);
      outer.appendChild(magicBtn);
      this.questionZoneEl.appendChild(outer);

      const options = this.generateChoices(total, 11, 18, 4);
      this.renderOptions(options, total);

    } else {
      // 100 难度：破十挑战（20以内退位减法的十格阵直观拆解，如 14 - 6 = 8）
      const total = Math.floor(Math.random() * 7) + 11; // 11~17
      const ones = total - 10;
      const minSub = ones + 1; // 确保个位不够减，必须破十
      const sub = Math.floor(Math.random() * (9 - minSub + 1)) + minSub; // minSub ~ 9
      const remainInTen = 10 - sub;
      const answer = total - sub;

      this.questionTextEl.innerHTML = `十格阵破十法：<span>${total} - ${sub} = ?</span> <span class="tip-sub">（先从第一盒10里拿走${sub}个，再合起来）</span>`;
      const audioPrompt = `破十法挑战：${total} 减 ${sub}，先从满十盒里拿走 ${sub} 个还剩 ${remainInTen} 个，再加上第二盒的 ${ones} 个等于几？`;

      this.currentQuestion = {
        answer: answer,
        audioPrompt: audioPrompt,
        type: 'tenframe'
      };

      const container = document.createElement('div');
      container.className = 'dual-ten-frame-wrapper';
      container.innerHTML = `
        <div class="ten-frame-box">
          <div class="frame-label">第一盒 (10 拿走 ${sub} 个 ❌，还剩 ${remainInTen} 个 🟢)</div>
          <div class="ten-frame">
            ${Array.from({length: 10}, (_, i) => `
              <div class="ten-frame-cell ${i < sub ? 'taken-cell' : ''}">
                <span class="ten-dot ${i < sub ? 'taken-dot' : ''}">${i < sub ? '🔴' : '🟢'}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="frame-plus">➕</div>
        <div class="ten-frame-box">
          <div class="frame-label">第二盒 (零头还有 ${ones} 个 🟡，共 ${remainInTen} + ${ones})</div>
          <div class="ten-frame">
            ${Array.from({length: 10}, (_, i) => `
              <div class="ten-frame-cell">
                <span class="ten-dot ${i < ones ? '' : 'empty-dot'}">${i < ones ? '🟡' : '⚪'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      container.querySelectorAll('.ten-frame-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          window.soundManager.playPop();
          cell.classList.add('wobble');
          setTimeout(() => cell.classList.remove('wobble'), 350);
        });
      });

      this.questionZoneEl.appendChild(container);
      const options = this.generateChoices(answer, 2, 9, 4);
      this.renderOptions(options, answer);
    }
  }

  // ================= 6. 奇妙时钟岛 (认识整点、半点、一刻/三刻与外圈分针刻度辅助) =================
  generateClockQuestion() {
    let hour = Math.floor(Math.random() * 12) + 1; // 1~12
    let minute = 0;

    if (this.difficulty === '10') {
      minute = 0;
    } else if (this.difficulty === '20') {
      if (this.lastClockMinute === 30) {
        minute = Math.random() > 0.35 ? 0 : 30;
      } else if (this.lastClockMinute === 0) {
        minute = Math.random() > 0.35 ? 30 : 0;
      } else {
        minute = Math.random() > 0.5 ? 30 : 0;
      }
      this.lastClockMinute = minute;
    } else {
      const minutesList = [0, 15, 30, 45, 5, 10, 20, 25, 40, 50];
      minute = minutesList[Math.floor(Math.random() * minutesList.length)];
    }

    const minStr = minute < 10 ? `0${minute}` : minute.toString();
    const correctTimeStr = `${hour}:${minStr}`;

    const title = minute === 0 ? `看一看时钟：现在是几点整？` : `看一看时钟：现在是几点几分？`;
    const audioPrompt = minute === 0
      ? `仔细看蓝色的短时针和红色的长分针，现在指向几点整呢？`
      : (minute === 30
          ? `分针指在6代表30分，现在是几点半呢？`
          : `仔细看时针和分针，现在是几点几分呢？`);

    this.currentQuestion = {
      answer: correctTimeStr,
      hour,
      minute,
      audioPrompt: audioPrompt,
      type: 'clock'
    };

    this.questionTextEl.innerHTML = `奇妙时钟岛：<span>${title}</span> <span class="tip-sub">（点击表盘可听读表提示）</span>`;

    const clockContainer = document.createElement('div');
    clockContainer.className = 'analog-clock-container';

    const minAngle = minute * 6;
    const hourAngle = (hour % 12 + minute / 60) * 30;

    const rHour = 36;
    const hRad = (hourAngle - 90) * (Math.PI / 180);
    const hX1 = (100 - 8 * Math.cos(hRad)).toFixed(2);
    const hY1 = (100 - 8 * Math.sin(hRad)).toFixed(2);
    const hX2 = (100 + rHour * Math.cos(hRad)).toFixed(2);
    const hY2 = (100 + rHour * Math.sin(hRad)).toFixed(2);

    const rMin = 56;
    const mRad = (minAngle - 90) * (Math.PI / 180);
    const mX1 = (100 - 10 * Math.cos(mRad)).toFixed(2);
    const mY1 = (100 - 10 * Math.sin(mRad)).toFixed(2);
    const mX2 = (100 + rMin * Math.cos(mRad)).toFixed(2);
    const mY2 = (100 + rMin * Math.sin(mRad)).toFixed(2);

    let numbersHtml = '';
    for (let h = 1; h <= 12; h++) {
      const angle = (h * 30 - 90) * (Math.PI / 180);
      const r = 68;
      const x = 100 + r * Math.cos(angle);
      const y = 100 + r * Math.sin(angle) + 6;
      numbersHtml += `<text x="${x}" y="${y}" class="clock-num" text-anchor="middle">${h}</text>`;
    }

    // 在进阶/高阶模式下显示外圈分钟小数字提示 (00, 05, 10... 55)，帮助孩子理解为什么指着 6 是 30 分
    let minuteRingHtml = '';
    if (this.difficulty !== '10') {
      for (let m = 0; m < 60; m += (this.difficulty === '20' ? 30 : 15)) {
        const angle = (m * 6 - 90) * (Math.PI / 180);
        const r = 82;
        const x = 100 + r * Math.cos(angle);
        const y = 100 + r * Math.sin(angle) + 3;
        const lbl = m === 0 ? '00' : m.toString();
        minuteRingHtml += `<text x="${x}" y="${y}" class="clock-min-num" text-anchor="middle">${lbl}</text>`;
      }
    }

    let ticksHtml = '';
    for (let m = 0; m < 60; m += 5) {
      const angle = (m * 6 - 90) * (Math.PI / 180);
      const isHourTick = (m % 15 === 0);
      const r1 = isHourTick ? 85 : 87;
      const r2 = 90;
      const x1 = 100 + r1 * Math.cos(angle);
      const y1 = 100 + r1 * Math.sin(angle);
      const x2 = 100 + r2 * Math.cos(angle);
      const y2 = 100 + r2 * Math.sin(angle);
      ticksHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isHourTick ? '#334155' : '#94A3B8'}" stroke-width="${isHourTick ? 2.5 : 1.5}" stroke-linecap="round" />`;
    }

    clockContainer.innerHTML = `
      <svg class="analog-clock-svg" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="95" class="clock-face-outer" />
        <circle cx="100" cy="100" r="88" class="clock-face-inner" />
        ${ticksHtml}
        ${minuteRingHtml}
        ${numbersHtml}
        <line x1="${hX1}" y1="${hY1}" x2="${hX2}" y2="${hY2}" class="clock-hand hour-hand" />
        <line x1="${mX1}" y1="${mY1}" x2="${mX2}" y2="${mY2}" class="clock-hand minute-hand" />
        <circle cx="100" cy="100" r="7" class="clock-center-pin" />
      </svg>
      <div class="clock-legend">
        <span class="legend-hour">🟦 短针看几时</span>
        <span class="legend-minute">🟥 长针看几分 (1格5分)</span>
      </div>
    `;

    const svgEl = clockContainer.querySelector('.analog-clock-svg');
    if (svgEl) {
      svgEl.style.cursor = 'pointer';
      svgEl.addEventListener('click', () => {
        window.soundManager.playTick();
        const hintMsg = minute === 0
          ? `长长的红分针指着12，代表整点，再看看蓝色的短时针指着数字几？`
          : `红色的长分针指在数字 ${minute / 5 || 12} 上，代表 ${minute} 分！`;
        this.setMascot(hintMsg);
        window.soundManager.speak(hintMsg);
      });
    }

    this.questionZoneEl.appendChild(clockContainer);

    const choices = new Set([correctTimeStr]);

    if (minute === 0) {
      if (this.difficulty !== '10') {
        choices.add(`${hour}:30`);
      }
      const prevH = (hour - 2 + 12) % 12 + 1;
      const nextH = hour % 12 + 1;
      choices.add(`${prevH}:00`);
      choices.add(`${nextH}:00`);
    } else if (minute === 30) {
      const nextH = hour % 12 + 1;
      choices.add(`${nextH}:30`);
      choices.add(`${hour}:00`);
      const prevH = (hour - 2 + 12) % 12 + 1;
      choices.add(`${prevH}:30`);
    } else {
      const altM = [0, 15, 30, 45].filter(m => m !== minute);
      altM.forEach(m => {
        const mStr = m < 10 ? `0${m}` : m.toString();
        if (choices.size < 3) choices.add(`${hour}:${mStr}`);
      });
      const nextH = hour % 12 + 1;
      choices.add(`${nextH}:${minStr}`);
    }

    while (choices.size < 4) {
      const randH = Math.floor(Math.random() * 12) + 1;
      let randM = 0;
      if (this.difficulty === '10') {
        randM = 0;
      } else if (this.difficulty === '20') {
        randM = Math.random() > 0.5 ? 30 : 0;
      } else {
        const mPool = [0, 15, 30, 45, 10, 20, 50];
        randM = mPool[Math.floor(Math.random() * mPool.length)];
      }
      const mStr = randM < 10 ? `0${randM}` : randM.toString();
      choices.add(`${randH}:${mStr}`);
    }

    const options = Array.from(choices).sort(() => 0.5 - Math.random());
    this.renderOptions(options, correctTimeStr);
  }

  // ================= 7. 空间数积木 (真 3D 可拖拽旋转模型 + 点亮计数 + 柱体标数透视法) =================
  generateBlocksQuestion() {
    this.xrayActive = false;

    let grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    let totalBlocks = 0;

    if (this.difficulty === '10') {
      const targetCount = Math.floor(Math.random() * 3) + 4; // 4, 5, 6
      let placed = 0;
      const coords = [
        [0,0], [0,1], [0,2],
        [1,0], [1,1], [1,2],
        [2,0], [2,1], [2,2]
      ].sort(() => 0.5 - Math.random());

      for (const [r, c] of coords) {
        if (placed >= targetCount) break;
        const remaining = targetCount - placed;
        const h = Math.min(2, remaining > 1 && Math.random() > 0.4 ? 2 : 1);
        grid[r][c] = h;
        placed += h;
      }
      totalBlocks = placed;

    } else if (this.difficulty === '20') {
      const targetCount = Math.floor(Math.random() * 3) + 7; // 7, 8, 9
      let placed = 0;
      grid[0][0] = 2;
      grid[1][1] = 2;
      placed = 4;

      const coords = [
        [0,1], [0,2],
        [1,0], [1,2],
        [2,0], [2,1], [2,2]
      ].sort(() => 0.5 - Math.random());

      for (const [r, c] of coords) {
        if (placed >= targetCount) break;
        const remaining = targetCount - placed;
        const maxH = Math.random() > 0.6 ? 3 : 2;
        const h = Math.min(maxH, remaining);
        if (h > 0) {
          grid[r][c] = h;
          placed += h;
        }
      }
      totalBlocks = placed;

    } else {
      const targetCount = Math.floor(Math.random() * 5) + 10; // 10~14
      let placed = 0;
      grid[0][0] = 3;
      grid[0][1] = 2;
      grid[1][0] = 2;
      grid[1][1] = 2;
      placed = 9;

      const coords = [
        [0,2], [1,2],
        [2,0], [2,1], [2,2]
      ].sort(() => 0.5 - Math.random());

      for (const [r, c] of coords) {
        if (placed >= targetCount) break;
        const remaining = targetCount - placed;
        const h = Math.min(2, remaining);
        if (h > 0) {
          grid[r][c] = h;
          placed += h;
        }
      }
      totalBlocks = placed;
    }

    this.questionTextEl.innerHTML = `空间数积木：<span>一共有多少块积木？</span> <span class="tip-sub">（👆 按住可 360° 拖动旋转，轻点积木可标数）</span>`;
    const audioPrompt = `数一数一共有多少块积木？按住积木可以自由拖动旋转，转到背面看看有没有隐藏积木哦！`;

    this.currentQuestion = {
      answer: totalBlocks,
      audioPrompt: audioPrompt,
      type: 'blocks'
    };

    const blockContainer = document.createElement('div');
    blockContainer.className = 'isometric-blocks-container';
    blockContainer.id = 'blocks-stage';

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'blocks-3d-stage-wrap';

    const canvas = document.createElement('canvas');
    canvas.className = 'blocks-3d-canvas';

    const rotateHintBadge = document.createElement('div');
    rotateHintBadge.className = 'blocks-rotate-hint';
    rotateHintBadge.innerHTML = '🔄 按住拖动可 360° 旋转视角';

    canvasWrap.appendChild(canvas);
    canvasWrap.appendChild(rotateHintBadge);
    blockContainer.appendChild(canvasWrap);

    const counterBadge = document.createElement('span');
    counterBadge.className = 'block-counter-pill';
    counterBadge.textContent = '✨ 已点亮: 0 块';

    // 构建 3D 立方体列表 (gx, gy, gz) 并计算最高层数
    const cubes = [];
    let maxColH = 1;
    for (let gx = 0; gx < 3; gx++) {
      for (let gy = 0; gy < 3; gy++) {
        if (grid[gx][gy] > maxColH) maxColH = grid[gx][gy];
        for (let gz = 0; gz < grid[gx][gy]; gz++) {
          cubes.push({
            gx,
            gy,
            gz,
            clicked: false,
            clickOrder: 0
          });
        }
      }
    }

    // 3D 相机姿态角：yaw 水平旋转角（默认 42° 经典斜等轴视角），pitch 俯仰角（默认 30°）
    const defaultYaw = Math.PI * 0.23;
    const defaultPitch = Math.PI * 0.175;
    let yaw = defaultYaw;
    let pitch = defaultPitch;

    // 自适应画布尺寸与 3D 包围盒自动缩放比例（适配 iPad 12.9 / Air / Mini / 桌面等任意尺寸）
    let cssW = 640;
    let cssH = 280;
    let scale = 52;
    let centerX = cssW / 2;
    let centerY = cssH / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const updateProjectionMetrics = () => {
      // 以包络角计算 3D 模型（含 3x3 底座、最高积木柱及顶部透视标数球）的完整垂直跨度，确保任何角度都不超出画布框
      const refPitch = Math.max(pitch, Math.PI * 0.22);
      const sinRef = Math.sin(refPitch);
      const cosRef = Math.cos(refPitch);
      const minUnitY = -2.15 * sinRef - (maxColH + 0.55) * cosRef;
      const maxUnitY = 2.29 * sinRef + 0.22 * cosRef;
      const unitSpanY = maxUnitY - minUnitY;
      const unitSpanX = 4.6;

      // 预留约 16% 上下左右安全呼吸边距，彻底避免在大屏平板上溢出容器
      scale = Math.min((cssW * 0.84) / unitSpanX, (cssH * 0.84) / unitSpanY, 72);
      centerX = cssW / 2;

      const curSinP = Math.sin(pitch);
      const curCosP = Math.cos(pitch);
      const curMinY = -2.15 * curSinP - (maxColH + 0.5) * curCosP;
      const curMaxY = 2.29 * curSinP + 0.22 * curCosP;
      centerY = (cssH / 2) - ((curMinY + curMaxY) / 2) * scale;
    };

    const updateCanvasSize = () => {
      const rect = canvasWrap.getBoundingClientRect();
      cssW = Math.max(280, Math.round(rect.width || 640));
      cssH = Math.max(160, Math.round(rect.height || 260));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      updateProjectionMetrics();
    };

    // 存放当前帧前面可点击的 2D 多边形用于精确点击拾取
    let interactivePolys = [];

    // 3D 坐标转 2D 屏幕坐标与相机深度
    // 世界坐标系：x, y ∈ [-1.5, 1.5]，z ∈ [0, 3] (向上为 +z)
    const projectPoint = (wx, wy, wz) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const x1 = wx * cosY - wy * sinY;
      const y1 = wx * sinY + wy * cosY;
      const z1 = wz;

      const sx = centerX + scale * x1;
      const sy = centerY + scale * (y1 * sinP - z1 * cosP);
      const depth = y1 * cosP + z1 * sinP;
      return { x: sx, y: sy, depth };
    };

    // 颜色明暗辅助函数
    const shadeRGB = (r, g, b, factor, alpha = 1) => {
      const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
      return `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${alpha})`;
    };

    const ctx = canvas.getContext('2d');

    const renderScene = () => {
      updateProjectionMetrics();
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssW, cssH);
      interactivePolys = [];

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      // 相机视线方向向量 V (从场景指向相机)
      const vx = sinY * cosP;
      const vy = cosY * cosP;
      const vz = sinP;

      // 1. 绘制 3x3 立体底座托盘 (帮助孩子在旋转时清晰分辨前后左右 9 宫格位置)
      const baseZTop = 0;
      const baseZBot = -0.16;
      const bCornersTop = [
        projectPoint(-1.62, -1.62, baseZTop),
        projectPoint(1.62, -1.62, baseZTop),
        projectPoint(1.62, 1.62, baseZTop),
        projectPoint(-1.62, 1.62, baseZTop)
      ];
      const bCornersBot = [
        projectPoint(-1.62, -1.62, baseZBot),
        projectPoint(1.62, -1.62, baseZBot),
        projectPoint(1.62, 1.62, baseZBot),
        projectPoint(-1.62, 1.62, baseZBot)
      ];

      // 底座侧面
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        ctx.beginPath();
        ctx.moveTo(bCornersTop[i].x, bCornersTop[i].y);
        ctx.lineTo(bCornersTop[next].x, bCornersTop[next].y);
        ctx.lineTo(bCornersBot[next].x, bCornersBot[next].y);
        ctx.lineTo(bCornersBot[i].x, bCornersBot[i].y);
        ctx.closePath();
        ctx.fillStyle = '#CBD5E1';
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 底座顶面
      ctx.beginPath();
      bCornersTop.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = '#F1F5F9';
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 底座 3x3 宫格线
      for (let gx = 0; gx < 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
          const x0 = gx - 1.5, x1 = gx - 0.5;
          const y0 = gy - 1.5, y1 = gy - 0.5;
          const cellPts = [
            projectPoint(x0, y0, baseZTop),
            projectPoint(x1, y0, baseZTop),
            projectPoint(x1, y1, baseZTop),
            projectPoint(x0, y1, baseZTop)
          ];
          ctx.beginPath();
          cellPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
          ctx.fillStyle = (gx + gy) % 2 === 0 ? '#E2E8F0' : '#F8FAFC';
          ctx.fill();
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 2. 对所有 3D 积木按相机空间深度从远到近严格拓扑排序 (零穿模)
      const sortedCubes = [...cubes].sort((a, b) => {
        const da = (a.gx - 1) * vx + (a.gy - 1) * vy + (a.gz + 0.5) * vz;
        const db = (b.gx - 1) * vx + (b.gy - 1) * vy + (b.gz + 0.5) * vz;
        return da - db;
      });

      // 光源方向向量 (左前上方来光)
      const lx = 0.35, ly = 0.55, lz = 0.75;

      // 6 个标准面的顶点偏移与外法线
      const faceDefs = [
        { name: 'top',    n: [0, 0, 1],  verts: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]] },
        { name: 'bottom', n: [0, 0, -1], verts: [[0,0,0], [0,1,0], [1,1,0], [1,0,0]] },
        { name: 'frontX', n: [1, 0, 0],  verts: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]] },
        { name: 'backX',  n: [-1, 0, 0], verts: [[0,0,0], [0,0,1], [0,1,1], [0,1,0]] },
        { name: 'frontY', n: [0, 1, 0],  verts: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]] },
        { name: 'backY',  n: [0, -1, 0], verts: [[0,0,0], [1,0,0], [1,0,1], [0,0,1]] }
      ];

      sortedCubes.forEach((cube) => {
        const x0 = cube.gx - 1.5;
        const y0 = cube.gy - 1.5;
        const z0 = cube.gz;

        // 基础配色：点亮后为翡翠绿水晶色，未点亮按层高渐变暖琥珀木块色
        let baseR = 245, baseG = 165, baseB = 36;
        if (cube.clicked) {
          baseR = 16; baseG = 185; baseB = 129;
        } else if (cube.gz === 1) {
          baseR = 251; baseG = 191; baseB = 36;
        } else if (cube.gz >= 2) {
          baseR = 252; baseG = 211; baseB = 77;
        }

        // 计算每个面在当前视角下的朝向与光照
        const evaluatedFaces = faceDefs.map(f => {
          const [nx, ny, nz] = f.n;
          // 旋转法向量到视角空间
          const rx = nx * cosY - ny * sinY;
          const ry = nx * sinY + ny * cosY;
          const rz = nz;
          const camDot = ry * cosP + rz * sinP;
          const lightDot = rx * lx + ry * ly + rz * lz;
          const brightness = 0.78 + Math.max(-0.2, Math.min(0.32, lightDot * 0.34));
          const pts = f.verts.map(([dx, dy, dz]) => projectPoint(x0 + dx, y0 + dy, z0 + dz));
          return {
            name: f.name,
            camDot,
            brightness,
            pts
          };
        });

        if (this.xrayActive) {
          // 透视模式：先画背面再画正面，半透明虚线边框
          const ordered = [...evaluatedFaces].sort((a, b) => a.camDot - b.camDot);
          ordered.forEach(f => {
            if (f.camDot < -0.15) return; // 仅绘制正对与侧对的面，保持通透清晰
            ctx.beginPath();
            f.pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.closePath();
            ctx.fillStyle = shadeRGB(baseR, baseG, baseB, f.brightness, cube.clicked ? 0.65 : 0.38);
            ctx.fill();
            ctx.save();
            ctx.setLineDash([5, 3]);
            ctx.strokeStyle = cube.clicked ? '#047857' : '#D97706';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.restore();

            if (f.camDot > 0) {
              interactivePolys.push({ poly: f.pts, cube });
            }
          });
        } else {
          // 实心 3D 模式：仅绘制朝向相机的可见面 (Back-face culling)
          evaluatedFaces.forEach(f => {
            if (f.camDot <= 0.001) return;
            ctx.beginPath();
            f.pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.closePath();
            ctx.fillStyle = shadeRGB(baseR, baseG, baseB, f.brightness, 1);
            ctx.fill();
            ctx.strokeStyle = cube.clicked ? '#065F46' : '#B45309';
            ctx.lineWidth = 2.2;
            ctx.lineJoin = 'round';
            ctx.stroke();

            // 顶面绘制立体圆凸粒 (乐高/积木质感)
            if (f.name === 'top') {
              const studCenter = projectPoint(x0 + 0.5, y0 + 0.5, z0 + 1.04);
              ctx.beginPath();
              ctx.ellipse(studCenter.x, studCenter.y, scale * 0.22, scale * 0.22 * sinP, 0, 0, Math.PI * 2);
              ctx.fillStyle = shadeRGB(baseR, baseG, baseB, f.brightness * 1.07, 1);
              ctx.fill();
              ctx.strokeStyle = cube.clicked ? '#047857' : '#B45309';
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }

            interactivePolys.push({ poly: f.pts, cube });
          });
        }

        // 如果该积木已被点击点亮，在其中心绘制醒目的序号徽章
        if (cube.clicked && cube.clickOrder > 0) {
          const centerPt = projectPoint(x0 + 0.5, y0 + 0.5, z0 + 0.55);
          const badgeR = Math.max(14, Math.round(scale * 0.22));
          const fontSize = Math.max(14, Math.round(scale * 0.24));
          ctx.beginPath();
          ctx.arc(centerPt.x, centerPt.y, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
          ctx.fillStyle = '#065F46';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cube.clickOrder.toString(), centerPt.x, centerPt.y + 1);
        }
      });

      // 3. 若开启了“透视 & 头顶标数法”，在每根非空柱子正上方悬浮显示柱高数字
      if (this.xrayActive) {
        const colBadgeR = Math.max(16, Math.round(scale * 0.25));
        const colFontSize = Math.max(16, Math.round(scale * 0.27));
        for (let gx = 0; gx < 3; gx++) {
          for (let gy = 0; gy < 3; gy++) {
            const h = grid[gx][gy];
            if (h > 0) {
              const topCenter = projectPoint(gx - 1.0, gy - 1.0, h + 0.24);
              ctx.beginPath();
              ctx.arc(topCenter.x, topCenter.y, colBadgeR, 0, Math.PI * 2);
              ctx.fillStyle = '#1D4ED8';
              ctx.fill();
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 2.8;
              ctx.stroke();

              ctx.font = `900 ${colFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
              ctx.fillStyle = '#FFFFFF';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(h.toString(), topCenter.x, topCenter.y + 1);
            }
          }
        }
      }

      ctx.restore();
    };

    // 射线/多边形点包含检测 (用于判断点击了哪块 3D 积木)
    const isPointInPoly = (px, py, pts) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y;
        const xj = pts[j].x, yj = pts[j].y;
        const intersect = ((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-7) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const recalculateClickOrders = () => {
      const clickedList = cubes.filter(c => c.clicked).sort((a, b) => a.clickOrder - b.clickOrder);
      clickedList.forEach((c, idx) => {
        c.clickOrder = idx + 1;
      });
      counterBadge.textContent = `✨ 已点亮: ${clickedList.length} 块`;
      return clickedList.length;
    };

    // 拖拽旋转与轻点选积木交互
    let isDragging = false;
    let dragDistance = 0;
    let lastX = 0;
    let lastY = 0;
    let spinAnimId = null;

    const stopSpinAnim = () => {
      if (spinAnimId) {
        cancelAnimationFrame(spinAnimId);
        spinAnimId = null;
      }
    };

    const getCanvasCoords = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : e.clientX);
      const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientY : e.clientY);
      return {
        x: (clientX - rect.left) * (cssW / (rect.width || cssW)),
        y: (clientY - rect.top) * (cssH / (rect.height || cssH)),
        rawX: clientX,
        rawY: clientY
      };
    };

    const onPointerDown = (e) => {
      stopSpinAnim();
      isDragging = true;
      dragDistance = 0;
      const pt = getCanvasCoords(e);
      lastX = pt.rawX;
      lastY = pt.rawY;
      canvas.classList.add('grabbing');
      if (e.pointerId !== undefined && canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();
      const pt = getCanvasCoords(e);
      const dx = pt.rawX - lastX;
      const dy = pt.rawY - lastY;
      dragDistance += Math.hypot(dx, dy);
      lastX = pt.rawX;
      lastY = pt.rawY;

      // 水平拖动 360° 自由旋转 yaw，垂直拖动调节俯仰角 pitch (10° ~ 76°)
      yaw -= dx * 0.014;
      pitch = Math.max(0.18, Math.min(1.32, pitch + dy * 0.011));
      renderScene();
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      canvas.classList.remove('grabbing');
      if (e.pointerId !== undefined && canvas.releasePointerCapture) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      }

      // 如果移动距离很小，判定为轻点积木块计数
      if (dragDistance < 8) {
        const pt = getCanvasCoords(e);
        for (let i = interactivePolys.length - 1; i >= 0; i--) {
          const item = interactivePolys[i];
          if (isPointInPoly(pt.x, pt.y, item.poly)) {
            window.soundManager.playPop();
            item.cube.clicked = !item.cube.clicked;
            if (item.cube.clicked) {
              item.cube.clickOrder = 999;
            } else {
              item.cube.clickOrder = 0;
            }
            const count = recalculateClickOrders();
            if (item.cube.clicked) {
              window.soundManager.speak(count.toString());
            }
            renderScene();
            break;
          }
        }
      }
    };

    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
    } else {
      canvas.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      canvas.addEventListener('touchstart', onPointerDown, { passive: false });
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    }

    const onWindowResize = () => {
      updateCanvasSize();
      renderScene();
    };
    window.addEventListener('resize', onWindowResize);

    let resizeObserver = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateCanvasSize();
        renderScene();
      });
      resizeObserver.observe(canvasWrap);
    }

    this.blocksCleanup = () => {
      stopSpinAnim();
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };

    const animateYawBy = (deltaYaw, duration = 420) => {
      stopSpinAnim();
      const startYaw = yaw;
      const targetYaw = yaw + deltaYaw;
      const startTime = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        yaw = startYaw + (targetYaw - startYaw) * ease;
        renderScene();
        if (t < 1) {
          spinAnimId = requestAnimationFrame(step);
        } else {
          spinAnimId = null;
        }
      };
      spinAnimId = requestAnimationFrame(step);
    };

    // 底部控制栏：计数胶囊 + 左转/右转 + 透视标数开关 + 360°环绕旋转按钮
    const controlsRow = document.createElement('div');
    controlsRow.className = 'blocks-controls-row';

    const rotLeftBtn = document.createElement('button');
    rotLeftBtn.className = 'xray-toggle-btn spin-3d-btn';
    rotLeftBtn.innerHTML = `⏪ 左转`;
    rotLeftBtn.addEventListener('click', () => {
      window.soundManager.playPop();
      animateYawBy(-Math.PI / 3, 380);
    });

    const rotRightBtn = document.createElement('button');
    rotRightBtn.className = 'xray-toggle-btn spin-3d-btn';
    rotRightBtn.innerHTML = `⏩ 右转`;
    rotRightBtn.addEventListener('click', () => {
      window.soundManager.playPop();
      animateYawBy(Math.PI / 3, 380);
    });

    const xrayBtn = document.createElement('button');
    xrayBtn.className = 'xray-toggle-btn';
    xrayBtn.innerHTML = `🔍 透视 & 头顶标数`;
    xrayBtn.addEventListener('click', () => {
      this.xrayActive = !this.xrayActive;
      xrayBtn.textContent = this.xrayActive ? `👓 恢复实心积木` : `🔍 透视 & 头顶标数`;
      window.soundManager.playMagic();
      if (this.xrayActive) {
        this.setMascot('看积木顶上的蓝圈数字，代表这一柱有几块，还可以拖动转一圈观察哦！');
      }
      renderScene();
    });

    const spinBtn = document.createElement('button');
    spinBtn.className = 'xray-toggle-btn spin-3d-btn';
    spinBtn.innerHTML = `🔄 360° 环绕`;
    spinBtn.addEventListener('click', () => {
      stopSpinAnim();
      window.soundManager.playPop();
      const startYaw = yaw;
      const targetYaw = defaultYaw + Math.PI * 2;
      const startPitch = pitch;
      const startTime = performance.now();
      const duration = 1800;

      const stepSpin = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        yaw = startYaw + (targetYaw - startYaw) * ease;
        pitch = startPitch + (defaultPitch - startPitch) * ease;
        renderScene();
        if (t < 1) {
          spinAnimId = requestAnimationFrame(stepSpin);
        } else {
          yaw = defaultYaw;
          pitch = defaultPitch;
          spinAnimId = null;
          renderScene();
        }
      };
      spinAnimId = requestAnimationFrame(stepSpin);
    });

    controlsRow.appendChild(counterBadge);
    controlsRow.appendChild(rotLeftBtn);
    controlsRow.appendChild(rotRightBtn);
    controlsRow.appendChild(spinBtn);
    controlsRow.appendChild(xrayBtn);
    blockContainer.appendChild(controlsRow);
    this.questionZoneEl.appendChild(blockContainer);

    // 挂载后动态测量容器尺寸，让展示框与 3D 积木自适应铺满中心区域
    updateCanvasSize();

    // 入场自动做一个优雅的 3D 旋转进场动画，直观提示它是可旋转 3D 模型
    yaw = defaultYaw - 0.65;
    renderScene();
    animateYawBy(0.65, 650);

    const minC = Math.max(1, totalBlocks - 3);
    const options = this.generateChoices(totalBlocks, minC, totalBlocks + 4, 4);
    this.renderOptions(options, totalBlocks);
  }

  // ================= 8. 60秒极速挑战模式 (计时闯关、连击加分与最高分纪录) =================
  startSpeedrun() {
    this.clearPendingTimers();
    this.speedrunActive = true;
    this.speedrunTimeLeft = 60;
    this.speedrunScore = 0;
    this.speedrunCombo = 0;

    if (this.speedrunHud) {
      this.speedrunHud.style.display = 'flex';
      this.speedrunTimerEl.textContent = '60';
      this.speedrunScoreEl.textContent = '0';
      this.speedrunComboEl.textContent = '0';
      if (this.speedrunBestEl) this.speedrunBestEl.textContent = this.bestSprintScore.toString();
      if (this.speedrunProgressEl) {
        this.speedrunProgressEl.style.width = '100%';
        this.speedrunProgressEl.classList.remove('danger');
      }
    }

    window.soundManager.playFanfare();
    this.setMascot("60秒极速挑战开始啦！连续答对积分翻倍！冲呀！🔥");

    if (this.speedrunTimer) clearInterval(this.speedrunTimer);
    this.speedrunTimer = setInterval(() => {
      this.speedrunTimeLeft--;
      if (this.speedrunTimerEl) {
        this.speedrunTimerEl.textContent = this.speedrunTimeLeft.toString();
      }
      if (this.speedrunProgressEl) {
        const pct = Math.max(0, (this.speedrunTimeLeft / 60) * 100);
        this.speedrunProgressEl.style.width = `${pct}%`;
        if (this.speedrunTimeLeft <= 10) {
          this.speedrunProgressEl.classList.add('danger');
        }
      }

      if (this.speedrunTimeLeft <= 10 && this.speedrunTimeLeft > 0) {
        window.soundManager.playTick();
      }

      if (this.speedrunTimeLeft <= 0) {
        this.finishSpeedrun();
      }
    }, 1000);

    this.generateSpeedrunQuestion();
  }

  generateSpeedrunQuestion() {
    // 综合抽取：加减法、比大小、十格阵、规律小火车、奇妙时钟
    const rand = Math.random();
    if (rand < 0.35) {
      this.generateArithmeticQuestion();
    } else if (rand < 0.58) {
      this.generateComparisonQuestion();
    } else if (rand < 0.76) {
      this.generateTenFrameQuestion();
    } else if (rand < 0.90) {
      this.generatePatternQuestion();
    } else {
      this.generateClockQuestion();
    }
  }

  finishSpeedrun() {
    this.clearPendingTimers();
    clearInterval(this.speedrunTimer);
    this.speedrunTimer = null;
    this.speedrunActive = false;

    window.soundManager.playFanfare();
    window.confetti.fire({ count: 130 });

    const isNewRecord = this.speedrunScore > this.bestSprintScore;
    if (isNewRecord) {
      this.bestSprintScore = this.speedrunScore;
      localStorage.setItem('kid_math_best_sprint', this.bestSprintScore.toString());
    }

    let rankTitle = '🌟 数学探索者';
    if (this.speedrunScore >= 160) rankTitle = '👑 数学传奇小神童';
    else if (this.speedrunScore >= 100) rankTitle = '🏆 算术金牌小达人';
    else if (this.speedrunScore >= 50) rankTitle = '🚀 闪电脑力探险家';

    const earnedStars = Math.max(1, Math.floor(this.speedrunScore / 10));

    const summaryText = document.getElementById('sprint-summary-text');
    if (summaryText) {
      summaryText.innerHTML = `
        <div class="sprint-rank">${rankTitle}</div>
        ${isNewRecord && this.speedrunScore > 0 ? `<div class="new-record-badge">🎉 刷新历史最高纪录！</div>` : ''}
        <div class="sprint-score-pill">本轮得分: <strong>${this.speedrunScore}</strong> 分 (最高纪录: ${this.bestSprintScore} 分)</div>
        <div class="sprint-stars-pill">奖励金星: <strong>+${earnedStars}</strong> ⭐</div>
      `;
    }

    this.stars += earnedStars;
    this.saveStars();

    if (this.speedrunSummaryModal) {
      this.speedrunSummaryModal.classList.add('active');
    }

    window.soundManager.speak(`时间到！你获得了 ${this.speedrunScore} 分，赢得 ${earnedStars} 颗小金星！`);
  }

  // ================= 通用选项渲染与作答校验 =================
  generateChoices(correctAnswer, min, max, count = 4) {
    const choices = new Set([correctAnswer]);
    let attempts = 0;
    while (choices.size < count && attempts < 100) {
      attempts++;
      let offset = Math.floor(Math.random() * 7) - 3;
      let candidate = correctAnswer + offset;
      if (candidate >= min && candidate <= max + 2 && candidate !== correctAnswer) {
        choices.add(candidate);
      } else {
        let randVal = Math.floor(Math.random() * (max - min + 1)) + min;
        if (randVal >= 0) choices.add(randVal);
      }
    }
    while (choices.size < count) {
      choices.add(correctAnswer + choices.size);
    }
    return Array.from(choices).sort(() => 0.5 - Math.random());
  }

  renderOptions(options, correctAnswer) {
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-card number-option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        this.checkAnswer(btn, opt, correctAnswer);
      });
      this.optionsZoneEl.appendChild(btn);
    });
  }

  checkAnswer(btnElement, selectedValue, correctValue) {
    if (btnElement.disabled || btnElement.classList.contains('disabled-opt')) return;
    const isCorrect = (selectedValue.toString() === correctValue.toString());
    const qType = this.currentQuestion ? this.currentQuestion.type : this.currentMode;

    if (isCorrect) {
      btnElement.classList.add('correct');
      document.querySelectorAll('.option-card').forEach(b => b.disabled = true);
      window.soundManager.playCorrect();
      window.confetti.fire({ count: 65, x: window.innerWidth / 2, y: window.innerHeight * 0.4 });

      // 比大小模式鳄鱼张嘴与天平倾斜动画
      if (qType === 'comparison') {
        const alligator = document.getElementById('scale-alligator');
        if (alligator) {
          alligator.innerHTML = `<div class="alligator-open pop-in">${correctValue}</div>`;
        }
        const balanceBox = document.getElementById('balance-container');
        if (balanceBox) {
          if (correctValue === '>') balanceBox.classList.add('tilt-left');
          else if (correctValue === '<') balanceBox.classList.add('tilt-right');
        }
      }

      // 规律小火车启程
      if (qType === 'pattern') {
        const targetCar = document.getElementById('target-train-car');
        const mysteryQ = document.getElementById('mystery-train-q');
        if (targetCar && mysteryQ) {
          mysteryQ.textContent = correctValue;
          targetCar.classList.remove('target-car');
          targetCar.classList.add('completed-car');
        }
        const trainTrack = document.getElementById('train-track-container');
        if (trainTrack) trainTrack.classList.add('train-chug');
      }

      // 算术填空题把问号替换为正确答案
      if (qType === 'arithmetic') {
        const blankBox = this.questionZoneEl.querySelector('.blank-box');
        if (blankBox) {
          blankBox.textContent = correctValue;
          blankBox.classList.add('filled-correct');
        }
      }

      this.streak++;

      // 如果在极速冲刺模式中，计算连击加分
      if (this.speedrunActive) {
        this.speedrunCombo++;
        let multiplier = 1;
        if (this.speedrunCombo >= 5) multiplier = 3;
        else if (this.speedrunCombo >= 3) multiplier = 2;

        const pts = 10 * multiplier;
        this.speedrunScore += pts;
        this.stars += multiplier;
        this.saveStars();

        if (this.speedrunScoreEl) this.speedrunScoreEl.textContent = this.speedrunScore.toString();
        if (this.speedrunComboEl) this.speedrunComboEl.textContent = `x${multiplier} (${this.speedrunCombo}连对)`;

        if (this.speedrunCombo >= 3) {
          window.soundManager.playCombo();
        }

        this.nextQuestionTimer = setTimeout(() => {
          if (this.speedrunActive) {
            this.generateQuestion();
          }
        }, 450);
        return;
      }

      this.stars++;
      this.saveStars();

      const praises = [
        '太棒啦！你真聪明！🎉',
        '哇！完全正确，思维真敏捷！⭐',
        '算得又快又准，给你大拇指！👍',
        '太厉害啦，难题都被你攻克了！🌟',
        '答对啦！离扭蛋又近一步了！🎁'
      ];
      let praise = praises[Math.floor(Math.random() * praises.length)];

      // 时钟关卡给出专属时间教学总结
      if (qType === 'clock' && this.currentQuestion) {
        const { hour, minute } = this.currentQuestion;
        praise = minute === 0
          ? `答对啦！时针指着 ${hour}，分针指着 12，就是 ${hour} 点整！`
          : (minute === 30
              ? `太棒啦！时针走过 ${hour}，分针指着 6，就是 ${hour} 点半！`
              : `完全正确！现在正是 ${hour} 点 ${minute} 分！`);
      }

      this.setMascot(praise);
      window.soundManager.speak(praise);

      this.feedbackZoneEl.innerHTML = `
        <div class="feedback-badge success bounce-in">
          <span>✨ 答对啦！金星 +1 ✨</span>
        </div>
      `;

      if (this.streak > 1 && this.streak % 3 === 0) {
        window.soundManager.playFanfare();
        this.setMascot(`太神奇了！连续答对 ${this.streak} 题了！快去扭蛋机看看吧！🎊`);
      }

      this.nextQuestionTimer = setTimeout(() => {
        this.generateQuestion();
      }, 1450);

    } else {
      // 立即禁用该错误选项，防止连续误触扣分
      btnElement.disabled = true;
      btnElement.classList.add('wrong');
      window.soundManager.playWrong();

      this.streak = 0;
      this.updateStatsUI();

      if (this.speedrunActive) {
        this.speedrunCombo = 0;
        if (this.speedrunComboEl) this.speedrunComboEl.textContent = '0';
      }

      const encouragements = [
        '差一点点哦，再仔细算算看！💪',
        '没关系，再看一眼题目，你一定行！🌸',
        '不要着急，深呼吸再试一次吧！☀️'
      ];
      const encText = encouragements[Math.floor(Math.random() * encouragements.length)];
      this.setMascot(encText);
      if (!this.speedrunActive) {
        window.soundManager.speak(encText);
      }

      this.feedbackZoneEl.innerHTML = `
        <div class="feedback-badge retry wobble">
          <span>加油！再试一次哦 💡</span>
        </div>
      `;

      setTimeout(() => {
        btnElement.classList.add('disabled-opt');
      }, 400);
    }
  }

  // ================= 扭蛋机与奖品屋 =================
  openGashapon() {
    this.gashaponModal.classList.add('active');
    this.updateGashaponUI();
  }

  updateGashaponUI() {
    const costText = document.getElementById('gashapon-cost-text');
    const drawBtn = document.getElementById('draw-egg-btn');
    const prizeDisplay = document.getElementById('gashapon-prize-display');
    prizeDisplay.innerHTML = `
      <div class="egg-preview">
        <div class="egg-shell">🥚</div>
        <p>点击下方按钮扭出神秘萌宠！（已收集 ${this.unlockedStickers.length}/${this.stickerLibrary.length}）</p>
      </div>
    `;

    const remainingStars = this.stars;
    costText.textContent = `当前星星: ⭐ ${remainingStars} (每 ${this.eggCost} 颗星星可扭一次)`;

    if (remainingStars >= this.eggCost) {
      drawBtn.disabled = false;
      drawBtn.textContent = '🎰 消耗 3 颗⭐ 扭蛋！';
      drawBtn.onclick = () => this.drawEgg();
    } else {
      drawBtn.disabled = true;
      drawBtn.textContent = `还需要 ${this.eggCost - remainingStars} 颗⭐ 才能扭蛋`;
    }
  }

  drawEgg() {
    if (this.stars < this.eggCost) return;

    this.stars -= this.eggCost;
    this.saveStars();

    const drawBtn = document.getElementById('draw-egg-btn');
    drawBtn.disabled = true;

    const prizeDisplay = document.getElementById('gashapon-prize-display');
    prizeDisplay.innerHTML = `
      <div class="egg-rolling">
        <div class="egg-animated">🔮</div>
        <p class="rolling-text">扭蛋旋转中... 呼噜噜~</p>
      </div>
    `;

    window.soundManager.playGashaponRoll();

    setTimeout(() => {
      const uncollected = this.stickerLibrary.filter(s => !this.unlockedStickers.includes(s.id));
      let randomSticker;
      let isNew = false;

      if (uncollected.length > 0 && Math.random() < 0.85) {
        randomSticker = uncollected[Math.floor(Math.random() * uncollected.length)];
        isNew = true;
      } else {
        randomSticker = this.stickerLibrary[Math.floor(Math.random() * this.stickerLibrary.length)];
        isNew = !this.unlockedStickers.includes(randomSticker.id);
      }

      if (isNew) {
        this.unlockedStickers.push(randomSticker.id);
        this.saveStickers();
      }

      window.soundManager.playFanfare();
      window.confetti.fire({ count: 100 });

      prizeDisplay.innerHTML = `
        <div class="prize-card pop-in">
          <div class="prize-badge">${isNew ? '✨ 新伙伴加入！' : '🎉 获得闪亮贴纸！'}</div>
          <div class="prize-emoji">${randomSticker.emoji}</div>
          <div class="prize-name">${randomSticker.name}</div>
          <div class="prize-title">【${randomSticker.title}】</div>
        </div>
      `;

      const voiceMsg = isNew
        ? `恭喜你！解锁了新伙伴：${randomSticker.name}！${randomSticker.soundText}`
        : `获得了可爱的${randomSticker.name}！`;
      window.soundManager.speak(voiceMsg);

      const remainingStars = this.stars;
      const costText = document.getElementById('gashapon-cost-text');
      if (costText) {
        costText.textContent = `当前星星: ⭐ ${remainingStars} (每 ${this.eggCost} 颗星星可扭一次)`;
      }
      if (remainingStars >= this.eggCost) {
        drawBtn.disabled = false;
        drawBtn.textContent = '🎰 再扭一次！(消耗 3 颗⭐)';
        drawBtn.onclick = () => this.drawEgg();
      } else {
        drawBtn.disabled = true;
        drawBtn.textContent = `还需要 ${this.eggCost - remainingStars} 颗⭐ 才能扭蛋`;
      }
    }, 1100);
  }

  // ================= 贴纸乐园 / 收集手册 (支持拖拽持久化与场景切换) =================
  openStickerBook() {
    this.stickerBookModal.classList.add('active');
    this.renderStickerBook();
    this.renderPlaygroundBar();
    this.restorePlaygroundScene();
  }

  renderStickerBook() {
    const grid = document.getElementById('stickers-grid');
    const unlockedCountEl = document.getElementById('unlocked-sticker-count');
    if (!grid || !unlockedCountEl) return;
    grid.innerHTML = '';

    unlockedCountEl.textContent = `${this.unlockedStickers.length} / ${this.stickerLibrary.length}`;

    this.stickerLibrary.forEach(item => {
      const isUnlocked = this.unlockedStickers.includes(item.id);
      const card = document.createElement('div');
      card.className = `sticker-grid-item ${isUnlocked ? 'unlocked' : 'locked'}`;

      if (isUnlocked) {
        card.innerHTML = `
          <div class="sticker-icon">${item.emoji}</div>
          <div class="sticker-lbl">${item.name}</div>
          <div class="sticker-tag">${item.title}</div>
        `;
        card.addEventListener('click', () => {
          window.soundManager.playStar();
          card.classList.add('wobble');
          window.soundManager.speak(item.soundText || item.name);
          setTimeout(() => card.classList.remove('wobble'), 500);
        });
      } else {
        card.innerHTML = `
          <div class="sticker-icon locked-icon">🔒</div>
          <div class="sticker-lbl">???</div>
          <div class="sticker-tag">扭蛋解锁</div>
        `;
      }

      grid.appendChild(card);
    });
  }

  applyPlaygroundTheme() {
    const playground = document.getElementById('sticker-playground-canvas');
    if (!playground) return;
    this.playgroundThemes.forEach(t => playground.classList.remove(t));
    const currentTheme = this.playgroundThemes[this.playgroundBgIndex] || 'theme-meadow';
    playground.classList.add(currentTheme);
  }

  renderPlaygroundBar() {
    const bar = document.getElementById('playground-stickers-bar');
    const playground = document.getElementById('sticker-playground-canvas');
    if (!bar || !playground) return;

    this.applyPlaygroundTheme();
    bar.innerHTML = '';
    const unlockedItems = this.stickerLibrary.filter(s => this.unlockedStickers.includes(s.id));

    unlockedItems.forEach(item => {
      const chip = document.createElement('button');
      chip.className = 'playground-chip';
      chip.innerHTML = `${item.emoji} <span>${item.name}</span>`;
      chip.title = '点击放入乐园';

      chip.addEventListener('click', () => {
        window.soundManager.playPop();
        const pWidth = playground.clientWidth > 100 ? playground.clientWidth : 480;
        const pHeight = playground.clientHeight > 80 ? playground.clientHeight : 220;
        const x = Math.floor(Math.random() * (pWidth - 80)) + 20;
        const y = Math.floor(Math.random() * (pHeight - 80)) + 20;
        const entry = { uid: Date.now() + Math.random(), id: item.id, x, y };
        this.playgroundScene.push(entry);
        this.savePlaygroundScene();
        this.mountStickerElement(item, entry, playground);
      });

      bar.appendChild(chip);
    });
  }

  restorePlaygroundScene() {
    const playground = document.getElementById('sticker-playground-canvas');
    if (!playground) return;
    this.applyPlaygroundTheme();
    playground.innerHTML = '';

    this.playgroundScene.forEach(entry => {
      const item = this.stickerLibrary.find(s => s.id === entry.id);
      if (item) {
        this.mountStickerElement(item, entry, playground);
      }
    });
  }

  mountStickerElement(item, entry, playground) {
    const el = document.createElement('div');
    el.className = 'placed-playground-sticker pop-in';
    el.textContent = item.emoji;
    el.style.left = `${entry.x}px`;
    el.style.top = `${entry.y}px`;

    let isDragging = false;
    let hasMoved = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const curW = playground.clientWidth > 100 ? playground.clientWidth : 480;
      const curH = playground.clientHeight > 80 ? playground.clientHeight : 220;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasMoved = true;
      }
      const nextX = Math.max(4, Math.min(curW - 56, origX + dx));
      const nextY = Math.max(4, Math.min(curH - 56, origY + dy));
      el.style.left = `${nextX}px`;
      el.style.top = `${nextY}px`;
      entry.x = nextX;
      entry.y = nextY;
    };

    const onPointerEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.zIndex = '10';
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerEnd);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerEnd);

      if (hasMoved) {
        this.savePlaygroundScene();
      } else {
        // 轻点（未拖动）时触发跳跃并发音
        window.soundManager.playStar();
        el.classList.add('jumping');
        window.soundManager.speak(item.soundText || item.name);
        setTimeout(() => el.classList.remove('jumping'), 600);
      }
    };

    const onPointerDown = (e) => {
      e.stopPropagation();
      isDragging = true;
      hasMoved = false;
      el.style.zIndex = '100';
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;
      origX = el.offsetLeft;
      origY = el.offsetTop;
      window.soundManager.playPop();

      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerEnd);
      document.addEventListener('touchmove', onPointerMove, { passive: true });
      document.addEventListener('touchend', onPointerEnd);
    };

    el.addEventListener('mousedown', onPointerDown);
    el.addEventListener('touchstart', onPointerDown, { passive: true });

    playground.appendChild(el);
  }
}

// 启动游戏实例
window.addEventListener('DOMContentLoaded', () => {
  window.mathGameApp = new MathGameApp();
});
