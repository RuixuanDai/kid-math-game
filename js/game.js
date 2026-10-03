// 6岁儿童数学小王国 - 高级全能进阶版
// 8大关卡：数一数、比大小、加减法、规律小火车、十格阵凑十、奇妙时钟岛、空间数积木、60秒冲刺
// 3大难度：10以内基础、20以内进退位、100以内高阶挑战

class MathGameApp {
  constructor() {
    this.currentMode = 'counting'; // 'counting' | 'comparison' | 'arithmetic' | 'patterns' | 'tenframes' | 'clocks' | 'blocks' | 'speedrun'
    this.difficulty = '20'; // 升级默认到 20以内，提供更丰富更有挑战的体验！
    this.stars = parseInt(localStorage.getItem('kid_math_stars') || '8', 10);
    this.unlockedStickers = JSON.parse(localStorage.getItem('kid_math_stickers') || '["bunny", "sun", "icecream"]');
    this.streak = 0;
    this.currentQuestion = null;
    this.countedItems = new Set();
    this.eggCost = 3;

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
      { id: 'lion', name: '小狮子波波', emoji: '🦁', title: '森林之王', soundText: '吼~ 我是勇敢聪明的森林之王！' },
      { id: 'panda', name: '胖达熊猫', emoji: '🐼', title: '竹林高手', soundText: '呼噜噜，竹子真香呀！' },
      { id: 'unicorn', name: '七彩独角兽', emoji: '🦄', title: '彩虹精灵', soundText: '滴答滴答，彩虹魔法降临！' },
      { id: 'dino', name: '霸王龙豆豆', emoji: '🦖', title: '远古探险家', soundText: '嗷呜！我虽然个头大，但很爱交朋友！' },
      { id: 'rocket', name: '星空火箭', emoji: '🚀', title: '小小宇航员', soundText: '3、2、1，发射去月球探险！' },
      { id: 'crown', name: '闪亮王冠', emoji: '👑', title: '智慧国王', soundText: '戴上智慧王冠，你就是算术小达人！' },
      { id: 'cat', name: '猫咪乐乐', emoji: '🐱', title: '捕鱼能手', soundText: '喵呜~ 今天抓到了好多数学小鱼！' },
      { id: 'chick', name: '欢欢小鸡', emoji: '🐥', title: '早起鸣唱', soundText: '叽叽喳喳，早起学习真快乐！' },
      { id: 'star_wand', name: '魔法星杖', emoji: '🪄', title: '奇迹魔法', soundText: '巴拉拉能量，数学难题变简单！' }
    ];

