import React, { useState, useRef, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import axios from 'axios';

// Minimal built-in cropping + upload logic without external deps
// No external helpers needed — using simple inlined Image in save flow

export default function AvatarEditor({ initialImage, onClose, onSaved, minWidth = 128, minHeight = 128 }) {
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);

  const onPointerDown = (e) => {
    setDragging(true);
    setStart({ x: e.clientX ?? e.touches?.[0]?.clientX, y: e.clientY ?? e.touches?.[0]?.clientY, orig: { ...pos } });
  };

  const onPointerMove = (e) => {
    if (!dragging || !start) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const dx = cx - start.x;
    const dy = cy - start.y;
    setPos({ x: start.orig.x + dx, y: start.orig.y + dy });
  };

  const onPointerUp = () => { setDragging(false); setStart(null); };

  useEffect(() => {
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
    return () => { window.removeEventListener('mouseup', onPointerUp); window.removeEventListener('touchend', onPointerUp); };
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container) throw new Error('Missing elements');

      const rect = container.getBoundingClientRect();

      // Compute the portion of the natural image to draw
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      // displayed size of image
      const displayedW = img.width * scale;
      const displayedH = img.height * scale;

      // center crop box equals container width/height (square)
      const cropSize = Math.min(rect.width, rect.height);

      // coordinates of the image within container
      const imgX = pos.x + (rect.width - displayedW) / 2;
      const imgY = pos.y + (rect.height - displayedH) / 2;

      // The crop area in image coordinates (natural pixels)
      const sx = Math.max(0, ((-imgX) / displayedW) * naturalW);
      const sy = Math.max(0, ((-imgY) / displayedH) * naturalH);
      const sw = Math.min(naturalW - sx, (cropSize / displayedW) * naturalW);
      const sh = Math.min(naturalH - sy, (cropSize / displayedH) * naturalH);

      // Validate min dims
      if (sw < minWidth || sh < minHeight) {
        setLoading(false);
        return alert(`Cropped image too small. Minimum ${minWidth}×${minHeight}px required.`);
      }

      // Draw to canvas at 512x512
      const outSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext('2d');
      const tmpImg = new Image();
      tmpImg.crossOrigin = 'anonymous';
      tmpImg.src = initialImage;
      await new Promise((resolve, reject) => { tmpImg.onload = resolve; tmpImg.onerror = reject; });

      ctx.drawImage(tmpImg, sx, sy, sw, sh, 0, 0, outSize, outSize);

      // convert to blob and to base64
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 0.9));
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve) => { reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });

      // upload
      const token = localStorage.getItem('token');
      const resp = await axios.put(`${getApiUrl()}/api/users/me/avatar`, { image: dataUrl }, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.data?.success) onSaved && onSaved(resp.data);
    } catch (err) {
      console.error('Avatar save error', err);
      alert('Failed to save avatar: ' + (err?.message || err));
    } finally {
      setLoading(false);
      onClose && onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50">
      <div className="w-[92%] max-w-2xl bg-white dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Edit Profile Photo</h3>
          <div className="flex gap-2">
            <button className="text-sm px-3 py-1 rounded" onClick={onClose}>Cancel</button>
            <button className="text-sm bg-indigo-600 text-white px-3 py-1 rounded" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative h-[360px] bg-gray-100 dark:bg-gray-700 rounded overflow-hidden touch-none select-none"
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
        >
          <img
            ref={imgRef}
            src={initialImage}
            alt="to edit"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
          />

          {/* overlay crop box (center square) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/70 rounded-full shadow-xl backdrop-blur-sm" style={{ boxSizing: 'border-box' }} />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">Zoom</label>
          <input type="range" min={0.5} max={3} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="flex-1" />
        </div>
      </div>
    </div>
  );
}
