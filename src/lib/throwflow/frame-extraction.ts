// ThrowFlow - Client-side Video Frame Extraction
// Extracts frames from uploaded video using Canvas API

const TARGET_FRAME_COUNT = 60;
const MAX_WIDTH = 480;

export interface ExtractedFrames {
  frames: string[]; // base64 data URLs
  duration: number; // seconds
  fps: number;
  width: number;
  height: number;
}

/**
 * Extract evenly-spaced frames from a video file.
 * Runs entirely client-side using HTMLVideoElement + Canvas.
 */
export async function extractFrames(
  file: File,
  onProgress?: (percent: number) => void,
  frameCount: number = TARGET_FRAME_COUNT
): Promise<ExtractedFrames> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = async () => {
      const duration = video.duration;

      if (duration < 0.5) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Video too short (minimum 0.5 seconds)"));
        return;
      }

      // Scale to max width while maintaining aspect ratio
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);
      canvas.width = width;
      canvas.height = height;

      // Calculate actual frame count (don't exceed video duration * 30fps)
      const actualFrameCount = Math.min(frameCount, Math.floor(duration * 30));
      const interval = duration / actualFrameCount;

      const frames: string[] = [];

      const extractFrame = (time: number): Promise<string> => {
        return new Promise((res) => {
          video.currentTime = time;
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, width, height);
            res(canvas.toDataURL("image/jpeg", 0.7));
          };
        });
      };

      try {
        for (let i = 0; i < actualFrameCount; i++) {
          const time = i * interval;
          const frame = await extractFrame(time);
          frames.push(frame);
          onProgress?.(Math.round(((i + 1) / actualFrameCount) * 100));
        }

        URL.revokeObjectURL(objectUrl);
        resolve({
          frames,
          duration,
          fps: actualFrameCount / duration,
          width,
          height,
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load video. Supported formats: MP4, MOV, WebM"));
    };
  });
}

/**
 * Select key frames for AI analysis (reduces token usage).
 * Picks evenly-distributed frames from the full set.
 */
export function selectKeyFrames(frames: string[], count: number = 8): { frames: string[]; indices: number[] } {
  if (frames.length <= count) {
    return { frames, indices: frames.map((_, i) => i) };
  }

  const step = (frames.length - 1) / (count - 1);
  const indices: number[] = [];
  const selected: string[] = [];

  for (let i = 0; i < count; i++) {
    const idx = Math.round(i * step);
    indices.push(idx);
    selected.push(frames[idx]);
  }

  return { frames: selected, indices };
}
