export type AttachmentKind = "image" | "document" | "video";

export type PendingAttachmentStatus = "processing" | "ready" | "error";

export interface PendingAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  status: PendingAttachmentStatus;
  file: File;
  parts?: AnalysisPart[];
  error?: string;
}

export type AnalysisPart =
  | { type: "text"; text: string; sourceName?: string }
  | { type: "image"; dataUrl: string; mimeType: string; sourceName?: string }
  | { type: "audio"; dataUrl: string; mimeType: string; sourceName?: string };

export interface AttachmentFileLike {
  name: string;
  type?: string;
  size: number;
}

export type AttachmentValidationResult =
  | {
      ok: true;
      kind: AttachmentKind;
      name: string;
      mimeType: string;
      size: number;
    }
  | {
      ok: false;
      code: "unsupported_type" | "file_too_large" | "empty_file";
      message: string;
      limit?: number;
    };
