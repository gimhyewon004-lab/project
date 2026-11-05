/**
 * Cat Sound Manager
 * Manages authentic, verified cat vocalizations with open licensing.
 * Features:
 * - Verified recordings: Meow, Purr, Hiss, Mute (None)
 * - Single playback controller (no overlapping audio)
 * - Tap-to-play, tap-to-stop/replay on diary stickers
 * - Global sound mute toggle with persistence
 * - Audio preview for selection UI
 * - Graceful fallback & error diagnostics
 */

export const CAT_SOUND_CATALOG = {
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

  /**
   * Play sound by soundType ('meow' | 'purr' | 'hiss' | 'none')
   * @param {string} soundType
   * @param {string} triggerKey - unique identifier (e.g. stickerId or 'preview')
   * @returns {Promise<boolean>}
   */
  async play(soundType, triggerKey = 'global') {
    if (this.isMuted) {
      return false;
    }

    if (!soundType || soundType === 'none') {
      this.stop();
      return true;
    }

    const soundDef = CAT_SOUND_CATALOG[soundType];
    if (!soundDef || (!soundDef.localFile && !soundDef.cdnUrl)) {
      this.stop();
      return false;
    }

    // If currently playing the SAME trigger, toggle stop
    if (this.currentAudio && this.currentPlayingId === triggerKey && !this.currentAudio.paused) {
      this.stop();
      return false;
    }

    // Stop any existing sound (single playback guarantee)
    this.stop();

    try {
      // Try local file first, fallback to CDN URL
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
        // Fallback to CDN URL if local file failed
        if (soundDef.cdnUrl && audio.src !== soundDef.cdnUrl) {
          try {
            audio.src = soundDef.cdnUrl;
            await audio.play();
            return;
          } catch (e) {
            console.warn('CDN audio fallback error:', e);
          }
        }
        console.warn('Audio playback not available for:', soundType);
        this.stop();
      };

      audio.src = soundDef.localFile || soundDef.cdnUrl;
      await audio.play();

      if (typeof this.onStateChange === 'function') {
        this.onStateChange({ isMuted: this.isMuted, currentPlayingId: triggerKey });
      }

      return true;
    } catch (err) {
      console.warn('Playback interrupted or blocked by browser autoplay policy:', err);
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

export const soundManager = new CatSoundManager();
