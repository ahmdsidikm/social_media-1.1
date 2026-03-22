import { useState, useRef, useEffect, useCallback } from 'react';

type Props = {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
  maxOutputSize?: number; // max file size in bytes (default: 500KB)
  maxOutputWidth?: number; // max output width in px (default: 1080)
  quality?: number; // initial JPEG quality 0-1 (default: 0.85)
};

type DragMode =
  | 'move'
  | 'resize-tl'
  | 'resize-tr'
  | 'resize-bl'
  | 'resize-br'
  | 'resize-t'
  | 'resize-b'
  | 'resize-l'
  | 'resize-r'
  | null;

async function compressCanvasToBlob(
  canvas: HTMLCanvasElement,
  maxSizeBytes: number,
  initialQuality: number
): Promise<Blob> {
  let quality = initialQuality;
  const minQuality = 0.1;
  const step = 0.05;

  // First attempt
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  );

  if (!blob) throw new Error('Failed to create blob');

  // Iteratively reduce quality until under maxSizeBytes
  while (blob.size > maxSizeBytes && quality > minQuality) {
    quality -= step;
    if (quality < minQuality) quality = minQuality;

    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );

    if (!blob) throw new Error('Failed to create blob');

    // Safety: if we've hit minimum quality, also try scaling down
    if (quality <= minQuality && blob.size > maxSizeBytes) {
      const scale = Math.sqrt(maxSizeBytes / blob.size);
      const newWidth = Math.round(canvas.width * scale);
      const newHeight = Math.round(canvas.height * scale);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = newWidth;
      tempCanvas.height = newHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
        blob = await new Promise<Blob | null>((resolve) =>
          tempCanvas.toBlob((b) => resolve(b), 'image/jpeg', minQuality)
        );
        if (!blob) throw new Error('Failed to create blob');
      }
      break;
    }
  }

  return blob;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ImageCropper({
  imageSrc,
  onCrop,
  onCancel,
  aspectRatio = 1,
  maxOutputSize = 500 * 1024, // 500KB default
  maxOutputWidth = 1080,
  quality: initialQuality = 0.85,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, w: 200, h: 200 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, dispW: 0, dispH: 0, offsetX: 0, offsetY: 0 });
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    reduction: number;
  } | null>(null);

  const isSquare = Math.abs(aspectRatio - 1) < 0.01;
  const ratioLabel = isSquare ? '1:1' : Math.abs(aspectRatio - 4 / 5) < 0.01 ? '4:5' : `${aspectRatio.toFixed(2)}`;

  const MIN_CROP_SIZE = 60;

  const calcDims = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = imgRef.current.naturalWidth;
    const ih = imgRef.current.naturalHeight;
    const scale = Math.min(cw / iw, ch / ih);
    const dispW = iw * scale;
    const dispH = ih * scale;
    const offsetX = (cw - dispW) / 2;
    const offsetY = (ch - dispH) / 2;
    setImgDims({ w: iw, h: ih, dispW, dispH, offsetX, offsetY });

    let cropW: number, cropH: number;
    if (dispW / dispH > aspectRatio) {
      cropH = dispH * 0.8;
      cropW = cropH * aspectRatio;
    } else {
      cropW = dispW * 0.8;
      cropH = cropW / aspectRatio;
    }
    if (cropW > dispW) { cropW = dispW; cropH = cropW / aspectRatio; }
    if (cropH > dispH) { cropH = dispH; cropW = cropH * aspectRatio; }

    setCropArea({
      x: offsetX + (dispW - cropW) / 2,
      y: offsetY + (dispH - cropH) / 2,
      w: cropW,
      h: cropH,
    });
  }, [aspectRatio]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      setTimeout(calcDims, 50);
    };
    img.src = imageSrc;
  }, [imageSrc, calcDims]);

  useEffect(() => {
    if (imgLoaded) calcDims();
    window.addEventListener('resize', calcDims);
    return () => window.removeEventListener('resize', calcDims);
  }, [imgLoaded, calcDims]);

  const clampCrop = useCallback((x: number, y: number, w: number, h: number) => {
    const minX = imgDims.offsetX;
    const minY = imgDims.offsetY;
    return {
      x: Math.max(minX, Math.min(imgDims.offsetX + imgDims.dispW - w, x)),
      y: Math.max(minY, Math.min(imgDims.offsetY + imgDims.dispH - h, y)),
    };
  }, [imgDims]);

  const getMaxCropSize = useCallback((anchorX: number, anchorY: number, dirX: number, dirY: number) => {
    let maxW: number, maxH: number;
    if (dirX > 0) { maxW = (imgDims.offsetX + imgDims.dispW) - anchorX; }
    else { maxW = anchorX - imgDims.offsetX; }
    if (dirY > 0) { maxH = (imgDims.offsetY + imgDims.dispH) - anchorY; }
    else { maxH = anchorY - imgDims.offsetY; }
    if (maxW / maxH > aspectRatio) { maxW = maxH * aspectRatio; }
    else { maxH = maxW / aspectRatio; }
    return { maxW, maxH };
  }, [imgDims, aspectRatio]);

  const detectMode = (px: number, py: number): DragMode => {
    const { x, y, w, h } = cropArea;
    const edge = 18;
    const nearLeft = Math.abs(px - x) < edge;
    const nearRight = Math.abs(px - (x + w)) < edge;
    const nearTop = Math.abs(py - y) < edge;
    const nearBottom = Math.abs(py - (y + h)) < edge;
    const inX = px >= x - edge && px <= x + w + edge;
    const inY = py >= y - edge && py <= y + h + edge;
    if (nearTop && nearLeft) return 'resize-tl';
    if (nearTop && nearRight) return 'resize-tr';
    if (nearBottom && nearLeft) return 'resize-bl';
    if (nearBottom && nearRight) return 'resize-br';
    if (nearTop && inX) return 'resize-t';
    if (nearBottom && inX) return 'resize-b';
    if (nearLeft && inY) return 'resize-l';
    if (nearRight && inY) return 'resize-r';
    if (px >= x && px <= x + w && py >= y && py <= y + h) return 'move';
    return null;
  };

  const getCursor = (mode: DragMode): string => {
    switch (mode) {
      case 'resize-tl': case 'resize-br': return 'nwse-resize';
      case 'resize-tr': case 'resize-bl': return 'nesw-resize';
      case 'resize-t': case 'resize-b': return 'ns-resize';
      case 'resize-l': case 'resize-r': return 'ew-resize';
      case 'move': return 'grab';
      default: return 'default';
    }
  };

  const [cursorStyle, setCursorStyle] = useState('default');

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mode = detectMode(px, py);
    if (!mode) return;
    setDragMode(mode);
    setDragStart({ x: px, y: py });
    setCropStart({ ...cropArea });
    setCursorStyle(mode === 'move' ? 'grabbing' : getCursor(mode));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (!dragMode) {
      const hoverMode = detectMode(px, py);
      setCursorStyle(getCursor(hoverMode));
      return;
    }

    const dx = px - dragStart.x;
    const dy = py - dragStart.y;

    if (dragMode === 'move') {
      const clamped = clampCrop(cropStart.x + dx, cropStart.y + dy, cropStart.w, cropStart.h);
      setCropArea(prev => ({ ...prev, ...clamped }));
      return;
    }

    let newX = cropStart.x;
    let newY = cropStart.y;
    let newW = cropStart.w;
    let newH = cropStart.h;

    switch (dragMode) {
      case 'resize-br': {
        newW = cropStart.w + dx;
        newH = newW / aspectRatio;
        const max = getMaxCropSize(cropStart.x, cropStart.y, 1, 1);
        newW = Math.max(MIN_CROP_SIZE, Math.min(newW, max.maxW));
        newH = newW / aspectRatio;
        break;
      }
      case 'resize-bl': {
        newW = cropStart.w - dx;
        newH = newW / aspectRatio;
        const max = getMaxCropSize(cropStart.x + cropStart.w, cropStart.y, -1, 1);
        newW = Math.max(MIN_CROP_SIZE, Math.min(newW, max.maxW));
        newH = newW / aspectRatio;
        newX = cropStart.x + cropStart.w - newW;
        break;
      }
      case 'resize-tr': {
        newW = cropStart.w + dx;
        newH = newW / aspectRatio;
        const max = getMaxCropSize(cropStart.x, cropStart.y + cropStart.h, 1, -1);
        newW = Math.max(MIN_CROP_SIZE, Math.min(newW, max.maxW));
        newH = newW / aspectRatio;
        newY = cropStart.y + cropStart.h - newH;
        break;
      }
      case 'resize-tl': {
        newW = cropStart.w - dx;
        newH = newW / aspectRatio;
        const max = getMaxCropSize(cropStart.x + cropStart.w, cropStart.y + cropStart.h, -1, -1);
        newW = Math.max(MIN_CROP_SIZE, Math.min(newW, max.maxW));
        newH = newW / aspectRatio;
        newX = cropStart.x + cropStart.w - newW;
        newY = cropStart.y + cropStart.h - newH;
        break;
      }
      case 'resize-r': {
        newW = cropStart.w + dx;
        newH = newW / aspectRatio;
        const max = getMaxCropSize(cropStart.x, cropStart.y, 1, 1);
        newW = Math.max(MIN_CROP_SIZE, Math.min(newW, max.maxW));
        newH = newW / aspectRatio;
        const centerY = cropStart.y + cropStart.h / 2;
        newY = centerY - newH / 2;
        break;
      }
      case 'resize-l': {
        newW = cropStart.w - dx;
        newH = newW / aspectRatio;
        const effectiveMaxW = cropStart.x + cropStart.w - imgDims.offsetX;
        newW = Math.max(MIN_CROP_SIZE, Math.min(newW, effectiveMaxW));
        newH = newW / aspectRatio;
        newX = cropStart.x + cropStart.w - newW;
        const cY = cropStart.y + cropStart.h / 2;
        newY = cY - newH / 2;
        break;
      }
      case 'resize-b': {
        newH = cropStart.h + dy;
        newW = newH * aspectRatio;
        const max = getMaxCropSize(cropStart.x, cropStart.y, 1, 1);
        newH = Math.max(MIN_CROP_SIZE / aspectRatio, Math.min(newH, max.maxH));
        newW = newH * aspectRatio;
        const centerX = cropStart.x + cropStart.w / 2;
        newX = centerX - newW / 2;
        break;
      }
      case 'resize-t': {
        newH = cropStart.h - dy;
        newW = newH * aspectRatio;
        const effectiveMaxH = cropStart.y + cropStart.h - imgDims.offsetY;
        newH = Math.max(MIN_CROP_SIZE / aspectRatio, Math.min(newH, effectiveMaxH));
        newW = newH * aspectRatio;
        newY = cropStart.y + cropStart.h - newH;
        const cX = cropStart.x + cropStart.w / 2;
        newX = cX - newW / 2;
        break;
      }
    }

    newX = Math.max(imgDims.offsetX, newX);
    newY = Math.max(imgDims.offsetY, newY);
    if (newX + newW > imgDims.offsetX + imgDims.dispW) {
      newW = imgDims.offsetX + imgDims.dispW - newX;
      newH = newW / aspectRatio;
    }
    if (newY + newH > imgDims.offsetY + imgDims.dispH) {
      newH = imgDims.offsetY + imgDims.dispH - newY;
      newW = newH * aspectRatio;
    }

    setCropArea({ x: newX, y: newY, w: newW, h: newH });
  };

  const handlePointerUp = () => {
    setDragMode(null);
    setCursorStyle('default');
  };

  const handleCrop = async () => {
    if (!imgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsCompressing(true);
    setCompressionInfo(null);

    try {
      const scaleX = imgDims.w / imgDims.dispW;
      const scaleY = imgDims.h / imgDims.dispH;
      const srcX = (cropArea.x - imgDims.offsetX) * scaleX;
      const srcY = (cropArea.y - imgDims.offsetY) * scaleY;
      const srcW = cropArea.w * scaleX;
      const srcH = cropArea.h * scaleY;

      const outputW = Math.min(maxOutputWidth, Math.round(srcW));
      const outputH = Math.round(outputW / aspectRatio);
      canvas.width = outputW;
      canvas.height = outputH;

      // Enable image smoothing for better downscale quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);

      // Get uncompressed size estimate
      const uncompressedBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.98)
      );
      const originalSize = uncompressedBlob?.size || 0;

      // Compress with iterative quality reduction
      const compressedBlob = await compressCanvasToBlob(canvas, maxOutputSize, initialQuality);

      const reduction = originalSize > 0
        ? Math.round((1 - compressedBlob.size / originalSize) * 100)
        : 0;

      setCompressionInfo({
        originalSize,
        compressedSize: compressedBlob.size,
        reduction,
      });

      // Short delay to show compression info
      await new Promise((resolve) => setTimeout(resolve, 600));

      onCrop(compressedBlob);
    } catch (err) {
      console.error('Compression failed:', err);
      // Fallback: just do a simple crop without compression
      canvas.toBlob((blob) => {
        if (blob) onCrop(blob);
      }, 'image/jpeg', initialQuality);
    } finally {
      setIsCompressing(false);
    }
  };

  // Overlay rects
  const overlayRects = imgLoaded ? [
    { left: 0, top: 0, width: '100%', height: cropArea.y },
    { left: 0, top: cropArea.y + cropArea.h, width: '100%', height: `calc(100% - ${cropArea.y + cropArea.h}px)` },
    { left: 0, top: cropArea.y, width: cropArea.x, height: cropArea.h },
    { left: cropArea.x + cropArea.w, top: cropArea.y, width: `calc(100% - ${cropArea.x + cropArea.w}px)`, height: cropArea.h },
  ] : [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Potong Foto</h3>
              <p className="text-[10px] text-gray-400">
                Rasio {ratioLabel} • Maks {formatFileSize(maxOutputSize)} • Otomatis kompres
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition" disabled={isCompressing}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="relative w-full bg-gray-900 select-none touch-none overflow-hidden"
          style={{ height: '420px', cursor: isCompressing ? 'wait' : cursorStyle }}
          onPointerDown={isCompressing ? undefined : handlePointerDown}
          onPointerMove={isCompressing ? undefined : handlePointerMove}
          onPointerUp={isCompressing ? undefined : handlePointerUp}
          onPointerLeave={isCompressing ? undefined : handlePointerUp}
        >
          {imgLoaded && (
            <>
              <img
                src={imageSrc}
                alt="Crop"
                className="absolute"
                style={{
                  left: imgDims.offsetX,
                  top: imgDims.offsetY,
                  width: imgDims.dispW,
                  height: imgDims.dispH,
                  objectFit: 'contain',
                }}
                draggable={false}
              />

              {overlayRects.map((rect, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  }}
                />
              ))}

              <div
                className="absolute pointer-events-none"
                style={{
                  left: cropArea.x,
                  top: cropArea.y,
                  width: cropArea.w,
                  height: cropArea.h,
                  border: '2px solid rgba(255,255,255,0.9)',
                  borderRadius: isSquare ? '50%' : '4px',
                }}
              >
                {isSquare && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      borderRadius: '50%',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
                    }}
                  />
                )}
              </div>

              <div className="absolute pointer-events-none" style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.w,
                height: cropArea.h,
              }}>
                {[
                  { cls: 'top-0 left-0', tx: 'translate(-50%, -50%)' },
                  { cls: 'top-0 right-0', tx: 'translate(50%, -50%)' },
                  { cls: 'bottom-0 left-0', tx: 'translate(-50%, 50%)' },
                  { cls: 'bottom-0 right-0', tx: 'translate(50%, 50%)' },
                ].map((h, i) => (
                  <div key={`c-${i}`} className={`absolute ${h.cls}`} style={{ transform: h.tx }}>
                    <div className="w-4 h-4 bg-white rounded-full shadow-lg border-2 border-blue-500" />
                  </div>
                ))}

                {[
                  { cls: 'top-0 left-1/2', tx: 'translate(-50%, -50%)' },
                  { cls: 'bottom-0 left-1/2', tx: 'translate(-50%, 50%)' },
                  { cls: 'top-1/2 left-0', tx: 'translate(-50%, -50%)' },
                  { cls: 'top-1/2 right-0', tx: 'translate(50%, -50%)' },
                ].map((h, i) => (
                  <div key={`e-${i}`} className={`absolute ${h.cls}`} style={{ transform: h.tx }}>
                    <div className="w-3 h-3 bg-white/80 rounded-full shadow border border-blue-400" />
                  </div>
                ))}
              </div>

              <div
                className="absolute pointer-events-none"
                style={{
                  left: cropArea.x,
                  top: cropArea.y,
                  width: cropArea.w,
                  height: cropArea.h,
                }}
              >
                {isSquare ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/20 rounded-full" />
                  </div>
                ) : (
                  <>
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-sm" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-sm" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-sm" />
                  </>
                )}

                <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/50 backdrop-blur-sm px-1.5 py-0.5">
                  <svg className="w-2.5 h-2.5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span className="text-[10px] text-white/80 font-medium">{ratioLabel}</span>
                </div>
              </div>
            </>
          )}

          {!imgLoaded && (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            </div>
          )}

          {/* Compression overlay */}
          {isCompressing && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50">
              <div className="relative mb-4">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-blue-400" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-white font-semibold text-sm mb-1">Mengompres gambar...</p>
              <p className="text-white/60 text-xs">Mengoptimalkan ukuran file</p>

              {compressionInfo && (
                <div className="mt-4 bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
                  <div className="flex items-center gap-3 text-xs text-white/80">
                    <div className="text-center">
                      <p className="text-white/50 text-[10px] mb-0.5">Sebelum</p>
                      <p className="font-semibold">{formatFileSize(compressionInfo.originalSize)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white/50 text-[10px] mb-0.5">Sesudah</p>
                      <p className="font-semibold text-green-400">{formatFileSize(compressionInfo.compressedSize)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[11px] text-green-400 font-medium">
                      Hemat {compressionInfo.reduction}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="border-t border-gray-100">
          {/* Compression info badge */}
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[11px] text-gray-400">
              Gambar akan dikompres otomatis (maks {formatFileSize(maxOutputSize)}, {maxOutputWidth}px)
            </span>
          </div>

          <div className="flex gap-2 px-4 py-3">
            <button
              onClick={onCancel}
              disabled={isCompressing}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleCrop}
              disabled={isCompressing}
              className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 py-2.5 text-sm font-semibold text-white hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isCompressing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Mengompres...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Terapkan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
