import { useState, useRef, useEffect, useCallback } from 'react';

type Props = {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
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

export function ImageCropper({ imageSrc, onCrop, onCancel, aspectRatio = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, w: 200, h: 200 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, dispW: 0, dispH: 0, offsetX: 0, offsetY: 0 });

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

  const handleCrop = () => {
    if (!imgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = imgDims.w / imgDims.dispW;
    const scaleY = imgDims.h / imgDims.dispH;
    const srcX = (cropArea.x - imgDims.offsetX) * scaleX;
    const srcY = (cropArea.y - imgDims.offsetY) * scaleY;
    const srcW = cropArea.w * scaleX;
    const srcH = cropArea.h * scaleY;

    const outputW = Math.min(1080, Math.round(srcW));
    const outputH = Math.round(outputW / aspectRatio);
    canvas.width = outputW;
    canvas.height = outputH;
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.92);
  };

  // Overlay rects: 4 dark rectangles around the crop area
  const overlayRects = imgLoaded ? [
    // Top
    { left: 0, top: 0, width: '100%', height: cropArea.y },
    // Bottom
    { left: 0, top: cropArea.y + cropArea.h, width: '100%', height: `calc(100% - ${cropArea.y + cropArea.h}px)` },
    // Left
    { left: 0, top: cropArea.y, width: cropArea.x, height: cropArea.h },
    // Right
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
              <p className="text-[10px] text-gray-400">Rasio {ratioLabel} • Seret sudut untuk ubah ukuran</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="relative w-full bg-gray-900 select-none touch-none overflow-hidden"
          style={{ height: '420px', cursor: cursorStyle }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {imgLoaded && (
            <>
              {/* Image — full brightness, no filter */}
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

              {/* 4 dark overlay rectangles around crop — no overlap on crop area */}
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

              {/* Crop border */}
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
                {/* For circle crop: dark corners inside the bounding box but outside the circle */}
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

              {/* Resize handles */}
              <div className="absolute pointer-events-none" style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.w,
                height: cropArea.h,
              }}>
                {/* Corner handles */}
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

                {/* Edge handles */}
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

              {/* Guides */}
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
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Batal
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}
