/**
 * Main Application Orchestrator
 * Editorial stationery boutique aesthetic & real die-cut cat stickers.
 */

import { db } from './db.js';
import { wikimediaService } from './wikimedia.js';
import { bgRemover } from './bg-remover.js';
import { diaryController } from './diary.js';
import { scheduleController, CATEGORIES, PRIORITIES } from './schedule.js';
import { diaryExporter } from './export.js';
import { soundManager, CAT_SOUND_CATALOG } from './sound-manager.js';
import { CURATED_WIKIMEDIA_CATS } from './curated-cats.js';

class CatStickerApp {
  constructor() {
    this.currentDate = this.getTodayDateString();
    this.currentTab = 'schedule';
    this.editingTaskId = null;
    this.currentStudioItem = null;
    this.currentCutoutDataUrl = null;
    this.currentFrameStyle = 'cutout'; // 'cutout' | 'polaroid' | 'circle' | 'rounded'
    this.selectedSoundType = 'meow'; // Default user sound selection
  }

  getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async init() {
    console.log('Cat Sticker Diary App initialized.');

    // 1. Initial Seed Data
    await this.seedInitialDataIfNeeded();

    // 2. Initialize Diary Controller
    await diaryController.init('diary-canvas-board');

    // 3. Connect Reward Trigger
    scheduleController.onRewardTriggered = (task) => {
      this.handleTaskReward(task);
    };

    // 4. Setup Global Mute Toggle UI
    this.setupMuteToggle();

    // 5. Setup Views and Modals
    this.setupTabNavigation();
    this.setupScheduleView();
    this.setupSearchView();
    this.setupStudioModal();
    this.setupStickerBoxView();
    this.setupStatsView();
    this.setupDiaryToolbar();
    this.setupGlobalModals();

    // 6. Initial Load
    await this.switchTab('schedule');
    await this.refreshScheduleView();
    await this.refreshStickerBox();
  }

