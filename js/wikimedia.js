/**
 * Wikimedia Commons API integration
 * Open API: No API key required, public domain / Creative Commons licensed media.
 * Full attribution extraction: Author, License, License URL, Source File URL.
 */

import { CURATED_WIKIMEDIA_CATS } from './curated-cats.js';

// Strip HTML tags from MediaWiki extmetadata strings
function cleanHtml(htmlStr) {
  if (!htmlStr) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = htmlStr;
  return (tmp.textContent || tmp.innerText || '').trim();
}

export class WikimediaService {
  constructor() {
    this.apiBase = 'https://commons.wikimedia.org/w/api.php';
  }

  /**
   * Search Wikimedia Commons for cat photographs
   * @param {string} query - search query in Korean or English
   * @param {number} limit - maximum number of results (default 18)
   * @returns {Promise<{items: Array, isFallback: boolean, errorMessage?: string}>}
   */
  async searchCats(query = 'cat', limit = 18) {
    const trimmed = (query || '').trim();
    
    // Map popular Korean cat keywords to helpful English search terms for Wikimedia Commons
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

    // Filter out common non-photo media files like SVG diagrams or icons
    const fullQuery = `${searchTerm} filetype:bitmap -diagram -map -icon`;

    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: fullQuery,
      gsrnamespace: '6', // File: namespace
      gsrlimit: limit.toString(),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|user|size|mime',
      iiurlwidth: '540', // Optimized preview thumbnail width
      format: 'json',
      origin: '*' // Enables Cross-Origin Resource Sharing (CORS)
    });

    const url = `${this.apiBase}?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.query || !data.query.pages) {
        // No results found via API, fallback to curated library
        const filteredCurated = this.filterCurated(trimmed);
        return {
          items: filteredCurated,
          isFallback: true,
          errorMessage: '검색 결과가 없어 엄선된 고양이 갤러리에서 추천 이미지를 보여드립니다.'
        };
      }

      const pages = Object.values(data.query.pages);
      const items = [];

      for (const page of pages) {
        if (!page.imageinfo || !page.imageinfo[0]) continue;
        const info = page.imageinfo[0];

        // Ensure mime type is an image
        if (info.mime && !info.mime.startsWith('image/')) continue;
        // Skip SVG or microscopic icons
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
          authorUrl: meta.Artist && meta.Artist.value && meta.Artist.value.includes('href')
            ? this.extractHref(meta.Artist.value)
            : `https://commons.wikimedia.org/wiki/User:${encodeURIComponent(info.user || '')}`,
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
          errorMessage: '적절한 이미지 결과를 찾을 수 없어 엄선된 고양이 갤러리를 표시합니다.'
        };
      }

      return {
        items,
        isFallback: false
      };

    } catch (err) {
      console.warn('Wikimedia Commons API error/timeout:', err);
      // Fallback with detailed reason as required by prompt
      let reason = '네트워크 연결 오류 또는 위키미디어 API 서버 일시 장애';
      if (err.name === 'AbortError') {
        reason = '요청 시간 초과 (네트워크 응답 지연)';
      } else if (err.message) {
        reason = `연결 상태 확인 필요 (${err.message})`;
      }

      return {
        items: this.filterCurated(trimmed),
        isFallback: true,
        errorMessage: `위키미디어 커먼즈 API에 연결할 수 없습니다. (${reason})\n대신 안전하고 출처가 검증된 엄선 고양이 스티커 갤러리를 사용하실 수 있습니다.`
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

  extractHref(htmlStr) {
    const match = htmlStr.match(/href=["'](.*?)["']/);
    return match ? match[1] : '';
  }

  /**
   * Get a random verified Wikimedia cat for task completion rewards
   */
  getRandomRewardCat() {
    const idx = Math.floor(Math.random() * CURATED_WIKIMEDIA_CATS.length);
    return { ...CURATED_WIKIMEDIA_CATS[idx] };
  }
}

export const wikimediaService = new WikimediaService();
