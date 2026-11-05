/**
 * Diary Export to PNG Image Generator
 * Editorial Stationery & Paper Boutique Aesthetic
 */

export class DiaryExporter {
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
    const scale = 2; // High-DPI

    const canvas = document.createElement('canvas');
    canvas.width = baseW * scale;
    canvas.height = baseH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // 1. Draw Paper Background
    this.drawPaperBackground(ctx, baseW, baseH, paperTheme);

    // 2. Draw Subtle Washi Tape Strips
    this.drawWashiTape(ctx, baseW);

    // 3. Draw Date, Weather, Mood
    this.drawDiaryHeader(ctx, date, weather, mood, baseW);

    // 4. Draw Diary Title & Content Text
    this.drawDiaryText(ctx, title, content, baseW, baseH, paperTheme);

    // 5. Draw Placed Stickers (with their real die-cut white borders)
    await this.drawStickers(ctx, stickers);

    // 6. Draw Minimalist Footer Stamp
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

    // Outer refined rule
    ctx.strokeStyle = '#E5DFD5';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, w - 32, h - 32);
  }

  drawWashiTape(ctx, w) {
    ctx.save();
    // Neutral translucent tape top-left
    ctx.fillStyle = 'rgba(225, 215, 200, 0.75)';
    ctx.fillRect(48, 8, 70, 16);

    // Subtle terracotta tape top-right
    ctx.fillStyle = 'rgba(209, 73, 54, 0.6)';
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

export const diaryExporter = new DiaryExporter();
