import type { AnalysisPart } from "./types.ts";

export function evenlySpacedVideoTimes(durationSeconds: number, requestedCount: number): number[] {
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
  const count = Math.max(1, Math.min(12, Math.floor(requestedCount) || 1));
  if (duration === 0 || count === 1) return [0];
  return Array.from({ length: count }, (_, index) => duration * index / (count - 1));
}

function waitForEvent(target: EventTarget, event: string, errorEvent = "error"): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("视频无法解码")); };
    const cleanup = () => {
      target.removeEventListener(event, done);
      target.removeEventListener(errorEvent, failed);
    };
    target.addEventListener(event, done, { once: true });
    target.addEventListener(errorEvent, failed, { once: true });
  });
}

async function seek(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.01) return;
  const ready = waitForEvent(video, "seeked");
  video.currentTime = time;
  await ready;
}

export async function extractVideo(file: File): Promise<{
  parts: AnalysisPart[];
  warnings: string[];
  cleanup(): Promise<void>;
}> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "metadata";
  video.src = objectUrl;
  try {
    await waitForEvent(video, "loadedmetadata");
    const width = Math.max(1, video.videoWidth || 1);
    const height = Math.max(1, video.videoHeight || 1);
    const scale = Math.min(1, 1280 / width, 1280 / height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("设备无法创建视频画布");

    const parts: AnalysisPart[] = [];
    for (const time of evenlySpacedVideoTimes(video.duration, 8)) {
      await seek(video, Math.min(time, Math.max(0, video.duration - 0.01)));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      parts.push({
        type: "image",
        dataUrl: canvas.toDataURL("image/jpeg", 0.78),
        mimeType: "image/jpeg",
        sourceName: `${file.name} @ ${time.toFixed(1)}s`,
      });
    }
    return {
      parts,
      warnings: ["已在设备上提取关键帧；当前浏览器通道未发现可直接读取的字幕或音轨。"],
      cleanup: async () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
