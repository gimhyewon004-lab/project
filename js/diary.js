/**
 * Diary Scrapbook Controller
 * Interactive canvas board for diary entries and cat sticker decoration.
 * Supports:
 * - Touch & Mouse drag, scale, rotate, delete, layering
 * - Tap to play sticker's cat sound (Meow, Purr, Hiss, None)
 * - Single sound playback (stop/replay on re-tap)
 * - Clean editorial stationery paper styles
 * - Auto-persistence per date in IndexedDB
 */

import { db } from './db.js';
import { soundManager } from './sound-manager.js';

export class DiaryController {
  constructor() {
    this.currentDate = this.getTodayDateString();
    this.boardEl = null;
    this.placedStickers = [];
    this.selectedStickerId = null;
    this.isDragging = false;
    this.isResizing = false;
    this.isRotating = false;
    this.hasMoved = false; // Distinguish click/tap from drag
    this.dragStart = { x: 0, y: 0 };
    this.activeActionHandler = null;
    this.paperTheme = 'cream';
    this.weather = 'sunny';
    this.mood = 'calm';
  }

  getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async init(boardElementId = 'diary-canvas-board') {
    this.boardEl = document.getElementById(boardElementId);
    if (!this.boardEl) return;

    this.bindEvents();
    await this.loadDate(this.currentDate);
  }

  bindEvents() {
    this.boardEl.addEventListener('pointerdown', (e) => {
      if (e.target === this.boardEl || e.target.classList.contains('diary-text-container') || e.target.classList.contains('diary-title-input') || e.target.classList.contains('diary-content-input')) {
        this.deselectAll();
      }
    });

    window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    window.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

    window.addEventListener('keydown', (e) => {
      if (this.selectedStickerId && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          e.preventDefault();
          this.removePlacedSticker(this.selectedStickerId);
        }
      }
    });