  setupMuteToggle() {
    const muteBtns = document.querySelectorAll('.btn-global-mute-toggle');
    const updateIcons = () => {
      const isMuted = soundManager.isGlobalMuted();
      muteBtns.forEach(btn => {
        btn.innerHTML = isMuted ? '🔇 무음 모드' : '🔊 소리 켜짐';
        btn.classList.toggle('is-muted', isMuted);
      });
    };

    muteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        soundManager.toggleGlobalMute();
        updateIcons();
        this.showToast(soundManager.isGlobalMuted() ? '🔇 앱 전체 소리가 꺼졌습니다.' : '🔊 앱 소리가 켜졌습니다.');
      });
    });

    updateIcons();
  }

  async seedInitialDataIfNeeded() {
    const stickers = await db.getAllStickers();
    if (!stickers || stickers.length === 0) {
      const starter1 = CURATED_WIKIMEDIA_CATS[0];
      const starter2 = CURATED_WIKIMEDIA_CATS[2];

      await db.saveSticker({
        id: 'starter_cat_01',
        name: '치즈태비 다이컷 스티커',
        imageUrl: starter1.thumbnailUrl,
        thumbnailUrl: starter1.thumbnailUrl,
        isCutout: true,
        borderStyle: 'cutout',
        soundType: 'meow',
        author: starter1.author,
        license: starter1.license,
        licenseUrl: starter1.licenseUrl,
        source: starter1.source,
        sourceUrl: starter1.sourceUrl,
        obtainedVia: 'welcome',
        createdAt: new Date().toISOString()
      });

      await db.saveSticker({
        id: 'starter_cat_02',
        name: '호기심 아깽이 스티커',
        imageUrl: starter2.thumbnailUrl,
        thumbnailUrl: starter2.thumbnailUrl,
        isCutout: true,
        borderStyle: 'cutout',
        soundType: 'purr',
        author: starter2.author,
        license: starter2.license,
        licenseUrl: starter2.licenseUrl,
        source: starter2.source,
        sourceUrl: starter2.sourceUrl,
        obtainedVia: 'welcome',
        createdAt: new Date().toISOString()
      });
    }

    const schedules = await db.getAllSchedules();
    if (!schedules || schedules.length === 0) {
      const today = this.getTodayDateString();
      await scheduleController.addTask({
        date: today,
        time: '09:30',
        title: '신선한 물과 고양이 사료 채워주기',
        category: 'cat',
        priority: 'high'
      });
      await scheduleController.addTask({
        date: today,
        time: '14:00',
        title: '고양이 스티커 찾기에서 예쁜 고양이 사진 찾아보기',
        category: 'hobby',
        priority: 'medium'
      });
      await scheduleController.addTask({
        date: today,
        time: '20:00',
        title: '오늘의 다이어리에 고양이 스티커 붙이고 하루 기록하기',
        category: 'daily',
        priority: 'medium'
      });
    }
  }

  // --- Tab Navigation ---
  setupTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });
  }

  async switchTab(tabName) {
    this.currentTab = tabName;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.app-screen-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabName}`);
    });

    if (tabName === 'schedule') {
      await this.refreshScheduleView();
    } else if (tabName === 'diary') {
      await diaryController.loadDate(this.currentDate);
    } else if (tabName === 'search') {
      const searchInput = document.getElementById('cat-search-input');
      if (searchInput && !searchInput.value) {
        searchInput.value = '귀여운 고양이';
        this.performCatSearch('귀여운 고양이');
      }
    } else if (tabName === 'stickers') {
      await this.refreshStickerBox();
    } else if (tabName === 'stats') {
      await this.refreshStatsView();
    }
  }

  // --- Schedule View ---
  setupScheduleView() {
    const prevBtn = document.getElementById('sched-prev-date-btn');
    const nextBtn = document.getElementById('sched-next-date-btn');
    const todayBtn = document.getElementById('sched-today-btn');
    const datePicker = document.getElementById('sched-date-picker');

    if (prevBtn) prevBtn.addEventListener('click', () => this.shiftDate(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this.shiftDate(1));
    if (todayBtn) todayBtn.addEventListener('click', () => this.setDate(this.getTodayDateString()));
    if (datePicker) datePicker.addEventListener('change', (e) => this.setDate(e.target.value));

    const openAddBtn = document.getElementById('btn-open-add-task');
    if (openAddBtn) openAddBtn.addEventListener('click', () => this.openTaskModal());

    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleTaskFormSubmit();
      });
    }

    const cancelTaskBtn = document.getElementById('btn-cancel-task');
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', () => this.closeTaskModal());
  }

  shiftDate(days) {
    const parts = this.currentDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.setDate(`${year}-${month}-${day}`);
  }

  setDate(dateStr) {
    this.currentDate = dateStr;
    const schedPicker = document.getElementById('sched-date-picker');
    if (schedPicker) schedPicker.value = dateStr;

    this.refreshScheduleView();
    diaryController.loadDate(dateStr);
  }

  async refreshScheduleView() {
    await scheduleController.loadDate(this.currentDate);

    const dateDisplay = document.getElementById('sched-current-date-text');
    if (dateDisplay) {
      const parts = this.currentDate.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const weekDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
      dateDisplay.textContent = `${parts[0]}.${parts[1]}.${parts[2]} (${weekDay})`;
    }

    const progress = await scheduleController.getDailyProgress(this.currentDate);
    const pctNumber = document.getElementById('daily-pct-number');
    const progressBar = document.getElementById('daily-progress-bar-fill');
    const cheerMsg = document.getElementById('daily-cheer-message');
    const taskCountText = document.getElementById('daily-task-count-text');

    if (pctNumber) pctNumber.textContent = `${progress.percentage}%`;
    if (progressBar) progressBar.style.width = `${progress.percentage}%`;
    if (cheerMsg) cheerMsg.textContent = progress.message;
    if (taskCountText) taskCountText.textContent = `${progress.completed} of ${progress.total} done`;

    const listEl = document.getElementById('task-list-container');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (scheduleController.schedules.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-card">
          <p class="empty-title">등록된 일정이 없습니다</p>
          <p class="empty-desc">새로운 일정을 추가하고 완료하여 고양이 스티커를 모아보세요.</p>
          <button class="btn btn-primary btn-sm" onclick="window.catApp.openTaskModal()">+ 새 일정 추가</button>
        </div>
      `;
      return;
    }

    const sorted = [...scheduleController.schedules].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const prioOrder = { high: 0, medium: 1, low: 2 };
      return (prioOrder[a.priority] || 1) - (prioOrder[b.priority] || 1);
    });

    for (const task of sorted) {
      const catInfo = CATEGORIES[task.category] || CATEGORIES.daily;
      const prioInfo = PRIORITIES[task.priority] || PRIORITIES.medium;

      const card = document.createElement('div');
      card.className = `task-card ${task.completed ? 'is-completed' : ''}`;
      card.innerHTML = `
        <label class="task-checkbox-wrap">
          <input type="checkbox" class="task-chk" ${task.completed ? 'checked' : ''} data-id="${task.id}" />
          <span class="custom-checkbox"></span>
        </label>
        <div class="task-body">
          <div class="task-header-meta">
            <span class="cat-badge">${catInfo.label}</span>
            <span class="prio-badge prio-${task.priority}">${prioInfo.label}</span>
            ${task.time ? `<span class="time-badge">${task.time}</span>` : ''}
            ${task.rewardClaimed ? '<span class="reward-tag">스티커 지급완료</span>' : ''}
          </div>
          <div class="task-title-text">${this.escapeHtml(task.title)}</div>
        </div>
        <div class="task-actions">
          <button class="btn-text-action edit-task-btn" data-id="${task.id}">수정</button>
          <button class="btn-text-action delete-task-btn" data-id="${task.id}">삭제</button>
        </div>
      `;

      const chk = card.querySelector('.task-chk');
      chk.addEventListener('change', async () => {
        await this.toggleTaskComplete(task.id);
      });

      const editBtn = card.querySelector('.edit-task-btn');
      editBtn.addEventListener('click', () => {
        this.openTaskModal(task);
      });

      const delBtn = card.querySelector('.delete-task-btn');
      delBtn.addEventListener('click', async () => {
        if (confirm('이 일정을 삭제하시겠습니까?')) {
          await scheduleController.deleteTask(task.id);
          await this.refreshScheduleView();
        }
      });

      listEl.appendChild(card);
    }
  }

  async toggleTaskComplete(taskId) {
    await scheduleController.toggleTask(taskId);
    await this.refreshScheduleView();
  }

  async handleTaskReward(task) {
    // Play authentic meow celebration sound
    soundManager.play('meow', 'reward');

    const rewardCat = wikimediaService.getRandomRewardCat();
    const assignedSound = rewardCat.soundType || 'meow';

    const newSticker = {
      id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: `${rewardCat.title.slice(0, 22)} 스티커`,
      imageUrl: rewardCat.thumbnailUrl,
      thumbnailUrl: rewardCat.thumbnailUrl,
      isCutout: true,
      borderStyle: 'cutout',
      soundType: assignedSound,
      author: rewardCat.author,
      license: rewardCat.license,
      licenseUrl: rewardCat.licenseUrl,
      source: rewardCat.source,
      sourceUrl: rewardCat.sourceUrl,
      obtainedVia: 'reward',
      createdAt: new Date().toISOString()
    };

    await db.saveSticker(newSticker);
    await this.refreshStickerBox();

    const modal = document.getElementById('reward-modal');
    if (!modal) return;

    document.getElementById('reward-task-title').textContent = task.title;
    document.getElementById('reward-sticker-img').src = newSticker.imageUrl;
    document.getElementById('reward-sticker-name').textContent = newSticker.name;
    document.getElementById('reward-sticker-sound-text').textContent = CAT_SOUND_CATALOG[assignedSound].name;
    document.getElementById('reward-sticker-author').textContent = newSticker.author;
    document.getElementById('reward-sticker-license').textContent = newSticker.license;

    const sourceLink = document.getElementById('reward-sticker-source-link');
    if (sourceLink) sourceLink.href = newSticker.sourceUrl;

    modal.classList.add('is-open');

    const placeNowBtn = document.getElementById('btn-reward-place-now');
    placeNowBtn.onclick = async () => {
      modal.classList.remove('is-open');
      await this.switchTab('diary');
      await diaryController.placeSticker(newSticker);
    };

    const closeBtn = document.getElementById('btn-close-reward-modal');
    closeBtn.onclick = () => {
      modal.classList.remove('is-open');
    };
  }

  openTaskModal(existingTask = null) {
    this.editingTaskId = existingTask ? existingTask.id : null;
    const modal = document.getElementById('task-modal');
    const modalTitle = document.getElementById('task-modal-title');
    const titleInput = document.getElementById('task-input-title');
    const dateInput = document.getElementById('task-input-date');
    const timeInput = document.getElementById('task-input-time');
    const catSelect = document.getElementById('task-input-category');
    const prioSelect = document.getElementById('task-input-priority');

    if (existingTask) {
      modalTitle.textContent = '일정 수정';
      titleInput.value = existingTask.title;
      dateInput.value = existingTask.date;
      timeInput.value = existingTask.time || '';
      catSelect.value = existingTask.category || 'daily';
      prioSelect.value = existingTask.priority || 'medium';
    } else {
      modalTitle.textContent = '새 일정 작성';
      titleInput.value = '';
      dateInput.value = this.currentDate;
      timeInput.value = '';
      catSelect.value = 'cat';
      prioSelect.value = 'medium';
    }

    modal.classList.add('is-open');
    titleInput.focus();
  }

  closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('is-open');
    this.editingTaskId = null;
  }

  async handleTaskFormSubmit() {
    const title = document.getElementById('task-input-title').value.trim();
    const date = document.getElementById('task-input-date').value;
    const time = document.getElementById('task-input-time').value;
    const category = document.getElementById('task-input-category').value;
    const priority = document.getElementById('task-input-priority').value;

    if (!title) {
      alert('일정 내용을 입력해 주세요.');
      return;
    }

    if (this.editingTaskId) {
      await scheduleController.updateTask(this.editingTaskId, { title, date, time, category, priority });
    } else {
      await scheduleController.addTask({ title, date, time, category, priority });
    }

    this.closeTaskModal();
    await this.refreshScheduleView();
  }

  // --- Search View ---
  setupSearchView() {
    const searchForm = document.getElementById('cat-search-form');
    const searchInput = document.getElementById('cat-search-input');

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = (searchInput?.value || '').trim();
        this.performCatSearch(q);
      });
    }

    document.querySelectorAll('.cat-search-tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query;
        if (searchInput) searchInput.value = query;
        this.performCatSearch(query);
      });
    });
  }

  async performCatSearch(query) {
    const resultsContainer = document.getElementById('cat-search-results-grid');
    const errorBanner = document.getElementById('search-error-banner');
    const loadingEl = document.getElementById('search-loading-spinner');

    if (!resultsContainer) return;

    if (loadingEl) loadingEl.style.display = 'flex';
    resultsContainer.innerHTML = '';
    if (errorBanner) errorBanner.style.display = 'none';

    try {
      const res = await wikimediaService.searchCats(query);
      if (loadingEl) loadingEl.style.display = 'none';

      if (res.isFallback && res.errorMessage && errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.innerHTML = `<strong>안내:</strong> ${this.escapeHtml(res.errorMessage)}`;
      }

      if (res.items.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state-card" style="grid-column: 1 / -1;">
            <p class="empty-title">검색된 고양이가 없습니다</p>
            <p class="empty-desc">다른 단어로 검색해 보세요. (예: cute cat, sleeping cat, 치즈태비)</p>
          </div>
        `;
        return;
      }

      for (const item of res.items) {
        const card = document.createElement('div');
        card.className = 'cat-result-card';
        card.innerHTML = `
          <div class="card-thumb-wrap">
            <img src="${item.thumbnailUrl}" alt="${this.escapeHtml(item.title)}" loading="lazy" />
          </div>
          <div class="card-content">
            <h4 class="card-title">${this.escapeHtml(item.title)}</h4>
            <div class="card-meta">
              <span>작가: ${this.escapeHtml(item.author)}</span>
              <span><a href="${item.licenseUrl}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(item.license)}</a></span>
            </div>
            <button class="btn btn-outline btn-sm btn-make-sticker" style="margin-top: 10px; width: 100%;">
              스티커 만들기
            </button>
          </div>
        `;

        const btn = card.querySelector('.btn-make-sticker');
        btn.addEventListener('click', () => {
          this.openStudioModal(item);
        });

        resultsContainer.appendChild(card);
      }

    } catch (err) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.innerHTML = `<strong>오류:</strong> ${this.escapeHtml(err.message || '이미지를 검색하지 못했습니다.')}`;
      }
    }
  }

  // --- Sticker Studio Modal (Die-cut & Sound Selection) ---
  setupStudioModal() {
    const closeBtn = document.getElementById('btn-close-studio');
    const saveBtn = document.getElementById('btn-studio-save-sticker');
    const retryBtn = document.getElementById('btn-studio-retry-cutout');
    const useFramedBtn = document.getElementById('btn-studio-use-framed');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeStudioModal());

    // Style switch
    document.querySelectorAll('.studio-style-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.studio-style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFrameStyle = btn.dataset.style;
        await this.generateStickerPreview();
      });
    });

    // Sound selection radio buttons & preview listeners
    document.querySelectorAll('.sound-option-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-sound-preview')) return;
        const soundType = card.dataset.sound;
        this.selectedSoundType = soundType;
        document.querySelectorAll('.sound-option-card').forEach(c => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
      });

      const previewBtn = card.querySelector('.btn-sound-preview');
      if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const soundType = card.dataset.sound;
          soundManager.play(soundType, 'preview_' + soundType);
        });
      }
    });

    // Tolerance slider
    const tolSlider = document.getElementById('studio-tolerance-slider');
    const tolVal = document.getElementById('studio-tolerance-val');
    if (tolSlider) {
      tolSlider.addEventListener('input', (e) => {
        if (tolVal) tolVal.textContent = e.target.value;
      });
      tolSlider.addEventListener('change', async () => {
        if (this.currentFrameStyle === 'cutout') {
          await this.generateStickerPreview();
        }
      });
    }

    if (retryBtn) retryBtn.addEventListener('click', () => this.generateStickerPreview());

    if (useFramedBtn) {
      useFramedBtn.addEventListener('click', async () => {
        this.currentFrameStyle = 'polaroid';
        document.querySelectorAll('.studio-style-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.style === 'polaroid');
        });
        await this.generateStickerPreview();
      });
    }

    if (saveBtn) saveBtn.addEventListener('click', () => this.saveStudioStickerToCollection());
  }

  openStudioModal(item) {
    this.currentStudioItem = item;
    this.currentFrameStyle = 'cutout';
    this.currentCutoutDataUrl = null;
    this.selectedSoundType = 'meow'; // Default selected

    const modal = document.getElementById('studio-modal');
    const titleInput = document.getElementById('studio-sticker-name-input');
    const authorSpan = document.getElementById('studio-meta-author');
    const licenseSpan = document.getElementById('studio-meta-license');
    const sourceLink = document.getElementById('studio-meta-source');

    if (titleInput) titleInput.value = `${item.title.slice(0, 18)} 스티커`;
    if (authorSpan) authorSpan.textContent = item.author;
    if (licenseSpan) licenseSpan.textContent = item.license;
    if (sourceLink) {
      sourceLink.href = item.sourceUrl;
      sourceLink.textContent = item.source || 'Wikimedia Commons';
    }

    // Reset sound options UI
    document.querySelectorAll('.sound-option-card').forEach(c => {
      c.classList.toggle('is-selected', c.dataset.sound === 'meow');
    });

    document.querySelectorAll('.studio-style-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.style === 'cutout');
    });

    modal.classList.add('is-open');
    this.generateStickerPreview();
  }

  closeStudioModal() {
    soundManager.stop();
    const modal = document.getElementById('studio-modal');
    if (modal) modal.classList.remove('is-open');
    this.currentStudioItem = null;
    this.currentCutoutDataUrl = null;
  }

  async generateStickerPreview() {
    if (!this.currentStudioItem) return;

    const previewImg = document.getElementById('studio-preview-img');
    const loadingOverlay = document.getElementById('studio-loading-overlay');
    const errorBox = document.getElementById('studio-error-box');
    const errorReason = document.getElementById('studio-error-reason');
    const tolGroup = document.getElementById('studio-tolerance-group');

    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (errorBox) errorBox.style.display = 'none';

    if (tolGroup) {
      tolGroup.style.display = this.currentFrameStyle === 'cutout' ? 'block' : 'none';
    }

    const item = this.currentStudioItem;
    const imgUrl = item.thumbnailUrl || item.imageUrl;
    const tolerance = parseInt(document.getElementById('studio-tolerance-slider')?.value || '44', 10);

    try {
      if (this.currentFrameStyle === 'cutout') {
        const resultUrl = await bgRemover.removeBackground(imgUrl, {
          tolerance,
          addStickerBorder: true,
          borderWidth: 12
        });
        this.currentCutoutDataUrl = resultUrl;
        if (previewImg) previewImg.src = resultUrl;
      } else {
        const framedUrl = await bgRemover.createFramedSticker(
          imgUrl,
          this.currentFrameStyle,
          `${item.title.slice(0, 14)}`
        );
        this.currentCutoutDataUrl = framedUrl;
        if (previewImg) previewImg.src = framedUrl;
      }
    } catch (err) {
      console.warn('Background removal error:', err);
      if (errorBox) {
        errorBox.style.display = 'block';
        if (errorReason) {
          errorReason.textContent = err.reason || '배경과 고양이의 실루엣을 분리하지 못했습니다.';
        }
      }
      if (previewImg) previewImg.src = imgUrl;
      this.currentCutoutDataUrl = null; // Do not allow saving broken cutout
    } finally {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }

  async saveStudioStickerToCollection() {
    if (!this.currentCutoutDataUrl) {
      alert('배경 분리가 완료되지 않았거나 오류가 발생했습니다. 감도를 조절해 다시 시도하거나 프레임 스티커를 선택해 주세요.');
      return;
    }

    const item = this.currentStudioItem;
    const nameInput = document.getElementById('studio-sticker-name-input');
    const stickerName = (nameInput?.value || '').trim() || `${item.title.slice(0, 18)} 스티커`;

    const newSticker = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: stickerName,
      imageUrl: this.currentCutoutDataUrl,
      thumbnailUrl: this.currentCutoutDataUrl,
      isCutout: this.currentFrameStyle === 'cutout',
      borderStyle: this.currentFrameStyle,
      soundType: this.selectedSoundType || 'none',
      author: item.author,
      license: item.license,
      licenseUrl: item.licenseUrl,
      source: item.source || 'Wikimedia Commons',
      sourceUrl: item.sourceUrl,
      obtainedVia: 'search',
      createdAt: new Date().toISOString()
    };

    await db.saveSticker(newSticker);
    this.closeStudioModal();
    await this.refreshStickerBox();
    this.showToast(`"${stickerName}" 스티커가 보관함에 저장되었습니다.`);
  }

  // --- Sticker Box View ---
  setupStickerBoxView() {
    document.querySelectorAll('.sticker-box-filter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.sticker-box-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await this.refreshStickerBox(btn.dataset.filter);
      });
    });
  }

  async refreshStickerBox(filter = 'all') {
    const list = await db.getAllStickers();
    const grid = document.getElementById('sticker-box-grid');
    const countBadge = document.getElementById('sticker-box-total-count');

    if (countBadge) countBadge.textContent = `${list.length} stickers`;
    if (!grid) return;

    let filtered = list;
    if (filter === 'cutout') {
      filtered = list.filter(s => s.isCutout);
    } else if (filter === 'reward') {
      filtered = list.filter(s => s.obtainedVia === 'reward');
    }

    grid.innerHTML = '';

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <p class="empty-title">보관함에 스티커가 없습니다</p>
          <p class="empty-desc">일정을 완료해 보상 스티커를 받거나 '고양이 스티커 찾기'에서 만들어 보세요.</p>
          <button class="btn btn-outline btn-sm" onclick="window.catApp.switchTab('search')">스티커 찾으러 가기</button>
        </div>
      `;
      return;
    }

    for (const sticker of filtered) {
      const card = document.createElement('div');
      card.className = 'sticker-box-card';
      const soundDef = CAT_SOUND_CATALOG[sticker.soundType || 'none'];

      card.innerHTML = `
        <div class="sticker-thumb-wrap">
          <img src="${sticker.imageUrl}" alt="${this.escapeHtml(sticker.name)}" />
          ${sticker.soundType && sticker.soundType !== 'none' ? `<button class="sound-tag-btn btn-play-box-sound" title="소리 미리듣기">♪ ${soundDef.name.split(' ')[0]}</button>` : ''}
        </div>
        <div class="sticker-info">
          <h4 class="sticker-title">${this.escapeHtml(sticker.name)}</h4>
          <p class="sticker-credit">${this.escapeHtml(sticker.author || 'Wikimedia')} • ${this.escapeHtml(sticker.license || 'CC')}</p>
        </div>
        <div class="sticker-card-btns">
          <button class="btn btn-primary btn-sm btn-place-on-diary" data-id="${sticker.id}">다이어리에 붙이기</button>
          <button class="btn-text-action btn-del-sticker" data-id="${sticker.id}">삭제</button>
        </div>
      `;

      // Sound play button inside box
      const playSoundBtn = card.querySelector('.btn-play-box-sound');
      if (playSoundBtn) {
        playSoundBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          soundManager.play(sticker.soundType, 'box_' + sticker.id);
        });
      }

      const placeBtn = card.querySelector('.btn-place-on-diary');
      placeBtn.addEventListener('click', async () => {
        await this.switchTab('diary');
        await diaryController.placeSticker(sticker);
        this.showToast('스티커를 다이어리에 붙였습니다. 스티커를 탭하면 고양이 소리가 납니다.');
      });

      const delBtn = card.querySelector('.btn-del-sticker');
      delBtn.addEventListener('click', async () => {
        if (confirm(`"${sticker.name}" 스티커를 삭제하시겠습니까?`)) {
          await db.deleteSticker(sticker.id);
          await this.refreshStickerBox(filter);
        }
      });

      grid.appendChild(card);
    }
  }

  // --- Stats View ---
  setupStatsView() {}

  async refreshStatsView() {
    const stats = await scheduleController.getRecent7DaysRecord(this.currentDate);

    const streakEl = document.getElementById('stats-streak-count');
    if (streakEl) streakEl.textContent = `${stats.streak}일 연속`;

    const totalEl = document.getElementById('stats-week-total-count');
    if (totalEl) totalEl.textContent = `${stats.totalCompletedWeek}개`;

    const chartContainer = document.getElementById('stats-7days-chart-grid');
    if (!chartContainer) return;

    chartContainer.innerHTML = '';

    for (const d of stats.days) {
      const col = document.createElement('div');
      col.className = `day-stat-col ${d.isToday ? 'is-today' : ''} ${d.isCurrentSelected ? 'is-selected' : ''}`;
      col.innerHTML = `
        <div class="day-stat-card">
          <div class="day-date-label">${d.displayDate}</div>
          <div class="day-name-label">${d.dayName}</div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="height: ${Math.max(6, d.percentage)}%"></div>
          </div>
          <div class="day-pct-label">${d.percentage}%</div>
          <div class="day-tasks-label">${d.completed}/${d.total}</div>
        </div>
      `;

      col.addEventListener('click', () => {
        this.setDate(d.date);
        this.switchTab('schedule');
      });

      chartContainer.appendChild(col);
    }
  }

  // --- Diary Toolbar ---
  setupDiaryToolbar() {
    const datePicker = document.getElementById('diary-date-picker');
    if (datePicker) datePicker.addEventListener('change', (e) => this.setDate(e.target.value));

    const prevDateBtn = document.getElementById('diary-prev-date-btn');
    const nextDateBtn = document.getElementById('diary-next-date-btn');
    if (prevDateBtn) prevDateBtn.addEventListener('click', () => this.shiftDate(-1));
    if (nextDateBtn) nextDateBtn.addEventListener('click', () => this.shiftDate(1));

    const clearStickersBtn = document.getElementById('btn-clear-diary-stickers');
    if (clearStickersBtn) {
      clearStickersBtn.addEventListener('click', async () => {
        if (confirm('오늘 다이어리의 배치된 스티커를 모두 지우시겠습니까?')) {
          await db.clearPlacedStickersForDate(this.currentDate);
          await diaryController.loadDate(this.currentDate);
        }
      });
    }

    const exportBtn = document.getElementById('btn-export-diary-image');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '저장 중...';

        diaryController.deselectAll();

        const title = (document.getElementById('diary-title-input')?.value || '').trim();
        const content = (document.getElementById('diary-content-input')?.value || '').trim();

        const success = await diaryExporter.exportToImage({
          date: this.currentDate,
          title,
          content,
          weather: diaryController.weather,
          mood: diaryController.mood,
          paperTheme: diaryController.paperTheme,
          stickers: diaryController.placedStickers,
          boardEl: diaryController.boardEl
        });

        exportBtn.disabled = false;
        exportBtn.innerHTML = '이미지 저장';

        if (success) {
          this.showToast('다이어리 페이지가 PNG 이미지로 저장되었습니다.');
        } else {
          alert('이미지 저장 중 오류가 발생했습니다.');
        }
      });
    }

    const openDrawerBtn = document.getElementById('btn-open-sticker-drawer');
    const drawer = document.getElementById('diary-sticker-drawer');
    const closeDrawerBtn = document.getElementById('btn-close-sticker-drawer');

    if (openDrawerBtn && drawer) {
      openDrawerBtn.addEventListener('click', async () => {
        await this.renderStickerDrawer();
        drawer.classList.add('is-open');
      });
    }
    if (closeDrawerBtn && drawer) {
      closeDrawerBtn.addEventListener('click', () => {
        drawer.classList.remove('is-open');
      });
    }
  }

  async renderStickerDrawer() {
    const list = await db.getAllStickers();
    const grid = document.getElementById('diary-drawer-stickers-grid');
    if (!grid) return;

    grid.innerHTML = '';
    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <p class="empty-title">보관함에 스티커가 없습니다.</p>
          <button class="btn btn-sm btn-outline" onclick="window.catApp.switchTab('search')">스티커 찾기</button>
        </div>
      `;
      return;
    }

    for (const sticker of list) {
      const item = document.createElement('div');
      item.className = 'drawer-sticker-item';
      item.innerHTML = `
        <img src="${sticker.imageUrl}" alt="${this.escapeHtml(sticker.name)}" />
        <span class="drawer-sticker-name">${this.escapeHtml(sticker.name)}</span>
      `;

      item.addEventListener('click', async () => {
        await diaryController.placeSticker(sticker);
        this.showToast('스티커가 추가되었습니다. 탭하면 소리가 재생됩니다.');
      });

      grid.appendChild(item);
    }
  }

  setupGlobalModals() {
    window.showStickerLicenseModal = (item) => {
      const modal = document.getElementById('license-modal');
      if (!modal) return;
      document.getElementById('lic-modal-title').textContent = item.name || '스티커 정보';
      document.getElementById('lic-modal-author').textContent = item.author || 'Wikimedia Contributor';
      document.getElementById('lic-modal-license').textContent = item.license || 'Creative Commons';
      const sourceLink = document.getElementById('lic-modal-source');
      if (sourceLink) {
        sourceLink.href = item.sourceUrl || 'https://commons.wikimedia.org';
        sourceLink.textContent = item.sourceUrl || 'Wikimedia Commons';
      }

      // Show attached sound license info
      const soundDef = CAT_SOUND_CATALOG[item.soundType || 'none'];
      const soundInfoEl = document.getElementById('lic-modal-sound-info');
      if (soundInfoEl) {
        if (soundDef && soundDef.id !== 'none') {
          soundInfoEl.innerHTML = `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #D9D2C7;">
              <strong>연결된 고양이 음원:</strong> ${soundDef.name}<br />
              <strong>음원 저작자:</strong> ${soundDef.author}<br />
              <strong>음원 라이선스:</strong> ${soundDef.license}<br />
              <strong>음원 출처:</strong> <a href="${soundDef.sourceUrl}" target="_blank" rel="noopener noreferrer">${soundDef.source}</a>
            </div>
          `;
        } else {
          soundInfoEl.innerHTML = '<div style="margin-top: 12px; color: #8A8175;">연결된 음원: 무음</div>';
        }
      }

      modal.classList.add('is-open');
    };

    const closeLicBtn = document.getElementById('btn-close-license-modal');
    if (closeLicBtn) {
      closeLicBtn.addEventListener('click', () => {
        document.getElementById('license-modal')?.classList.remove('is-open');
      });
    }
  }

  showToast(msg) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.catApp = new CatStickerApp();
window.addEventListener('DOMContentLoaded', () => {
  window.catApp.init();
});
