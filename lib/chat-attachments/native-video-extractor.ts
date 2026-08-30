import { Capacitor, registerPlugin } from "@capacitor/core";

import type { AnalysisPart, PendingAttachment } from "./types.ts";

interface NativeVideoPlugin {
  pickVideo(): Promise<{ uri: string }>;
  inspect(options: { uri: string }): Promise<{ durationMs: number; width: number; height: number }>;
  extractFrames(options: { uri: string; count: number }): Promise<{ frames: Array<{ uri: string; timeMs: number }> }>;
  extractAudio(options: { uri: string }): Promise<{ uri: string; mimeType: string }>;
  extractSubtitles(options: { uri: string }): Promise<{ text: string }>;
  cleanup(): Promise<{ deleted: number }>;
}

const VideoAnalysis = registerPlugin<NativeVideoPlugin>("VideoAnalysis");
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

async function nativeFileToDataUrl(uri: string): Promise<{ dataUrl: string; blob: Blob }> {
  const response = await fetch(Capacitor.convertFileSrc(uri));
  if (!response.ok) throw new Error("无法读取安卓视频分析缓存");
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("缓存转换失败"));
    reader.onerror = () => reject(reader.error || new Error("缓存转换失败"));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, blob };
}

export function canUseNativeVideoAnalysis(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function pickNativeVideoAttachment(): Promise<PendingAttachment> {
  if (!canUseNativeVideoAnalysis()) throw new Error("当前设备不支持原生视频分析");
  const selected = await VideoAnalysis.pickVideo();
  const info = await VideoAnalysis.inspect({ uri: selected.uri });
  const frameResult = await VideoAnalysis.extractFrames({ uri: selected.uri, count: 8 });
  const parts: AnalysisPart[] = [];
  for (const frame of frameResult.frames) {
    const converted = await nativeFileToDataUrl(frame.uri);
    parts.push({ type: "image", dataUrl: converted.dataUrl, mimeType: converted.blob.type || "image/jpeg", sourceName: `视频关键帧 @ ${(frame.timeMs / 1000).toFixed(1)}s` });
  }
  try {
    const subtitles = await VideoAnalysis.extractSubtitles({ uri: selected.uri });
    if (subtitles.text.trim()) {
      parts.push({ type: "text", text: `视频内嵌字幕：\n${subtitles.text.trim()}`, sourceName: "视频字幕" });
    }
  } catch {
    // Videos without a readable embedded subtitle track can still use audio and frames.
  }
  try {
    const audio = await VideoAnalysis.extractAudio({ uri: selected.uri });
    const converted = await nativeFileToDataUrl(audio.uri);
    if (converted.blob.size <= MAX_AUDIO_BYTES) {
      parts.push({ type: "audio", dataUrl: converted.dataUrl, mimeType: audio.mimeType || converted.blob.type || "audio/mp4", sourceName: "视频音轨" });
    }
  } catch {
    // Videos without an audio track remain analyzable through keyframes.
  }
  if (!parts.length) throw new Error("视频没有提取到可分析的画面或音轨");
  return {
    id: crypto.randomUUID(),
    kind: "video",
    name: `视频-${new Date().toLocaleTimeString()}.mp4`,
    mimeType: "video/mp4",
    size: 0,
    status: "ready",
    file: new File([], "native-video.mp4", { type: "video/mp4" }),
    parts,
  };
}