    document.querySelectorAll('.paper-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setPaperTheme(btn.dataset.theme);
      });
    });

    document.querySelectorAll('.weather-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setWeather(btn.dataset.weather);
      });
    });

    document.querySelectorAll('.mood-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setMood(btn.dataset.mood);
      });
    });

    const titleInput = document.getElementById('diary-title-input');
    const contentInput = document.getElementById('diary-content-input');
    if (titleInput) titleInput.addEventListener('input', () => this.saveDiaryText());
    if (contentInput) contentInput.addEventListener('input', () => this.saveDiaryText());
  }

  async loadDate(dateStr) {
    this.currentDate = dateStr;
    this.deselectAll();

    const entry = await db.getDiaryEntry(dateStr);
    const titleInput = document.getElementById('diary-title-input');
    const contentInput = document.getElementById('diary-content-input');
    const dateDisplay = document.getElementById('diary-current-date-display');
    const datePicker = document.getElementById('diary-date-picker');

    if (dateDisplay) {
      const parts = dateStr.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const weekDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
      dateDisplay.textContent = `${parts[0]}.${parts[1]}.${parts[2]} ${weekDay}`;
    }

    if (datePicker) datePicker.value = dateStr;

    if (entry) {
      if (titleInput) titleInput.value = entry.title || '';
      if (contentInput) contentInput.value = entry.content || '';
      this.setPaperTheme(entry.paperTheme || 'cream', false);
      this.setWeather(entry.weather || 'sunny', false);
      this.setMood(entry.mood || 'calm', false);
    } else {
      if (titleInput) titleInput.value = '';
      if (contentInput) contentInput.value = '';
      this.setPaperTheme('cream', false);
      this.setWeather('sunny', false);
      this.setMood('calm', false);
    }

    this.placedStickers = (await db.getPlacedStickers(dateStr)) || [];
    this.renderStickers();
  }

  setPaperTheme(theme, save = true) {
    this.paperTheme = theme;
    if (this.boardEl) {
      this.boardEl.className = `diary-board theme-${theme}`;
    }
    document.querySelectorAll('.paper-theme-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
    if (save) this.saveDiaryText();
  }

  setWeather(w, save = true) {
    this.weather = w;
    document.querySelectorAll('.weather-select-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.weather === w);
    });
    if (save) this.saveDiaryText();
  }

  setMood(m, save = true) {
    this.mood = m;
    document.querySelectorAll('.mood-select-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mood === m);
    });
    if (save) this.saveDiaryText();
  }

  async saveDiaryText() {
    const title = (document.getElementById('diary-title-input')?.value || '').trim();
    const content = (document.getElementById('diary-content-input')?.value || '').trim();

    await db.saveDiaryEntry({
      date: this.currentDate,
      title,
      content,
      paperTheme: this.paperTheme,
      weather: this.weather,
      mood: this.mood,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Place a sticker onto the diary
   */
  async placeSticker(sticker, initialX = null, initialY = null) {
    const boardRect = this.boardEl.getBoundingClientRect();
    const w = 150;
    const h = 150;
    const x = initialX !== null ? initialX : Math.max(30, (boardRect.width - w) / 2 + (Math.random() * 40 - 20));
    const y = initialY !== null ? initialY : Math.max(30, (boardRect.height - h) / 2 + (Math.random() * 40 - 20));
    const maxZ = this.placedStickers.reduce((max, s) => Math.max(max, s.zIndex || 1), 1);

    const newPlaced = {
      id: `placed_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      date: this.currentDate,
      stickerId: sticker.id,
      name: sticker.name || '고양이 스티커',
      imageUrl: sticker.imageUrl,
      thumbnailUrl: sticker.thumbnailUrl || sticker.imageUrl,
      soundType: sticker.soundType || 'meow', // Default sound or sticker sound
      author: sticker.author,
      license: sticker.license,
      sourceUrl: sticker.sourceUrl,
      x: Math.round(x),
      y: Math.round(y),
      width: w,
      height: h,
      rotation: Math.round(Math.random() * 12 - 6),
      zIndex: maxZ + 1
    };

    this.placedStickers.push(newPlaced);
    await db.savePlacedSticker(newPlaced);
    this.renderStickers();
    this.selectSticker(newPlaced.id);

    // Play sticker sound once on placement if enabled
    if (newPlaced.soundType && newPlaced.soundType !== 'none') {
      soundManager.play(newPlaced.soundType, newPlaced.id);
    }

    return newPlaced;
  }

  renderStickers() {
    const existing = this.boardEl.querySelectorAll('.placed-sticker');
    existing.forEach(el => el.remove());

    this.placedStickers.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));

    for (const item of this.placedStickers) {
      const el = document.createElement('div');
      el.className = `placed-sticker ${this.selectedStickerId === item.id ? 'is-selected' : ''}`;
      el.id = `sticker-${item.id}`;
      el.style.left = `${item.x}px`;
      el.style.top = `${item.y}px`;
      el.style.width = `${item.width}px`;
      el.style.height = `${item.height}px`;
      el.style.transform = `rotate(${item.rotation || 0}deg)`;
      el.style.zIndex = item.zIndex || 1;

      const soundBadge = item.soundType && item.soundType !== 'none'
        ? `<span class="sticker-sound-pill" title="탭하면 소리가 재생됩니다">${this.getSoundLabel(item.soundType)}</span>`
        : '';

      el.innerHTML = `
        <div class="sticker-body">
          <img src="${item.imageUrl}" alt="${item.name || '스티커'}" draggable="false" />
          ${soundBadge}
        </div>
        <div class="sticker-controls">
          <div class="ctrl-btn rotate-handle" title="회전">↻</div>
          <div class="ctrl-btn resize-handle" title="크기 조절">⤡</div>
          <div class="sticker-toolbar">
            <button class="tb-btn tb-sound" title="소리 재생/변경">🔊 ${this.getSoundShortName(item.soundType)}</button>
            <button class="tb-btn tb-forward" title="앞으로">앞으로</button>
            <button class="tb-btn tb-backward" title="뒤로">뒤로</button>
            <button class="tb-btn tb-info" title="출처">출처</button>
            <button class="tb-btn tb-delete" title="삭제">삭제</button>
          </div>
        </div>
      `;

      this.attachStickerHandlers(el, item);
      this.boardEl.appendChild(el);
    }
  }

  getSoundLabel(type) {
    if (type === 'meow') return '♪ 야옹';
    if (type === 'purr') return '♪ 골골송';
    if (type === 'hiss') return '♪ 하악질';
    return '';
  }

  getSoundShortName(type) {
    if (type === 'meow') return '야옹';
    if (type === 'purr') return '골골';
    if (type === 'hiss') return '하악';
    return '무음';
  }

  attachStickerHandlers(el, item) {
    let pointerDownPos = { x: 0, y: 0 };

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.sticker-toolbar')) return;

      e.stopPropagation();
      this.hasMoved = false;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      this.selectSticker(item.id);

      // Handle Resize button
      if (e.target.classList.contains('resize-handle')) {
        this.isResizing = true;
        this.activeActionHandler = item;
        this.dragStart = {
          startX: e.clientX,
          startY: e.clientY,
          startW: item.width,
          startH: item.height,
          aspect: item.width / item.height
        };
        el.setPointerCapture(e.pointerId);
        return;
      }

      // Handle Rotate button
      if (e.target.classList.contains('rotate-handle')) {
        this.isRotating = true;
        this.activeActionHandler = item;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        this.dragStart = {
          centerX,
          centerY,
          startAngle: item.rotation || 0,
          mouseStartAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI)
        };
        el.setPointerCapture(e.pointerId);
        return;
      }

      // Default: Drag to move
      this.isDragging = true;
      this.activeActionHandler = item;
      this.dragStart = {
        x: e.clientX - item.x,
        y: e.clientY - item.y
      };
      el.setPointerCapture(e.pointerId);
    });

    // Handle Tap / Click on the sticker body to play sound
    el.addEventListener('pointerup', (e) => {
      // If the pointer barely moved (< 5px), treat it as an intentional tap/click!
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist < 6 && !e.target.closest('.sticker-toolbar') && !e.target.classList.contains('resize-handle') && !e.target.classList.contains('rotate-handle')) {
        this.triggerStickerSound(item);
      }
    });

    // Toolbar actions
    const soundBtn = el.querySelector('.tb-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cycleStickerSound(item);
      });
    }

    const deleteBtn = el.querySelector('.tb-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removePlacedSticker(item.id);
      });
    }

    const forwardBtn = el.querySelector('.tb-forward');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.bringForward(item.id);
      });
    }

    const backwardBtn = el.querySelector('.tb-backward');
    if (backwardBtn) {
      backwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sendBackward(item.id);
      });
    }

    const infoBtn = el.querySelector('.tb-info');
    if (infoBtn) {
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.showStickerLicenseModal) {
          window.showStickerLicenseModal(item);
        }
      });
    }
  }

  async triggerStickerSound(item) {
    if (!item.soundType || item.soundType === 'none') {
      if (window.catApp && window.catApp.showToast) {
        window.catApp.showToast('🔇 이 스티커는 무음으로 설정되어 있습니다.');
      }
      return;
    }

    if (soundManager.isGlobalMuted()) {
      if (window.catApp && window.catApp.showToast) {
        window.catApp.showToast('🔇 현재 전체 무음 상태입니다. 상단 볼륨 아이콘을 켜보세요.');
      }
      return;
    }

    const el = document.getElementById(`sticker-${item.id}`);
    if (el) {
      el.classList.add('is-playing-sound');
      setTimeout(() => el.classList.remove('is-playing-sound'), 900);
    }

    const played = await soundManager.play(item.soundType, item.id);
    if (!played && !soundManager.isGlobalMuted()) {
      if (window.catApp && window.catApp.showToast) {
        window.catApp.showToast('음원을 불러오지 못해 무음으로 처리되었습니다.');
      }
    }
  }

  async cycleStickerSound(item) {
    // meow -> purr -> hiss -> none -> meow
    const order = ['meow', 'purr', 'hiss', 'none'];
    const currentIdx = order.indexOf(item.soundType || 'meow');
    const nextIdx = (currentIdx + 1) % order.length;
    item.soundType = order[nextIdx];

    await db.savePlacedSticker(item);
    this.renderStickers();
    this.selectSticker(item.id);

    // Play preview of newly chosen sound
    if (item.soundType !== 'none') {
      soundManager.play(item.soundType, item.id);
    } else {
      soundManager.stop();
    }

    if (window.catApp && window.catApp.showToast) {
      window.catApp.showToast(`스티커 소리 변경: ${this.getSoundLabel(item.soundType) || '무음'}`);
    }
  }

  handlePointerMove(e) {
    if (!this.activeActionHandler) return;
    const item = this.activeActionHandler;
    const el = document.getElementById(`sticker-${item.id}`);
    if (!el) return;

    this.hasMoved = true;

    if (this.isDragging) {
      const boardRect = this.boardEl.getBoundingClientRect();
      let newX = e.clientX - this.dragStart.x;
      let newY = e.clientY - this.dragStart.y;

      newX = Math.max(-item.width * 0.4, Math.min(newX, boardRect.width - item.width * 0.6));
      newY = Math.max(-item.height * 0.4, Math.min(newY, boardRect.height - item.height * 0.6));

      item.x = Math.round(newX);
      item.y = Math.round(newY);

      el.style.left = `${item.x}px`;
      el.style.top = `${item.y}px`;
    } else if (this.isResizing) {
      const deltaX = e.clientX - this.dragStart.startX;
      const aspect = this.dragStart.aspect;

      let newWidth = Math.max(60, Math.min(450, this.dragStart.startW + deltaX));
      let newHeight = Math.round(newWidth / aspect);

      item.width = newWidth;
      item.height = newHeight;

      el.style.width = `${newWidth}px`;
      el.style.height = `${newHeight}px`;
    } else if (this.isRotating) {
      const currentAngle = Math.atan2(e.clientY - this.dragStart.centerY, e.clientX - this.dragStart.centerX) * (180 / Math.PI);
      const angleDiff = currentAngle - this.dragStart.mouseStartAngle;
      let newRot = Math.round((this.dragStart.startAngle + angleDiff) % 360);
      if (newRot < 0) newRot += 360;

      for (const snap of [0, 90, 180, 270, 360]) {
        if (Math.abs(newRot - snap) < 4) {
          newRot = snap % 360;
          break;
        }
      }

      item.rotation = newRot;
      el.style.transform = `rotate(${newRot}deg)`;
    }
  }

  async handlePointerUp(e) {
    if (this.activeActionHandler) {
      await db.savePlacedSticker(this.activeActionHandler);
    }
    this.isDragging = false;
    this.isResizing = false;
    this.isRotating = false;
    this.activeActionHandler = null;
  }

  selectSticker(id) {
    this.selectedStickerId = id;
    this.boardEl.querySelectorAll('.placed-sticker').forEach(el => {
      el.classList.toggle('is-selected', el.id === `sticker-${id}`);
    });
  }

  deselectAll() {
    this.selectedStickerId = null;
    this.boardEl.querySelectorAll('.placed-sticker').forEach(el => {
      el.classList.remove('is-selected');
    });
  }

  async removePlacedSticker(id) {
    this.placedStickers = this.placedStickers.filter(s => s.id !== id);
    if (this.selectedStickerId === id) this.selectedStickerId = null;
    await db.deletePlacedSticker(id);
    this.renderStickers();
  }

  async bringForward(id) {
    const item = this.placedStickers.find(s => s.id === id);
    if (!item) return;
    const maxZ = this.placedStickers.reduce((m, s) => Math.max(m, s.zIndex || 1), 1);
    item.zIndex = maxZ + 1;
    await db.savePlacedSticker(item);
    this.renderStickers();
    this.selectSticker(id);
  }

  async sendBackward(id) {
    const item = this.placedStickers.find(s => s.id === id);
    if (!item) return;
    const minZ = this.placedStickers.reduce((m, s) => Math.min(m, s.zIndex || 1), 1);
    item.zIndex = Math.max(1, minZ - 1);
    await db.savePlacedSticker(item);
    this.renderStickers();
    this.selectSticker(id);
  }
}

export const diaryController = new DiaryController();
