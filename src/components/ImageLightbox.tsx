import { useEffect, useState } from 'react';

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt = 'Foto', onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2.5);
    }
  };

  // Mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag for panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.3, 5));
    } else {
      setScale((prev) => {
        const newScale = Math.max(prev - 0.3, 1);
        if (newScale === 1) setPosition({ x: 0, y: 0 });
        return newScale;
      });
    }
  };

  // Close on backdrop click (only if not dragging and not zoomed)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDragging && scale === 1) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/70 font-medium">{Math.round(scale * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
            title="Perkecil"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            disabled={scale >= 5}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
            title="Perbesar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          {/* Reset */}
          {scale !== 1 && (
            <button
              onClick={handleReset}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition"
              title="Reset"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {/* Divider */}
          <div className="w-px h-5 bg-white/20 mx-1" />
          {/* Close */}
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition"
            title="Tutup (Esc)"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image Area */}
      <div
        className="relative z-10 flex-1 flex items-center justify-center overflow-hidden select-none"
        onClick={handleBackdropClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* Loading spinner */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
          </div>
        )}

        <img
          src={src}
          alt={alt}
          className={`max-w-full max-h-full object-contain transition-transform select-none ${
            !loaded ? 'opacity-0' : 'opacity-100'
          } ${isDragging ? 'transition-none' : 'duration-200 ease-out'}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
          onLoad={() => setLoaded(true)}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />
      </div>

      {/* Bottom hint */}
      <div className="relative z-10 flex items-center justify-center px-4 py-3 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-xs text-white/50">
          {scale > 1
            ? 'Geser untuk melihat · Klik dua kali untuk reset'
            : 'Klik dua kali untuk zoom · Scroll untuk zoom · Tekan Esc untuk keluar'}
        </p>
      </div>
    </div>
  );
}
