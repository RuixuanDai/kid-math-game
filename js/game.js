// 6岁儿童数学小王国 - 智能自适应与自定义题库旗舰版
// 支持「智能自适应闯关」与「⚙️ 设置中心自定义题型/难度/全屏/音效/家长防改锁」，精简答题后语音反馈，节奏轻快不拖沓

class MathGameApp {
  constructor() {
    this.currentMode = 'smart'; // 'smart' | 'speedrun'
    this.difficulty = '20';     // 当前题目实际运行难度: '10' | '20' | '100'
    this.difficultySetting = 'auto'; // 设置项: 'auto' | '10' | '20' | '100'
    this.parentLockEnabled = false;
    this.settingsChangedPending = false;
    this.ktestSubType = 'all';
    this.lastKTestType = null;
    this.stars = parseInt(localStorage.getItem('kid_math_stars') || '8', 10);
    this.unlockedStickers = JSON.parse(localStorage.getItem('kid_math_stickers') || '["bunny", "sun", "icecream"]');
    this.bestSprintScore = parseInt(localStorage.getItem('kid_math_best_sprint') || '0', 10);
    this.playgroundScene = JSON.parse(localStorage.getItem('kid_math_playground') || '[]');
    this.playgroundBgIndex = parseInt(localStorage.getItem('kid_math_playground_bg') || '0', 10);

    this.streak = 0;
    this.questionsSolved = 0;
    this.currentQuestion = null;
    this.countedItems = new Set();
    this.eggCost = 3;
    this.nextQuestionTimer = null;
    this.questionSpeakTimer = null;
    this.transitionSeq = 0;
    this.lastClockMinute = null;

    // 16类全覆盖课程目录（支持设置页自由勾选）
    this.curriculumCatalog = [
      { id: 'ktest:q1', group: 'ktest', icon: '🔗', mode: 'ktest', subType: 'q1', label: '凑十数键', tag: '🎓 真题特训', sprintOk: true },
      { id: 'ktest:q2', group: 'ktest', icon: '🌿', mode: 'ktest', subType: 'q2', label: '连环分合', tag: '🎓 真题特训', sprintOk: true },
      { id: 'ktest:q3', group: 'ktest', icon: '🧮', mode: 'ktest', subType: 'q3', label: '一图四式', tag: '🎓 真题特训', sprintOk: false },
      { id: 'ktest:q4', group: 'ktest', icon: '🗼', mode: 'ktest', subType: 'q4', label: '三格数塔', tag: '🎓 真题特训', sprintOk: true },
      { id: 'ktest:q5a', group: 'ktest', icon: '🧠', mode: 'ktest', subType: 'q5a', label: '多步文字推理', tag: '🎓 真题特训', sprintOk: true },
      { id: 'ktest:q5b', group: 'ktest', icon: '⚖️', mode: 'ktest', subType: 'q5b', label: '双边等式天平', tag: '🎓 真题特训', sprintOk: true },
      { id: 'arithmetic:blank', group: 'calc', icon: '❓', mode: 'arithmetic', subType: 'blank', label: '逆向未知数', tag: '🍩 进阶算术', sprintOk: true },
      { id: 'arithmetic:chain', group: 'calc', icon: '🚀', mode: 'arithmetic', subType: 'chain', label: '连加连减与两位数', tag: '🍩 高阶算术', sprintOk: true },
      { id: 'comparison:expr', group: 'calc', icon: '🐊', mode: 'comparison', subType: 'expr', label: '双算式比大小', tag: '⚖️ 算式对比', sprintOk: true },
      { id: 'comparison:twodigit', group: 'calc', icon: '🔢', mode: 'comparison', subType: 'twodigit', label: '数位与整十对比', tag: '⚖️ 数位挑战', sprintOk: true },
      { id: 'tenframes:make10', group: 'calc', icon: '🔴', mode: 'tenframes', subType: 'make10', label: '十格阵凑十', tag: '🧪 数感建模', sprintOk: true },
      { id: 'tenframes:break10', group: 'calc', icon: '🟢', mode: 'tenframes', subType: 'break10', label: '十格阵破十', tag: '🧪 数感建模', sprintOk: true },
      { id: 'counting:grouped', group: 'calc', icon: '🍓', mode: 'counting', subType: 'grouped', label: '群组倍增快数', tag: '🍓 乘法启蒙', sprintOk: true },
      { id: 'patterns:numeric', group: 'visual', icon: '🚂', mode: 'patterns', subType: 'numeric', label: '数字规律火车', tag: '🚂 逻辑归纳', sprintOk: true },
      { id: 'blocks:3d', group: 'visual', icon: '🧩', mode: 'blocks', subType: '3d', label: '3D遮挡数积木', tag: '🧩 空间推理', sprintOk: false },
      { id: 'clocks:time', group: 'visual', icon: '⏰', mode: 'clocks', subType: 'time', label: '钟表认读与推算', tag: '⏰ 时间认知', sprintOk: true }
    ];

    this.enabledSkillIds = new Set(this.curriculumCatalog.map(s => s.id));
    this.loadSettings();

    this.questionDeck = [];
    this.sprintDeck = [];
    this.mistakeReviewQueue = []; // [{ skillId, dueIn }]
    this.recentSignatures = [];   // 最近 32 道题的数字签名，杜绝重复出题
    this.currentSkill = null;
    this.lastSkillId = null;
    this.questionsSinceFactFamily = 99;
    this.currentQuestionHadMistake = false;

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
    this.initPWA();
    this.renderSettingsUI();
    this.updateStatsUI();
    this.startSmartAdventure();
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('kid_math_settings_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (['auto', '10', '20', '100'].includes(parsed.difficultySetting)) {
        this.difficultySetting = parsed.difficultySetting;
      }
      if (typeof parsed.parentLockEnabled === 'boolean') {
        this.parentLockEnabled = parsed.parentLockEnabled;
      }
      if (Array.isArray(parsed.enabledSkills)) {
        const validIds = new Set(this.curriculumCatalog.map(s => s.id));
        const filtered = parsed.enabledSkills.filter(id => validIds.has(id));
        if (filtered.length > 0) {
          this.enabledSkillIds = new Set(filtered);
        }
      }
    } catch (_) {}
  }

  saveSettings() {
    try {
      localStorage.setItem('kid_math_settings_v1', JSON.stringify({
        difficultySetting: this.difficultySetting,
        parentLockEnabled: this.parentLockEnabled,
        enabledSkills: Array.from(this.enabledSkillIds)
      }));
    } catch (_) {}
  }

  initDOMElements() {
    this.starCountEl = document.getElementById('star-count');
    this.streakCountEl = document.getElementById('streak-count');
    this.questionTextEl = document.getElementById('question-text');
    this.questionZoneEl = document.getElementById('question-zone');
    this.optionsZoneEl = document.getElementById('options-zone');
    this.feedbackZoneEl = document.getElementById('feedback-zone');
    this.mascotMsgEl = document.getElementById('mascot-message');
    this.smartStageBadgeEl = document.getElementById('smart-stage-badge');
    this.sprintToggleBtn = document.getElementById('sprint-toggle-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsModal = document.getElementById('settings-modal');
    this.parentGateModal = document.getElementById('parent-gate-modal');
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
    this.transitionSeq += 1;
    if (this.nextQuestionTimer) {
      clearTimeout(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
    if (this.questionSpeakTimer) {
      clearTimeout(this.questionSpeakTimer);
      this.questionSpeakTimer = null;
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

    // 顶栏 60秒极速冲刺 开关切换
    if (this.sprintToggleBtn) {
      this.sprintToggleBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        if (this.speedrunActive) {
          this.exitSpeedrunToSmart();
        } else {
          this.startSpeedrun();
        }
      });
    }

    // 顶栏 ⚙️ 设置 按钮
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        this.openSettingsRequest();
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
          '右上角设置里可以自由挑选想练的题型、难度和全屏模式！',
          '遇到难题别着急，用凑十法、破十法和透视镜试试看！',
          '每集齐 3 颗小金星，就能去扭蛋机抽一次神秘萌宠！'
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

    // 设置页内的「启蒙导学指南」入口
    const guideBtn = document.getElementById('parent-guide-btn');
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        if (this.settingsModal) this.settingsModal.classList.remove('active');
        if (this.parentGuideModal) this.parentGuideModal.classList.add('active');
      });
    }

    // 弹窗关闭按钮与遮罩背景点击关闭
    const handleModalDismiss = (modal) => {
      if (!modal) return;
      modal.classList.remove('active');
      if (modal.id === 'speedrun-summary-modal' && !this.speedrunActive) {
        this.exitSpeedrunToSmart();
      } else if (modal.id === 'settings-modal' && this.settingsChangedPending) {
        this.settingsChangedPending = false;
        this.generateQuestion();
      }
    };

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundManager.playPop();
        handleModalDismiss(btn.closest('.modal-overlay'));
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          window.soundManager.playPop();
          handleModalDismiss(overlay);
        }
      });
    });

    // 设置页底部「保存设置并出新题」按钮
    const applySettingsBtn = document.getElementById('settings-apply-btn');
    if (applySettingsBtn) {
      applySettingsBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        if (this.settingsModal) this.settingsModal.classList.remove('active');
        this.settingsChangedPending = false;
        this.generateQuestion();
      });
    }

    // 设置页难度档位卡片点击
    document.querySelectorAll('.settings-diff-card').forEach(card => {
      card.addEventListener('click', () => {
        window.soundManager.playPop();
        const diff = card.dataset.diff;
        if (['auto', '10', '20', '100'].includes(diff)) {
          this.difficultySetting = diff;
          this.settingsChangedPending = true;
          this.saveSettings();
          this.renderSettingsUI();
        }
      });
    });

    // 设置页题型快捷预设按钮点击
    document.querySelectorAll('.settings-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundManager.playPop();
        const preset = btn.dataset.preset;
        let targetIds = [];
        let tipMsg = '';
        if (preset === 'all') {
          targetIds = this.curriculumCatalog.map(s => s.id);
        } else if (preset === 'ktest') {
          targetIds = this.curriculumCatalog.filter(s => s.group === 'ktest').map(s => s.id);
        } else if (preset === 'calc') {
          targetIds = this.curriculumCatalog.filter(s => s.group === 'calc').map(s => s.id);
        } else if (preset === 'visual') {
          targetIds = this.curriculumCatalog.filter(s => s.group === 'visual').map(s => s.id);
        } else if (preset === 'single') {
          const keepId = (this.currentSkill && this.currentSkill.id) || this.curriculumCatalog[0].id;
          targetIds = [keepId];
          tipMsg = '🎯 已仅保留当前 1 项题型！你可直接保存单练，或继续勾选任意想练的题型';
        }
        if (targetIds.length > 0) {
          this.enabledSkillIds = new Set(targetIds);
          this.questionDeck = [];
          this.sprintDeck = [];
          this.settingsChangedPending = true;
          this.saveSettings();
          this.showSettingsTip(tipMsg);
          this.renderSettingsUI();
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

    // 设置页：音效、读题开关、语音角色切换、家长锁与全屏
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        const next = window.soundManager.setSoundEnabled(!window.soundManager.soundEnabled);
        if (next) window.soundManager.playPop();
        this.syncQuickSettingsTiles();
      });
    }

    const voiceToggle = document.getElementById('voice-toggle');
    if (voiceToggle) {
      voiceToggle.addEventListener('click', () => {
        window.soundManager.playPop();
        const nowEnabled = window.soundManager.setVoiceEnabled(!window.soundManager.voiceEnabled);
        this.syncQuickSettingsTiles();
        if (nowEnabled) {
          window.soundManager.speak('读题已开启！');
        } else {
          window.soundManager.stopSpeaking();
        }
      });
    }

    const voiceRoleBtn = document.getElementById('voice-role-btn');
    if (voiceRoleBtn) {
      voiceRoleBtn.addEventListener('click', () => {
        window.soundManager.playPop();
        window.soundManager.cycleVoice();
        this.syncQuickSettingsTiles();
      });
    }

    const parentLockToggle = document.getElementById('parent-lock-toggle');
    if (parentLockToggle) {
      parentLockToggle.addEventListener('click', () => {
        window.soundManager.playPop();
        this.parentLockEnabled = !this.parentLockEnabled;
        this.saveSettings();
        this.syncQuickSettingsTiles();
        this.showSettingsTip(
          this.parentLockEnabled
            ? '🔒 家长防改锁已开启：下次点设置需算一道乘法题解锁'
            : '🔓 家长防改锁已关闭'
        );
      });
    }

    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const syncFsState = () => this.syncQuickSettingsTiles();
    document.addEventListener('fullscreenchange', syncFsState);
    document.addEventListener('webkitfullscreenchange', syncFsState);

    if (fullscreenToggle) {
      fullscreenToggle.addEventListener('click', () => {
        window.soundManager.playPop();
        const docEl = document.documentElement;
        const reqFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (!reqFs) {
          if (this.settingsModal) this.settingsModal.classList.remove('active');
          const pwaModal = document.getElementById('pwa-install-modal');
          if (pwaModal) pwaModal.classList.add('active');
          return;
        }
        if (!fsEl) {
          Promise.resolve(reqFs.call(docEl)).then(syncFsState).catch(() => {
            if (this.settingsModal) this.settingsModal.classList.remove('active');
            const pwaModal = document.getElementById('pwa-install-modal');
            if (pwaModal) pwaModal.classList.add('active');
          });
        } else if (exitFs) {
          Promise.resolve(exitFs.call(document)).then(syncFsState).catch(() => {});
        }
      });
    }

    // 键盘快捷键支持 (数字键 1-4 选答案, R 重读题目, Escape 关闭弹窗)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => handleModalDismiss(m));
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

  // ================= 设置中心与家长锁逻辑 =================
  openSettingsRequest() {
    if (!this.parentLockEnabled) {
      this.openSettingsModal();
      return;
    }
    this.openParentGate();
  }

  openParentGate() {
    if (!this.parentGateModal) {
      this.openSettingsModal();
      return;
    }
    const f1 = Math.floor(Math.random() * 4) + 6; // 6 ~ 9
    const f2 = Math.floor(Math.random() * 4) + 6; // 6 ~ 9
    const ans = f1 * f2;
    const qEl = document.getElementById('parent-gate-question');
    const optsEl = document.getElementById('parent-gate-options');
    if (qEl) qEl.textContent = `${f1} × ${f2} = ?`;
    if (optsEl) {
      const set = new Set([ans, ans + f1, ans - f2, ans + 4, ans - 3]);
      const choices = Array.from(set).filter(n => n > 10).slice(0, 4).sort((a, b) => a - b);
      if (!choices.includes(ans)) choices[0] = ans;
      choices.sort((a, b) => a - b);
      optsEl.innerHTML = '';
      choices.forEach(val => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'candy-btn btn-secondary parent-gate-opt-btn';
        btn.textContent = val;
        btn.addEventListener('click', () => {
          if (val === ans) {
            window.soundManager.playCorrect();
            this.parentGateModal.classList.remove('active');
            this.openSettingsModal();
          } else {
            window.soundManager.playWrong();
            btn.classList.add('wobble');
            setTimeout(() => btn.classList.remove('wobble'), 450);
          }
        });
        optsEl.appendChild(btn);
      });
    }
    this.parentGateModal.classList.add('active');
  }

  openSettingsModal() {
    this.settingsChangedPending = false;
    this.showSettingsTip('');
    this.renderSettingsUI();
    if (this.settingsModal) {
      this.settingsModal.classList.add('active');
    }
  }

  showSettingsTip(msg) {
    const tipEl = document.getElementById('settings-tip-msg');
    if (!tipEl) return;
    if (!msg) {
      tipEl.style.display = 'none';
      tipEl.textContent = '';
    } else {
      tipEl.textContent = msg;
      tipEl.style.display = 'block';
    }
  }

  syncQuickSettingsTiles() {
    const soundTile = document.getElementById('sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    const soundLabel = document.getElementById('sound-label');
    if (soundTile) {
      const on = window.soundManager.soundEnabled;
      soundTile.classList.toggle('active', on);
      if (soundIcon) soundIcon.textContent = on ? '🔊' : '🔇';
      if (soundLabel) soundLabel.textContent = on ? '音效：开启' : '音效：静音';
    }

    const voiceTile = document.getElementById('voice-toggle');
    const voiceIcon = document.getElementById('voice-icon');
    const voiceLabel = document.getElementById('voice-label');
    if (voiceTile) {
      const on = window.soundManager.voiceEnabled;
      voiceTile.classList.toggle('active', on);
      if (voiceIcon) voiceIcon.textContent = on ? '🗣️' : '🤐';
      if (voiceLabel) voiceLabel.textContent = on ? '读题：开启' : '读题：关闭';
    }

    const roleIcon = document.getElementById('voice-role-icon');
    const roleLabel = document.getElementById('voice-role-label');
    if (roleLabel && window.soundManager.getActiveVoiceOption) {
      const opt = window.soundManager.getActiveVoiceOption();
      if (roleIcon && opt.emoji) roleIcon.textContent = opt.emoji;
      roleLabel.textContent = `音色：${opt.shortLabel || '默认'}`;
    }

    const lockTile = document.getElementById('parent-lock-toggle');
    const lockIcon = document.getElementById('parent-lock-icon');
    const lockLabel = document.getElementById('parent-lock-label');
    if (lockTile) {
      lockTile.classList.toggle('active', this.parentLockEnabled);
      if (lockIcon) lockIcon.textContent = this.parentLockEnabled ? '🔒' : '🔓';
      if (lockLabel) lockLabel.textContent = this.parentLockEnabled ? '家长锁：开启' : '家长锁：关闭';
    }

    const fsTile = document.getElementById('fullscreen-toggle');
    const fsLabel = document.getElementById('fullscreen-label');
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (fsTile) fsTile.classList.toggle('active', isFs);
    if (fsLabel) fsLabel.textContent = isFs ? '退出全屏' : '开启全屏';
  }

  renderSettingsUI() {
    this.syncQuickSettingsTiles();

    // 1. 难度档位高亮同步
    document.querySelectorAll('.settings-diff-card').forEach(card => {
      card.classList.toggle('active', card.dataset.diff === this.difficultySetting);
    });

    // 2. 题型数量统计
    const countEl = document.getElementById('settings-skill-count');
    if (countEl) {
      countEl.textContent = `已选 ${this.enabledSkillIds.size} / ${this.curriculumCatalog.length} 项`;
    }

    // 3. 分组渲染题型多选芯片
    const container = document.getElementById('settings-skills-container');
    if (!container) return;

    const groups = [
      { key: 'ktest', title: '🎓 K班测试核心真题（6项）' },
      { key: 'calc', title: '🧮 算术·凑十破十·天平·群数（7项）' },
      { key: 'visual', title: '🧩 规律火车·3D积木·奇妙时钟（3项）' }
    ];

    container.innerHTML = groups.map(grp => {
      const items = this.curriculumCatalog.filter(s => s.group === grp.key);
      const chipsHtml = items.map(skill => {
        const checked = this.enabledSkillIds.has(skill.id);
        return `
          <button type="button" class="settings-skill-chip ${checked ? 'checked' : ''}" data-skill-id="${skill.id}" data-no-tts="true">
            <span class="chip-check">${checked ? '✅' : '⬜'}</span>
            <span class="chip-icon">${skill.icon}</span>
            <span class="chip-name">${skill.label}</span>
          </button>
        `;
      }).join('');
      return `
        <div class="settings-skills-group">
          <div class="skills-group-label">${grp.title}</div>
          <div class="skills-group-chips">${chipsHtml}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.settings-skill-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.skillId;
        if (!id) return;
        if (this.enabledSkillIds.has(id)) {
          if (this.enabledSkillIds.size <= 1) {
            window.soundManager.playWrong();
            this.showSettingsTip('💡 至少需要保留 1 种出题题型哦！');
            return;
          }
          this.enabledSkillIds.delete(id);
        } else {
          this.enabledSkillIds.add(id);
        }
        window.soundManager.playPop();
        this.showSettingsTip('');
        this.questionDeck = [];
        this.sprintDeck = [];
        this.settingsChangedPending = true;
        this.saveSettings();
        this.renderSettingsUI();
      });
    });
  }

  startSmartAdventure() {
    this.speedrunActive = false;
    this.currentMode = 'smart';
    if (this.speedrunHud) this.speedrunHud.style.display = 'none';
    this.syncSprintButtonUI();
    this.setMascot('欢迎来到数学小王国！右上角「设置」可自由挑选想练的题型与难度哦！🦊');
    this.generateQuestion();
  }

  exitSpeedrunToSmart() {
    this.clearPendingTimers();
    if (this.speedrunTimer) {
      clearInterval(this.speedrunTimer);
      this.speedrunTimer = null;
    }
    this.speedrunActive = false;
    this.currentMode = 'smart';
    if (this.speedrunHud) this.speedrunHud.style.display = 'none';
    this.syncSprintButtonUI();
    this.setMascot('回到常规闯关模式！一步一个脚印攻克好题吧！🌟');
    this.generateQuestion();
  }

  syncSprintButtonUI() {
    if (!this.sprintToggleBtn) return;
    if (this.speedrunActive) {
      this.sprintToggleBtn.innerHTML = '<span>🎯 退出冲刺</span>';
      this.sprintToggleBtn.classList.add('active-sprint');
    } else {
      this.sprintToggleBtn.innerHTML = '<span>⚡ 60秒冲刺</span>';
      this.sprintToggleBtn.classList.remove('active-sprint');
    }
  }

  // Fisher-Yates 真随机洗牌算法
  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  getEnabledSkillsPool() {
    const pool = this.curriculumCatalog.filter(s => this.enabledSkillIds.has(s.id));
    return pool.length > 0 ? pool : [...this.curriculumCatalog];
  }

  // 记录当前题型出错，安排在 4 题后用全新数字进行错题巩固（队列上限 3 项，防堆积循环）
  scheduleMistakeReview() {
    if (this.currentQuestionHadMistake) return;
    this.currentQuestionHadMistake = true;
    if (!this.currentSkill) return;
    const skillId = this.currentSkill.id;
    const alreadyQueued = this.mistakeReviewQueue.some(item => item.skillId === skillId);
    if (!alreadyQueued && this.mistakeReviewQueue.length < 3) {
      this.mistakeReviewQueue.push({ skillId, dueIn: 4 });
    }
  }

  // 智能课程牌组抽题器（支持设置页单题型专练/任意组合多选、错题隔题巩固、洗牌全覆盖）
  pickNextSmartSkill(forSprint = false) {
    const enabledPool = this.getEnabledSkillsPool();

    if (forSprint) {
      this.sprintDeck = this.sprintDeck.filter(s => this.enabledSkillIds.has(s.id));
      if (this.sprintDeck.length === 0) {
        const sprintCandidates = enabledPool.filter(s => s.sprintOk);
        this.sprintDeck = this.shuffleArray(sprintCandidates.length > 0 ? sprintCandidates : enabledPool);
      }
      if (this.sprintDeck.length > 1 && this.sprintDeck[0].id === this.lastSkillId) {
        const swapIdx = 1 + Math.floor(Math.random() * (this.sprintDeck.length - 1));
        [this.sprintDeck[0], this.sprintDeck[swapIdx]] = [this.sprintDeck[swapIdx], this.sprintDeck[0]];
      }
      const chosen = this.sprintDeck.shift();
      this.lastSkillId = chosen.id;
      this.lastWasReview = false;
      return { skill: chosen, isReview: false };
    }

    // 若家长在设置页仅勾选了 1 种专项题型，直接专注练习该题型（由签名池保证数字不重样）
    if (enabledPool.length === 1) {
      const onlySkill = enabledPool[0];
      this.lastSkillId = onlySkill.id;
      this.lastWasReview = false;
      return { skill: onlySkill, isReview: false };
    }

    // 1. 递减错题巩固倒计时，绝不连续两题都是错题巩固，确保主线新题型顺畅推进
    this.mistakeReviewQueue = this.mistakeReviewQueue.filter(item => this.enabledSkillIds.has(item.skillId));
    this.mistakeReviewQueue.forEach(item => { item.dueIn -= 1; });
    if (!this.lastWasReview) {
      const dueIdx = this.mistakeReviewQueue.findIndex(
        item => item.dueIn <= 0 && item.skillId !== this.lastSkillId
      );
      if (dueIdx !== -1) {
        const [dueItem] = this.mistakeReviewQueue.splice(dueIdx, 1);
        const found = enabledPool.find(s => s.id === dueItem.skillId);
        if (found) {
          this.lastSkillId = found.id;
          this.lastWasReview = true;
          if (found.id === 'ktest:q3') this.questionsSinceFactFamily = 0;
          else this.questionsSinceFactFamily += 1;
          return { skill: found, isReview: true };
        }
      }
    }

    this.lastWasReview = false;

    // 2. 从已勾选的课程牌组中洗牌抽取
    this.questionDeck = this.questionDeck.filter(s => this.enabledSkillIds.has(s.id));
    if (this.questionDeck.length === 0) {
      this.questionDeck = this.shuffleArray(enabledPool);
    }

    // 避免相邻两题同款；若启用池 >= 4 项则让一图四式至少间隔 3 题
    const minFactGap = enabledPool.length >= 4 ? 3 : 1;
    const nonConflictIdx = this.questionDeck.findIndex(cand => {
      if (cand.id === this.lastSkillId) return false;
      if (cand.id === 'ktest:q3' && this.questionsSinceFactFamily < minFactGap) return false;
      return true;
    });

    let chosen;
    if (nonConflictIdx > 0) {
      [chosen] = this.questionDeck.splice(nonConflictIdx, 1);
    } else if (nonConflictIdx === 0) {
      chosen = this.questionDeck.shift();
    } else {
      // 当前剩余牌只有跟上一题相同的牌时，从 enabledPool 中挑一张不同的补充
      const altPool = enabledPool.filter(s => s.id !== this.lastSkillId);
      chosen = altPool.length > 0
        ? altPool[Math.floor(Math.random() * altPool.length)]
        : this.questionDeck.shift();
    }

    this.lastSkillId = chosen.id;
    if (chosen.id === 'ktest:q3') this.questionsSinceFactFamily = 0;
    else this.questionsSinceFactFamily += 1;
    return { skill: chosen, isReview: false };
  }

  updateSmartStageBadge(skill, isReview) {
    if (!this.smartStageBadgeEl || !skill) return;
    this.smartStageBadgeEl.classList.remove('tier-review', 'tier-master', 'tier-sprint');
    if (this.speedrunActive) {
      this.smartStageBadgeEl.classList.add('tier-sprint');
      this.smartStageBadgeEl.textContent = `⚡ 极速冲刺 · ${skill.label}`;
    } else if (isReview) {
      this.smartStageBadgeEl.classList.add('tier-review');
      this.smartStageBadgeEl.textContent = `💡 错题巩固 · ${skill.label}`;
    } else if (this.difficultySetting === '10') {
      this.smartStageBadgeEl.textContent = `🌱 基础热身 · ${skill.label}`;
    } else if (this.difficultySetting === '20') {
      this.smartStageBadgeEl.textContent = `🚀 进阶突破 · ${skill.label}`;
    } else if (this.difficultySetting === '100' || this.difficulty === '100') {
      this.smartStageBadgeEl.classList.add('tier-master');
      this.smartStageBadgeEl.textContent = `🔥 高阶挑战 · ${skill.label}`;
    } else {
      this.smartStageBadgeEl.textContent = `${skill.tag} · ${skill.label}`;
    }
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

  // ================= 核心智能自适应出题调度 =================
  generateQuestion() {
    this.clearPendingTimers();
    this.currentQuestionHadMistake = false;

    const { skill, isReview } = this.pickNextSmartSkill(this.speedrunActive);
    this.currentSkill = skill;

    // 依据设置页难度配置决定本道题实际难度档位
    if (this.difficultySetting === 'auto') {
      const forceHighTier = (
        skill.id === 'arithmetic:chain' ||
        skill.id === 'comparison:twodigit' ||
        skill.id === 'tenframes:break10' ||
        skill.id === 'counting:grouped'
      );
      this.difficulty = (forceHighTier || this.streak >= 3) ? '100' : '20';
    } else {
      this.difficulty = this.difficultySetting;
    }

    this.updateSmartStageBadge(skill, isReview);

    // 防重签名循环：若与最近 32 题数字完全一致则自动重新生成，保证题题新鲜
    let attempts = 0;
    let signature = '';
    do {
      attempts += 1;
      this.countedItems.clear();
      this.questionZoneEl.innerHTML = '';
      this.optionsZoneEl.innerHTML = '';
      this.optionsZoneEl.className = 'options-zone';
      this.feedbackZoneEl.innerHTML = '';
      this.feedbackZoneEl.className = 'feedback-zone';

      switch (skill.mode) {
        case 'counting':
          this.generateCountingQuestion(skill.subType);
          break;
        case 'comparison':
          this.generateComparisonQuestion(skill.subType);
          break;
        case 'arithmetic':
          this.generateArithmeticQuestion(skill.subType);
          break;
        case 'patterns':
          this.generatePatternQuestion(skill.subType);
          break;
        case 'tenframes':
          this.generateTenFrameQuestion(skill.subType);
          break;
        case 'clocks':
          this.generateClockQuestion(skill.subType);
          break;
        case 'blocks':
          this.generateBlocksQuestion(skill.subType);
          break;
        case 'ktest':
        default:
          this.generateKTestQuestion(skill.subType);
          break;
      }

      const titleKey = (this.questionTextEl.textContent || '').trim();
      const ansKey = this.currentQuestion ? String(this.currentQuestion.answer) : '';
      signature = `${skill.id}::${titleKey}::${ansKey}`;
    } while (attempts < 6 && this.recentSignatures.includes(signature));

    this.recentSignatures.push(signature);
    if (this.recentSignatures.length > 32) {
      this.recentSignatures.shift();
    }

    if (isReview && !this.speedrunActive) {
      this.setMascot(`💡 错题巩固：换组新数字再攻克一道「${skill.label}」吧！`);
    }

    if (!this.speedrunActive && this.currentQuestion && this.currentQuestion.audioPrompt) {
      const qSeq = this.transitionSeq;
      this.questionSpeakTimer = setTimeout(() => {
        if (!this.speedrunActive && this.currentQuestion && this.transitionSeq === qSeq) {
          window.soundManager.speak(this.currentQuestion.audioPrompt);
        }
      }, 220);
    }
  }

  // ================= 1. 群组倍增与带零头快数 (告别低幼逐个数，强化群计数与乘法前置) =================
  generateCountingQuestion() {
    const itemPool = Math.random() > 0.5 ? this.fruitEmojis : this.animalEmojis;
    const emoji = itemPool[Math.floor(Math.random() * itemPool.length)];

    // 70% 考察「满盒群组 + 盒外零头」(如 3盒×5个 + 3个 = 18)，30% 考察「等量多组乘法启蒙」(如 4盒×3个 = 12)
    const isEasy10 = this.difficulty === '10';
    const hasRemainder = Math.random() < (isEasy10 ? 0.5 : 0.7);
    const groupSizes = isEasy10
      ? [2, 3, 5]
      : (this.difficulty === '100' ? [3, 4, 5, 10] : [2, 3, 5]);
    const groupSize = groupSizes[Math.floor(Math.random() * groupSizes.length)];
    const numGroups = isEasy10
      ? (groupSize === 5 ? 2 : (Math.floor(Math.random() * 2) + 2)) // 2~3 盒温和热身
      : (groupSize === 10
          ? Math.floor(Math.random() * 3) + 2 // 2~4 盒十个装
          : Math.floor(Math.random() * 3) + 3); // 3~5 盒
    const remainder = hasRemainder ? (Math.floor(Math.random() * (groupSize - 1)) + 1) : 0;
    const total = groupSize * numGroups + remainder;

    const title = remainder > 0
      ? `群组快数：每满盒 ${groupSize} 个，有 ${numGroups} 满盒零 ${remainder} 个，一共多少个 ${emoji}？`
      : `群组快数：每盒 ${groupSize} 个，一共有 ${numGroups} 盒，合起来是多少个 ${emoji}？`;
    const audioPrompt = remainder > 0
      ? `每满盒 ${groupSize} 个，有 ${numGroups} 满盒加 ${remainder} 个零头，一共多少个？`
      : `每盒 ${groupSize} 个，一共 ${numGroups} 盒，合起来是多少个？`;

    this.currentQuestion = {
      answer: total,
      audioPrompt,
      trapValue: remainder > 0 ? groupSize * numGroups : undefined,
      trapHint: remainder > 0 ? `${groupSize * numGroups} 是前面 ${numGroups} 个满盒的数量哦，别忘了加上最后一盒里的 ${remainder} 个零头！` : null,
      shortTrapVoice: remainder > 0 ? '别忘加零头哦！' : null,
      type: 'counting'
    };

    this.questionTextEl.innerHTML = `<span>${title}</span> <span class="tip-sub">（点击盒子可累加报数）</span>`;

    const board = document.createElement('div');
    board.className = 'counting-board grouped-counting-board';

    let runningSum = 0;
    for (let g = 1; g <= numGroups; g++) {
      const groupBox = document.createElement('div');
      groupBox.className = 'counting-group-box';
      groupBox.innerHTML = `
        <span class="group-tag">满盒 ${g} (${groupSize}个)</span>
        <div class="group-items">${emoji.repeat(groupSize)}</div>
      `;
      groupBox.addEventListener('click', () => {
        if (!groupBox.classList.contains('counted')) {
          groupBox.classList.add('counted');
          runningSum += groupSize;
          window.soundManager.playPop();
          const badge = document.createElement('span');
          badge.className = 'count-bubble';
          badge.textContent = runningSum;
          groupBox.appendChild(badge);
          window.soundManager.speak(runningSum.toString());
        }
      });
      board.appendChild(groupBox);
    }

    if (remainder > 0) {
      const remBox = document.createElement('div');
      remBox.className = 'counting-group-box remainder-group-box';
      remBox.innerHTML = `
        <span class="group-tag">零头 (+${remainder}个)</span>
        <div class="group-items">${emoji.repeat(remainder)}</div>
      `;
      remBox.addEventListener('click', () => {
        if (!remBox.classList.contains('counted')) {
          remBox.classList.add('counted');
          runningSum += remainder;
          window.soundManager.playPop();
          const badge = document.createElement('span');
          badge.className = 'count-bubble';
          badge.textContent = runningSum;
          remBox.appendChild(badge);
          window.soundManager.speak(runningSum.toString());
        }
      });
      board.appendChild(remBox);
    }

    this.questionZoneEl.appendChild(board);

    const choices = new Set([total]);
    if (remainder > 0) choices.add(groupSize * numGroups);
    [total - groupSize, total + groupSize, total - 1, total + 1, total + 2].forEach(c => {
      if (c > 0 && choices.size < 4) choices.add(c);
    });
    const options = Array.from(choices).slice(0, 4).sort((a, b) => a - b);
    this.renderOptions(options, total);
  }

  // ================= 2. 天平比大小 (全算式双边对比 & 易混淆数位挑战，告别单数比大小) =================
  generateComparisonQuestion(subType = 'expr') {
    let leftExpr, rightExpr, leftVal, rightVal;

    if (this.difficulty === '10') {
      // 基础热身：10~15 以内温和算式或十几数位对比
      if (subType === 'twodigit') {
        const d1 = 1;
        const d2 = Math.floor(Math.random() * 5) + 2; // 2~6 -> 12 vs 21 或 10+X 对比
        if (Math.random() < 0.5) {
          leftVal = d1 * 10 + d2;
          rightVal = d2 * 10 + d1;
          leftExpr = `${leftVal}`;
          rightExpr = `${rightVal}`;
        } else {
          const ones = Math.floor(Math.random() * 5) + 2;
          leftVal = 10 + ones;
          leftExpr = `10 + ${ones}`;
          const delta = Math.random() < 0.34 ? 0 : (Math.random() > 0.5 ? 1 : -1);
          rightVal = Math.max(11, leftVal + delta);
          rightExpr = `${rightVal}`;
        }
      } else {
        const a1 = Math.floor(Math.random() * 5) + 2; // 2~6
        const b1 = Math.floor(Math.random() * (9 - a1)) + 2; // 保证和 <= 10
        leftVal = a1 + b1;
        leftExpr = `${a1} + ${b1}`;
        const delta = Math.random() < 0.32 ? 0 : (Math.random() > 0.5 ? 1 : -1);
        rightVal = Math.max(3, Math.min(10, leftVal + delta));
        const b2 = Math.floor(Math.random() * 3) + 1;
        rightExpr = rightVal + b2 <= 10 ? `${rightVal + b2} - ${b2}` : `${rightVal - 1} + 1`;
      }
    } else if (subType === 'twodigit' || (this.difficulty === '100' && Math.random() < 0.5)) {
      // 数位挑战：两位数加减对比 或 易混淆倒置数加减对比 (如 38 + 5 vs 48 - 5，或 47 vs 74)
      const variant = Math.floor(Math.random() * 3);
      if (variant === 0) {
        // 易混十位个位颠倒 + 微调算式 (如 47 vs 74 - 20 或 36 vs 63)
        const d1 = Math.floor(Math.random() * 6) + 2; // 2~7
        let d2 = Math.floor(Math.random() * 7) + 2;
        if (d1 === d2) d2 = (d2 % 8) + 1;
        leftVal = d1 * 10 + d2;
        rightVal = d2 * 10 + d1;
        leftExpr = `${leftVal}`;
        rightExpr = `${rightVal}`;
      } else if (variant === 1) {
        // 两位数加减整十对比 (如 36 + 20 vs 66 - 10)
        const base = (Math.floor(Math.random() * 4) + 2) * 10 + (Math.floor(Math.random() * 8) + 1);
        const step = (Math.floor(Math.random() * 3) + 1) * 10;
        leftVal = base + step;
        leftExpr = `${base} + ${step}`;
        const delta = Math.random() < 0.32 ? 0 : (Math.random() > 0.5 ? 10 : -10);
        rightVal = Math.max(12, leftVal + delta);
        const rAdd = 10;
        rightExpr = Math.random() > 0.5 ? `${rightVal + rAdd} - ${rAdd}` : `${rightVal - rAdd} + ${rAdd}`;
      } else {
        // 两位数进位加一位数 vs 两位数减一位数
        const tens = (Math.floor(Math.random() * 4) + 2) * 10;
        const o1 = Math.floor(Math.random() * 4) + 6; // 6~9
        const o2 = Math.floor(Math.random() * 5) + 4; // 4~8
        leftVal = tens + o1 + o2;
        leftExpr = `${tens + o1} + ${o2}`;
        const delta = Math.random() < 0.3 ? 0 : (Math.random() > 0.5 ? 1 : -1);
        rightVal = leftVal + delta;
        const sub = Math.floor(Math.random() * 5) + 3;
        rightExpr = `${rightVal + sub} - ${sub}`;
      }
    } else {
      // 20以内双算式硬核 PK：左右两边全是加减法算式，差值控制在 -2 ~ +2 之间，必须算准才能选对！
      const leftIsAdd = Math.random() < 0.55;
      if (leftIsAdd) {
        const a1 = Math.floor(Math.random() * 5) + 5; // 5~9
        const b1 = Math.floor(Math.random() * 6) + 4; // 4~9
        leftVal = a1 + b1;
        leftExpr = `${a1} + ${b1}`;
      } else {
        const a1 = Math.floor(Math.random() * 7) + 12; // 12~18
        const b1 = Math.floor(Math.random() * 6) + 4;  // 4~9
        leftVal = a1 - b1;
        leftExpr = `${a1} - ${b1}`;
      }

      const delta = Math.random() < 0.3 ? 0 : (Math.random() > 0.5 ? 1 : -1);
      rightVal = Math.max(4, leftVal + delta);

      const rightIsSub = leftIsAdd ? (Math.random() < 0.7) : (Math.random() < 0.4);
      if (rightIsSub) {
        const b2 = Math.floor(Math.random() * 5) + 3;
        const a2 = rightVal + b2;
        rightExpr = `${a2} - ${b2}`;
      } else {
        const a2 = Math.max(2, Math.floor(rightVal / 2) + (Math.random() > 0.5 ? 1 : -1));
        const b2 = rightVal - a2;
        rightExpr = `${a2} + ${b2}`;
      }
    }

    if (Math.random() > 0.5) {
      [leftExpr, rightExpr] = [rightExpr, leftExpr];
      [leftVal, rightVal] = [rightVal, leftVal];
    }

    let answerSymbol = '=';
    if (leftVal > rightVal) answerSymbol = '>';
    if (leftVal < rightVal) answerSymbol = '<';

    const audioPrompt = `算式天平挑战：先算出左边 ${leftExpr} 等于几，再算出右边 ${rightExpr} 等于几，比一比哪边更大呢？`;
    this.questionTextEl.innerHTML = `算式天平比大小：<span>先心算两边得数，再判断谁更大！</span>`;

    this.currentQuestion = {
      answer: answerSymbol,
      leftVal,
      rightVal,
      praiseText: `算得真准！左边 ${leftExpr} 等于 ${leftVal}，右边 ${rightExpr} 等于 ${rightVal}，所以选 ${answerSymbol === '=' ? '等于号' : (answerSymbol === '>' ? '左边更大' : '右边更大')}！`,
      audioPrompt,
      type: 'comparison'
    };

    const balanceBox = document.createElement('div');
    balanceBox.className = 'balance-container';
    balanceBox.id = 'balance-container';

    const leftPlate = document.createElement('div');
    leftPlate.className = 'scale-plate left-plate';
    leftPlate.innerHTML = `<div class="plate-expr">${leftExpr}</div>`;
    leftPlate.addEventListener('click', () => {
      window.soundManager.playPop();
      window.soundManager.speak(`左边算式是 ${leftExpr}`);
    });

    const midSymbol = document.createElement('div');
    midSymbol.className = 'scale-middle';
    midSymbol.id = 'scale-alligator';
    midSymbol.innerHTML = `<div class="mystery-box">❓</div>`;

    const rightPlate = document.createElement('div');
    rightPlate.className = 'scale-plate right-plate';
    rightPlate.innerHTML = `<div class="plate-expr">${rightExpr}</div>`;
    rightPlate.addEventListener('click', () => {
      window.soundManager.playPop();
      window.soundManager.speak(`右边算式是 ${rightExpr}`);
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

  // ================= 3. 高阶算术挑战 (逆向未知数填空、进退位、连加连减与两位数运算) =================
  generateArithmeticQuestion(subType = 'blank') {
    let promptHtml, audioText, answer, strategyTip = '';
    let trapValue, trapHint, shortTrapVoice;
    const isEasy10 = this.difficulty === '10';

    if (subType === 'blank') {
      // 4种逆向未知数填空：A + ? = C、? + B = C、C - ? = A、? - B = A
      const form = Math.floor(Math.random() * 4);
      let a, b, c;
      if (isEasy10) {
        a = Math.floor(Math.random() * 5) + 2; // 2~6
        b = Math.floor(Math.random() * (9 - a)) + 2; // c ∈ [4, 10]
        c = a + b;
      } else {
        a = Math.floor(Math.random() * 5) + 5; // 5~9
        const minB = Math.max(3, 11 - a);
        b = Math.floor(Math.random() * (9 - minB + 1)) + minB; // 保证进退位 c ∈ [11, 18]
        c = a + b;
      }
      const need10 = 10 - a;
      const leftOver = b - need10;

      if (form === 0) {
        // a + ? = c
        answer = b;
        promptHtml = `${a} + <span class="blank-box">?</span> = ${c}`;
        audioText = `${a} 加几等于 ${c}？`;
        strategyTip = isEasy10
          ? `💡 逆向思考：总数是 ${c}，算算 ${c} - ${a} 就知道填几啦！`
          : `💡 凑十逆推：${a} 加 ${need10} 到 10，10 再加 ${leftOver} 到 ${c}，一共加了几个？`;
      } else if (form === 1) {
        // ? + b = c
        answer = a;
        promptHtml = `<span class="blank-box">?</span> + ${b} = ${c}`;
        audioText = `几加上 ${b} 等于 ${c}？`;
        strategyTip = `💡 逆向秘诀：总数是 ${c}，用 ${c} 减去 ${b} 就能找到方格里的数啦！`;
      } else if (form === 2) {
        // c - ? = a
        answer = b;
        promptHtml = `${c} - <span class="blank-box">?</span> = ${a}`;
        audioText = `${c} 减去几等于 ${a}？`;
        strategyTip = `💡 想一想：共有 ${c} 个，拿走多少个才会剩下 ${a} 个呢？`;
      } else {
        // ? - b = a （高频易错题：孩子容易算成 b - a 或 a - b，实际应为 a + b！）
        answer = c;
        promptHtml = `<span class="blank-box">?</span> - ${b} = ${a}`;
        audioText = `几减去 ${b} 还剩 ${a}？注意方格是总数哦！`;
        strategyTip = `💡 防坑妙招：被减数在最前面最大！拿走的 ${b} 和剩下的 ${a} 合起来才是原来的总数！`;
        if (Math.abs(a - b) > 0) {
          trapValue = Math.abs(a - b);
          trapHint = `小心陷阱哦！方格在减号最前面，拿走 ${b} 个还剩 ${a} 个，原来的总数要比 ${b} 和 ${a} 都大，应该算 ${a} 加 ${b} 哦！`;
          shortTrapVoice = '被减数要把两数相加！';
        }
      }
    } else if (isEasy10) {
      // 基础热身：10以内温和连加连减与两步加减
      const qKind = Math.floor(Math.random() * 3);
      if (qKind === 0) {
        const start = Math.floor(Math.random() * 4) + 7; // 7~10
        const sub = Math.floor(Math.random() * 3) + 2;   // 2~4
        const mid = start - sub;
        const add = Math.floor(Math.random() * 3) + 2;   // 2~4
        answer = mid + add;
        promptHtml = `${start} - ${sub} + ${add} = ?`;
        audioText = `${start} 减 ${sub} 再加 ${add} 等于几？`;
        strategyTip = `💡 分步心算：先算 ${start} - ${sub} = ${mid}，再加 ${add}！`;
        trapValue = mid;
        trapHint = `${mid} 只是第一步的得数哦，后面还要再加上 ${add} 呢！`;
        shortTrapVoice = '还要算第二步哦！';
      } else if (qKind === 1) {
        const a = Math.floor(Math.random() * 4) + 3; // 3~6
        const b = Math.floor(Math.random() * 3) + 2; // 2~4
        const mid = a + b;
        const c = Math.floor(Math.random() * 3) + 2; // 2~4
        answer = mid - c;
        promptHtml = `${a} + ${b} - ${c} = ?`;
        audioText = `${a} 加 ${b} 再减 ${c} 等于几？`;
        strategyTip = `💡 分步心算：先算 ${a} + ${b} = ${mid}，再减去 ${c}！`;
        trapValue = mid;
        trapHint = `${mid} 是前两个数相加的得数哦，还要减去后面的 ${c}！`;
        shortTrapVoice = '还要算第二步哦！';
      } else {
        const ans = Math.floor(Math.random() * 4) + 2;
        const s1 = Math.floor(Math.random() * 3) + 2;
        const s2 = Math.floor(Math.random() * 2) + 2;
        const total = ans + s1 + s2;
        answer = ans;
        promptHtml = `${total} - ${s1} - ${s2} = ?`;
        audioText = `${total} 减 ${s1} 再减 ${s2} 等于几？`;
        strategyTip = `💡 分步计算：先算 ${total} - ${s1}，再减去 ${s2}！`;
      }
    } else {
      // 高阶连加连减 / 加减混合 与 两位数进退位运算
      const qKind = this.difficulty === '20' ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 4);
      if (qKind === 0) {
        // 加减混合：如 14 - 6 + 5 = ?
        const start = Math.floor(Math.random() * 6) + 12; // 12~17
        const sub = Math.floor(Math.random() * 5) + 5;    // 5~9
        const mid = start - sub;
        const add = Math.floor(Math.random() * 6) + 4;    // 4~9
        answer = mid + add;
        promptHtml = `${start} - ${sub} + ${add} = ?`;
        audioText = `${start} 减 ${sub} 再加 ${add} 等于几？`;
        strategyTip = `💡 分步心算：第一步先算 ${start} - ${sub} = ?，第二步再加上 ${add}！`;
        trapValue = mid;
        trapHint = `${mid} 只是第一步 ${start} 减 ${sub} 的得数哦，后面还要再加上 ${add} 呢！`;
        shortTrapVoice = '还要算第二步哦！';
      } else if (qKind === 1) {
        // 先加后减混合：如 8 + 7 - 6 = ?
        const a = Math.floor(Math.random() * 4) + 6; // 6~9
        const b = Math.floor(Math.random() * 4) + 5; // 5~8
        const mid = a + b;
        const c = Math.floor(Math.random() * 6) + 4; // 4~9
        answer = mid - c;
        promptHtml = `${a} + ${b} - ${c} = ?`;
        audioText = `${a} 加 ${b} 再减 ${c} 等于几？`;
        strategyTip = `💡 分步心算：先算 ${a} + ${b} 凑十得多少，再减去 ${c}！`;
        trapValue = mid;
        trapHint = `${mid} 是前两个数相加的得数哦，别忘了还要减去后面的 ${c}！`;
        shortTrapVoice = '还要算第二步哦！';
      } else if (qKind === 3) {
        // 两位数进位加一位数：如 27 + 6 = 33 (仅 100 高阶模式触发)
        const tens = (Math.floor(Math.random() * 5) + 2) * 10; // 20~60
        const ones = Math.floor(Math.random() * 4) + 6;        // 6~9
        const addOne = Math.floor(Math.random() * 5) + 4;      // 4~8 (保证个位满十进位)
        const baseNum = tens + ones;
        answer = baseNum + addOne;
        promptHtml = `${baseNum} + ${addOne} = ?`;
        audioText = `${baseNum} 加 ${addOne} 等于几？`;
        strategyTip = `💡 满十进一：个位 ${ones} + ${addOne} = ${ones + addOne} 满十啦，十位要多加 1 个十！`;
        trapValue = tens + ((ones + addOne) % 10); // 忘记进位的典型错答
        trapHint = `个位 ${ones} 加 ${addOne} 等于 ${ones + addOne}，已经满十进一啦，十位应该变成 ${(tens / 10) + 1} 个十哦！`;
        shortTrapVoice = '注意个位满十进一！';
      } else {
        // 连减挑战：如 17 - 5 - 4 = 8
        const ans = Math.floor(Math.random() * 6) + 4;
        const s1 = Math.floor(Math.random() * 4) + 3;
        const s2 = Math.floor(Math.random() * 4) + 3;
        const total = ans + s1 + s2;
        answer = ans;
        promptHtml = `${total} - ${s1} - ${s2} = ?`;
        audioText = `${total} 先减 ${s1} 再减 ${s2}，还剩几？`;
        strategyTip = `💡 巧算秘诀：可以先算 ${total} - ${s1}，也可以把减去的 ${s1} 和 ${s2} 先合起来一共拿走 ${s1 + s2}！`;
      }
    }

    this.questionTextEl.innerHTML = `高阶算术挑战：<span>开动脑筋算出正确答案吧！</span>`;
    this.currentQuestion = {
      answer,
      trapValue,
      trapHint,
      shortTrapVoice,
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

    const optSet = new Set([answer]);
    if (trapValue !== undefined && trapValue >= 0 && trapValue !== answer) {
      optSet.add(trapValue);
    }
    const minChoice = Math.max(1, answer - 3);
    const baseOpts = this.generateChoices(answer, minChoice, answer + 4, 4);
    baseOpts.forEach(o => { if (optSet.size < 4) optSet.add(o); });
    const finalOptions = Array.from(optSet).slice(0, 4).sort((x, y) => x - y);
    this.renderOptions(finalOptions, answer);
  }

  // ================= 4. 规律小火车 (全数字推理：等差跳数、逆向倒数、中间缺项与递增阶梯) =================
  generatePatternQuestion() {
    let fullSeq = [];
    let descText = '';
    const isEasy10 = this.difficulty === '10';
    const patternKind = isEasy10
      ? (Math.random() < 0.65 ? 0 : 1)
      : (this.difficulty === '20' ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 4));

    if (patternKind === 0) {
      // 等差递增跳数
      const step = isEasy10
        ? [1, 2][Math.floor(Math.random() * 2)]
        : [3, 4, 5, 6][Math.floor(Math.random() * 4)];
      const start = isEasy10
        ? Math.floor(Math.random() * 5) + 1
        : Math.floor(Math.random() * 6) + 2;
      fullSeq = [start, start + step, start + step * 2, start + step * 3, start + step * 4];
      descText = `等差递增规律：观察相邻车厢每次增加几，找出问号车厢的数字！`;
    } else if (patternKind === 1) {
      // 逆向等差递减倒数
      const step = isEasy10
        ? [1, 2][Math.floor(Math.random() * 2)]
        : [2, 3, 4, 5][Math.floor(Math.random() * 4)];
      const last = isEasy10
        ? Math.floor(Math.random() * 4) + 1
        : Math.floor(Math.random() * 6) + 3;
      const start = last + step * 4;
      fullSeq = [start, start - step, start - step * 2, start - step * 3, start - step * 4];
      descText = `逆向递减规律：数字越来越小，算算每次减少几？`;
    } else if (patternKind === 2) {
      // 二阶递增差值规律：依次 +1, +2, +3, +4 (如 2, 3, 5, 8, 12, 17)
      const start = Math.floor(Math.random() * 5) + 1;
      fullSeq = [start, start + 1, start + 3, start + 6, start + 10, start + 15];
      descText = `阶梯差值规律（相邻差依次是 +1, +2, +3, +4, +5）：问号填几？`;
    } else {
      // 整十或大跨度规律 (如 15, 25, 35, 45, 55)
      const ones = Math.floor(Math.random() * 8) + 1;
      const startTen = Math.floor(Math.random() * 4) + 1;
      fullSeq = [0, 1, 2, 3, 4].map(i => (startTen + i) * 10 + ones);
      descText = `十位递增规律：仔细观察十位和个位的变化，问号填几？`;
    }

    // 45% 概率挖空中间第3/第4节车厢（双向验证），55% 概率挖空最后一节车厢
    const hideMiddle = patternKind !== 2 && Math.random() < 0.45;
    const missingIdx = hideMiddle ? (Math.random() < 0.5 ? 2 : 3) : (fullSeq.length - 1);
    const answer = fullSeq[missingIdx];
    const sequence = fullSeq.map((v, idx) => (idx === missingIdx ? '?' : v));

    this.questionTextEl.innerHTML = `数字规律火车：<span>${descText}</span>`;
    const audioPrompt = hideMiddle
      ? `找规律挑战：观察前后车厢的数字变化规律，中间带问号的车厢应该装数字几呢？`
      : `找规律挑战：观察小火车车厢的数字变化规律，最后一节车厢应该装数字几呢？`;

    this.currentQuestion = {
      answer,
      audioPrompt,
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

    const options = this.generateChoices(answer, Math.max(1, answer - 5), answer + 6, 4);
    this.renderOptions(options, answer);
  }

  // ================= 5. 十格阵凑十与破十 (全双盒进退位与逆向补数，告别单盒低幼补10) =================
  generateTenFrameQuestion(subType = 'make10') {
    const isEasy10 = this.difficulty === '10';
    if (subType === 'make10') {
      // 双盒凑十进位求和 或 双盒逆向补数
      const num1 = isEasy10
        ? Math.floor(Math.random() * 3) + 7 // 7, 8, 9
        : Math.floor(Math.random() * 4) + 6; // 6, 7, 8, 9
      const minNum2 = 11 - num1;
      const maxNum2 = isEasy10 ? Math.min(6, 13 - num1) : 9;
      const num2 = Math.floor(Math.random() * Math.max(1, maxNum2 - minNum2 + 1)) + minNum2;
      const needToMake10 = 10 - num1;
      const remain = num2 - needToMake10;
      const total = num1 + num2;

      const askMissingAddend = !isEasy10 && Math.random() < 0.45;

      if (askMissingAddend) {
        this.questionTextEl.innerHTML = `十格阵逆向推理：<span>第一盒已有 ${num1} 个 🔴，还要添几个 🟡 才能凑够 ${total} 个？</span>`;
        const audioPrompt = `第一盒有 ${num1} 个红点，还要添几个黄点才是 ${total} 个？`;

        this.currentQuestion = {
          answer: num2,
          audioPrompt,
          trapValue: needToMake10,
          trapHint: `添上 ${needToMake10} 个只是刚把第一盒凑满 10 个哦！题目要凑够 ${total} 个，第二盒里还要再放 ${remain} 个，一共要添 ${needToMake10} 加 ${remain} 个！`,
          shortTrapVoice: '还要加第二盒的个数哦！',
          type: 'tenframe'
        };

        const container = document.createElement('div');
        container.className = 'dual-ten-frame-wrapper';
        container.innerHTML = `
          <div class="ten-frame-box">
            <div class="frame-label">第一盒 (已有 ${num1} 个 🔴，差 ${needToMake10} 个满 10)</div>
            <div class="ten-frame">
              ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot ${i < num1 ? '' : 'empty-dot'}">${i < num1 ? '🔴' : '⚪'}</span></div>`).join('')}
            </div>
          </div>
          <div class="frame-plus">➕</div>
          <div class="ten-frame-box">
            <div class="frame-label">目标总数 ${total} (10 之外还需 ${remain} 个)</div>
            <div class="ten-frame">
              ${Array.from({length: 10}, (_, i) => `<div class="ten-frame-cell"><span class="ten-dot empty-dot">${i < remain ? '❔' : '⚪'}</span></div>`).join('')}
            </div>
          </div>
        `;
        this.questionZoneEl.appendChild(container);
        const opts = new Set([num2, needToMake10]);
        this.generateChoices(num2, 2, 9, 4).forEach(v => { if (opts.size < 4) opts.add(v); });
        this.renderOptions(Array.from(opts).slice(0, 4).sort((a, b) => a - b), num2);
        return;
      }

      this.questionTextEl.innerHTML = `十格阵凑十法：<span>${num1} + ${num2} = ?</span> <span class="tip-sub">（先凑满第一盒10个，再加剩下的）</span>`;
      const audioPrompt = `${num1} 加 ${num2}，把第二盒分出 ${needToMake10} 个凑满第一盒的 10，合起来是多少？`;

      this.currentQuestion = {
        answer: total,
        audioPrompt,
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
              <div class="frame-label">✨ 第二盒还剩 ${remain} 个 🟡 (10 + ${remain} = ?)</div>
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
      magicBtn.innerHTML = `✨ 点击演示“凑十魔法”（移 ${needToMake10} 个 🟡 填满第一盒）`;
      magicBtn.addEventListener('click', () => {
        mergedState = !mergedState;
        window.soundManager.playMagic();
        renderFrames(mergedState);
        magicBtn.innerHTML = mergedState
          ? `🔄 还原初始点阵 (${num1} + ${num2})`
          : `✨ 点击演示“凑十魔法”（移 ${needToMake10} 个 🟡 填满第一盒）`;
      });

      outer.appendChild(container);
      outer.appendChild(magicBtn);
      this.questionZoneEl.appendChild(outer);

      const options = this.generateChoices(total, 11, 18, 4);
      this.renderOptions(options, total);

    } else {
      // 破十法挑战：20以内退位减法的十格阵直观拆解 (如 14 - 6 = 8)
      const total = isEasy10
        ? Math.floor(Math.random() * 3) + 11 // 11~13
        : Math.floor(Math.random() * 7) + 11; // 11~17
      const ones = total - 10;
      const minSub = ones + 1; // 确保个位不够减，必须破十
      const maxSub = isEasy10 ? Math.min(7, minSub + 3) : 9;
      const sub = Math.floor(Math.random() * Math.max(1, maxSub - minSub + 1)) + minSub;
      const remainInTen = 10 - sub;
      const answer = total - sub;

      this.questionTextEl.innerHTML = `十格阵破十法：<span>${total} - ${sub} = ?</span> <span class="tip-sub">（先从满10里拿走${sub}个，再加第二盒零头）</span>`;
      const audioPrompt = `${total} 减 ${sub}，先用 10 减 ${sub} 剩 ${remainInTen}，再加 ${ones} 等于几？`;

      this.currentQuestion = {
        answer,
        trapValue: remainInTen,
        trapHint: `${remainInTen} 是第一盒 10 拿走 ${sub} 之后剩下的个数哦，别忘了还要加上第二盒里的 ${ones} 个黄圆点！`,
        shortTrapVoice: '别忘加第二盒零头！',
        audioPrompt,
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
          <div class="frame-label">第二盒 (零头还有 ${ones} 个 🟡)</div>
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
      const optSet = new Set([answer, remainInTen]);
      this.generateChoices(answer, 2, 9, 4).forEach(v => { if (optSet.size < 4) optSet.add(v); });
      this.renderOptions(Array.from(optSet).slice(0, 4).sort((a, b) => a - b), answer);
    }
  }

  // ================= 6. 奇妙时钟岛 (半点、一刻/三刻、5分刻度 & 1小时/半小时时间推算) =================
  generateClockQuestion() {
    const isEasy10 = this.difficulty === '10';
    let hour = Math.floor(Math.random() * 12) + 1; // 1~12
    const minutesPool = isEasy10
      ? [0, 30]
      : (this.difficulty === '100'
          ? [15, 30, 45, 5, 10, 20, 25, 35, 40, 50]
          : [30, 15, 45, 0, 10, 20, 40, 50]);
    let minute = minutesPool[Math.floor(Math.random() * minutesPool.length)];
    if (minute === this.lastClockMinute && minutesPool.length > 1) {
      minute = minutesPool[(minutesPool.indexOf(minute) + 1) % minutesPool.length];
    }
    this.lastClockMinute = minute;

    // 进阶/高阶下升级为「时间推算应用题」；基础热身仅考察直接认读整点与半点
    const askElapsed = !isEasy10 && (minute === 0 || minute === 30) && Math.random() < 0.55;
    let ansHour = hour;
    let ansMinute = minute;
    let title = '';
    let audioPrompt = '';
    let praiseOverride = null;
    let trapValue = undefined;
    let trapHint = null;
    let shortTrapVoice = null;

    const curMinStr = minute < 10 ? `0${minute}` : `${minute}`;
    const curTimeStr = `${hour}:${curMinStr}`;

    if (askElapsed) {
      const elapsedType = Math.floor(Math.random() * 3); // 0: 再过1小时, 1: 1小时前, 2: 再过半小时(30分钟)
      if (elapsedType === 0) {
        ansHour = (hour % 12) + 1;
        title = `时间推算：钟面现在的时间【再过 1 小时】是几点？`;
        audioPrompt = `看钟面想一想：再过 1 个小时是几点？`;
      } else if (elapsedType === 1) {
        ansHour = ((hour - 2 + 12) % 12) + 1;
        title = `时间推算：钟面现在的时间【1 小时前】是几点？`;
        audioPrompt = `看钟面倒推一下：1 个小时前是几点？`;
      } else {
        const totalMins = (hour % 12) * 60 + minute + 30;
        ansHour = Math.floor(totalMins / 60) % 12 || 12;
        ansMinute = totalMins % 60;
        title = `时间推算：钟面现在的时间【再过半小时(30分)】是几点？`;
        audioPrompt = `看钟面想一想：再过 30 分钟是几点几分？`;
      }
      const ansMinStr = ansMinute < 10 ? `0${ansMinute}` : `${ansMinute}`;
      const targetStr = `${ansHour}:${ansMinStr}`;
      trapValue = curTimeStr;
      trapHint = `${curTimeStr} 是钟面上现在显示的时间哦！仔细听题目问的是变化之后的时间，再推算一步吧！`;
      shortTrapVoice = '要算变化后的时间哦！';
      praiseOverride = `时间推算满分！钟面现在是 ${curTimeStr}，推算后正好是 ${targetStr}！`;
    } else {
      title = `认读时钟：仔细看时针与分针，现在是几点几分？`;
      audioPrompt = minute === 0
        ? `长分针指着12是整点，现在是几点整？`
        : (minute === 30
            ? `长分针指在6代表30分，现在是几点半？`
            : `长分针每大格5分钟，现在是几点几分？`);
    }

    const ansMinStr = ansMinute < 10 ? `0${ansMinute}` : ansMinute.toString();
    const correctTimeStr = `${ansHour}:${ansMinStr}`;

    this.currentQuestion = {
      answer: correctTimeStr,
      hour: ansHour,
      minute: ansMinute,
      praiseText: praiseOverride,
      trapValue,
      trapHint,
      shortTrapVoice,
      audioPrompt,
      type: 'clock'
    };

    this.questionTextEl.innerHTML = `<span>${title}</span> <span class="tip-sub">（点击表盘可听读表提示）</span>`;

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

    let minuteRingHtml = '';
    for (let m = 0; m < 60; m += 15) {
      const angle = (m * 6 - 90) * (Math.PI / 180);
      const r = 82;
      const x = 100 + r * Math.cos(angle);
      const y = 100 + r * Math.sin(angle) + 3;
      const lbl = m === 0 ? '00' : m.toString();
      minuteRingHtml += `<text x="${x}" y="${y}" class="clock-min-num" text-anchor="middle">${lbl}</text>`;
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
        <span class="legend-minute">🟥 长针看几分 (1大格=5分)</span>
      </div>
    `;

    const svgEl = clockContainer.querySelector('.analog-clock-svg');
    if (svgEl) {
      svgEl.style.cursor = 'pointer';
      svgEl.addEventListener('click', () => {
        window.soundManager.playTick();
        const hintMsg = minute === 0
          ? `长长的红分针指着12代表整点，蓝色的短时针指着 ${hour}！`
          : `红色的长分针指在数字 ${minute / 5} 上，${minute / 5} 乘 5 等于 ${minute} 分！`;
        this.setMascot(hintMsg);
        window.soundManager.speak(hintMsg);
      });
    }

    this.questionZoneEl.appendChild(clockContainer);

    const choices = new Set([correctTimeStr]);
    if (trapValue && trapValue !== correctTimeStr) {
      choices.add(trapValue);
    }
    const nextH = (ansHour % 12) + 1;
    const prevH = ((ansHour - 2 + 12) % 12) + 1;
    choices.add(`${nextH}:${ansMinStr}`);
    if (choices.size < 4) choices.add(`${prevH}:${ansMinStr}`);

    const altMins = [0, 15, 30, 45, 10, 20, 40, 50].filter(m => m !== ansMinute);
    for (const m of altMins) {
      if (choices.size >= 4) break;
      const mStr = m < 10 ? `0${m}` : `${m}`;
      choices.add(`${ansHour}:${mStr}`);
    }

    const toClockSortVal = (str) => {
      const [hh, mm] = str.split(':').map(Number);
      return hh * 60 + mm;
    };
    const options = Array.from(choices).slice(0, 4).sort((a, b) => toClockSortVal(a) - toClockSortVal(b));
    this.renderOptions(options, correctTimeStr);
  }

  // ================= 7. 空间数积木 (全多层遮挡立体结构 8~14块 + 360°旋转与头顶标数法) =================
  generateBlocksQuestion() {
    this.xrayActive = false;

    let grid = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    let totalBlocks = 0;

    if (this.difficulty === '10') {
      // 基础热身：5~7 块温和双层积木结构，建立遮挡直觉
      const targetCount = Math.floor(Math.random() * 3) + 5; // 5, 6, 7
      grid[0][0] = 2;
      grid[0][1] = 2;
      grid[1][0] = 1;
      let placed = 5;
      const coords = [
        [0, 2], [1, 1], [1, 2], [2, 0], [2, 1]
      ].sort(() => 0.5 - Math.random());
      for (const [r, c] of coords) {
        if (placed >= targetCount) break;
        grid[r][c] = 1;
        placed += 1;
      }
      totalBlocks = placed;
    } else if (this.difficulty === '20') {
      // 进阶：8~10 块，必含后排高柱遮挡底层隐藏块
      const targetCount = Math.floor(Math.random() * 3) + 8; // 8, 9, 10
      grid[0][0] = 3;
      grid[0][1] = 2;
      grid[1][1] = 2;
      let placed = 7;

      const coords = [
        [0,2], [1,0], [1,2], [2,0], [2,1], [2,2]
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
    } else {
      // 高阶挑战：11~15 块，3层立体阶梯建筑，考验柱体标数法累加
      const targetCount = Math.floor(Math.random() * 5) + 11; // 11~15
      grid[0][0] = 3;
      grid[0][1] = 3;
      grid[1][0] = 2;
      grid[1][1] = 2;
      let placed = 10;

      const coords = [
        [0,2], [1,2], [2,0], [2,1], [2,2]
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

    this.questionTextEl.innerHTML = `空间数积木：<span>连同藏在下面的积木，一共有多少块？</span> <span class="tip-sub">（👆 按住可 360° 旋转视角）</span>`;
    const audioPrompt = `空间推理挑战：注意被压在底下的隐藏积木也要算进去哦！按住可以自由旋转观察，算算一共有多少块积木？`;

    this.currentQuestion = {
      answer: totalBlocks,
      audioPrompt,
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
      cssW = Math.max(200, Math.round(rect.width || 340));
      cssH = Math.max(120, Math.round(rect.height || 200));
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

  // ================= 8. K班数学测试真题特训 (无缝接入智能课程牌组，隐藏手动题型胶囊) =================
  generateKTestQuestion(forcedSubType = null) {
    const stage = document.createElement('div');
    stage.className = 'ktest-stage-wrap';

    let chosenType = forcedSubType;
    if (!chosenType || chosenType === 'all') {
      const allTypes = ['q1', 'q2', 'q3', 'q4', 'q5a', 'q5b'];
      const candidates = this.lastKTestType
        ? allTypes.filter(t => t !== this.lastKTestType)
        : allTypes;
      chosenType = candidates[Math.floor(Math.random() * candidates.length)];
    }
    this.lastKTestType = chosenType;

    this.questionZoneEl.appendChild(stage);

    switch (chosenType) {
      case 'q1':
        this.buildKTestQ1MakeTenBond(stage);
        break;
      case 'q2':
        this.buildKTestQ2ChainedBonds(stage);
        break;
      case 'q3':
        this.buildKTestQ3FactFamily(stage);
        break;
      case 'q4':
        this.buildKTestQ4NumberTowers(stage);
        break;
      case 'q5a':
        this.buildKTestQ5Challenge(stage, 'q5a');
        break;
      case 'q5b':
      case 'q5':
      default:
        this.buildKTestQ5Challenge(stage, chosenType === 'q5b' ? 'q5b' : null);
        break;
    }
  }

  // 真题题型 1: 凑十数键分支图 (如 8 + 7 = 15，7 拆成 2 和 5；轮流考察拆分数与总和)
  buildKTestQ1MakeTenBond(stage) {
    const isEasy10 = this.difficulty === '10';
    const aPool = isEasy10 ? [9, 8] : [9, 8, 7, 6];
    const a = aPool[Math.floor(Math.random() * aPool.length)];
    const needForTen = 10 - a;
    const minB = needForTen + (isEasy10 ? 1 : 2);
    const maxB = isEasy10 ? Math.min(6, minB + 3) : 9;
    const b = Math.floor(Math.random() * Math.max(1, maxB - minB + 1)) + minB;
    const rem = b - needForTen;
    const total = a + b;

    // 三种问法轮换：① 问右边剩余圆圈 rem (38%)、② 问左边凑十圆圈 needForTen (24%)、③ 问最终总和 total (38%)
    const roll = Math.random();
    const askMode = roll < 0.38 ? 'rem' : (roll < 0.62 ? 'need' : 'total');
    const correctAnswer = askMode === 'rem' ? rem : (askMode === 'need' ? needForTen : total);

    let titleZh, audioPrompt, helperFormulaHtml, trapValue, trapHint, shortTrapVoice;
    if (askMode === 'rem') {
      titleZh = `凑十数键：${a} 需要 ${needForTen} 凑成 10，那 ${b} 可以分成 ${needForTen} 和几？`;
      audioPrompt = `凑十数键：${a} 加 ${needForTen} 凑成 10，${b} 分成 ${needForTen} 和几？`;
      helperFormulaHtml = `<strong>${a} + ${needForTen} = 10</strong>，<strong>${b} - ${needForTen} = ?</strong>`;
      trapValue = total;
      trapHint = `${total} 是最后的得数哦！这里问号在下面的小圆圈里，想一想 ${b} 分成 ${needForTen} 和几？`;
      shortTrapVoice = '看清问号在小圆圈里哦！';
    } else if (askMode === 'need') {
      titleZh = `凑十数键：先看 ${a} 和几能凑成 10？（把 ${b} 分成 ？ 和 ${rem}）`;
      audioPrompt = `凑十数键：要把 ${a} 凑成 10，${b} 要分成几和 ${rem}？`;
      helperFormulaHtml = `<strong>${a} + ? = 10</strong>，而且 <strong>? + ${rem} = ${b}</strong>`;
      trapValue = rem;
      trapHint = `仔细看哦，右边小圆圈已经是 ${rem} 啦，左边小圆圈要和 ${a} 凑成 10，${a} 加几等于 10 呢？`;
      shortTrapVoice = `想想 ${a} 加几等于 10！`;
    } else {
      titleZh = `凑十数键：先把 ${a} 和 ${needForTen} 凑成 10，再算 ${a} + ${b} 等于几？`;
      audioPrompt = `凑十法：${a} 加 ${needForTen} 得 10，10 再加 ${rem} 等于几？`;
      helperFormulaHtml = `<strong>${a} + ${needForTen} = 10</strong>，<strong>10 + ${rem} = ?</strong>`;
      trapValue = 10;
      trapHint = `10 只是第一步凑出来的十哦，别忘了还要加上右边小圆圈剩下的 ${rem} 呢！`;
      shortTrapVoice = '10还要加右边剩下的数！';
    }

    const praiseText = `太棒啦！把 ${b} 分成 ${needForTen} 和 ${rem}，${a} 加 ${needForTen} 凑成 10，10 加 ${rem} 就等于 ${total}！`;

    this.currentQuestion = {
      answer: correctAnswer,
      audioPrompt,
      praiseText,
      trapValue,
      trapHint,
      shortTrapVoice,
      type: 'ktest',
      subType: 'q1'
    };

    this.questionTextEl.innerHTML = `<span>${titleZh}</span>`;

    const leftBondCircleHtml = askMode === 'need'
      ? `<div class="bond-circle ktest-target-slot mystery-pulse">?</div>`
      : `<div class="bond-circle shaded" title="${a} + ${needForTen} = 10">${needForTen}</div>`;

    const rightBondCircleHtml = askMode === 'rem'
      ? `<div class="bond-circle ktest-target-slot mystery-pulse">?</div>`
      : `<div class="bond-circle unshaded" title="10 + ${rem} = ${total}">${rem}</div>`;

    const bridgeText = askMode === 'need'
      ? `✨ ${a} + ? = 10`
      : `✨ ${a} + ${needForTen} = 10`;

    const card = document.createElement('div');
    card.className = 'ktest-card ktest-q1-card';
    card.innerHTML = `
      <div class="q1-make-ten-diagram">
        <div class="q1-equation-row">
          <div class="q1-num-token q1-num-a" title="点击听凑十秘诀">${a}</div>
          <div class="q1-op-token">+</div>
          <div class="q1-b-anchor">
            <div class="q1-num-token q1-num-b">${b}</div>
            <!-- 倒V型数键分支严格居中锚定在第二个加数 b 正下方 -->
            <div class="q1-bond-under-b">
              <div class="q1-maketen-bridge" title="点击听凑十过程">
                <span class="bridge-badge">${bridgeText}</span>
              </div>
              <svg class="q1-bond-legs-svg" viewBox="0 0 176 48" aria-hidden="true">
                <line x1="88" y1="2" x2="39" y2="45" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
                <line x1="88" y1="2" x2="137" y2="45" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
              </svg>
              <div class="q1-bond-circles-row">
                ${leftBondCircleHtml}
                ${rightBondCircleHtml}
              </div>
            </div>
          </div>
          <div class="q1-op-token">=</div>
          ${askMode !== 'total'
            ? `<div class="q1-result-box solved">${total}</div>`
            : `<div class="q1-result-box ktest-target-slot mystery-pulse">?</div>`
          }
        </div>
      </div>
      <div class="ktest-helper-pill" id="q1-helper-pill">
        💡 点击看思路：${helperFormulaHtml}
      </div>
    `;

    card.querySelector('#q1-helper-pill').addEventListener('click', () => {
      window.soundManager.playPop();
      window.soundManager.speak(`先把 ${a} 凑成 10，${b} 可以分成 ${needForTen} 和 ${rem}，10 加 ${rem} 等于 ${total}`);
    });

    stage.appendChild(card);

    const minOpt = askMode === 'total' ? 11 : 1;
    const maxOpt = askMode === 'total' ? 19 : 9;
    const options = this.generateChoices(correctAnswer, minOpt, maxOpt, 4);
    this.renderOptions(options, correctAnswer);
  }

  // 真题题型 2: 多级连环数字分合图 (左款自上而下连环拆、右款自左向右连环合，进退位高阶数域)
  buildKTestQ2ChainedBonds(stage) {
    const isEasy10 = this.difficulty === '10';
    const isLeftStyle = Math.random() < 0.5;

    const card = document.createElement('div');
    card.className = 'ktest-card ktest-q2-card';

    if (isLeftStyle) {
      // 试卷左图：顶圆 Whole -> 左中 Mid & 右中 P1；左中 Mid -> 左下 P2 & 右下 P3
      const maxWhole = isEasy10 ? 11 : (this.difficulty === '100' ? 22 : 17);
      const minWhole = isEasy10 ? 8 : (this.difficulty === '100' ? 14 : 11);
      const whole = Math.floor(Math.random() * (maxWhole - minWhole + 1)) + minWhole;
      const p1 = isEasy10 ? (Math.floor(Math.random() * 3) + 2) : (Math.floor(Math.random() * 5) + 3);
      const mid = whole - p1;
      const p2 = Math.floor(Math.random() * Math.max(1, mid - 2)) + 1;
      const p3 = mid - p2;

      const askMid = Math.random() < 0.45;
      const correctAnswer = askMid ? mid : p3;

      const titleZh = askMid
        ? `连环数键：顶上的 ${whole} 分成 ？ 和 ${p1}（下面还能看到 ？ 分成了 ${p2} 和 ${p3}）`
        : `连环数键：${whole} 分成 ${mid} 和 ${p1}，那 ${mid} 再分成 ${p2} 和几呢？`;

      const audioPrompt = askMid
        ? `连环数键：顶上的 ${whole} 分成几和 ${p1}？`
        : `连环数键：${whole} 分成 ${mid} 和 ${p1}，${mid} 又分成 ${p2} 和几？`;

      const praiseText = `完全正确！${whole} 分成 ${mid} 和 ${p1}，${mid} 再分成 ${p2} 和 ${p3}！`;

      this.currentQuestion = {
        answer: correctAnswer,
        audioPrompt,
        praiseText,
        trapValue: !askMid ? mid : undefined,
        trapHint: !askMid ? `${mid} 是第一层拆出来的中间数哦，还要再算 ${mid} 减 ${p2} 等于几呢！` : null,
        shortTrapVoice: !askMid ? '还要算第二层分合哦！' : null,
        type: 'ktest',
        subType: 'q2'
      };

      this.questionTextEl.innerHTML = `<span>${titleZh}</span>`;

      card.innerHTML = `
        <div class="q2-bond-svg-stage">
          <svg class="q2-bond-svg" viewBox="0 0 320 200" aria-hidden="true">
            <line x1="190" y1="34" x2="115" y2="102" stroke="#1E293B" stroke-width="3.5"/>
            <line x1="190" y1="34" x2="248" y2="96" stroke="#1E293B" stroke-width="3.5"/>
            <line x1="115" y1="102" x2="62" y2="166" stroke="#1E293B" stroke-width="3.5"/>
            <line x1="115" y1="102" x2="162" y2="166" stroke="#1E293B" stroke-width="3.5"/>
          </svg>

          <div class="bond-node shaded" style="left: 59.4%; top: 17%;" title="总数 ${whole}">${whole}</div>
          ${askMid
            ? `<div class="bond-node ktest-target-slot mystery-pulse" style="left: 35.9%; top: 51%;">?</div>`
            : `<div class="bond-node unshaded" style="left: 35.9%; top: 51%;" title="${whole} - ${p1} = ${mid}">${mid}</div>`
          }
          <div class="bond-node shaded" style="left: 77.5%; top: 48%;">${p1}</div>
          <div class="bond-node shaded" style="left: 19.4%; top: 83%;">${p2}</div>
          ${askMid
            ? `<div class="bond-node unshaded" style="left: 50.6%; top: 83%;">${p3}</div>`
            : `<div class="bond-node ktest-target-slot mystery-pulse" style="left: 50.6%; top: 83%;">?</div>`
          }
        </div>
        <div class="ktest-helper-pill">
          💡 提示：${askMid ? `${whole} - ${p1} = ？ （或者 ${p2} + ${p3} = ？）` : `先看上层 ${whole} - ${p1} = ${mid}，再算下层 ${mid} - ${p2} = ？`}
        </div>
      `;

      stage.appendChild(card);
      const options = this.generateChoices(correctAnswer, 1, whole - 1, 4);
      this.renderOptions(options, correctAnswer);

    } else {
      // 试卷右图：左上 A + 左下 B -> 中间 Mid；中间 Mid + 下方 C -> 右侧总数 Whole
      const maxPart = isEasy10 ? 4 : (this.difficulty === '100' ? 9 : 7);
      const minPart = isEasy10 ? 2 : 3;
      const a = Math.floor(Math.random() * (maxPart - minPart + 1)) + minPart;
      const b = Math.floor(Math.random() * (maxPart - minPart + 1)) + minPart;
      const mid = a + b;
      const c = isEasy10 ? (Math.floor(Math.random() * 3) + 2) : (Math.floor(Math.random() * 6) + 3);
      const whole = mid + c;

      const askMid = Math.random() < 0.45;
      const correctAnswer = askMid ? mid : c;

      const titleZh = askMid
        ? `连环数键：左边的 ${a} 和 ${b} 合起来等于中间的几？`
        : `连环数键：${a} 和 ${b} 合起来是 ${mid}，那 ${mid} 再和几合起来是 ${whole}？`;

      const audioPrompt = askMid
        ? `连环数键：左边的 ${a} 和 ${b} 合起来等于几？`
        : `连环数键：${a} 加 ${b} 得 ${mid}，${mid} 再加几等于 ${whole}？`;

      const praiseText = `太聪明啦！${a} 和 ${b} 合起来是 ${mid}，${mid} 和 ${c} 合起来就是 ${whole}！`;

      this.currentQuestion = {
        answer: correctAnswer,
        audioPrompt,
        praiseText,
        trapValue: !askMid ? mid : whole,
        trapHint: !askMid
          ? `${mid} 是左边 ${a} + ${b} 的和哦，再想一想 ${mid} 加几才等于最右边的 ${whole}？`
          : `问号在中间的圆圈里哦，只需要把左边的 ${a} 和 ${b} 合起来就可以啦！`,
        shortTrapVoice: '看清问号在哪个圆圈哦！',
        type: 'ktest',
        subType: 'q2'
      };

      this.questionTextEl.innerHTML = `<span>${titleZh}</span>`;

      card.innerHTML = `
        <div class="q2-bond-svg-stage">
          <svg class="q2-bond-svg" viewBox="0 0 320 200" aria-hidden="true">
            <line x1="58" y1="42" x2="148" y2="86" stroke="#1E293B" stroke-width="3.5"/>
            <line x1="58" y1="128" x2="148" y2="86" stroke="#1E293B" stroke-width="3.5"/>
            <line x1="148" y1="86" x2="258" y2="122" stroke="#1E293B" stroke-width="3.5"/>
            <line x1="164" y1="166" x2="258" y2="122" stroke="#1E293B" stroke-width="3.5"/>
          </svg>

          <div class="bond-node shaded" style="left: 18.1%; top: 21%;">${a}</div>
          <div class="bond-node shaded" style="left: 18.1%; top: 64%;">${b}</div>
          ${askMid
            ? `<div class="bond-node ktest-target-slot mystery-pulse" style="left: 46.2%; top: 43%;">?</div>`
            : `<div class="bond-node unshaded" style="left: 46.2%; top: 43%;" title="${a} + ${b} = ${mid}">${mid}</div>`
          }
          ${askMid
            ? `<div class="bond-node unshaded" style="left: 51.2%; top: 83%;">${c}</div>`
            : `<div class="bond-node ktest-target-slot mystery-pulse" style="left: 51.2%; top: 83%;">?</div>`
          }
          <div class="bond-node shaded" style="left: 80.6%; top: 61%;" title="总数 ${whole}">${whole}</div>
        </div>
        <div class="ktest-helper-pill">
          💡 提示：${askMid ? `左边两个圆圈合起来：${a} + ${b} = ？` : `左边 ${a} + ${b} = ${mid}，右边总数是 ${whole}，所以 ${whole} - ${mid} = ？`}
        </div>
      `;

      stage.appendChild(card);
      const options = this.generateChoices(correctAnswer, 1, whole - 1, 4);
      this.renderOptions(options, correctAnswer);
    }
  }

  // 真题题型 3: 一图四式 (给定3个打乱的数字盒，由孩子自己动手组合出2道加法和2道减法算式)
  buildKTestQ3FactFamily(stage) {
    const pairs10 = [
      [5, 3], [6, 2], [6, 3], [7, 2],
      [7, 3], [6, 4], [8, 2], [5, 4]
    ];
    const pairs20 = [
      [8, 5], [9, 4], [9, 5], [7, 5], [8, 6],
      [9, 6], [7, 6], [8, 7], [9, 7], [8, 3]
    ];
    const pairs100 = [
      [9, 6], [8, 7], [9, 7], [9, 8], [11, 5],
      [12, 5], [11, 6], [13, 4], [12, 7], [14, 5]
    ];
    const pairs = this.difficulty === '10'
      ? pairs10
      : (this.difficulty === '100' ? pairs100 : pairs20);
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    const c = a + b;

    // 将 3 个数字真随机打乱顺序展示在顶部，需要孩子自己判断谁是总数、谁是两个部分
    const shuffledCards = this.shuffleArray([c, a, b]);
    const sortedTargetKey = [a, b, c].slice().sort((m, n) => m - n).join(',');

    // 4道待拼搭的算式状态 (常规闯关模式下4道全部由孩子亲手组合！)
    const eqStates = [
      { idx: 0, op: '+', label: '➕ 加法 ①', slots: this.speedrunActive ? [a, b, c] : [null, null, null], solved: this.speedrunActive },
      { idx: 1, op: '+', label: '➕ 加法 ②', slots: this.speedrunActive ? [b, a, c] : [null, null, null], solved: this.speedrunActive },
      { idx: 2, op: '-', label: '➖ 减法 ①', slots: this.speedrunActive ? [c, a, b] : [null, null, null], solved: this.speedrunActive },
      { idx: 3, op: '-', label: '➖ 减法 ②', slots: [null, null, null], solved: false }
    ];

    let activeEqIdx = this.speedrunActive ? 3 : 0;
    let activeSlotIdx = 0;
    let isLocked = false;

    const titleZh = `一图四式：用 [${shuffledCards[0]}]、[${shuffledCards[1]}]、[${shuffledCards[2]}] 自己组合出 2 道加法和 2 道减法！`;
    const audioPrompt = `一图四式：用 ${shuffledCards[0]}、${shuffledCards[1]}、${shuffledCards[2]} 拼出两道加法和两道减法吧！`;
    const praiseText = `太厉害啦！你靠自己把 ${c}、${a}、${b} 的两道加法和两道减法全都组合出来啦！`;

    this.currentQuestion = {
      answer: 'fact_family_complete',
      audioPrompt,
      praiseText,
      type: 'ktest',
      subType: 'q3'
    };

    this.questionTextEl.innerHTML = `<span>${titleZh}</span>`;

    const card = document.createElement('div');
    card.className = 'ktest-card ktest-q3-card';

    card.innerHTML = `
      <div class="ff-top-row">
        <div class="ff-number-cards" id="ff-top-cards">
          ${shuffledCards.map(num => `
            <button type="button" class="ff-card clickable-ff-card" data-num="${num}" title="点击填入数字 ${num}">${num}</button>
          `).join('')}
        </div>
        <div class="ff-rule-badge" id="ff-progress-badge">
          💡 点击下方数字填入方格（已完成 <strong>${eqStates.filter(e => e.solved).length} / 4</strong> 道）
        </div>
      </div>
      <div class="ff-equations-grid" id="ff-equations-grid"></div>
    `;

    stage.appendChild(card);

    const gridEl = card.querySelector('#ff-equations-grid');
    const progressBadgeEl = card.querySelector('#ff-progress-badge');

    const renderEquationsUI = () => {
      const solvedCount = eqStates.filter(e => e.solved).length;
      if (progressBadgeEl) {
        progressBadgeEl.innerHTML = `💡 每道算式把 3 个数各用一次（已完成 <strong>${solvedCount} / 4</strong> 道）`;
      }

      gridEl.innerHTML = eqStates.map((eq) => {
        const isCurrentEq = (!eq.solved && eq.idx === activeEqIdx);
        const boxClass = eq.solved
          ? 'ff-eq-box solved-eq'
          : (isCurrentEq ? 'ff-eq-box target-eq' : 'ff-eq-box pending-eq');

        const slotsHtml = [0, 1, 2].map(sIdx => {
          const val = eq.slots[sIdx];
          const isCurrentSlot = isCurrentEq && (sIdx === activeSlotIdx);
          let slotClass = 'ff-slot-btn';
          if (eq.solved) {
            slotClass += ' slot-solved';
          } else if (isCurrentSlot) {
            slotClass += ' mystery-pulse slot-active';
          } else if (val !== null) {
            slotClass += ' slot-filled';
          } else {
            slotClass += ' slot-empty';
          }
          const displayChar = val !== null ? val : (isCurrentSlot ? '?' : '□');
          return `<button type="button" class="${slotClass}" data-eq="${eq.idx}" data-slot="${sIdx}" ${eq.solved ? 'disabled' : ''}>${displayChar}</button>`;
        });

        return `
          <div class="${boxClass}" id="ff-eq-box-${eq.idx}">
            <span class="ff-eq-tag">${eq.solved ? '✅ ' : ''}${eq.label}</span>
            <div class="ff-eq-formula">
              ${slotsHtml[0]}
              <span class="ff-op">${eq.op}</span>
              ${slotsHtml[1]}
              <span class="ff-op">=</span>
              ${slotsHtml[2]}
            </div>
          </div>
        `;
      }).join('');

      gridEl.querySelectorAll('.ff-slot-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
          if (isLocked) return;
          window.soundManager.playPop();
          activeEqIdx = parseInt(btn.dataset.eq, 10);
          activeSlotIdx = parseInt(btn.dataset.slot, 10);
          renderEquationsUI();
        });
      });
    };

    const handleNumberInput = (numVal) => {
      if (isLocked) return;
      const curEq = eqStates[activeEqIdx];
      if (!curEq || curEq.solved) return;

      window.soundManager.playPop();
      curEq.slots[activeSlotIdx] = numVal;

      const nextEmptyIdx = curEq.slots.findIndex((v, i) => v === null && i > activeSlotIdx);
      const anyEmptyIdx = curEq.slots.findIndex(v => v === null);

      if (nextEmptyIdx !== -1) {
        activeSlotIdx = nextEmptyIdx;
        renderEquationsUI();
        return;
      }
      if (anyEmptyIdx !== -1) {
        activeSlotIdx = anyEmptyIdx;
        renderEquationsUI();
        return;
      }

      renderEquationsUI();
      const [x, y, z] = curEq.slots;
      const usedKey = [x, y, z].slice().sort((m, n) => m - n).join(',');
      const usedAllThree = (usedKey === sortedTargetKey);
      const isMathTrue = curEq.op === '+' ? (x + y === z) : (x - y === z);

      const siblingIdx = curEq.op === '+' ? (curEq.idx === 0 ? 1 : 0) : (curEq.idx === 2 ? 3 : 2);
      const siblingEq = eqStates[siblingIdx];
      const isDuplicate = siblingEq.solved && siblingEq.slots[0] === x && siblingEq.slots[1] === y;

      if (usedAllThree && isMathTrue && !isDuplicate) {
        curEq.solved = true;
        const nextUnsolved = eqStates.find(e => !e.solved);

        if (nextUnsolved) {
          window.soundManager.playCorrect();
          activeEqIdx = nextUnsolved.idx;
          activeSlotIdx = 0;
          renderEquationsUI();

          const stepMsg = `真棒！${x} ${curEq.op} ${y} = ${z} 正确！请继续组合「${nextUnsolved.label}」吧！`;
          this.setMascot(stepMsg);
          this.feedbackZoneEl.innerHTML = `
            <div class="feedback-badge success bounce-in">
              <span>✅ 完成 ${eqStates.filter(e => e.solved).length}/4 道！继续拼下一道 👉</span>
            </div>
          `;
        } else {
          isLocked = true;
          renderEquationsUI();
          const dummyBtn = this.optionsZoneEl.querySelector('.option-card') || document.createElement('button');
          this.checkAnswer(dummyBtn, 'fact_family_complete', 'fact_family_complete');
        }
      } else {
        // 算式出错：记录一图四式需后续错题巩固，并给出精准引导
        isLocked = true;
        this.scheduleMistakeReview();
        window.soundManager.playWrong();
        const boxEl = document.getElementById(`ff-eq-box-${curEq.idx}`);
        if (boxEl) boxEl.classList.add('wobble', 'wrong-eq');

        let errMsg;
        let errVoice;
        if (isDuplicate) {
          errMsg = curEq.op === '+'
            ? `这道加法 ${x} + ${y} = ${z} 已经写过啦！交换前两个加数的位置，试试 ${y} + ${x} = ${z} 吧！`
            : `这道减法 ${x} - ${y} = ${z} 已经写过啦！试试用 ${c} 减去另一个数字宝宝吧！`;
          errVoice = '这道写过啦，换个顺序！';
        } else if (!usedAllThree) {
          errMsg = `小心哦！算式 ${x} ${curEq.op} ${y} = ${z} 里重复用了同一个数！每道算式都要把 ${c}、${a}、${b} 各用一次哦！`;
          errVoice = '三个数要各用一次哦！';
        } else if (curEq.op === '-' && x !== c) {
          errMsg = `减法算式要把最大的总数宝宝 ${c} 放在最前面第一个格哦！用 ${c} 去减！`;
          errVoice = '减法大数放最前！';
        } else if (curEq.op === '+' && z !== c) {
          errMsg = `加法算式要把两个小的数字宝宝加起来，等号最后面填最大的总数宝宝 ${c} 哦！`;
          errVoice = '加法大数放最后！';
        } else {
          errMsg = `${x} ${curEq.op} ${y} 不等于 ${z} 哦，换个组合再试一次吧！`;
          errVoice = '算式不对，再试试！';
        }

        this.setMascot(errMsg);
        if (!this.speedrunActive) {
          window.soundManager.speak(errVoice);
        }
        this.feedbackZoneEl.innerHTML = `
          <div class="feedback-badge retry wobble">
            <span>💡 调整一下顺序再试一次哦！</span>
          </div>
        `;

        setTimeout(() => {
          curEq.slots = [null, null, null];
          activeSlotIdx = 0;
          isLocked = false;
          renderEquationsUI();
        }, 700);
      }
    };

    const handleBackspace = () => {
      if (isLocked) return;
      const curEq = eqStates[activeEqIdx];
      if (!curEq || curEq.solved) return;
      window.soundManager.playPop();

      if (curEq.slots[activeSlotIdx] !== null) {
        curEq.slots[activeSlotIdx] = null;
      } else {
        for (let i = 2; i >= 0; i--) {
          if (curEq.slots[i] !== null) {
            curEq.slots[i] = null;
            activeSlotIdx = i;
            break;
          }
        }
      }
      renderEquationsUI();
    };

    card.querySelectorAll('.clickable-ff-card').forEach(btn => {
      btn.addEventListener('click', () => {
        handleNumberInput(parseInt(btn.dataset.num, 10));
      });
    });

    this.optionsZoneEl.innerHTML = '';
    shuffledCards.forEach(num => {
      const btn = document.createElement('button');
      btn.className = 'option-card number-option-btn';
      btn.textContent = num;
      btn.addEventListener('click', () => handleNumberInput(num));
      this.optionsZoneEl.appendChild(btn);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'option-card ff-clear-option-btn';
    clearBtn.innerHTML = `⌫ 退格`;
    clearBtn.title = '清除当前算式刚填的数字';
    clearBtn.addEventListener('click', handleBackspace);
    this.optionsZoneEl.appendChild(clearBtn);

    renderEquationsUI();
  }

  // 真题题型 4: 三格数塔 (顶格 = 中格 + 底格，全面聚焦进退位数塔与两位数数塔)
  buildKTestQ4NumberTowers(stage) {
    const towerPool10 = [
      [8, 5, 3], [9, 5, 4], [10, 7, 3], [9, 6, 3],
      [10, 6, 4], [8, 6, 2], [7, 4, 3], [10, 8, 2]
    ];
    const towerPool20 = [
      [13, 8, 5], [16, 9, 7], [18, 9, 9], [15, 8, 7],
      [14, 8, 6], [17, 9, 8], [12, 7, 5], [11, 6, 5],
      [15, 9, 6], [13, 7, 6], [14, 9, 5], [16, 8, 8]
    ];
    const towerPool100 = [
      [19, 11, 8], [21, 13, 8], [20, 12, 8], [18, 11, 7],
      [22, 14, 8], [24, 15, 9], [17, 9, 8], [23, 14, 9],
      [25, 16, 9], [20, 13, 7], [21, 12, 9], [19, 12, 7]
    ];
    const towerPool = this.difficulty === '10'
      ? towerPool10
      : (this.difficulty === '100' ? towerPool100 : towerPool20);
    const shuffled = this.shuffleArray(towerPool).slice(0, 4);
    const targetTowerIdx = Math.random() < 0.5 ? 2 : 3;
    const [topVal, midVal, botVal] = shuffled[targetTowerIdx];

    // 重点考察逆向减法（缺底格 42%、缺中格 42%），辅以正向求和（缺顶格 16%）
    const roll = Math.random();
    const missingSlot = roll < 0.42 ? 'bot' : (roll < 0.84 ? 'mid' : 'top');
    const correctAnswer = missingSlot === 'top' ? topVal : (missingSlot === 'mid' ? midVal : botVal);

    const titleZh = missingSlot === 'top'
      ? `三格数塔：下面两格 ${midVal} + ${botVal} 合起来，最顶上一格应该填几？`
      : `三格数塔：最顶上是总和 ${topVal}，想一想 ${missingSlot === 'mid' ? `几 + ${botVal} = ${topVal}` : `${midVal} + 几 = ${topVal}`}？`;

    const audioPrompt = missingSlot === 'top'
      ? `三格数塔：下面两格 ${midVal} 加 ${botVal} 等于顶上的几？`
      : `三格数塔：顶上是总和 ${topVal}，${topVal} 减 ${missingSlot === 'mid' ? botVal : midVal} 等于几？`;

    const praiseText = `太棒啦！在三格数塔里，${midVal} 加 ${botVal} 就等于顶上的 ${topVal}！`;

    const knownPart = missingSlot === 'mid' ? botVal : midVal;
    const trapValue = missingSlot !== 'top' ? (topVal + knownPart) : Math.abs(midVal - botVal);
    const trapHint = missingSlot !== 'top'
      ? `小心哦！最顶上的 ${topVal} 已经是总和啦，不能再用 ${topVal} 加 ${knownPart}，应该算 ${topVal} 减 ${knownPart} 哦！`
      : `最顶上一格是下面两格合起来的总和哦，应该算 ${midVal} 加 ${botVal}！`;
    const shortTrapVoice = missingSlot !== 'top' ? '顶上是总和，要用减法！' : '顶上要把下面两格相加！';

    this.currentQuestion = {
      answer: correctAnswer,
      audioPrompt,
      praiseText,
      trapValue,
      trapHint,
      shortTrapVoice,
      type: 'ktest',
      subType: 'q4'
    };

    this.questionTextEl.innerHTML = `<span>${titleZh}</span>`;

    const card = document.createElement('div');
    card.className = 'ktest-card ktest-q4-card';

    const towersRow = document.createElement('div');
    towersRow.className = 'q4-towers-row';

    shuffled.forEach(([t, m, b], idx) => {
      const isTarget = idx === targetTowerIdx;
      const towerEl = document.createElement('div');
      towerEl.className = `q4-tower ${isTarget ? 'target-tower' : 'example-tower'}`;

      const topCell = (isTarget && missingSlot === 'top')
        ? `<div class="tower-cell cell-top ktest-target-slot mystery-pulse">?</div>`
        : `<div class="tower-cell cell-top">${t}</div>`;

      const midCell = (isTarget && missingSlot === 'mid')
        ? `<div class="tower-cell cell-mid ktest-target-slot mystery-pulse">?</div>`
        : `<div class="tower-cell cell-mid">${m}</div>`;

      const botCell = (isTarget && missingSlot === 'bot')
        ? `<div class="tower-cell cell-bot ktest-target-slot mystery-pulse">?</div>`
        : `<div class="tower-cell cell-bot">${b}</div>`;

      let formulaHtml = `${m} + ${b} = ${t}`;
      if (isTarget) {
        if (missingSlot === 'top') {
          formulaHtml = `${m} + ${b} = <span class="ktest-step-reveal">?</span>`;
        } else if (missingSlot === 'mid') {
          formulaHtml = `<span class="ktest-step-reveal">?</span> + ${b} = ${t}`;
        } else {
          formulaHtml = `${m} + <span class="ktest-step-reveal">?</span> = ${t}`;
        }
      }

      towerEl.innerHTML = `
        <div class="tower-tag">${isTarget ? '🎯 填一填' : `示范 ${idx + 1}`}</div>
        <div class="tower-stack">
          ${topCell}
          ${midCell}
          ${botCell}
        </div>
        <div class="tower-formula-pill ${isTarget ? 'target-formula' : ''}">${formulaHtml}</div>
      `;

      towerEl.addEventListener('click', () => {
        window.soundManager.playPop();
        if (!isTarget) {
          window.soundManager.speak(`看这座数塔：下面的 ${m} 加 ${b} 等于最上面的 ${t}`);
        } else {
          window.soundManager.speak(audioPrompt);
        }
      });

      towersRow.appendChild(towerEl);
    });

    card.appendChild(towersRow);

    const helper = document.createElement('div');
    helper.className = 'ktest-helper-pill';
    helper.innerHTML = `💡 规律：<strong>最上格 = 中间格 + 最下格</strong>（点任意示范数塔可听讲解）`;
    card.appendChild(helper);

    stage.appendChild(card);

    const options = this.generateChoices(correctAnswer, Math.max(2, correctAnswer - 4), correctAnswer + 5, 4);
    this.renderOptions(options, correctAnswer);
  }

  // 真题题型 5: 压轴思维挑战
  // (q5a) "比 13 - 5 多 4 的数是 ___" (双步文字算式推理)
  // (q5b) "14 - 6 = 3 + ___" (双边等式平衡填空)
  buildKTestQ5Challenge(stage, forcedVariant = null) {
    const isEasy10 = this.difficulty === '10';
    const isVerbalMoreLess = forcedVariant === 'q5a'
      ? true
      : (forcedVariant === 'q5b' ? false : (Math.random() < 0.5));

    const card = document.createElement('div');
    card.className = 'ktest-card ktest-q5-card';

    if (isVerbalMoreLess) {
      // 题型 5(a): "比 A ± B 多/少 X 的数是 ___"
      const isMore = Math.random() < 0.55;
      const isInnerSub = Math.random() < 0.6;
      let a, b, innerVal;
      if (isInnerSub) {
        a = isEasy10
          ? Math.floor(Math.random() * 4) + 7   // 7 ~ 10
          : (this.difficulty === '100'
              ? Math.floor(Math.random() * 6) + 12  // 12 ~ 17
              : Math.floor(Math.random() * 6) + 9); // 9 ~ 14
        b = isEasy10
          ? Math.floor(Math.random() * 3) + 2   // 2 ~ 4
          : Math.floor(Math.random() * 5) + 3;  // 3 ~ 7
        innerVal = a - b;
      } else {
        a = isEasy10
          ? Math.floor(Math.random() * 4) + 2   // 2 ~ 5
          : (this.difficulty === '100'
              ? Math.floor(Math.random() * 5) + 6   // 6 ~ 10
              : Math.floor(Math.random() * 5) + 4); // 4 ~ 8
        b = isEasy10
          ? Math.floor(Math.random() * 3) + 2   // 2 ~ 4
          : Math.floor(Math.random() * 5) + 3;  // 3 ~ 7
        innerVal = a + b;
      }
      const delta = isMore
        ? (isEasy10 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 5) + 2)
        : Math.max(1, Math.min(isEasy10 ? 3 : 6, innerVal - 2));
      const innerExpr = isInnerSub ? `${a} - ${b}` : `${a} + ${b}`;
      const correctAnswer = isMore ? innerVal + delta : innerVal - delta;

      const zhSentence = `思维挑战：比 (${innerExpr}) ${isMore ? '多' : '少'} ${delta} 的数是几？`;
      const audioPrompt = `比 ${a} ${isInnerSub ? '减' : '加'} ${b} ${isMore ? '多' : '少'} ${delta} 的数是几？`;
      const praiseText = `太厉害啦！先算 ${innerExpr} 等于 ${innerVal}，比 ${innerVal} ${isMore ? '多' : '少'} ${delta}，就是 ${innerVal} ${isMore ? '加' : '减'} ${delta} 等于 ${correctAnswer}！`;

      const trapValue = innerVal;
      const trapHint = `${innerVal} 是第一步 ${innerExpr} 的得数哦！题目问的是比它还要${isMore ? '多' : '少'} ${delta}，还要再${isMore ? '加' : '减'} ${delta} 呢！`;

      this.currentQuestion = {
        answer: correctAnswer,
        audioPrompt,
        praiseText,
        trapValue,
        trapHint,
        shortTrapVoice: '还要再算第二步哦！',
        type: 'ktest',
        subType: 'q5a'
      };

      this.questionTextEl.innerHTML = `<span>${zhSentence}</span>`;

      card.innerHTML = `
        <div class="q5-verbal-box">
          <div class="q5-en-line">
            <span>比</span>
            <span class="q5-highlight-expr">${innerExpr}</span>
            <span class="q5-highlight-delta">${isMore ? `多 ${delta}` : `少 ${delta}`}</span>
            <span>的数是</span>
            <span class="q5-blank-slot ktest-target-slot mystery-pulse">?</span>
          </div>
        </div>

        <div class="q5-steps-row">
          <div class="q5-step-pill">
            <span class="step-num">第一步</span>
            <span>先算 <strong>${innerExpr} = ${innerVal}</strong></span>
          </div>
          <div class="q5-step-arrow">➔</div>
          <div class="q5-step-pill step-two">
            <span class="step-num">第二步</span>
            <span>再算比 ${innerVal} ${isMore ? '多' : '少'} ${delta}：<strong>${innerVal} ${isMore ? '+' : '-'} ${delta} = <span class="ktest-step-reveal">?</span></strong></span>
          </div>
        </div>
      `;

      stage.appendChild(card);

      const optSet = new Set([correctAnswer, innerVal]);
      const oppositeTrap = isMore ? Math.max(1, innerVal - delta) : (innerVal + delta);
      if (oppositeTrap !== correctAnswer) optSet.add(oppositeTrap);
      const offsets = [-1, 1, 2, -2, 3, -3, 4];
      for (const off of offsets) {
        if (optSet.size >= 4) break;
        const cand = correctAnswer + off;
        if (cand >= 1 && cand !== correctAnswer) optSet.add(cand);
      }
      while (optSet.size < 4) {
        optSet.add(correctAnswer + optSet.size);
      }
      this.renderOptions(Array.from(optSet).slice(0, 4).sort((m, n) => m - n), correctAnswer);

    } else {
      // 题型 5(b): 双边等式平衡 "13 - 5 = 3 + ___" 或 "7 + 6 = 16 - ___"
      const isLeftSub = Math.random() < 0.6;
      let a, b, midVal;
      if (isLeftSub) {
        a = isEasy10
          ? Math.floor(Math.random() * 4) + 7  // 7 ~ 10
          : (this.difficulty === '100'
              ? Math.floor(Math.random() * 6) + 12 // 12 ~ 17
              : Math.floor(Math.random() * 6) + 9); // 9 ~ 14
        b = isEasy10
          ? Math.floor(Math.random() * 3) + 2  // 2 ~ 4
          : Math.floor(Math.random() * 5) + 3; // 3 ~ 7
        midVal = a - b;
      } else {
        a = isEasy10
          ? Math.floor(Math.random() * 4) + 2  // 2 ~ 5
          : (this.difficulty === '100'
              ? Math.floor(Math.random() * 5) + 6  // 6 ~ 10
              : Math.floor(Math.random() * 5) + 4); // 4 ~ 8
        b = isEasy10
          ? Math.floor(Math.random() * 3) + 2  // 2 ~ 4
          : Math.floor(Math.random() * 5) + 3; // 3 ~ 7
        midVal = a + b;
      }

      const isRightAdd = isEasy10 ? true : (Math.random() < 0.65);
      let c, correctAnswer;
      if (isRightAdd) {
        c = Math.floor(Math.random() * Math.max(1, midVal - 2)) + 1;
        correctAnswer = midVal - c;
      } else {
        correctAnswer = Math.floor(Math.random() * 6) + 2;
        c = midVal + correctAnswer;
      }

      const leftExpr = isLeftSub ? `${a} - ${b}` : `${a} + ${b}`;
      const rightOp = isRightAdd ? '+' : '-';

      const titleZh = `等式天平：等号两边得数要一样大！${leftExpr} = ${c} ${rightOp} 几？`;
      const audioPrompt = `等式天平：${a} ${isLeftSub ? '减' : '加'} ${b} 等于 ${c} ${isRightAdd ? '加' : '减'} 几？`;
      const praiseText = `太牛啦！等号左边 ${leftExpr} 等于 ${midVal}，右边 ${c} ${rightOp} ${correctAnswer} 也等于 ${midVal}，两边完全平衡！`;

      // 针对最常见错因：把左边的得数 midVal 直接填进横线 (例如 12 - 4 = 3 + 8)
      const trapValue = midVal !== correctAnswer ? midVal : undefined;
      const trapHint = trapValue !== undefined
        ? `差一点点哦！等号左边 ${leftExpr} 确实等于 ${midVal}，但等号右边还有一个 ${c} ${rightOp} 呢！想想 ${c} ${isRightAdd ? '加' : '减'} 几才等于 ${midVal}？`
        : null;

      this.currentQuestion = {
        answer: correctAnswer,
        audioPrompt,
        praiseText,
        trapValue,
        trapHint,
        shortTrapVoice: trapValue !== undefined ? '看清等号右边还有数哦！' : null,
        type: 'ktest',
        subType: 'q5b'
      };

      this.questionTextEl.innerHTML = `<span>${titleZh}</span>`;

      card.innerHTML = `
        <div class="q5-balance-eq-box">
          <div class="q5-eq-side left-side">
            <div class="q5-side-formula">${a} ${isLeftSub ? '-' : '+'} ${b}</div>
            <div class="q5-bridge-tag">左边得数 = <strong>${midVal}</strong></div>
          </div>

          <div class="q5-eq-sign">=</div>

          <div class="q5-eq-side right-side">
            <div class="q5-side-formula">
              <span>${c} ${rightOp}</span>
              <span class="q5-blank-slot ktest-target-slot mystery-pulse">?</span>
            </div>
            <div class="q5-bridge-tag">右边也要 = <strong>${midVal}</strong></div>
          </div>
        </div>

        <div class="ktest-helper-pill">
          💡 天平秘诀：等号两边都等于 <strong>${midVal}</strong>，所以 <strong>${c} ${rightOp} <span class="ktest-step-reveal">?</span> = ${midVal}</strong>
        </div>
      `;

      stage.appendChild(card);

      const optSet = new Set([correctAnswer]);
      if (trapValue !== undefined && trapValue > 0) optSet.add(trapValue);
      const sumTrap = midVal + c;
      if (sumTrap > 0 && sumTrap !== correctAnswer && optSet.size < 4) optSet.add(sumTrap);
      const offsets = [-1, 1, -2, 2, 3, -3, 4];
      for (const off of offsets) {
        if (optSet.size >= 4) break;
        const cand = correctAnswer + off;
        if (cand >= 1 && cand !== correctAnswer) optSet.add(cand);
      }
      while (optSet.size < 4) {
        optSet.add(correctAnswer + optSet.size);
      }
      this.renderOptions(Array.from(optSet).slice(0, 4).sort((m, n) => m - n), correctAnswer);
    }
  }

  // ================= 9. 60秒极速挑战模式 (计时闯关、连击加分与最高分纪录) =================
  startSpeedrun() {
    this.clearPendingTimers();
    this.speedrunActive = true;
    this.speedrunTimeLeft = 60;
    this.speedrunScore = 0;
    this.speedrunCombo = 0;
    this.syncSprintButtonUI();

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
    this.setMascot('60秒极速挑战开始啦！连续答对积分翻倍！冲呀！🔥');

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

    this.currentMode = 'speedrun';
    this.generateQuestion();
  }

  generateSpeedrunQuestion() {
    this.generateQuestion();
  }

  finishSpeedrun() {
    this.clearPendingTimers();
    clearInterval(this.speedrunTimer);
    this.speedrunTimer = null;
    this.speedrunActive = false;
    this.syncSprintButtonUI();

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

    window.soundManager.speak(`时间到！得分 ${this.speedrunScore} 分！`);
  }

  // ================= 通用选项渲染与作答校验 (认知近似干扰项 + 升序排列) =================
  generateChoices(correctAnswer, min, max, count = 4) {
    const safeMin = Math.max(0, min);
    const safeMax = Math.max(safeMin + count + 2, max);
    const choices = new Set([correctAnswer]);

    // 若当前题目带有典型易错认知陷阱值，优先纳入选项以提高思维辨析度
    if (
      this.currentQuestion &&
      typeof this.currentQuestion.trapValue === 'number' &&
      Number.isFinite(this.currentQuestion.trapValue) &&
      this.currentQuestion.trapValue >= 0 &&
      this.currentQuestion.trapValue !== correctAnswer
    ) {
      choices.add(this.currentQuestion.trapValue);
    }

    // 优先从进退位近邻偏移 (±1, ±2, ±3, ±10) 中挑选高迷惑度干扰项，杜绝一眼看穿的离谱选项
    const nearOffsets = safeMax >= 25
      ? [-10, 10, -2, 2, -1, 1, -3, 3, -4, 4]
      : [-1, 1, -2, 2, -3, 3, 4, -4];
    const shuffledOffsets = this.shuffleArray(nearOffsets);

    for (const off of shuffledOffsets) {
      if (choices.size >= count) break;
      const cand = correctAnswer + off;
      if (cand >= safeMin && cand <= safeMax + 2 && cand !== correctAnswer) {
        choices.add(cand);
      }
    }

    let attempts = 0;
    while (choices.size < count && attempts < 80) {
      attempts++;
      const randVal = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
      if (randVal >= 0 && randVal !== correctAnswer) {
        choices.add(randVal);
      }
    }

    let step = 1;
    while (choices.size < count) {
      const cand = correctAnswer + step;
      if (cand !== correctAnswer) choices.add(cand);
      step++;
    }

    // 数字选项统一按从小到大升序排列，符合数学试卷规范且防止位置盲猜
    return Array.from(choices).slice(0, count).sort((a, b) => a - b);
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

      // K班真题特训：把数键圆圈、一图四式、三格数塔或压轴等式里的问号替换为正确答案
      if (qType === 'ktest') {
        this.questionZoneEl.querySelectorAll('.ktest-target-slot').forEach(slot => {
          slot.textContent = correctValue;
          slot.classList.remove('mystery-pulse');
          slot.classList.add('filled-correct');
        });
        this.questionZoneEl.querySelectorAll('.ktest-step-reveal').forEach(rev => {
          rev.textContent = correctValue;
          rev.classList.add('filled-correct');
        });
      }

      this.streak++;
      this.questionsSolved++;

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

      // 视觉气泡保留详细解题复盘，语音仅播报 3~6 字极短夸奖（已预热 0 延迟），大幅缩短切题等待
      const shortVoicePool = ['答对啦！', '太棒啦！', '真聪明！', '算得真准！', '好厉害！'];
      let voicePraise = shortVoicePool[Math.floor(Math.random() * shortVoicePool.length)];

      const visualPraises = [
        '太棒啦！你真聪明！🎉',
        '哇！完全正确，思维真敏捷！⭐',
        '算得又快又准，给你大拇指！👍',
        '太厉害啦，这道题也被你攻克了！🌟',
        '答对啦！离扭蛋又近一步了！🎁'
      ];
      let mascotPraise = visualPraises[Math.floor(Math.random() * visualPraises.length)];

      if (this.currentQuestion && this.currentQuestion.praiseText) {
        mascotPraise = this.currentQuestion.praiseText;
      } else if (qType === 'clock' && this.currentQuestion) {
        const { hour, minute } = this.currentQuestion;
        mascotPraise = minute === 0
          ? `答对啦！结果就是 ${hour} 点整！`
          : (minute === 30
              ? `太棒啦！结果就是 ${hour} 点半！`
              : `完全正确！结果正是 ${hour} 点 ${minute} 分！`);
      } else if (this.streak > 1 && this.streak % 3 === 0) {
        mascotPraise = `太神奇了！连续答对 ${this.streak} 题！🎊`;
      }

      if (this.streak > 1 && this.streak % 3 === 0) {
        window.soundManager.playFanfare();
        voicePraise = '连对啦，超棒！';
      }

      this.setMascot(mascotPraise);

      this.feedbackZoneEl.innerHTML = `
        <div class="feedback-badge success bounce-in" style="cursor:pointer;" title="点击立即进入下一题">
          <span>✨ 答对啦！金星 +1 · 下一题 ⏭️</span>
        </div>
      `;

      const badgeEl = this.feedbackZoneEl.querySelector('.feedback-badge');
      if (badgeEl) {
        badgeEl.addEventListener('click', () => {
          window.soundManager.playPop();
          this.generateQuestion();
        });
      }

      // 播完简短夸奖（约 0.8 秒）即刻进入下一题，节奏轻快不拖沓
      const transitionId = ++this.transitionSeq;
      const minDisplayPromise = new Promise((resolve) => setTimeout(resolve, 750));
      const speechPromise = window.soundManager.voiceEnabled
        ? Promise.race([
            Promise.resolve(window.soundManager.speak(voicePraise)).catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 2200))
          ])
        : Promise.resolve();

      Promise.all([minDisplayPromise, speechPromise]).then(() => {
        if (this.transitionSeq !== transitionId) return;
        const postSpeechDelay = window.soundManager.voiceEnabled ? 120 : 50;
        this.nextQuestionTimer = setTimeout(() => {
          if (this.transitionSeq === transitionId) {
            this.generateQuestion();
          }
        }, postSpeechDelay);
      });

    } else {
      // 立即禁用该错误选项，记录当前题型进入错题巩固队列（3题后换新数复测）
      btnElement.disabled = true;
      btnElement.classList.add('wrong');
      window.soundManager.playWrong();

      this.scheduleMistakeReview();
      this.streak = 0;
      this.updateStatsUI();
      this.updateSmartStageBadge(this.currentSkill, false);

      if (this.speedrunActive) {
        this.speedrunCombo = 0;
        if (this.speedrunComboEl) this.speedrunComboEl.textContent = '0';
      }

      const encouragements = [
        '差一点点哦，再仔细算算看！💪',
        '没关系，再看一眼题目，你一定行！🌸',
        '不要着急，再试一次吧！☀️'
      ];
      const shortWrongPool = ['再算算看！', '差一点点哦！'];
      let encText = encouragements[Math.floor(Math.random() * encouragements.length)];
      let shortVoiceEnc = shortWrongPool[Math.floor(Math.random() * shortWrongPool.length)];
      if (
        this.currentQuestion &&
        this.currentQuestion.trapValue !== undefined &&
        selectedValue.toString() === this.currentQuestion.trapValue.toString() &&
        this.currentQuestion.trapHint
      ) {
        encText = this.currentQuestion.trapHint;
        shortVoiceEnc = this.currentQuestion.shortTrapVoice || '小心陷阱，再算算！';
      }
      this.setMascot(encText);
      if (!this.speedrunActive) {
        window.soundManager.speak(shortVoiceEnc);
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
        ? `新伙伴：${randomSticker.name}！`
        : `抽到${randomSticker.name}！`;
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

  initPWA() {
    this.deferredInstallPrompt = null;
    const installBtn = document.getElementById('pwa-install-btn');
    const installModal = document.getElementById('pwa-install-modal');

    const isStandalone = () =>
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
      window.navigator.standalone === true;

    const updateInstallBtnVisibility = () => {
      if (!installBtn) return;
      installBtn.style.display = isStandalone() ? 'none' : 'flex';
    };
    updateInstallBtnVisibility();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      updateInstallBtnVisibility();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      if (installBtn) installBtn.style.display = 'none';
      if (installModal) installModal.classList.remove('active');
      this.setMascot('🎉 太棒啦！数学小王国已安装到桌面，随时离线畅玩！');
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        window.soundManager.playPop();
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          try {
            await this.deferredInstallPrompt.userChoice;
          } catch (_) {}
          this.deferredInstallPrompt = null;
          return;
        }
        if (this.settingsModal) this.settingsModal.classList.remove('active');
        if (installModal) {
          installModal.classList.add('active');
        }
      });
    }

    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }
}

// 启动游戏实例
window.addEventListener('DOMContentLoaded', () => {
  window.mathGameApp = new MathGameApp();
});
