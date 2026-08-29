import { extractDocument } from "./document-extractor.ts";
import type { AnalysisPart, PendingAttachment } from "./types.ts";
import { validateAttachment } from "./validation.ts";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function createPendingAttachment(file: File): PendingAttachment {
  const validation = validateAttachment(file);
  if (!validation.ok) {
    return {
      id: crypto.randomUUID(),
      kind: "document",
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      status: "error",
      error: validation.message,
      file,
    };
  }
  return {
    id: crypto.randomUUID(),
    kind: validation.kind,
    name: validation.name,
    mimeType: validation.mimeType,
    size: validation.size,
    status: "processing",
    file,
  };
}

export async function processPendingAttachment(attachment: PendingAttachment): Promise<PendingAttachment> {
  if (attachment.status === "error" && !validateAttachment(attachment.file).ok) return attachment;
  try {
    let parts: AnalysisPart[];
    if (attachment.kind === "document") {
      const result = await extractDocument(attachment.file);
      parts = [result.part];
    } else if (attachment.kind === "image") {
      parts = [{
        type: "image",
        dataUrl: await fileToDataUrl(attachment.file),
        mimeType: attachment.mimeType,
        sourceName: attachment.name,
      }];
    } else {
      throw new Error("视频正在等待本机解析组件处理。");
    }
    return { ...attachment, status: "ready", parts, error: undefined };
  } catch (error) {
    return {
      ...attachment,
      status: "error",
      error: error instanceof Error ? error.message : "附件解析失败",
    };
  }
}
