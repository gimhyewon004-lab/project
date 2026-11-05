/**
 * Client-Side Background Removal & Real Die-Cut Sticker Generator
 * 
 * Improvements:
 * - Real die-cut silhouette white border (thick, smooth, uniform, rounded corners)
 * - Anti-aliasing with continuous curve thresholding (no pixelated or rectangular borders)
 * - Strict perimeter validation: if background removal fails to isolate the subject,
 *   reject creating an awkward rectangular border and guide user to adjust or pick another photo
 * - Subtle paper contact shadow for genuine vinyl sticker feel
 * - Fallback framed stickers with matching stationery aesthetic
 */

export class BackgroundRemover {
  constructor() {
    this.borderWidth = 12; // 12px thick, uniform die-cut border
  }

  async loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        const imgFallback = new Image();
        imgFallback.onload = () => resolve(imgFallback);
        imgFallback.onerror = () => reject(new Error('이미지를 불러오는데 실패했습니다. (CORS 보안 또는 원본 서버 응답 없음)'));
        imgFallback.src = src;
      };
      img.src = src;
    });
  }

  /**
   * Main entry point for cutout and die-cut sticker generation
   * @param {string} imageUrl
   * @param {Object} options - { tolerance, addStickerBorder, borderWidth }
   */
  async removeBackground(imageUrl, options = {}) {
    const {
      tolerance = 44,
      addStickerBorder = true,
      borderWidth = 12
    } = options;

    const img = await this.loadImage(imageUrl);

    // 1. Perform smart edge-aware segmentation
    const segmentation = await this.smartCanvasCutout(img, tolerance);

    // 2. Validate that the background was truly removed around the perimeter
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
        reason: '피사체 대부분이 투명하게 처리되었습니다. 배경 분리 감도(Tolerance)를 낮추고 다시 시도해 주세요.'
      };
    }

    // 3. Create real die-cut silhouette with smooth rounded white border
    if (addStickerBorder) {
      return this.generateDieCutSticker(segmentation.cutoutCanvas, borderWidth);
    }

    return segmentation.cutoutCanvas.toDataURL('image/png');
  }

  /**
   * High-accuracy Canvas segmentation & perimeter validation
   */
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
      throw new Error('Canvas CORS 보안 제한으로 픽셀을 읽을 수 없습니다.');
    }

    const data = imgData.data;
    const totalPixels = width * height;

    // Sample background colors along perimeter
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

    // Color distance in human-weighted RGB/luminance space
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

    // --- Strict Perimeter Validation ---
    // If the 4 outer image edges are predominantly solid (>28%),
    // the subject is NOT properly cut out.
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

    const perimeterSolidRatio = solidPerimeterCount / perimeterPixels;
    const isPerimeterBlocked = perimeterSolidRatio > 0.28;

    // Apply alpha mask
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

  /**
   * Real Die-cut Sticker Generator
   * Produces a thick, uniform, rounded white contour around the cat silhouette
   * with anti-aliasing and a delicate paper shadow.
   */
  async generateDieCutSticker(cutoutCanvas, radius = 12) {
    const srcW = cutoutCanvas.width;
    const srcH = cutoutCanvas.height;

    // Generous padding so thick border & shadow are never clipped
    const pad = radius + 16;
    const finalW = srcW + pad * 2;
    const finalH = srcH + pad * 2;

    // 1. Offscreen mask canvas for silhouette dilation
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = finalW;
    maskCanvas.height = finalH;
    const mctx = maskCanvas.getContext('2d', { willReadFrequently: true });

    // Multi-angle radial disk dilation (36 angles x 7 radial steps)
    // Ensures perfectly uniform expansion in all directions
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
    // Stamp at center
    mctx.drawImage(cutoutCanvas, pad, pad);

    // Convert mask to pure solid black silhouette
    mctx.globalCompositeOperation = 'source-in';
    mctx.fillStyle = '#000000';
    mctx.fillRect(0, 0, finalW, finalH);
    mctx.globalCompositeOperation = 'source-over';

    // 2. Smooth & anti-alias mask to make corners organically rounded and silky
    const maskImgData = mctx.getImageData(0, 0, finalW, finalH);
    const mData = maskImgData.data;

    // Fast 1.5px radius box blur on alpha channel
    const blurredAlpha = this.fastBoxBlurAlpha(mData, finalW, finalH, 2);

    // Sharp smoothstep thresholding to create smooth rounded vector-like edges
    for (let i = 0; i < finalW * finalH; i++) {
      const a = blurredAlpha[i];
      // Anti-aliased cutoff around half-opacity
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

    // 3. Assemble Final Die-Cut Sticker
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalW;
    finalCanvas.height = finalH;
    const fctx = finalCanvas.getContext('2d');

    // Subtle paper contact shadow (genuine physical paper sticker look)
    fctx.shadowColor = 'rgba(28, 22, 16, 0.14)';
    fctx.shadowBlur = 5;
    fctx.shadowOffsetY = 2;
    fctx.shadowOffsetX = 0;

    // Draw smooth white die-cut base
    fctx.drawImage(maskCanvas, 0, 0);

    // Second pass without shadow to ensure 100% solid white body
    fctx.shadowColor = 'transparent';
    fctx.drawImage(maskCanvas, 0, 0);

    // Draw crisp original cat subject in foreground
    fctx.drawImage(cutoutCanvas, pad, pad);

    return finalCanvas.toDataURL('image/png');
  }

  /**
   * Fast separable 2D box blur on alpha channel for curve smoothing
   */
  fastBoxBlurAlpha(data, width, height, radius) {
    const len = width * height;
    const alpha = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      alpha[i] = data[i * 4 + 3];
    }

    const temp = new Uint8Array(len);
    const result = new Uint8Array(len);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
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

    // Vertical pass
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        let count = 0;
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

  /**
   * Fallback Framed Stickers (Editorial Stationery Aesthetic)
   */
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
      // Rounded clean stationery print
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

export const bgRemover = new BackgroundRemover();