    this.fruitEmojis = ['🍎', '🍓', '🍌', '🥕', '🍊', '🍇', '🍒', '🍉'];
    this.animalEmojis = ['🐥', '🐱', '🐶', '🐰', '🐸', '🐼', '🐧', '🐻'];

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
    this.speedrunSummaryModal = document.getElementById('speedrun-summary-modal');
    this.difficultySelectorEl = document.getElementById('difficulty-selector');
  }

  bindEvents() {
    // 首次交互激活 Web Audio
    const unlockAudio = () => {
      window.soundManager.ensureContext();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // 8大关卡模式切换
    document.querySelectorAll('.mode-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        window.soundManager.playPop();
        this.switchMode(mode);
      });
    });

    // 难度切换 (事件代理到容器，无缝支持动态关卡标签)
    if (this.difficultySelectorEl) {
      this.difficultySelectorEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.diff-btn');
        if (!btn) return;
        this.difficultySelectorEl.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.difficulty = btn.dataset.diff;
        window.soundManager.playPop();
        this.setMascot("难度调整为：" + btn.textContent + "！继续冲冲冲！");
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

    // 弹窗关闭
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundManager.playPop();
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
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

    // 冲刺重新开始
    const restartSprintBtn = document.getElementById('restart-sprint-btn');
    if (restartSprintBtn) {
      restartSprintBtn.addEventListener('click', () => {
        if (this.speedrunSummaryModal) this.speedrunSummaryModal.classList.remove('active');
        this.startSpeedrun();
      });
    }

    // 声音与全屏
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        window.soundManager.soundEnabled = !window.soundManager.soundEnabled;
        soundToggle.textContent = window.soundManager.soundEnabled ? '🔊 声音' : '🔇 静音';
        soundToggle.classList.toggle('off', !window.soundManager.soundEnabled);
      });
    }

    const voiceToggle = document.getElementById('voice-toggle');
    if (voiceToggle) {
      voiceToggle.addEventListener('click', () => {
        window.soundManager.voiceEnabled = !window.soundManager.voiceEnabled;
        voiceToggle.textContent = window.soundManager.voiceEnabled ? '🗣️ 读题开' : '🤐 读题关';
        voiceToggle.classList.toggle('off', !window.soundManager.voiceEnabled);
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
  }

  switchMode(mode) {
    // 如果之前在冲刺模式，清理计时器
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
        { diff: '20', label: '20以内点数', tip: '进阶点数挑战' },
        { diff: '100', label: '群组数数(分组)', tip: '2/5个一组，分组群计数' }
      ],
      comparison: [
        { diff: '10', label: '单数比大小', tip: '10以内数字大小比较' },
        { diff: '20', label: '算式比大小', tip: '加减算式与数字对比' },
        { diff: '100', label: '百数比大小', tip: '两位数与易混倒置数' }
      ],
      arithmetic: [
        { diff: '10', label: '10以内加减', tip: '基础不进位加减法' },
        { diff: '20', label: '20以内进退位', tip: '凑十破十与未知数填空' },
        { diff: '100', label: '100以内挑战', tip: '整十数与连加连减大挑战' }
      ],
      patterns: [
        { diff: '10', label: '图案规律', tip: '水果图形AB/ABB循环' },
        { diff: '20', label: '跳跃数数', tip: '双数跳数与倒数规律' },
        { diff: '100', label: '百数规律', tip: '加3、加4、加10进阶规律' }
      ],
      tenframes: [
        { diff: '10', label: '单盒凑十', tip: '10格阵红点补足10' },
        { diff: '20', label: '双盒进位', tip: '双盒凑十进位加法' },
        { diff: '100', label: '破十挑战', tip: '拆十法与高阶运算' }
      ],
      clocks: [
        { diff: '10', label: '认识整点', tip: '基础入门：分针指向12，整点认读 (如 3:00)' },
        { diff: '20', label: '整点与半点', tip: '核心进阶：整点与半点随机切换与易错对比' },
        { diff: '100', label: '几时几分', tip: '高阶挑战：一刻(15分)、三刻(45分)与各刻度' }
      ],
      blocks: [
        { diff: '10', label: '初级 (4~6块)', tip: '2层基础立体积木堆' },
        { diff: '20', label: '进阶 (7~9块)', tip: '含隐藏积木，空间推理' },
        { diff: '100', label: '挑战 (10~14块)', tip: '3层多层立体透视挑战' }
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

  // ================= 核心出题调度 =================
  generateQuestion() {
    this.countedItems.clear();
    this.questionZoneEl.innerHTML = '';
    this.optionsZoneEl.innerHTML = '';
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
        window.soundManager.speak(this.currentQuestion.audioPrompt);
      }, 300);
    }
  }

  // ================= 1. 森林数一数 (支持群组与进阶点数) =================
  generateCountingQuestion() {
    const isGroupCount = (this.difficulty === '20' && Math.random() > 0.4) || (this.difficulty === '100');
    const itemPool = Math.random() > 0.5 ? this.fruitEmojis : this.animalEmojis;
    const emoji = itemPool[Math.floor(Math.random() * itemPool.length)];

    if (isGroupCount) {
      // 进阶：2个一组或5个一组数数！(幼小衔接乘法与群计数启蒙)
      const groupSize = (this.difficulty === '100') ? 5 : 2;
      const numGroups = (groupSize === 5) ? Math.floor(Math.random() * 3) + 3 : Math.floor(Math.random() * 4) + 3;
      const total = groupSize * numGroups;

      const title = `${groupSize}个一组数一数：这里一共有多少个 ${emoji}？`;
      const audioPrompt = `${groupSize}个一堆，快数数看一共有几组，合起来是多少个呢？`;

      this.currentQuestion = {
        answer: total,
        audioPrompt: audioPrompt,
        type: 'counting'
      };

      this.questionTextEl.innerHTML = `<span>${title}</span> <span class="tip-sub">（一堆有 ${groupSize} 个，可以 ${groupSize}个${groupSize}个数哦）</span>`;

      const board = document.createElement('div');
      board.className = 'counting-board grouped-counting-board';

      for (let g = 1; g <= numGroups; g++) {
        const groupBox = document.createElement('div');
        groupBox.className = 'counting-group-box';
        groupBox.innerHTML = `<span class="group-tag">第${g}组</span><div class="group-items">${emoji.repeat(groupSize)}</div>`;
        groupBox.addEventListener('click', () => {
          if (!groupBox.classList.contains('counted')) {
            groupBox.classList.add('counted');
            window.soundManager.playPop();
            const currentSubtotal = g * groupSize;
            window.soundManager.speak(currentSubtotal.toString());
          }
        });
        board.appendChild(groupBox);
      }

      this.questionZoneEl.appendChild(board);
      const options = this.generateChoices(total, total - 6, total + 8, 4);
      this.renderOptions(options, total);

    } else {
      // 经典单体散落点数
      const max = this.difficulty === '10' ? 10 : 20;
      const min = this.difficulty === '10' ? 4 : 11;
      const targetCount = Math.floor(Math.random() * (max - min + 1)) + min;

      const title = `数一数：草地上有几个 ${emoji} 呢？`;
      const audioPrompt = `数一数草地上有几个，点一点它们可以帮你记录数字哦！`;

      this.currentQuestion = {
        answer: targetCount,
        audioPrompt: audioPrompt,
        type: 'counting'
      };

      this.questionTextEl.innerHTML = `<span>${title}</span> <span class="tip-sub">（点一点可以按顺序标出数字）</span>`;

      const board = document.createElement('div');
      board.className = 'counting-board';

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

  // ================= 2. 天平比大小 (升级算式对比 & 两位数倒置对比) =================
  generateComparisonQuestion() {
    let leftExpr, rightExpr, leftVal, rightVal;

    if (this.difficulty === '10') {
      // 10以内单数对比
      leftVal = Math.floor(Math.random() * 10) + 1;
      rightVal = Math.floor(Math.random() * 10) + 1;
      if (Math.random() < 0.25) rightVal = leftVal;
      leftExpr = leftVal.toString();
      rightExpr = rightVal.toString();

    } else if (this.difficulty === '20') {
      // 20以内算式对比：如 8 + 6 对比 15，或 16 - 7 对比 8
      const isLeftExpr = Math.random() > 0.5;
      const a = Math.floor(Math.random() * 9) + 3;
      const b = Math.floor(Math.random() * 8) + 2;
      const exprVal = a + b;

      if (isLeftExpr) {
        leftExpr = `${a} + ${b}`;
        leftVal = exprVal;
        rightVal = Math.random() < 0.3 ? exprVal : exprVal + (Math.random() > 0.5 ? 1 : -1);
        rightExpr = rightVal.toString();
      } else {
        rightExpr = `${a} + ${b}`;
        rightVal = exprVal;
        leftVal = Math.random() < 0.3 ? exprVal : exprVal + (Math.random() > 0.5 ? 1 : -1);
        leftExpr = leftVal.toString();
      }

    } else {
      // 100以内挑战：易混淆两位数 (如 47 vs 74) 或 算式对比 (如 35 + 20 vs 54)
      if (Math.random() > 0.4) {
        // 易混倒置两位数
        const d1 = Math.floor(Math.random() * 7) + 2;
        const d2 = Math.floor(Math.random() * 7) + 2;
        leftVal = d1 * 10 + d2;
        rightVal = d2 * 10 + d1;
        leftExpr = leftVal.toString();
        rightExpr = rightVal.toString();
      } else {
        const tens1 = (Math.floor(Math.random() * 5) + 1) * 10;
        const ones1 = Math.floor(Math.random() * 9) + 1;
        const tens2 = (Math.floor(Math.random() * 3) + 1) * 10;
        leftExpr = `${tens1 + ones1} + ${tens2}`;
        leftVal = tens1 + ones1 + tens2;
        rightVal = Math.random() < 0.3 ? leftVal : leftVal + (Math.random() > 0.5 ? 2 : -2);
        rightExpr = rightVal.toString();
      }
    }

    let answerSymbol = '=';
    if (leftVal > rightVal) answerSymbol = '>';
    if (leftVal < rightVal) answerSymbol = '<';

    const audioPrompt = `比一比，左边是 ${leftExpr}，右边是 ${rightExpr}，哪边更大呢？`;
    this.questionTextEl.innerHTML = `天平比大小：比较左右两边谁更大！`;

    this.currentQuestion = {
      answer: answerSymbol,
      audioPrompt: audioPrompt,
      type: 'comparison'
    };

    const balanceBox = document.createElement('div');
    balanceBox.className = 'balance-container';

    // 左盘
    const leftPlate = document.createElement('div');
    leftPlate.className = 'scale-plate left-plate';
    leftPlate.innerHTML = `<div class="plate-expr">${leftExpr}</div>`;

    // 中间鳄鱼嘴
    const midSymbol = document.createElement('div');
    midSymbol.className = 'scale-middle';
    midSymbol.id = 'scale-alligator';
    midSymbol.innerHTML = `<div class="mystery-box">❓</div>`;

    // 右盘
    const rightPlate = document.createElement('div');
    rightPlate.className = 'scale-plate right-plate';
    rightPlate.innerHTML = `<div class="plate-expr">${rightExpr}</div>`;

    balanceBox.appendChild(leftPlate);
    balanceBox.appendChild(midSymbol);
    balanceBox.appendChild(rightPlate);
    this.questionZoneEl.appendChild(balanceBox);

    const optionsData = [
      { val: '>', label: '左边大 👈' },
      { val: '=', label: '一样大 🤝' },
      { val: '<', label: '右边大 👉' }
    ];

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

  // ================= 3. 趣味加减法 (支持进退位、未知数填空 & 两位数运算) =================
  generateArithmeticQuestion() {
    let promptHtml, audioText, answer;
    const isBlankMode = Math.random() > 0.6; // 40% 概率出未知数填空题 (如 8 + ? = 14)

    if (this.difficulty === '10') {
      const isAdd = Math.random() > 0.4;
      if (isAdd) {
        const a = Math.floor(Math.random() * 8) + 1;
        const b = Math.floor(Math.random() * (10 - a)) + 1;
        answer = a + b;
        promptHtml = `${a} + ${b} = ?`;
        audioText = `${a} 加 ${b} 等于几呢？`;
      } else {
        const a = Math.floor(Math.random() * 8) + 3;
        const b = Math.floor(Math.random() * (a - 1)) + 1;
        answer = a - b;
        promptHtml = `${a} - ${b} = ?`;
        audioText = `${a} 减去 ${b} 等于几呢？`;
      }

    } else if (this.difficulty === '20') {
      // 20以内：核心考察凑十法进位加法与破十法退位减法！
      const isAdd = Math.random() > 0.45;
      if (isAdd) {
        // 进位加法 (如 7 + 8 = 15, 9 + 6 = 15)
        const a = Math.floor(Math.random() * 6) + 4; // 4~9
        const b = Math.floor(Math.random() * 7) + (11 - a); // 确保 a + b > 10
        if (isBlankMode) {
          promptHtml = `${a} + <span class="blank-box">?</span> = ${a + b}`;
          audioText = `${a} 加上几等于 ${a + b} 呢？`;
          answer = b;
        } else {
          promptHtml = `${a} + ${b} = ?`;
          audioText = `${a} 加 ${b} 等于几呢？可以用凑十法算一算哦！`;
          answer = a + b;
        }
      } else {
        // 退位减法 (如 14 - 8 = 6, 13 - 7 = 6)
        const total = Math.floor(Math.random() * 8) + 11; // 11~18
        const sub = Math.floor(Math.random() * 7) + (total - 9); // 确保个位不够减
        if (isBlankMode) {
          promptHtml = `${total} - <span class="blank-box">?</span> = ${total - sub}`;
          audioText = `${total} 减去几等于 ${total - sub} 呢？`;
          answer = sub;
        } else {
          promptHtml = `${total} - ${sub} = ?`;
          audioText = `${total} 减去 ${sub} 等于几呢？可以用破十法算一算！`;
          answer = total - sub;
        }
      }

    } else {
      // 100以内高阶运算：整十数加减与两位数加一位数 (如 35 + 4, 60 + 30, 48 - 6)
      const qType = Math.floor(Math.random() * 3);
      if (qType === 0) {
        // 整十数加减
        const t1 = (Math.floor(Math.random() * 5) + 1) * 10;
        const t2 = (Math.floor(Math.random() * 4) + 1) * 10;
        if (Math.random() > 0.5) {
          promptHtml = `${t1} + ${t2} = ?`;
          audioText = `${t1} 加 ${t2} 等于几呢？`;
          answer = t1 + t2;
        } else {
          const big = t1 + t2;
          promptHtml = `${big} - ${t1} = ?`;
          audioText = `${big} 减去 ${t1} 等于几呢？`;
          answer = t2;
        }
      } else if (qType === 1) {
        // 两位数加一位数不进位 (如 32 + 5 = 37)
        const tens = (Math.floor(Math.random() * 7) + 2) * 10;
        const ones = Math.floor(Math.random() * 5) + 1;
        const addOne = Math.floor(Math.random() * (8 - ones)) + 1;
        promptHtml = `${tens + ones} + ${addOne} = ?`;
        audioText = `${tens + ones} 加 ${addOne} 等于几呢？`;
        answer = tens + ones + addOne;
      } else {
        // 3数连加连减大挑战！(如 4 + 3 + 2, 10 - 3 - 2)
        const a = Math.floor(Math.random() * 6) + 2;
        const b = Math.floor(Math.random() * 5) + 2;
        const c = Math.floor(Math.random() * 4) + 1;
        if (Math.random() > 0.5) {
          promptHtml = `${a} + ${b} + ${c} = ?`;
          audioText = `${a} 加 ${b} 再加 ${c}，一共等于几？`;
          answer = a + b + c;
        } else {
          const total = a + b + c;
          promptHtml = `${total} - ${a} - ${b} = ?`;
          audioText = `${total} 减去 ${a} 再减去 ${b}，还剩几？`;
          answer = c;
        }
      }
    }

    this.questionTextEl.innerHTML = `魔法算术挑战：<span>${promptHtml}</span>`;
    this.currentQuestion = {
      answer: answer,
      audioPrompt: audioText,
      type: 'arithmetic'
    };

    const visualBox = document.createElement('div');
    visualBox.className = 'arithmetic-card-display';
    visualBox.innerHTML = `<div class="big-formula-text">${promptHtml}</div>`;
    this.questionZoneEl.appendChild(visualBox);

    const minChoice = Math.max(0, answer - 4);
    const options = this.generateChoices(answer, minChoice, answer + 5, 4);
    this.renderOptions(options, answer);
  }

  // ================= 4. 规律小火车 (支持数字跳数与阶梯规律) =================
  generatePatternQuestion() {
    let sequence = [];
    let answer;
    let descText;

    if (this.difficulty === '10') {
      // 符号图案规律
      const pool = ['🌸', '⭐', '🎈', '🍎', '🍌', '🥕'];
      const p1 = pool[Math.floor(Math.random() * pool.length)];
      let p2 = pool[Math.floor(Math.random() * pool.length)];
      while (p2 === p1) p2 = pool[Math.floor(Math.random() * pool.length)];

      sequence = [p1, p2, p1, p2, p1, '?'];
      answer = p2;
      descText = `看一看小火车规律，最后一节装什么？`;

    } else if (this.difficulty === '20') {
      // 跳跃点数规律 (双数跳数 / 5的倍数 / 倒数)
      const patternType = Math.floor(Math.random() * 3);
      if (patternType === 0) {
        // 2个2个数 (双数跳数 2, 4, 6, 8, 10, ?)
        const start = (Math.floor(Math.random() * 4) + 1) * 2;
        sequence = [start, start + 2, start + 4, start + 6, '?'];
        answer = start + 8;
        descText = `2个2个数规律：后面应该是几呢？`;
      } else if (patternType === 1) {
        // 5个5个数 (5, 10, 15, 20, ?)
        const start = Math.random() > 0.5 ? 5 : 0;
        sequence = [start, start + 5, start + 10, start + 15, '?'];
        answer = start + 20;
        descText = `5个5个数规律：接下来装哪个数字？`;
      } else {
        // 倒数规律 (20, 19, 18, 17, ?)
        const start = Math.floor(Math.random() * 6) + 15;
        sequence = [start, start - 1, start - 2, start - 3, '?'];
        answer = start - 4;
        descText = `倒数小火车：数字越来越小啦，下一个是几？`;
      }

    } else {
      // 100以内阶梯递增递减 (如 10, 20, 30, 40, ? 或 3, 6, 9, 12, ?)
      const step = [3, 4, 10][Math.floor(Math.random() * 3)];
      const start = step === 10 ? 10 : Math.floor(Math.random() * 5) + 1;
      sequence = [start, start + step, start + step * 2, start + step * 3, '?'];
      answer = start + step * 4;
      descText = `找规律：每次增加 ${step}，下一节车厢是几？`;
    }

    this.questionTextEl.innerHTML = `找规律小火车：<span>${descText}</span> 🚂`;
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
      const pool = ['🌸', '⭐', '🎈', '🍎', '🍌', '🥕'];
      while (options.length < 4) {
        const p = pool[Math.floor(Math.random() * pool.length)];
        if (!options.includes(p)) options.push(p);
      }
      options.sort(() => 0.5 - Math.random());
    }

    this.renderOptions(options, answer);
  }

  // ================= 5. 十格阵凑十 (NEW! 新加坡数学/蒙氏凑十破十) =================
  generateTenFrameQuestion() {
    if (this.difficulty === '10') {
      // 单十格阵：已经有 N 个红点，还差几个能凑成 10？
      const filled = Math.floor(Math.random() * 7) + 2; // 2~8
      const needed = 10 - filled;

      this.questionTextEl.innerHTML = `十格阵凑十：<span>已有 ${filled} 个圆点，还差几个能凑满 10？</span>`;
      const audioPrompt = `看一看十格阵，盒子里已经有 ${filled} 个小圆点，还差几个就能凑满 10 个呢？`;

      this.currentQuestion = {
        answer: needed,
        audioPrompt: audioPrompt,
        type: 'tenframe'
      };

      const container = document.createElement('div');
      container.className = 'ten-frame-wrapper';

      const frame = document.createElement('div');
      frame.className = 'ten-frame';

      for (let i = 1; i <= 10; i++) {
        const cell = document.createElement('div');
        cell.className = 'ten-frame-cell';
        if (i <= filled) {
          cell.innerHTML = `<span class="ten-dot filled-dot">🔴</span>`;
        } else {
          cell.innerHTML = `<span class="ten-dot empty-dot">⚪</span>`;
        }
        frame.appendChild(cell);
      }

      container.appendChild(frame);
      this.questionZoneEl.appendChild(container);

      const options = this.generateChoices(needed, 1, 9, 4);
      this.renderOptions(options, needed);

    } else {
      // 双十格阵破十与进位法 (如 8 + 5 = 13)
      const num1 = Math.floor(Math.random() * 4) + 6; // 6, 7, 8, 9
      const num2 = Math.floor(Math.random() * 5) + (11 - num1); // 进位加法
      const needToMake10 = 10 - num1;
      const remain = num2 - needToMake10;
      const total = num1 + num2;

      this.questionTextEl.innerHTML = `十格阵凑十法：<span>${num1} + ${num2} = ?</span>`;
      const audioPrompt = `${num1} 加 ${num2}，把第二组拆出 ${needToMake10} 个凑满第一个10，合起来是多少？`;

      this.currentQuestion = {
        answer: total,
        audioPrompt: audioPrompt,
        type: 'tenframe'
      };

      const container = document.createElement('div');
      container.className = 'dual-ten-frame-wrapper';

      // 渲染两个十格阵并标示凑十过程
      container.innerHTML = `
        <div class="ten-frame-box">
          <div class="frame-label">第一格 (满 10): 🔴 × ${num1} + 🟡 × ${needToMake10}</div>
          <div class="ten-frame">
            ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot">${i < num1 ? '🔴' : '🟡'}</span></div>`).join('')}
          </div>
        </div>
        <div class="frame-plus">➕</div>
        <div class="ten-frame-box">
          <div class="frame-label">第二格 (还剩 ${remain}): 🟡 × ${remain}</div>
          <div class="ten-frame">
            ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot">${i < remain ? '🟡' : '⚪'}</span></div>`).join('')}
          </div>
        </div>
      `;

      this.questionZoneEl.appendChild(container);
      const options = this.generateChoices(total, 11, 18, 4);
      this.renderOptions(options, total);
    }
  }

  // ================= 6. 奇妙时钟岛 (NEW! 认识时钟、整点与半点) =================
  generateClockQuestion() {
    let hour = Math.floor(Math.random() * 12) + 1; // 1~12
    let minute = 0;

    if (this.difficulty === '10') {
      // 认识整点: 100% 整点 (如 3:00, 8:00)
      minute = 0;
    } else if (this.difficulty === '20') {
      // 整点与半点: 随机切换整点与半点，强化对比（彻底告别固定30分）！
      // 避免连续只出同一种，实现整点与半点交替出现
      if (this.lastClockMinute === 30) {
        minute = Math.random() > 0.35 ? 0 : 30;
      } else if (this.lastClockMinute === 0) {
        minute = Math.random() > 0.35 ? 30 : 0;
      } else {
        minute = Math.random() > 0.5 ? 30 : 0;
      }
      this.lastClockMinute = minute;
    } else {
      // 几时几分(高阶): 包含 15分(一刻)、30分(半点)、45分(三刻)、整点以及常见刻度
      const minutesList = [0, 15, 30, 45, 10, 20, 50];
      minute = minutesList[Math.floor(Math.random() * minutesList.length)];
    }

    const minStr = minute < 10 ? `0${minute}` : minute.toString();
    const correctTimeStr = `${hour}:${minStr}`;

    const title = minute === 0 ? `看一看时钟：现在是几点整？` : `看一看时钟：现在是几点几分？`;
    const audioPrompt = minute === 0 
      ? `仔细看时针和分针，现在的指针指向几点整呢？`
      : (minute === 30 
          ? `仔细看时针和分针，现在的指针指向几点半呢？`
          : `仔细看时针和分针，现在的指针指向几点几分呢？`);

    this.currentQuestion = {
      answer: correctTimeStr,
      audioPrompt: audioPrompt,
      type: 'clock'
    };

    this.questionTextEl.innerHTML = `奇妙时钟岛：<span>${title}</span> ⏰`;

    // 渲染 SVG 钟表
    const clockContainer = document.createElement('div');
    clockContainer.className = 'analog-clock-container';

    // 计算分针和时针的角度
    const minAngle = minute * 6; // 360 / 60
    const hourAngle = (hour % 12 + minute / 60) * 30; // 360 / 12

    let numbersHtml = '';
    for (let h = 1; h <= 12; h++) {
      const angle = (h * 30 - 90) * (Math.PI / 180);
      const r = 70;
      const x = 100 + r * Math.cos(angle);
      const y = 100 + r * Math.sin(angle) + 6;
      numbersHtml += `<text x="${x}" y="${y}" class="clock-num" text-anchor="middle">${h}</text>`;
    }

    // 表盘刻度点 (12个大刻度与分针小刻度，让钟表更真实生动)
    let ticksHtml = '';
    for (let m = 0; m < 60; m += 5) {
      const angle = (m * 6 - 90) * (Math.PI / 180);
      const isHourTick = (m % 15 === 0);
      const r1 = isHourTick ? 84 : 86;
      const r2 = 90;
      const x1 = 100 + r1 * Math.cos(angle);
      const y1 = 100 + r1 * Math.sin(angle);
      const x2 = 100 + r2 * Math.cos(angle);
      const y2 = 100 + r2 * Math.sin(angle);
      ticksHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isHourTick ? '#334155' : '#94A3B8'}" stroke-width="${isHourTick ? 2.5 : 1.5}" stroke-linecap="round" />`;
    }

    clockContainer.innerHTML = `
      <svg class="analog-clock-svg" viewBox="0 0 200 200">
        <!-- 钟表表盘外圈 -->
        <circle cx="100" cy="100" r="95" class="clock-face-outer" />
        <circle cx="100" cy="100" r="88" class="clock-face-inner" />
        
        <!-- 表盘刻度 -->
        ${ticksHtml}

        <!-- 数字 1 ~ 12 -->
        ${numbersHtml}
        
        <!-- 时针 (短粗蓝色) -->
        <line x1="100" y1="100" x2="100" y2="52" class="clock-hand hour-hand" transform="rotate(${hourAngle} 100 100)" />
        
        <!-- 分针 (长细红色) -->
        <line x1="100" y1="100" x2="100" y2="28" class="clock-hand minute-hand" transform="rotate(${minAngle} 100 100)" />
        
        <!-- 中心圆轴点 -->
        <circle cx="100" cy="100" r="6" class="clock-center-pin" />
      </svg>
      <div class="clock-legend">
        <span class="legend-hour">🟦 短针是时针</span>
        <span class="legend-minute">🟥 长针是分针</span>
      </div>
    `;

    this.questionZoneEl.appendChild(clockContainer);

    // 生成针对性的高质量时钟选项（含幼小衔接易错陷阱）
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

  // ================= 7. 空间数积木 (NEW! 3D等轴测积木空间推理) =================
  generateBlocksQuestion() {
    this.xrayActive = false;

    // 积木网格: 3x3 空间，每一格有高度 height
    let grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    let totalBlocks = 0;

    if (this.difficulty === '10') {
      // 初级：4~6块积木，2层基础立体堆，直观容易数
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
      // 进阶：7~9块积木，2~3层，保证有下层被压住的隐藏积木（空间思维训练！）
      const targetCount = Math.floor(Math.random() * 3) + 7; // 7, 8, 9
      let placed = 0;
      // 保证中间或后排至少有2层
      grid[1][1] = 2;
      placed += 2;

      const coords = [
        [0,0], [0,1], [0,2],
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
      // 挑战：10~14块积木，3层立体建筑，考验多层空间透视推理
      const targetCount = Math.floor(Math.random() * 5) + 10; // 10~14
      let placed = 0;
      grid[0][0] = 2;
      grid[0][1] = 3;
      grid[1][1] = 3;
      placed = 8;

      const coords = [
        [0,2], [1,0], [1,2],
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

    this.questionTextEl.innerHTML = `空间数积木：<span>数一数，一共有多少块积木？</span> 🧩`;
    const audioPrompt = `数一数一共有多少块积木？别忘了被压在下面的隐藏积木哦！`;

    this.currentQuestion = {
      answer: totalBlocks,
      audioPrompt: audioPrompt,
      type: 'blocks'
    };

    // 绘制大幅超清等轴测 3D 积木 (Isometric SVG)
    const blockContainer = document.createElement('div');
    blockContainer.className = 'isometric-blocks-container';
    blockContainer.id = 'blocks-stage';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'isometric-svg');

    // 积木单体尺寸大幅放大（tileW 84, tileH 46, cubeH 58）
    const tileW = 84;
    const tileH = 46;
    const cubeH = 58;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    // 先计算所有积木顶点的外接包围盒，以便自适应 viewBox
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        if (grid[x][y] > 0) {
          for (let z = 0; z < grid[x][y]; z++) {
            const posX = (x - y) * (tileW / 2);
            const posY = (x + y) * (tileH / 2) - z * cubeH;
            const pts = [
              [posX, posY - tileH / 2],
              [posX + tileW / 2, posY],
              [posX, posY + tileH / 2],
              [posX - tileW / 2, posY],
              [posX - tileW / 2, posY + cubeH],
              [posX, posY + tileH / 2 + cubeH],
              [posX + tileW / 2, posY + cubeH]
            ];
            pts.forEach(([px, py]) => {
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            });
          }
        }
      }
    }

    // 设置紧凑完美的 viewBox，让积木铺满画布，视觉面积放大 4~5 倍！
    const pad = 24;
    const vbW = Math.round(maxX - minX + pad * 2);
    const vbH = Math.round(maxY - minY + pad * 2);
    const vbX = Math.round(minX - pad);
    const vbY = Math.round(minY - pad);
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);

    // 按照从后向前、从下到上的顺序渲染，保证遮挡关系正确
    for (let sum = 0; sum <= 4; sum++) {
      for (let x = 0; x <= sum; x++) {
        let y = sum - x;
        if (x < 3 && y < 3 && grid[x][y] > 0) {
          for (let z = 0; z < grid[x][y]; z++) {
            const posX = (x - y) * (tileW / 2);
            const posY = (x + y) * (tileH / 2) - z * cubeH;

            // 绘制一个 3D 立方体：顶面、左面、右面
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'isometric-cube');
            g.setAttribute('title', '点击点亮积木');

            // 交互：点击积木会有金色高亮提示和清脆音效
            g.addEventListener('click', (e) => {
              e.stopPropagation();
              window.soundManager.playPop();
              g.classList.toggle('cube-clicked');
            });

            // 顶面
            const topPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            topPolygon.setAttribute('points', `${posX},${posY - tileH/2} ${posX + tileW/2},${posY} ${posX},${posY + tileH/2} ${posX - tileW/2},${posY}`);
            topPolygon.setAttribute('class', 'cube-face-top');

            // 左面
            const leftPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            leftPolygon.setAttribute('points', `${posX - tileW/2},${posY} ${posX},${posY + tileH/2} ${posX},${posY + tileH/2 + cubeH} ${posX - tileW/2},${posY + cubeH}`);
            leftPolygon.setAttribute('class', 'cube-face-left');

            // 右面
            const rightPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            rightPolygon.setAttribute('points', `${posX},${posY + tileH/2} ${posX + tileW/2},${posY} ${posX + tileW/2},${posY + cubeH} ${posX},${posY + tileH/2 + cubeH}`);
            rightPolygon.setAttribute('class', 'cube-face-right');

            g.appendChild(topPolygon);
            g.appendChild(leftPolygon);
            g.appendChild(rightPolygon);
            svg.appendChild(g);
          }
        }
      }
    }

    blockContainer.appendChild(svg);

    // 透视辅助按钮 (培养孩子的空间透视直觉)
    const xrayBtn = document.createElement('button');
    xrayBtn.className = 'xray-toggle-btn';
    xrayBtn.innerHTML = `🔍 开启透视模式（找找隐藏积木）`;
    xrayBtn.addEventListener('click', () => {
      this.xrayActive = !this.xrayActive;
      svg.classList.toggle('xray-mode', this.xrayActive);
      xrayBtn.textContent = this.xrayActive ? `👓 恢复实心模式` : `🔍 开启透视模式（找找隐藏积木）`;
      window.soundManager.playPop();
    });

    blockContainer.appendChild(xrayBtn);
    this.questionZoneEl.appendChild(blockContainer);

    const minC = Math.max(1, totalBlocks - 3);
    const options = this.generateChoices(totalBlocks, minC, totalBlocks + 4, 4);
    this.renderOptions(options, totalBlocks);
  }

  // ================= 8. 60秒极速挑战模式 (NEW! 计时闯关与连击爆发) =================
  startSpeedrun() {
    this.speedrunActive = true;
    this.speedrunTimeLeft = 60;
    this.speedrunScore = 0;
    this.speedrunCombo = 0;

    if (this.speedrunHud) {
      this.speedrunHud.style.display = 'flex';
      this.speedrunTimerEl.textContent = '60';
      this.speedrunScoreEl.textContent = '0';
      this.speedrunComboEl.textContent = '0';
    }

    window.soundManager.playFanfare();
    this.setMascot("60秒极速挑战开始啦！连续答对星星翻倍！冲呀！🔥");

    if (this.speedrunTimer) clearInterval(this.speedrunTimer);
    this.speedrunTimer = setInterval(() => {
      this.speedrunTimeLeft--;
      if (this.speedrunTimerEl) {
        this.speedrunTimerEl.textContent = this.speedrunTimeLeft.toString();
      }

      if (this.speedrunTimeLeft <= 10) {
        window.soundManager.playTick();
      }

      if (this.speedrunTimeLeft <= 0) {
        this.finishSpeedrun();
      }
    }, 1000);

    this.generateSpeedrunQuestion();
  }

  generateSpeedrunQuestion() {
    // 随机从 加减法、比大小、规律小火车、十格阵 中快速选题
    const rand = Math.random();
    if (rand < 0.45) {
      this.generateArithmeticQuestion();
    } else if (rand < 0.75) {
      this.generateComparisonQuestion();
    } else {
      this.generateTenFrameQuestion();
    }
  }

  finishSpeedrun() {
    clearInterval(this.speedrunTimer);
    this.speedrunTimer = null;
    this.speedrunActive = false;

    window.soundManager.playFanfare();
    window.confetti.fire({ count: 120 });

    let rankTitle = '🌟 数学探索者';
    if (this.speedrunScore >= 150) rankTitle = '👑 数学小神童';
    else if (this.speedrunScore >= 80) rankTitle = '🏆 算术小达人';
    else if (this.speedrunScore >= 40) rankTitle = '🚀 闪电探险家';

    const summaryText = document.getElementById('sprint-summary-text');
    if (summaryText) {
      summaryText.innerHTML = `
        <div class="sprint-rank">${rankTitle}</div>
        <div class="sprint-score-pill">总得分: <strong>${this.speedrunScore}</strong> 分</div>
        <div class="sprint-stars-pill">本次赢取金星: <strong>+${Math.floor(this.speedrunScore / 10)}</strong> ⭐</div>
      `;
    }

    // 奖励金星
    this.stars += Math.floor(this.speedrunScore / 10);
    this.saveStars();

    if (this.speedrunSummaryModal) {
      this.speedrunSummaryModal.classList.add('active');
    }
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
        choices.add(randVal);
      }
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
    const isCorrect = (selectedValue.toString() === correctValue.toString());

    if (isCorrect) {
      btnElement.classList.add('correct');
      window.soundManager.playCorrect();
      window.confetti.fire({ count: 65, x: window.innerWidth / 2, y: window.innerHeight * 0.4 });

      // 比大小模式鳄鱼张嘴
      if (this.currentMode === 'comparison') {
        const alligator = document.getElementById('scale-alligator');
        if (alligator) {
          alligator.innerHTML = `<div class="alligator-open pop-in">${correctValue}</div>`;
        }
      }

      // 规律小火车启程
      if (this.currentMode === 'patterns') {
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

        // 冲刺模式极速切换下一题 (仅0.5秒)
        document.querySelectorAll('.option-card').forEach(b => b.disabled = true);
        setTimeout(() => {
          this.generateQuestion();
        }, 500);
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
      const praise = praises[Math.floor(Math.random() * praises.length)];
      this.setMascot(praise);
      window.soundManager.speak(praise);

      this.feedbackZoneEl.innerHTML = `
        <div class="feedback-badge success bounce-in">
          <span>✨ 答对啦！金星 +1 ✨</span>
        </div>
      `;

      document.querySelectorAll('.option-card').forEach(b => b.disabled = true);

      if (this.streak > 1 && this.streak % 3 === 0) {
        window.soundManager.playFanfare();
        this.setMascot(`太神奇了！连续答对 ${this.streak} 题了！快去扭蛋机看看吧！🎊`);
      }

      setTimeout(() => {
        this.generateQuestion();
      }, 1400);

    } else {
      btnElement.classList.add('wrong');
      window.soundManager.playWrong();

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
      window.soundManager.speak(encText);

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
        <p>点击按钮扭出神秘萌宠！</p>
      </div>
    `;

    const remainingStars = this.stars;
    costText.textContent = `当前星星: ⭐ ${remainingStars} (需要 ${this.eggCost} 颗星星扭一次)`;

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
    this.updateStatsUI();

    const drawBtn = document.getElementById('draw-egg-btn');
    drawBtn.disabled = true;

    const prizeDisplay = document.getElementById('gashapon-prize-display');
    prizeDisplay.innerHTML = `
      <div class="egg-rolling">
        <div class="egg-animated">🔮</div>
        <p class="rolling-text">扭蛋滚动中... 呼噜噜~</p>
      </div>
    `;

    window.soundManager.playPop();

    setTimeout(() => {
      const uncollected = this.stickerLibrary.filter(s => !this.unlockedStickers.includes(s.id));
      let randomSticker;
      let isNew = false;

      if (uncollected.length > 0 && Math.random() < 0.8) {
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
          <div class="prize-badge">${isNew ? '✨ 新伙伴加入！' : '🎉 获得闪亮金光贴纸！'}</div>
          <div class="prize-emoji">${randomSticker.emoji}</div>
          <div class="prize-name">${randomSticker.name}</div>
          <div class="prize-title">【${randomSticker.title}】</div>
        </div>
      `;

      const voiceMsg = isNew ? `恭喜你！解锁了新伙伴：${randomSticker.name}！` : `获得了可爱的${randomSticker.name}！`;
      window.soundManager.speak(voiceMsg);

      this.updateGashaponUI();
    }, 1200);
  }

  // ================= 贴纸乐园 / 收集手册 =================
  openStickerBook() {
    this.stickerBookModal.classList.add('active');
    this.renderStickerBook();
    this.renderPlaygroundBar();
  }

  renderStickerBook() {
    const grid = document.getElementById('stickers-grid');
    const unlockedCountEl = document.getElementById('unlocked-sticker-count');
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

  renderPlaygroundBar() {
    const bar = document.getElementById('playground-stickers-bar');
    const playground = document.getElementById('sticker-playground-canvas');
    if (!bar || !playground) return;

    bar.innerHTML = '';
    const unlockedItems = this.stickerLibrary.filter(s => this.unlockedStickers.includes(s.id));

    unlockedItems.forEach(item => {
      const chip = document.createElement('button');
      chip.className = 'playground-chip';
      chip.innerHTML = `${item.emoji} <span>${item.name}</span>`;
      chip.title = '点击放入乐园';

      chip.addEventListener('click', () => {
        window.soundManager.playPop();
        this.addStickerToPlayground(item, playground);
      });

      bar.appendChild(chip);
    });
  }

  addStickerToPlayground(item, playground) {
    const el = document.createElement('div');
    el.className = 'placed-playground-sticker pop-in';
    el.textContent = item.emoji;

    const pWidth = playground.clientWidth > 100 ? playground.clientWidth : 360;
    const pHeight = playground.clientHeight > 80 ? playground.clientHeight : 220;

    const x = Math.floor(Math.random() * (pWidth - 80)) + 20;
    const y = Math.floor(Math.random() * (pHeight - 80)) + 20;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    let isDragging = false;
    let startX, startY, origX, origY;

    const onPointerDown = (e) => {
      isDragging = true;
      el.style.zIndex = '100';
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;
      origX = el.offsetLeft;
      origY = el.offsetTop;
      window.soundManager.playPop();
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const curW = playground.clientWidth > 100 ? playground.clientWidth : 360;
      const curH = playground.clientHeight > 80 ? playground.clientHeight : 220;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startX;
      const dy = clientY - startY;
      el.style.left = `${Math.max(0, Math.min(curW - 60, origX + dx))}px`;
      el.style.top = `${Math.max(0, Math.min(curH - 60, origY + dy))}px`;
    };

    const onPointerEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.zIndex = '10';
    };

    el.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerEnd);

    el.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('touchmove', onPointerMove, { passive: true });
    document.addEventListener('touchend', onPointerEnd);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      window.soundManager.playStar();
      el.classList.add('jumping');
      window.soundManager.speak(item.soundText || item.name);
      setTimeout(() => el.classList.remove('jumping'), 600);
    });

    playground.appendChild(el);
  }
}

// 启动游戏实例
window.addEventListener('DOMContentLoaded', () => {
  window.mathGameApp = new MathGameApp();
});
