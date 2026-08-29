import type { AttachmentKind, PendingAttachment } from "./types.ts";
import { normalizeExtractedText } from "./text-normalizer.ts";

export interface StoredAttachmentMetadata {
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  extractedText?: string;
  mediaRef?: string;
}

type MetadataSource = Pick<PendingAttachment, "kind" | "name" | "mimeType" | "size" | "parts">;

export function buildStoredAttachmentMetadata(
  attachments: MetadataSource[],
): StoredAttachmentMetadata[] {
  return attachments.map((attachment) => {
    const text = attachment.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n");
    return {
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      ...(text ? { extractedText: normalizeExtractedText(text) } : {}),
    };
  });
}

export function attachmentPromptText(metadata: StoredAttachmentMetadata[] | undefined): string {
  if (!metadata?.length) return "";
  return metadata
    .filter((item) => item.extractedText)
    .map((item) => `[附件：${item.name}]\n${item.extractedText}`)
    .join("\n\n");
}
