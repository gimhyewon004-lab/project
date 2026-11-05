/**
 * IndexedDB & LocalStorage persistent storage manager for Cat Sticker Diary
 * Supports schedules, stickers, diary entries, and placed diary stickers.
 */

const DB_NAME = 'CatStickerDiaryDB';
const DB_VERSION = 1;

class DiaryDatabase {
  constructor() {
    this.db = null;
    this.readyPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to LocalStorage');
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Schedules store
        if (!db.objectStoreNames.contains('schedules')) {
          const scheduleStore = db.createObjectStore('schedules', { keyPath: 'id' });
          scheduleStore.createIndex('date', 'date', { unique: false });
          scheduleStore.createIndex('completed', 'completed', { unique: false });
        }

        // 2. Sticker collection store
        if (!db.objectStoreNames.contains('stickers')) {
          const stickerStore = db.createObjectStore('stickers', { keyPath: 'id' });
          stickerStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 3. Diary entries store (one entry per date)
        if (!db.objectStoreNames.contains('diary_entries')) {
          db.createObjectStore('diary_entries', { keyPath: 'date' });
        }

        // 4. Placed stickers on diary store
        if (!db.objectStoreNames.contains('placed_stickers')) {
          const placedStore = db.createObjectStore('placed_stickers', { keyPath: 'id' });
          placedStore.createIndex('date', 'date', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        resolve(null); // fallback to localStorage
      };
    });
  }

  // Generic helper for object store operations
  async execute(storeName, mode, callback) {
    await this.readyPromise;
    if (this.db) {
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction(storeName, mode);
          const store = transaction.objectStore(storeName);
          const request = callback(store);

          request.onsuccess = () => resolve(request.result);
          request.onerror = (e) => reject(e.target.error);
        } catch (err) {
          reject(err);
        }
      });
    } else {
      // LocalStorage fallback
      return this.executeFallback(storeName, mode, callback);
    }
  }

  // --- LocalStorage Fallback Methods ---
  executeFallback(storeName, mode, callback) {
    const key = `csd_${storeName}`;
    const raw = localStorage.getItem(key);
    let items = raw ? JSON.parse(raw) : [];

    const mockStore = {
      getAll: () => ({ result: items, onsuccess: null }),
      get: (id) => ({ result: items.find((i) => (i.id || i.date) === id), onsuccess: null }),
      put: (item) => {
        const idKey = item.id ? 'id' : 'date';
        const idx = items.findIndex((i) => i[idKey] === item[idKey]);
        if (idx >= 0) items[idx] = item;
        else items.push(item);
        localStorage.setItem(key, JSON.stringify(items));
        return { result: item, onsuccess: null };
      },
      delete: (id) => {
        items = items.filter((i) => (i.id || i.date) !== id);
        localStorage.setItem(key, JSON.stringify(items));
        return { result: id, onsuccess: null };
      },
      clear: () => {
        items = [];
        localStorage.setItem(key, JSON.stringify(items));
        return { result: true, onsuccess: null };
      }
    };

    const req = callback(mockStore);
    return Promise.resolve(req.result);
  }

  // --- Schedules (Todos) ---
  async getAllSchedules() {
    return this.execute('schedules', 'readonly', (store) => store.getAll());
  }

  async getSchedulesByDate(dateStr) {
    const all = await this.getAllSchedules();
    return (all || []).filter((s) => s.date === dateStr);
  }

  async saveSchedule(schedule) {
    return this.execute('schedules', 'readwrite', (store) => store.put(schedule));
  }

  async deleteSchedule(id) {
    return this.execute('schedules', 'readwrite', (store) => store.delete(id));
  }

  // --- Sticker Collection ---
  async getAllStickers() {
    const list = await this.execute('stickers', 'readonly', (store) => store.getAll());
    return (list || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getStickerById(id) {
    return this.execute('stickers', 'readonly', (store) => store.get(id));
  }

  async saveSticker(sticker) {
    return this.execute('stickers', 'readwrite', (store) => store.put(sticker));
  }

  async deleteSticker(id) {
    return this.execute('stickers', 'readwrite', (store) => store.delete(id));
  }

  // --- Diary Entries ---
  async getDiaryEntry(dateStr) {
    return this.execute('diary_entries', 'readonly', (store) => store.get(dateStr));
  }

  async saveDiaryEntry(entry) {
    return this.execute('diary_entries', 'readwrite', (store) => store.put(entry));
  }

  // --- Placed Stickers on Diary ---
  async getPlacedStickers(dateStr) {
    const all = await this.execute('placed_stickers', 'readonly', (store) => store.getAll());
    return (all || []).filter((p) => p.date === dateStr);
  }

  async savePlacedSticker(placedSticker) {
    return this.execute('placed_stickers', 'readwrite', (store) => store.put(placedSticker));
  }

  async deletePlacedSticker(id) {
    return this.execute('placed_stickers', 'readwrite', (store) => store.delete(id));
  }

  async clearPlacedStickersForDate(dateStr) {
    const list = await this.getPlacedStickers(dateStr);
    for (const item of list) {
      await this.deletePlacedSticker(item.id);
    }
  }
}

export const db = new DiaryDatabase();
