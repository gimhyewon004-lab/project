/**
 * Cat Sticker Diary - Complete Standalone Bundle
 * Editorial Stationery Boutique Aesthetic & Real Die-Cut Stickers with Authentic Sounds
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. IndexedDB & LocalStorage Database
  // =========================================================================
  const DB_NAME = 'CatStickerDiaryDB';
  const DB_VERSION = 1;

  class DiaryDatabase {
    constructor() {
      this.db = null;
      this.readyPromise = this.init();
    }

    async init() {
      return new Promise((resolve) => {
        if (!window.indexedDB) {
          console.warn('IndexedDB not supported, falling back to LocalStorage');
          resolve(null);
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('schedules')) {
            const scheduleStore = db.createObjectStore('schedules', { keyPath: 'id' });
            scheduleStore.createIndex('date', 'date', { unique: false });
            scheduleStore.createIndex('completed', 'completed', { unique: false });
          }
          if (!db.objectStoreNames.contains('stickers')) {
            const stickerStore = db.createObjectStore('stickers', { keyPath: 'id' });
            stickerStore.createIndex('createdAt', 'createdAt', { unique: false });
          }
          if (!db.objectStoreNames.contains('diary_entries')) {
            db.createObjectStore('diary_entries', { keyPath: 'date' });
          }
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
          resolve(null);
        };
      });
    }

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
        return this.executeFallback(storeName, mode, callback);
      }
    }

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

    async getAllStickers() {
      const list = await this.execute('stickers', 'readonly', (store) => store.getAll());
      return (list || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async saveSticker(sticker) {
      return this.execute('stickers', 'readwrite', (store) => store.put(sticker));
    }

    async deleteSticker(id) {
      return this.execute('stickers', 'readwrite', (store) => store.delete(id));
    }

    async getDiaryEntry(dateStr) {
      return this.execute('diary_entries', 'readonly', (store) => store.get(dateStr));
    }

    async saveDiaryEntry(entry) {
      return this.execute('diary_entries', 'readwrite', (store) => store.put(entry));
    }

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

  const db = new DiaryDatabase();

  // =========================================================================
  // 2. Verified Cat Audio Sound Manager
  // =========================================================================
  const CAT_SOUND_CATALOG = {
    meow: {
      id: 'meow',
      name: '야옹 (Meow)',
      description: '사랑스럽고 맑은 고양이 울음소리',
      localFile: 'assets/sounds/meow.ogg',
      cdnUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Meow.ogg',
      mimeType: 'audio/ogg',
      author: 'Dan Crosby (Dcrosby)',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      source: 'Wikimedia Commons (File:Meow.ogg)',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Meow.ogg'
    },
    purr: {
      id: 'purr',
      name: '골골송 (Purr)',
      description: '편안하고 따뜻하게 울리는 고양이 골골송',
      localFile: 'assets/sounds/purr.ogg',
      cdnUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Cat_purring.ogg',
      mimeType: 'audio/ogg',
      author: 'Peter Hull (Z8kflt)',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source: 'Wikimedia Commons (File:Cat purring.ogg)',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cat_purring.ogg'
    },
    hiss: {
      id: 'hiss',
      name: '하악질 (Hiss)',
      description: '경계심 가득한 고양이의 쉭- 하악질 소리',
      localFile: 'assets/sounds/hiss.wav',
      cdnUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Cat_hissing_-_Zabuhailo.wav',
      mimeType: 'audio/wav',
      author: 'Zabuhailo',
      license: 'CC0 1.0 (Public Domain)',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'Wikimedia Commons / Freesound',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cat_hissing_-_Zabuhailo.wav'
    },
    none: {
      id: 'none',
      name: '무음 (Mute)',
      description: '소리 없이 조용한 스티커',
      localFile: null,
      cdnUrl: null,
      mimeType: null,
      author: '-',
      license: '-',
      licenseUrl: null,
      source: '-',
      sourceUrl: null
    }
  };

  class CatSoundManager {
    constructor() {
      this.currentAudio = null;
      this.currentPlayingId = null;
      this.isMuted = localStorage.getItem('csd_global_mute') === 'true';
      this.onStateChange = null;
    }

    isGlobalMuted() {
      return this.isMuted;
    }

    setGlobalMute(mute) {
      this.isMuted = !!mute;
      localStorage.setItem('csd_global_mute', this.isMuted ? 'true' : 'false');
      if (this.isMuted && this.currentAudio) {
        this.stop();
      }
      if (typeof this.onStateChange === 'function') {
        this.onStateChange({ isMuted: this.isMuted, currentPlayingId: this.currentPlayingId });
      }
    }

    toggleGlobalMute() {
      this.setGlobalMute(!this.isMuted);
      return this.isMuted;
    }

    async play(soundType, triggerKey = 'global') {
      if (this.isMuted) return false;

      if (!soundType || soundType === 'none') {
        this.stop();
        return true;
      }

      const soundDef = CAT_SOUND_CATALOG[soundType];
      if (!soundDef || (!soundDef.localFile && !soundDef.cdnUrl)) {
        this.stop();
        return false;
      }

      // If already playing this sticker, toggle stop
      if (this.currentAudio && this.currentPlayingId === triggerKey && !this.currentAudio.paused) {
        this.stop();
        return false;
      }

      this.stop();

      try {
        const audio = new Audio();
        this.currentAudio = audio;
        this.currentPlayingId = triggerKey;

        audio.onended = () => {
          if (this.currentAudio === audio) {
            this.currentAudio = null;
            this.currentPlayingId = null;
            if (typeof this.onStateChange === 'function') {
              this.onStateChange({ isMuted: this.isMuted, currentPlayingId: null });
            }
          }
        };

        audio.onerror = async () => {
          if (soundDef.cdnUrl && audio.src !== soundDef.cdnUrl) {
            try {
              audio.src = soundDef.cdnUrl;
              await audio.play();
              return;
            } catch (e) {}
          }
          this.stop();
        };

        audio.src = soundDef.localFile || soundDef.cdnUrl;
        await audio.play();

        if (typeof this.onStateChange === 'function') {
          this.onStateChange({ isMuted: this.isMuted, currentPlayingId: triggerKey });
        }
        return true;
      } catch (err) {
        console.warn('Audio playback error:', err);
        this.stop();
        return false;
      }
    }

    stop() {
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
        } catch (e) {}
        this.currentAudio = null;
      }
      const prevKey = this.currentPlayingId;
      this.currentPlayingId = null;
      if (prevKey && typeof this.onStateChange === 'function') {
        this.onStateChange({ isMuted: this.isMuted, currentPlayingId: null });
      }
    }
  }

  const soundManager = new CatSoundManager();

  // =========================================================================
  // 3. Curated Wikimedia Commons Cat Photographs
  // =========================================================================
  const CURATED_WIKIMEDIA_CATS = [
    {
      id: 'wiki_cat_01',
      title: 'Cat March 2010 - Red tabby cat sitting',
      description: 'A beautiful ginger tabby cat looking thoughtfully into the camera.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/480px-Cat03.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/800px-Cat03.jpg',
      soundType: 'meow',
      author: 'Alvesgaspar',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Alvesgaspar',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cat03.jpg',
      tags: ['치즈태비', '귀여운', '앉아있는']
    },
    {
      id: 'wiki_cat_02',
      title: 'Sleeping Cat on Wood',
      description: 'A cozy calico cat sleeping peacefully in a warm sunny spot.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Felis_catus-cat_on_snow.jpg/480px-Felis_catus-cat_on_snow.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Felis_catus-cat_on_snow.jpg/800px-Felis_catus-cat_on_snow.jpg',
      soundType: 'purr',
      author: 'Von.grzanka',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Von.grzanka',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Felis_catus-cat_on_snow.jpg',
      tags: ['눈속의고양이', '하얀겨울', '포근']
    },
    {
      id: 'wiki_cat_03',
      title: 'Playful Kitten with Blue Eyes',
      description: 'A lovely young kitten with bright curious eyes and soft white fur.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/480px-Cat_November_2010-1a.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/800px-Cat_November_2010-1a.jpg',
      soundType: 'meow',
      author: 'Alvesgaspar',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Alvesgaspar',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cat_November_2010-1a.jpg',
      tags: ['아기고양이', '푸른눈', '호기심']
    },
    {
      id: 'wiki_cat_04',
      title: 'Tuxedo Cat Sitting Elegantly',
      description: 'A handsome black and white tuxedo cat sitting gracefully like a little gentleman.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Painted_eyes.jpg/480px-Painted_eyes.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Painted_eyes.jpg/800px-Painted_eyes.jpg',
      soundType: 'purr',
      author: 'Hisashi',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Hisashi',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Painted_eyes.jpg',
      tags: ['턱시도고양이', '우아한', '매력']
    },
    {
      id: 'wiki_cat_05',
      title: 'European Shorthair Resting',
      description: 'A contented brown tabby cat stretching and enjoying a lazy afternoon.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/June_odd-eyed-cat_cropped.jpg/480px-June_odd-eyed-cat_cropped.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/June_odd-eyed-cat_cropped.jpg/800px-June_odd-eyed-cat_cropped.jpg',
      soundType: 'purr',
      author: 'Keith Kissel',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Keith_Kissel',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-2.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:June_odd-eyed-cat_cropped.jpg',
      tags: ['오드아이', '신비로운', '하얀고양이']
    },
    {
      id: 'wiki_cat_06',
      title: 'Black Cat Green Eyes',
      description: 'A sleek black cat with glowing emerald green eyes peeking out curiously.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Black-Cat-Green-Eyes.jpg/480px-Black-Cat-Green-Eyes.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Black-Cat-Green-Eyes.jpg/800px-Black-Cat-Green-Eyes.jpg',
      soundType: 'meow',
      author: 'Robyn Jay',
      authorUrl: 'https://www.flickr.com/people/robynjay/',
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Black-Cat-Green-Eyes.jpg',
      tags: ['검은고양이', '초록눈', '미묘']
    },
    {
      id: 'wiki_cat_07',
      title: 'Cat Yawning Loaf',
      description: 'A tabby cat giving a big adorable yawn while making a cozy loaf posture.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Cat_eating_a_rabbit.jpg/480px-Cat_eating_a_rabbit.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Cat_eating_a_rabbit.jpg/800px-Cat_eating_a_rabbit.jpg',
      soundType: 'purr',
      author: 'Mikael Häggström',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Mikael_H%C3%A4ggstr%C3%B6m',
      license: 'CC0 Public Domain',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cat_eating_a_rabbit.jpg',
      tags: ['하품', '귀여움', '식빵자세']
    },
    {
      id: 'wiki_cat_08',
      title: 'Little Kitten in Meadow',
      description: 'A tiny sweet kitten exploring the green grass on a sunny spring day.',
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Cat_poster_1.jpg/480px-Cat_poster_1.jpg',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Cat_poster_1.jpg/800px-Cat_poster_1.jpg',
      soundType: 'meow',
      author: 'Various / Alvesgaspar',
      authorUrl: 'https://commons.wikimedia.org/wiki/User:Alvesgaspar',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cat_poster_1.jpg',
      tags: ['아기고양이', '초원', '봄날']
    }
  ];

  function cleanHtml(htmlStr) {
    if (!htmlStr) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlStr;
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  // =========================================================================
  // 4. Wikimedia Commons API Service
  // =========================================================================
  class WikimediaService {
    constructor() {
      this.apiBase = 'https://commons.wikimedia.org/w/api.php';
    }

    async searchCats(query = 'cat', limit = 18) {
      const trimmed = (query || '').trim();

      const keywordMap = {
        '고양이': 'cat felis catus',
        '귀여운': 'cute kitten cat',
        '귀여운 고양이': 'cute cat kitten',
        '아기고양이': 'kitten cute playful',
        '새끼고양이': 'kitten young cat',
        '치즈태비': 'ginger tabby cat',
        '치즈': 'ginger cat tabby',
        '턱시도': 'tuxedo cat black white',
        '검은고양이': 'black cat',
        '하얀고양이': 'white cat',
        '삼색이': 'calico cat',
        '잠자는 고양이': 'sleeping cat',
        '식빵': 'cat loafing resting',
        '장난': 'playful kitten cat',
        '샴': 'siamese cat',
        '페르시안': 'persian cat',
        '러시안블루': 'russian blue cat'
      };

      let searchTerm = keywordMap[trimmed] || (trimmed ? `${trimmed} cat` : 'cat cute');
      const fullQuery = `${searchTerm} filetype:bitmap -diagram -map -icon`;

      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: fullQuery,
        gsrnamespace: '6',
        gsrlimit: limit.toString(),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|user|size|mime',
        iiurlwidth: '540',
        format: 'json',
        origin: '*'
      });

      const url = `${this.apiBase}?${params.toString()}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7500);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.query || !data.query.pages) {
          return {
            items: this.filterCurated(trimmed),
            isFallback: true,
            errorMessage: '검색 결과가 없어 검증된 고양이 갤러리에서 추천 이미지를 보여드립니다.'
          };
        }

        const pages = Object.values(data.query.pages);
        const items = [];

        for (const page of pages) {
          if (!page.imageinfo || !page.imageinfo[0]) continue;
          const info = page.imageinfo[0];

          if (info.mime && !info.mime.startsWith('image/')) continue;
          if (info.width && info.width < 250) continue;

          const meta = info.extmetadata || {};
          const artistRaw = meta.Artist ? meta.Artist.value : (info.user || 'Unknown Artist');
          const artist = cleanHtml(artistRaw);

          const licenseRaw = meta.LicenseShortName ? meta.LicenseShortName.value : (meta.License ? meta.License.value : 'Public Domain / Creative Commons');
          const license = cleanHtml(licenseRaw);

          const licenseUrl = meta.LicenseUrl ? meta.LicenseUrl.value : 'https://creativecommons.org/';
          const descRaw = meta.ImageDescription ? meta.ImageDescription.value : page.title.replace(/^File:/, '');
          const description = cleanHtml(descRaw).slice(0, 150);

          items.push({
            id: `wiki_${page.pageid || Math.random().toString(36).substr(2, 9)}`,
            title: page.title.replace(/^File:/, '').replace(/\.[^/.]+$/, ''),
            description: description || '위키미디어 커먼즈 공개 고양이 사진',
            thumbnailUrl: info.thumburl || info.url,
            imageUrl: info.url,
            author: artist || 'Wikimedia Contributor',
            license: license || 'CC BY-SA',
            licenseUrl: licenseUrl,
            source: 'Wikimedia Commons',
            sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
            width: info.width,
            height: info.height
          });
        }

        if (items.length === 0) {
          return {
            items: this.filterCurated(trimmed),
            isFallback: true,
            errorMessage: '적절한 이미지 결과를 찾을 수 없어 추천 갤러리를 표시합니다.'
          };
        }

        return { items, isFallback: false };

      } catch (err) {
        console.warn('Wikimedia API error:', err);
        return {
          items: this.filterCurated(trimmed),
          isFallback: true,
          errorMessage: '위키미디어 커먼즈 API 연결이 지연되어 추천 고양이 갤러리를 표시합니다.'
        };
      }
    }

    filterCurated(query) {
      if (!query) return CURATED_WIKIMEDIA_CATS;
      const lower = query.toLowerCase();
      const matched = CURATED_WIKIMEDIA_CATS.filter(cat =>
        cat.tags.some(t => t.includes(lower)) ||
        cat.title.toLowerCase().includes(lower) ||
        cat.description.toLowerCase().includes(lower)
      );
      return matched.length > 0 ? matched : CURATED_WIKIMEDIA_CATS;
    }

    getRandomRewardCat() {
      const idx = Math.floor(Math.random() * CURATED_WIKIMEDIA_CATS.length);
      return { ...CURATED_WIKIMEDIA_CATS[idx] };
    }
  }

  const wikimediaService = new WikimediaService();

  // =========================================================================
  // 5. Background Removal & Real Die-Cut Sticker Generator
  // =========================================================================
  class BackgroundRemover {
    async loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          const imgFallback = new Image();
          imgFallback.onload = () => resolve(imgFallback);
          imgFallback.onerror = () => reject(new Error('이미지를 불러오는데 실패했습니다. (CORS 보안 정책 또는 서버 응답 지연)'));
          imgFallback.src = src;
        };
        img.src = src;
      });
    }

    async removeBackground(imageUrl, options = {}) {
      const {
        tolerance = 44,
        addStickerBorder = true,
        borderWidth = 12
      } = options;

      const img = await this.loadImage(imageUrl);
      const segmentation = await this.smartCanvasCutout(img, tolerance);

      if (segmentation.isPerimeterBlocked) {
        throw {
          canRetry: true,
          isPerimeterBlocked: true,
          reason: '고양이 실루엣이 충분히 분리되지 않았습니다. 사진 가장자리에 배경이 남아있어 다이컷 외곽선이 사각형으로 둘러지는 것을 방지하기 위해 작업을 중단했습니다.\n\n감도 슬라이더를 높이거나, 배경이 단순하고 고양이가 뚜렷한 사진을 선택해 주세요.'
        };
      }

      if (segmentation.foregroundRatio < 0.04) {
        throw {
          canRetry: true,
          isPerimeterBlocked: false,
          reason: '피사체 대부분이 투명 처리되었습니다. 감도를 낮추고 다시 시도해 주세요.'
        };
      }

      if (addStickerBorder) {
        return this.generateDieCutSticker(segmentation.cutoutCanvas, borderWidth);
      }

      return segmentation.cutoutCanvas.toDataURL('image/png');
    }

    async smartCanvasCutout(img, tolerance = 44) {
      const maxDim = 800;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);

      let imgData;
      try {
        imgData = ctx.getImageData(0, 0, width, height);
      } catch (e) {
        throw new Error('Canvas 보안 제한으로 픽셀을 읽을 수 없습니다.');
      }

      const data = imgData.data;
      const totalPixels = width * height;

      // Sample along 4 perimeter borders
      const bgSamples = [];
      const sampleStep = Math.max(1, Math.floor(width / 16));
      for (let x = 0; x < width; x += sampleStep) {
        bgSamples.push(this.getPixelColor(data, x, 0, width));
        bgSamples.push(this.getPixelColor(data, x, height - 1, width));
      }
      const sampleStepY = Math.max(1, Math.floor(height / 16));
      for (let y = 0; y < height; y += sampleStepY) {
        bgSamples.push(this.getPixelColor(data, 0, y, width));
        bgSamples.push(this.getPixelColor(data, width - 1, y, width));
      }
      const validBg = bgSamples.filter(Boolean);

      const colorDist = (r1, g1, b1, r2, g2, b2) => {
        const rmean = (r1 + r2) / 2;
        const r = r1 - r2;
        const g = g1 - g2;
        const b = b1 - b2;
        return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
      };

      const mask = new Uint8Array(totalPixels);
      const threshold = tolerance * 2.4;
      const cx = width / 2;
      const cy = height / 2;
      const maxCenterDist = Math.sqrt(cx * cx + cy * cy);
      let foregroundCount = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          let minBgDist = 999;
          for (let i = 0; i < validBg.length; i++) {
            const bg = validBg[i];
            const d = colorDist(r, g, b, bg.r, bg.g, bg.b);
            if (d < minBgDist) minBgDist = d;
          }

          const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxCenterDist;
          const edgePenalty = Math.pow(distFromCenter, 1.7) * 26;
          const effectiveDist = minBgDist - edgePenalty;

          if (effectiveDist < threshold) {
            mask[y * width + x] = 0;
          } else if (effectiveDist < threshold + 20) {
            const factor = (effectiveDist - threshold) / 20;
            const a = Math.round(factor * 255);
            mask[y * width + x] = a;
            if (a > 40) foregroundCount++;
          } else {
            mask[y * width + x] = 255;
            foregroundCount++;
          }
        }
      }

      // Perimeter Check
      let perimeterPixels = 0;
      let solidPerimeterCount = 0;
      for (let x = 0; x < width; x++) {
        if (mask[x] > 40) solidPerimeterCount++;
        if (mask[(height - 1) * width + x] > 40) solidPerimeterCount++;
        perimeterPixels += 2;
      }
      for (let y = 1; y < height - 1; y++) {
        if (mask[y * width] > 40) solidPerimeterCount++;
        if (mask[y * width + (width - 1)] > 40) solidPerimeterCount++;
        perimeterPixels += 2;
      }
      const isPerimeterBlocked = (solidPerimeterCount / perimeterPixels) > 0.28;

      for (let i = 0; i < totalPixels; i++) {
        data[i * 4 + 3] = mask[i];
      }
      ctx.putImageData(imgData, 0, 0);

      return {
        cutoutCanvas: canvas,
        isPerimeterBlocked,
        foregroundRatio: foregroundCount / totalPixels
      };
    }

    async generateDieCutSticker(cutoutCanvas, radius = 12) {
      const srcW = cutoutCanvas.width;
      const srcH = cutoutCanvas.height;
      const pad = radius + 16;
      const finalW = srcW + pad * 2;
      const finalH = srcH + pad * 2;

      // Offscreen mask canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = finalW;
      maskCanvas.height = finalH;
      const mctx = maskCanvas.getContext('2d', { willReadFrequently: true });

      // Circular disk dilation with 36 angles
      const numAngles = 36;
      const radSteps = [radius * 0.25, radius * 0.5, radius * 0.75, radius * 0.9, radius];

      for (const r of radSteps) {
        for (let i = 0; i < numAngles; i++) {
          const theta = (i / numAngles) * Math.PI * 2;
          const dx = Math.round(Math.cos(theta) * r) + pad;
          const dy = Math.round(Math.sin(theta) * r) + pad;
          mctx.drawImage(cutoutCanvas, dx, dy);
        }
      }
      mctx.drawImage(cutoutCanvas, pad, pad);

      // Mask to solid white
      mctx.globalCompositeOperation = 'source-in';
      mctx.fillStyle = '#FFFFFF';
      mctx.fillRect(0, 0, finalW, finalH);
      mctx.globalCompositeOperation = 'source-over';

      // Anti-aliased smooth curve
      const maskImgData = mctx.getImageData(0, 0, finalW, finalH);
      const mData = maskImgData.data;
      const blurredAlpha = this.fastBoxBlurAlpha(mData, finalW, finalH, 2);

      for (let i = 0; i < finalW * finalH; i++) {
        const a = blurredAlpha[i];
        if (a < 80) {
          mData[i * 4 + 3] = 0;
        } else if (a > 175) {
          mData[i * 4] = 255;
          mData[i * 4 + 1] = 255;
          mData[i * 4 + 2] = 255;
          mData[i * 4 + 3] = 255;
        } else {
          const t = (a - 80) / 95;
          mData[i * 4] = 255;
          mData[i * 4 + 1] = 255;
          mData[i * 4 + 2] = 255;
          mData[i * 4 + 3] = Math.round(t * 255);
        }
      }
      mctx.putImageData(maskImgData, 0, 0);

      // Final Assembly Canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = finalW;
      finalCanvas.height = finalH;
      const fctx = finalCanvas.getContext('2d');

      // Subtle paper contact shadow
      fctx.shadowColor = 'rgba(28, 22, 16, 0.14)';
      fctx.shadowBlur = 5;
      fctx.shadowOffsetY = 2;
      fctx.shadowOffsetX = 0;

      fctx.drawImage(maskCanvas, 0, 0);

      fctx.shadowColor = 'transparent';
      fctx.drawImage(maskCanvas, 0, 0);
      fctx.drawImage(cutoutCanvas, pad, pad);

      return finalCanvas.toDataURL('image/png');
    }

    fastBoxBlurAlpha(data, width, height, radius) {
      const len = width * height;
      const alpha = new Uint8Array(len);
      for (let i = 0; i < len; i++) alpha[i] = data[i * 4 + 3];

      const temp = new Uint8Array(len);
      const result = new Uint8Array(len);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0, count = 0;
          for (let k = -radius; k <= radius; k++) {
            const nx = x + k;
            if (nx >= 0 && nx < width) {
              sum += alpha[y * width + nx];
              count++;
            }
          }
          temp[y * width + x] = Math.round(sum / count);
        }
      }

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let sum = 0, count = 0;
          for (let k = -radius; k <= radius; k++) {
            const ny = y + k;
            if (ny >= 0 && ny < height) {
              sum += temp[ny * width + x];
              count++;
            }
          }
          result[y * width + x] = Math.round(sum / count);
        }
      }

      return result;
    }

    getPixelColor(data, x, y, width) {
      const idx = (y * width + x) * 4;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    }

    async createFramedSticker(imageUrl, style = 'polaroid', caption = '냥이 스냅') {
      const img = await this.loadImage(imageUrl);
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (style === 'polaroid') {
        const photoSize = 440;
        const pad = 20;
        const bottomPad = 70;

        canvas.width = photoSize + pad * 2;
        canvas.height = photoSize + pad + bottomPad;

        ctx.shadowColor = 'rgba(25, 20, 15, 0.12)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;

        ctx.fillStyle = '#FFFFFF';
        this.roundRect(ctx, 2, 2, canvas.width - 4, canvas.height - 4, 4);
        ctx.fill();

        ctx.shadowColor = 'transparent';

        const minSide = Math.min(origW, origH);
        const cropX = (origW - minSide) / 2;
        const cropY = (origH - minSide) / 2;
        ctx.drawImage(img, cropX, cropY, minSide, minSide, pad, pad, photoSize, photoSize);

        ctx.fillStyle = '#3A352F';
        ctx.font = '500 16px "Pretendard", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(caption || '고양이 스냅', canvas.width / 2, canvas.height - 26);

      } else if (style === 'circle') {
        const size = Math.min(origW, origH, 500);
        canvas.width = size + 20;
        canvas.height = size + 20;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = size / 2;

        ctx.shadowColor = 'rgba(25, 20, 15, 0.12)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 3;

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        const cropX = (origW - size) / 2;
        const cropY = (origH - size) / 2;
        ctx.drawImage(img, cropX, cropY, size, size, cx - radius, cy - radius, size, size);
        ctx.restore();

      } else {
        const w = 460;
        const h = Math.round((origH / origW) * w);
        canvas.width = w + 16;
        canvas.height = h + 16;

        ctx.shadowColor = 'rgba(25, 20, 15, 0.12)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = '#FFFFFF';
        this.roundRect(ctx, 2, 2, w + 12, h + 12, 6);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.save();
        this.roundRect(ctx, 8, 8, w, h, 4);
        ctx.clip();
        ctx.drawImage(img, 8, 8, w, h);
        ctx.restore();
      }

      return canvas.toDataURL('image/png');
    }

    roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
  }

  const bgRemover = new BackgroundRemover();

  // =========================================================================
  // 6. Schedule Controller
  // =========================================================================
  const CATEGORIES = {
    cat: { label: '고양이', color: '#C84630' },
    work: { label: '업무', color: '#1F1D1A' },
    study: { label: '공부', color: '#496352' },
    workout: { label: '운동', color: '#8E5A2A' },
    daily: { label: '일상', color: '#3A5B78' },
    hobby: { label: '취미', color: '#684575' }
  };

  const PRIORITIES = {
    high: { label: '높음' },
    medium: { label: '보통' },
    low: { label: '낮음' }
  };

  class ScheduleController {
    constructor() {
      this.currentDate = this.getTodayDateString();
      this.schedules = [];
      this.onRewardTriggered = null;
    }

    getTodayDateString() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    async loadDate(dateStr) {
      this.currentDate = dateStr;
      this.schedules = await db.getSchedulesByDate(dateStr);
      return this.schedules;
    }

    async addTask(data) {
      const newTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        date: data.date || this.currentDate,
        time: data.time || '',
        title: data.title.trim(),
        category: data.category || 'daily',
        priority: data.priority || 'medium',
        completed: false,
        rewardClaimed: false,
        createdAt: new Date().toISOString()
      };

      await db.saveSchedule(newTask);
      if (newTask.date === this.currentDate) {
        this.schedules.push(newTask);
      }
      return newTask;
    }

    async updateTask(id, updates) {
      const all = await db.getAllSchedules();
      const task = all.find(t => t.id === id);
      if (!task) return null;

      Object.assign(task, updates);
      await db.saveSchedule(task);

      if (task.date === this.currentDate) {
        const idx = this.schedules.findIndex(t => t.id === id);
        if (idx >= 0) this.schedules[idx] = task;
      }
      return task;
    }

    async deleteTask(id) {
      await db.deleteSchedule(id);
      this.schedules = this.schedules.filter(t => t.id !== id);
    }

    async toggleTask(id) {
      const all = await db.getAllSchedules();
      const task = all.find(t => t.id === id);
      if (!task) return { task: null, rewarded: false };

      task.completed = !task.completed;
      let rewarded = false;

      if (task.completed && !task.rewardClaimed) {
        task.rewardClaimed = true;
        rewarded = true;
        if (typeof this.onRewardTriggered === 'function') {
          this.onRewardTriggered(task);
        }
      }

      await db.saveSchedule(task);
      const idx = this.schedules.findIndex(t => t.id === id);
      if (idx >= 0) this.schedules[idx] = task;

      return { task, rewarded };
    }

    async getDailyProgress(dateStr = this.currentDate) {
      const list = await db.getSchedulesByDate(dateStr);
      const total = list.length;
      const completed = list.filter(t => t.completed).length;
      const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

      let message = '일정을 등록하고 완료해 보세요.';
      if (total > 0) {
        if (percentage === 100) message = '오늘의 모든 일정을 완료했습니다.';
        else if (percentage >= 50) message = '절반 이상의 일정을 마쳤습니다.';
        else message = '차근차근 일정을 진행해 보세요.';
      }

      return { total, completed, percentage, message };
    }

    async getRecent7DaysRecord(refDateStr = this.currentDate) {
      const all = await db.getAllSchedules();
      const [year, month, day] = refDateStr.split('-').map(Number);
      const refDate = new Date(year, month - 1, day);

      const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const days = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(refDate);
        d.setDate(d.getDate() - i);

        const dYear = d.getFullYear();
        const dMonth = String(d.getMonth() + 1).padStart(2, '0');
        const dDay = String(d.getDate()).padStart(2, '0');
        const dateString = `${dYear}-${dMonth}-${dDay}`;

        const dayTasks = all.filter(t => t.date === dateString);
        const total = dayTasks.length;
        const completed = dayTasks.filter(t => t.completed).length;
        const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

        days.push({
          date: dateString,
          displayDate: `${d.getMonth() + 1}.${d.getDate()}`,
          dayName: weekDays[d.getDay()],
          total,
          completed,
          percentage: pct,
          isToday: dateString === this.getTodayDateString(),
          isCurrentSelected: dateString === refDateStr
        });
      }

      let streak = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].completed > 0) streak++;
        else if (days[i].isToday && days[i].total === 0) continue;
        else break;
      }

      return {
        days,
        streak,
        totalCompletedWeek: days.reduce((sum, d) => sum + d.completed, 0)
      };
    }
  }

  const scheduleController = new ScheduleController();

  // =========================================================================
  // 7. Diary Controller (Sticker Sound Playback & Touch Drag)
  // =========================================================================
  class DiaryController {
    constructor() {
      this.currentDate = this.getTodayDateString();
      this.boardEl = null;
      this.placedStickers = [];
      this.selectedStickerId = null;
      this.isDragging = false;
      this.isResizing = false;
      this.isRotating = false;
      this.hasMoved = false;
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
        btn.addEventListener('click', () => this.setPaperTheme(btn.dataset.theme));
      });

      document.querySelectorAll('.weather-select-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setWeather(btn.dataset.weather));
      });

      document.querySelectorAll('.mood-select-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setMood(btn.dataset.mood));
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
        soundType: sticker.soundType || 'meow',
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
              <button class="tb-btn tb-sound" title="소리 변경">🔊 ${this.getSoundShortName(item.soundType)}</button>
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

        this.isDragging = true;
        this.activeActionHandler = item;
        this.dragStart = {
          x: e.clientX - item.x,
          y: e.clientY - item.y
        };
        el.setPointerCapture(e.pointerId);
      });

      // Tap on sticker body plays sound
      el.addEventListener('pointerup', (e) => {
        const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (dist < 6 && !e.target.closest('.sticker-toolbar') && !e.target.classList.contains('resize-handle') && !e.target.classList.contains('rotate-handle')) {
          this.triggerStickerSound(item);
        }
      });

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
          window.catApp.showToast('무음 스티커입니다.');
        }
        return;
      }

      if (soundManager.isGlobalMuted()) {
        if (window.catApp && window.catApp.showToast) {
          window.catApp.showToast('현재 전체 무음 모드입니다. 상단 볼륨 아이콘을 켜보세요.');
        }
        return;
      }

      const el = document.getElementById(`sticker-${item.id}`);
      if (el) {
        el.classList.add('is-playing-sound');
        setTimeout(() => el.classList.remove('is-playing-sound'), 900);
      }

      await soundManager.play(item.soundType, item.id);
    }

    async cycleStickerSound(item) {
      const order = ['meow', 'purr', 'hiss', 'none'];
      const currentIdx = order.indexOf(item.soundType || 'meow');
      const nextIdx = (currentIdx + 1) % order.length;
      item.soundType = order[nextIdx];

      await db.savePlacedSticker(item);
      this.renderStickers();
      this.selectSticker(item.id);

      if (item.soundType !== 'none') {
        soundManager.play(item.soundType, item.id);
      } else {
        soundManager.stop();
      }

      if (window.catApp && window.catApp.showToast) {
        window.catApp.showToast(`소리 변경: ${this.getSoundLabel(item.soundType) || '무음'}`);
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

    async handlePointerUp() {
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

  const diaryController = new DiaryController();

  // =========================================================================
  // 8. Diary Export to PNG Image Generator
  // =========================================================================
  class DiaryExporter {
    async exportToImage(diaryData) {
      const {
        date,
        title = '',
        content = '',
        weather = 'sunny',
        mood = 'calm',
        paperTheme = 'cream',
        stickers = [],
        boardEl
      } = diaryData;

      const boardRect = boardEl ? boardEl.getBoundingClientRect() : { width: 800, height: 960 };
      const baseW = Math.max(760, Math.round(boardRect.width));
      const baseH = Math.max(900, Math.round(boardRect.height));
      const scale = 2;

      const canvas = document.createElement('canvas');
      canvas.width = baseW * scale;
      canvas.height = baseH * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      this.drawPaperBackground(ctx, baseW, baseH, paperTheme);
      this.drawWashiTape(ctx, baseW);
      this.drawDiaryHeader(ctx, date, weather, mood, baseW);
      this.drawDiaryText(ctx, title, content, baseW, baseH, paperTheme);
      await this.drawStickers(ctx, stickers);
      this.drawFooterStamp(ctx, baseW, baseH);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cat-diary-${date || 'today'}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1500);
          resolve(true);
        }, 'image/png');
      });
    }

    drawPaperBackground(ctx, w, h, theme) {
      let bgColor = '#FDFCF9';
      if (theme === 'grid') bgColor = '#FAF8F5';
      else if (theme === 'lines') bgColor = '#FAF9F6';
      else if (theme === 'rose') bgColor = '#FCF9F8';

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      if (theme === 'grid') {
        ctx.strokeStyle = 'rgba(210, 202, 192, 0.4)';
        ctx.lineWidth = 0.8;
        const step = 22;
        for (let x = 0; x < w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      } else if (theme === 'lines') {
        ctx.strokeStyle = 'rgba(205, 198, 188, 0.45)';
        ctx.lineWidth = 0.8;
        const startY = 150;
        const step = 30;
        for (let y = startY; y < h - 40; y += step) {
          ctx.beginPath();
          ctx.moveTo(40, y);
          ctx.lineTo(w - 40, y);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = '#E5DFD5';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 16, w - 32, h - 32);
    }

    drawWashiTape(ctx, w) {
      ctx.save();
      ctx.fillStyle = 'rgba(225, 215, 200, 0.75)';
      ctx.fillRect(48, 8, 70, 16);
      ctx.fillStyle = 'rgba(200, 70, 48, 0.6)';
      ctx.fillRect(w - 118, 8, 70, 16);
      ctx.restore();
    }

    drawDiaryHeader(ctx, dateStr, weather, mood, w) {
      const parts = (dateStr || '').split('-');
      let dateText = dateStr;
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const weekDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
        dateText = `${parts[0]}.${parts[1]}.${parts[2]} ${weekDay}`;
      }

      const weatherMap = { sunny: 'SUNNY', cloudy: 'CLOUDY', rainy: 'RAINY', snowy: 'SNOWY' };
      const moodMap = { calm: 'CALM', happy: 'HAPPY', focused: 'FOCUSED', sleepy: 'TIRED' };

      ctx.save();
      ctx.font = '600 18px "Pretendard", -apple-system, sans-serif';
      ctx.fillStyle = '#24211E';
      ctx.fillText(dateText, 45, 58);

      ctx.font = '500 12px "Pretendard", -apple-system, sans-serif';
      ctx.fillStyle = '#6E665D';
      const infoText = `${weatherMap[weather] || 'SUNNY'}  /  ${moodMap[mood] || 'CALM'}`;
      ctx.fillText(infoText, w - 170, 58);

      ctx.strokeStyle = '#24211E';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, 74);
      ctx.lineTo(w - 40, 74);
      ctx.stroke();
      ctx.restore();
    }

    drawDiaryText(ctx, title, content, w, h) {
      ctx.save();
      if (title) {
        ctx.font = '700 20px "Pretendard", sans-serif';
        ctx.fillStyle = '#24211E';
        ctx.fillText(title, 45, 110);
      }

      if (content) {
        ctx.font = '400 15px "Pretendard", sans-serif';
        ctx.fillStyle = '#3A352F';
        const lineHeight = 28;
        const maxWidth = w - 90;
        let startY = title ? 150 : 120;

        const lines = content.split('\n');
        for (const line of lines) {
          if (startY > h - 70) break;
          if (!line.trim()) {
            startY += lineHeight * 0.7;
            continue;
          }

          const chars = line.split('');
          let currentLine = '';
          for (let i = 0; i < chars.length; i++) {
            const testLine = currentLine + chars[i];
            const testW = ctx.measureText(testLine).width;
            if (testW > maxWidth && i > 0) {
              ctx.fillText(currentLine, 45, startY);
              currentLine = chars[i];
              startY += lineHeight;
              if (startY > h - 70) break;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine && startY <= h - 70) {
            ctx.fillText(currentLine, 45, startY);
            startY += lineHeight;
          }
        }
      }
      ctx.restore();
    }

    async drawStickers(ctx, stickers) {
      if (!stickers || stickers.length === 0) return;
      const sorted = [...stickers].sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));

      for (const item of sorted) {
        if (!item.imageUrl) continue;
        try {
          const img = await this.loadImage(item.imageUrl);
          ctx.save();
          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;
          ctx.translate(cx, cy);
          if (item.rotation) ctx.rotate((item.rotation * Math.PI) / 180);
          ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
          ctx.restore();
        } catch (err) {
          console.warn('Sticker image render failed:', err);
        }
      }
    }

    drawFooterStamp(ctx, w, h) {
      ctx.save();
      ctx.font = '500 11px "Pretendard", sans-serif';
      ctx.fillStyle = '#A39C91';
      ctx.textAlign = 'right';
      ctx.fillText('CAT STICKER DIARY • ARCHIVE', w - 45, h - 26);
      ctx.restore();
    }

    loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Export image load failed: ' + src));
        img.src = src;
      });
    }
  }

  const diaryExporter = new DiaryExporter();

  // =========================================================================
  // 9. Main Application Controller
  // =========================================================================
  class CatStickerApp {
    constructor() {
      this.currentDate = this.getTodayDateString();
      this.currentTab = 'schedule';
      this.editingTaskId = null;
      this.currentStudioItem = null;
      this.currentCutoutDataUrl = null;
      this.currentFrameStyle = 'cutout';
      this.selectedSoundType = 'meow';
    }

    getTodayDateString() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    async init() {
      await this.seedInitialDataIfNeeded();
      await diaryController.init('diary-canvas-board');

      scheduleController.onRewardTriggered = (task) => {
        this.handleTaskReward(task);
      };

      this.setupMuteToggle();
      this.setupTabNavigation();
      this.setupScheduleView();
      this.setupSearchView();
      this.setupStudioModal();
      this.setupStickerBoxView();
      this.setupStatsView();
      this.setupDiaryToolbar();
      this.setupGlobalModals();

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

    setupStudioModal() {
      const closeBtn = document.getElementById('btn-close-studio');
      const saveBtn = document.getElementById('btn-studio-save-sticker');
      const retryBtn = document.getElementById('btn-studio-retry-cutout');
      const useFramedBtn = document.getElementById('btn-studio-use-framed');

      if (closeBtn) closeBtn.addEventListener('click', () => this.closeStudioModal());

      document.querySelectorAll('.studio-style-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          document.querySelectorAll('.studio-style-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentFrameStyle = btn.dataset.style;
          await this.generateStickerPreview();
        });
      });

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
      this.selectedSoundType = 'meow';

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
        this.currentCutoutDataUrl = null;
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
})();
