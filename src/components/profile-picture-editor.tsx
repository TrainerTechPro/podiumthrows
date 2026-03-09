"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ProfilePictureEditorProps {
  currentImageUrl?: string;
  onSave: (dataUrl: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  onClose: () => void;
}

const CANVAS_SIZE = 280;

export default function ProfilePictureEditor({
  currentImageUrl,
  onSave,
  onRemove,
  onClose,
}: ProfilePictureEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const half = CANVAS_SIZE / 2;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(half + pan.x, half + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
    ctx.restore();
  }, [zoom, rotation, pan]);

  useEffect(() => { draw(); }, [draw, imageSrc]);

  function loadFile(src: string) {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const fit = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
      setZoom(fit);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      setTimeout(draw, 0);
    };
    img.src = src;
    setImageSrc(src);
    setError("");
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("Image must be under 15 MB."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => loadFile(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  // Pan
  function startDrag(clientX: number, clientY: number) {
    setIsDragging(true);
    setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
  }
  function moveDrag(clientX: number, clientY: number) {
    if (!isDragging) return;
    setPan({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  }
  function stopDrag() { setIsDragging(false); }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(6, z + (e.deltaY > 0 ? -0.08 : 0.08))));
  }

  async function handleSave() {
    if (!imageRef.current) return;
    const out = document.createElement("canvas");
    out.width = 400; out.height = 400;
    const ctx = out.getContext("2d")!;
    const scale = 400 / CANVAS_SIZE;
    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(200 + pan.x * scale, 200 + pan.y * scale);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scale, zoom * scale);
    const { naturalWidth: w, naturalHeight: h } = imageRef.current;
    ctx.drawImage(imageRef.current, -w / 2, -h / 2, w, h);
    const dataUrl = out.toDataURL("image/jpeg", 0.88);
    const bytes = Math.ceil((dataUrl.length * 3) / 4);
    if (bytes > 3.5 * 1024 * 1024) { setError("Result too large — zoom out a bit and try again."); return; }
    setSaving(true); setError("");
    try { await onSave(dataUrl); onClose(); }
    catch { setError("Save failed. Please try again."); }
    finally { setSaving(false); }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setRemoving(true);
    try { await onRemove(); onClose(); }
    catch { setError("Couldn't remove photo. Try again."); }
    finally { setRemoving(false); }
  }

  const hasImage = Boolean(imageSrc);
  const showCurrent = !hasImage && Boolean(currentImageUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white dark:bg-surface w-full sm:w-auto sm:min-w-[340px] sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Profile Photo</h2>
          <button onClick={onClose} aria-label="Close" className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview area */}
          <div className="flex justify-center">
            {hasImage ? (
              /* Edit mode — canvas */
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  className="rounded-full border-4 border-primary-200 dark:border-primary-800 cursor-grab active:cursor-grabbing touch-none"
                  style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
                  onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
                  onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
                  onMouseUp={stopDrag}
                  onMouseLeave={stopDrag}
                  onTouchStart={(e) => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
                  onTouchMove={(e) => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }}
                  onTouchEnd={stopDrag}
                  onWheel={handleWheel}
                />
                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Drag to reposition · Pinch or scroll to zoom
                </p>
              </div>
            ) : (
              /* Upload zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer flex flex-col items-center justify-center rounded-full border-4 border-dashed transition-colors ${
                  dragOver
                    ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-surface-800"
                }`}
                style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              >
                {showCurrent ? (
                  /* Current photo preview */
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentImageUrl}
                      alt="Current profile"
                      className="absolute inset-0 w-full h-full rounded-full object-cover opacity-60"
                    />
                    <div className="relative flex flex-col items-center gap-2 text-gray-700 dark:text-gray-200">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-semibold">Change Photo</span>
                    </div>
                  </>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500 px-8 text-center">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Click to choose a photo</p>
                      <p className="text-xs mt-0.5">or drag &amp; drop here</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Edit controls — only visible when image is loaded */}
          {hasImage && (
            <div className="space-y-3">
              {/* Zoom */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Zoom</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range" min="0.3" max="6" step="0.05" value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-primary-500"
                />
              </div>
              {/* Rotate */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Rotate</span>
                <div className="flex gap-1.5">
                  {([-90, -15, 15, 90] as const).map((deg) => (
                    <button key={deg} type="button" onClick={() => setRotation((r) => r + deg)}
                      className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-surface-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors">
                      {deg > 0 ? "+" : ""}{deg}°
                    </button>
                  ))}
                  <button type="button" onClick={() => { setRotation(0); setPan({ x: 0, y: 0 }); }}
                    className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-surface-800 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors">
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 space-y-2">
          {hasImage ? (
            <>
              <button onClick={handleSave} disabled={saving}
                className="w-full btn-primary py-2.5 disabled:opacity-60">
                {saving ? "Saving…" : "Save Photo"}
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-4 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-800 transition-colors">
                Choose Different Photo
              </button>
            </>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full btn-primary py-2.5">
              Choose Photo
            </button>
          )}

          <div className="flex gap-2">
            {currentImageUrl && onRemove && (
              <button onClick={handleRemove} disabled={removing}
                className="flex-1 py-2 px-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60">
                {removing ? "Removing…" : "Remove Photo"}
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-800 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
    </div>
  );
}
