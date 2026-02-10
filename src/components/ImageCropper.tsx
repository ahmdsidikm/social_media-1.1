import { useState, useRef, useEffect, useCallback } from 'react';

type Props = {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
};

export function ImageCropper({ imageSrc, onCrop, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, dispW: 0, dispH: 0, offsetX: 0, offsetY: 0 });

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
    const cropSize = Math.min(dispW, dispH) * 0.8;
    setCropArea({
      x: offsetX + (dispW - cropSize) / 2,
      y: offsetY + (dispH - cropSize) / 2,
      size: cropSize,
    });
  }, []);

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
    const maxX = imgDims.offsetX + imgDims.dispW - cropArea.size;
    const maxY = imgDims.offsetY + imgDims.dispH - cropArea.size;
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
      px >= cropArea.x && px <= cropArea.x + cropArea.size &&
      py >= cropArea.y && py <= cropArea.y + cropArea.size
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
    const srcSize = cropArea.size * Math.min(scaleX, scaleY);

    const outputSize = 400;
    canvas.width = outputSize;
    canvas.height = outputSize;
    ctx.drawImage(imgRef.current, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Potong Foto (1:1)</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative w-full bg-gray-900 select-none touch-none"
          style={{ height: '400px' }}
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
              {/* Dark overlay outside crop */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/50" />
                <div
                  className="absolute bg-transparent"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.size,
                    height: cropArea.size,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                    border: '2px solid white',
                    borderRadius: '50%',
                  }}
                />
              </div>
              {/* Corner guides */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: cropArea.x,
                  top: cropArea.y,
                  width: cropArea.size,
                  height: cropArea.size,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 rounded-full" />
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
