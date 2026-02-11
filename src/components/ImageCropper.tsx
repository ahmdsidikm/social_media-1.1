import { useState, useRef, useEffect, useCallback } from 'react';

type Props = {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number; // width / height — default 1 (square)
};

export function ImageCropper({ imageSrc, onCrop, onCancel, aspectRatio = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, w: 200, h: 200 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, dispW: 0, dispH: 0, offsetX: 0, offsetY: 0 });

  const isSquare = Math.abs(aspectRatio - 1) < 0.01;
  const ratioLabel = isSquare ? '1:1' : aspectRatio === 4 / 5 ? '4:5' : `${aspectRatio.toFixed(2)}`;

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

    // Calculate crop size that fits within displayed image
    let cropW: number, cropH: number;
    if (dispW / dispH > aspectRatio) {
      // Image wider than ratio — height-limited
      cropH = dispH * 0.8;
      cropW = cropH * aspectRatio;
    } else {
      // Image taller than ratio — width-limited
      cropW = dispW * 0.8;
      cropH = cropW / aspectRatio;
    }

    // Make sure crop fits in image
    if (cropW > dispW) {
      cropW = dispW;
      cropH = cropW / aspectRatio;
    }
    if (cropH > dispH) {
      cropH = dispH;
      cropW = cropH * aspectRatio;
    }

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

  const clampCrop = (x: number, y: number) => {
    const minX = imgDims.offsetX;
    const minY = imgDims.offsetY;
    const maxX = imgDims.offsetX + imgDims.dispW - cropArea.w;
    const maxY = imgDims.offsetY + imgDims.dispH - cropArea.h;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (
      px >= cropArea.x && px <= cropArea.x + cropArea.w &&
      py >= cropArea.y && py <= cropArea.y + cropArea.h
    ) {
      setDragging(true);
      setDragStart({ x: px - cropArea.x, y: py - cropArea.y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const clamped = clampCrop(px - dragStart.x, py - dragStart.y);
    setCropArea((prev) => ({ ...prev, ...clamped }));
  };

  const handlePointerUp = () => setDragging(false);

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

    // Output max 1080px wide
    const outputW = Math.min(1080, Math.round(srcW));
    const outputH = Math.round(outputW / aspectRatio);
    canvas.width = outputW;
    canvas.height = outputH;
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Potong Foto</h3>
              <p className="text-[10px] text-gray-400">Rasio {ratioLabel}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative w-full bg-gray-900 select-none touch-none"
          style={{ height: '420px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
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
              {/* Dark overlay with transparent crop hole */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/50" />
                <div
                  className="absolute bg-transparent"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.w,
                    height: cropArea.h,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                    border: '2px solid white',
                    borderRadius: isSquare ? '50%' : '12px',
                  }}
                />
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
                  /* Center circle for square/avatar */
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/30 rounded-full" />
                  </div>
                ) : (
                  /* Grid + corners + ratio badge for non-square */
                  <>
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/25" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/25" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/25" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/25" />
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-md" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-md" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-md" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-md" />
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5">
                      <span className="text-[10px] text-white/80 font-medium">{ratioLabel}</span>
                    </div>
                  </>
                )}
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
