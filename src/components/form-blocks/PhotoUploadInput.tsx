"use client";

import { useState, useRef, useCallback } from "react";
import type { PhotoUploadBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

type UploadState = "idle" | "uploading" | "error";

export function PhotoUploadInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<PhotoUploadBlock>) {
  const url = (value as string) ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const maxSizeMb = block.maxSizeMb ?? 15;

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setUploadError("Please select an image file (JPEG, PNG, WebP, GIF).");
        return;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        setUploadError(`File too large. Maximum size is ${maxSizeMb}MB.`);
        return;
      }

      setUploadError("");
      setUploadState("uploading");
      setProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/uploads/image");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                resolve(data.url);
              } else {
                reject(new Error(data.error || "Upload failed"));
              }
            } catch {
              reject(new Error("Upload failed"));
            }
          };

          xhr.onerror = () => reject(new Error("Network error — check your connection"));
          xhr.send(formData);
        });

        setUploadState("idle");
        setProgress(0);
        onChange(uploadUrl);
      } catch (err) {
        setUploadState("error");
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [maxSizeMb, onChange]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleRemove() {
    onChange("");
    setUploadState("idle");
    setUploadError("");
    setProgress(0);
  }

  return (
    <div className="space-y-2">
      {block.prompt && (
        <p className="text-xs text-muted">{block.prompt}</p>
      )}

      {url ? (
        <div className="border-2 border-[var(--card-border)] rounded-xl p-4 text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Uploaded"
            className="mx-auto max-h-48 rounded-lg object-contain"
          />
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="text-xs font-medium text-primary-500 hover:text-primary-600 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && uploadState !== "uploading" && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            dragOver
              ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20"
              : "border-[var(--card-border)] hover:border-primary-300 dark:hover:border-primary-600 hover:bg-[var(--color-bg-subtle)]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {uploadState === "uploading" ? (
            <div className="space-y-3">
              <div className="w-10 h-10 mx-auto border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-[var(--foreground)]">Uploading... {progress}%</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {dragOver ? "Drop image here" : "Click or drag to upload photo"}
              </p>
              <p className="text-[10px] text-muted">
                JPEG, PNG, WebP, GIF · Max {maxSizeMb}MB
              </p>
            </div>
          )}
        </div>
      )}

      {(uploadError || error) && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-danger-500 dark:text-danger-400 flex-1">
            {uploadError || error}
          </p>
          {uploadState === "error" && (
            <button
              type="button"
              onClick={() => {
                setUploadState("idle");
                setUploadError("");
              }}
              className="text-xs font-medium text-primary-500 hover:text-primary-600 whitespace-nowrap"
            >
              Try again
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
