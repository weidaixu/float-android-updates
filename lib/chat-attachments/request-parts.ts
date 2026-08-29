import {
  assertPartsSupported,
  type ModelCapabilities,
} from "./model-capabilities.ts";
import type { AnalysisPart } from "./types.ts";

export type AttachmentRequestContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "auto" } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

function audioPayload(dataUrl: string, mimeType: string): { data: string; format: string } {
  const marker = ";base64,";
  const markerIndex = dataUrl.indexOf(marker);
  if (!dataUrl.startsWith("data:") || markerIndex < 0) {
    throw new Error("音频数据格式无效。");
  }
  const format = mimeType.split("/")[1]?.replace("x-", "") || "mp3";
  return { data: dataUrl.slice(markerIndex + marker.length), format };
}

export function analysisPartsToRequestContent(
  parts: AnalysisPart[],
  capabilities: ModelCapabilities,
): AttachmentRequestContentPart[] {
  assertPartsSupported(parts, capabilities);
  return parts.map((part) => {
    if (part.type === "image") {
      return { type: "image_url", image_url: { url: part.dataUrl, detail: "auto" } };
    }
    if (part.type === "audio") {
      return { type: "input_audio", input_audio: audioPayload(part.dataUrl, part.mimeType) };
    }
    const label = part.sourceName ? `[文件：${part.sourceName}]\n` : "";
    return { type: "text", text: `${label}${part.text}` };
  });
}
