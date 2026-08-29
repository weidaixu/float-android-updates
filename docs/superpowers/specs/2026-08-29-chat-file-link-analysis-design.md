# Float Chat File and Link Analysis Design

## Goal

Extend the existing Float chat experience so a user can attach supported local files or paste public links and have the configured AI model analyze their actual content. Preserve the current UI language, character context, message history, API settings, local-first storage model, Android package identity, signing identity, and in-app update channel.

## Scope

### Included

- One attachment entry in the existing chat composer.
- Images, videos, PDF, DOCX, TXT, and EPUB.
- Local extraction of document text.
- Local extraction of video metadata, embedded text subtitles when available, representative keyframes, and an audio track suitable for a compatible model or transcription endpoint.
- Automatic URL recognition in ordinary outgoing chat text.
- Public-page extraction for ordinary web pages, Douyin share links, and Xiaohongshu share links.
- Explicit model-capability and extraction-failure messages.
- Temporary local processing with automatic cleanup.
- Unit, integration, Android build, signature, package, and manual-device verification.

### Excluded

- Covert collection or administrator access to user chats.
- Permanent public storage of local attachments.
- Circumvention of authentication, paywalls, private posts, DRM, CAPTCHAs, or access controls.
- Guaranteeing extraction from every Douyin or Xiaohongshu URL; platform defenses can change.
- Supplying model API quota, speech-to-text quota, or a third-party content license.

## Architecture

The feature is divided into four isolated subsystems:

1. **Attachment intake** validates type and size, creates a local processing job, and renders a compact preview in the existing composer.
2. **Local extractors** convert supported files into normalized analysis parts without public upload.
3. **Model capability adapter** maps normalized parts to the existing provider request format and blocks unsupported combinations with a clear user-facing reason.
4. **Public-link resolver** detects URLs in ordinary chat text, attempts safe direct extraction, and optionally falls back to a private Cloudflare Worker that receives only the public URL.

Each subsystem returns typed results and structured errors so chat-room UI code does not contain parser or provider-specific logic.

## Attachment Intake

The existing composer gains one paperclip-style entry matching current visual density and spacing. The picker accepts:

- `image/*`
- `video/*`
- `.pdf`, `application/pdf`
- `.docx`, Office Open XML document MIME
- `.txt`, `text/plain`
- `.epub`, `application/epub+zip`

Default limits:

- Image: 20 MiB
- Document: 30 MiB
- Video: 200 MiB
- Extracted text sent to a model: 120,000 Unicode characters before provider-aware trimming
- Keyframes: up to 12 JPEG frames
- Extracted audio: up to 25 MiB; larger tracks require a shorter source or a provider-specific upload route

The UI shows file name, type, size, processing state, remove action, and actionable failure text. Sending is disabled while required processing is incomplete.

## Normalized Analysis Parts

All extractors produce a common representation:

```ts
type AnalysisPart =
  | { kind: "text"; text: string; sourceName: string; truncated: boolean }
  | { kind: "image"; mimeType: string; dataUrl: string; sourceName: string }
  | { kind: "audio"; mimeType: string; localUri: string; sourceName: string }
  | { kind: "link"; url: string; title?: string; text: string; platform: "web" | "douyin" | "xiaohongshu" };
```

Chat messages retain only the user-visible attachment metadata and the extracted text needed to reproduce conversation context. Large binary payloads and temporary video artifacts are not written into chat history.

## Local Document Extraction

- TXT: decode UTF-8 first, detect BOM, then report unsupported encoding rather than silently producing corrupt text.
- PDF: use a browser-compatible PDF parser to extract text page by page; scanned PDFs without text report that OCR is unavailable unless image-capable analysis is selected.
- DOCX: extract paragraphs, headings, tables, headers, and footnotes with a browser-compatible OOXML parser.
- EPUB: unzip locally, follow package/spine order, remove scripts/styles, and extract readable XHTML text with chapter labels.

Extraction runs off the main render path and reports progress. Parser libraries are bundled with the APK and never fetched from a CDN.

## Image Analysis

Images reuse the existing Float multimodal request path. The adapter sends provider-supported image parts and preserves the user's accompanying text. If the chosen provider/model is text-only, the send action is blocked with: `当前模型未声明图片理解能力，请更换支持视觉的模型或移除图片。`

## Video Analysis

Android uses a dedicated Capacitor plugin:

- `MediaMetadataRetriever` obtains duration, dimensions, and representative frames.
- `MediaExtractor` reads embedded subtitle tracks where Android exposes them.
- `MediaExtractor` plus `MediaMuxer` copies the selected audio track into a temporary local container without re-encoding when compatible.
- Temporary files live under the app cache directory and are deleted after the request finishes, is cancelled, or expires.

The request is assembled from available subtitles, keyframes, metadata, and audio. If a configured model supports images but not audio, it receives subtitles and keyframes and the UI explicitly states that audio was not analyzed. If no usable subtitle, frame, or compatible audio path exists, sending fails with a specific explanation.

No remote video processing service is used by default.

## Model Capability Adapter

Capability resolution uses explicit provider/model settings when present and conservative known-provider defaults otherwise. It never assumes that an OpenAI-compatible endpoint supports every OpenAI content type.

Capabilities:

```ts
type ModelCapabilities = {
  text: true;
  image: boolean;
  audioInput: boolean;
  documentNative: boolean;
};
```

Documents always have a text fallback. Images and audio have no fake fallback. Errors identify the missing capability and leave the attachment in the composer so the user can switch models.

## Public-Link Resolution

Outgoing text is scanned for HTTP and HTTPS URLs. There is no separate link button.

Resolution order:

1. Normalize and validate the URL; reject local, private, loopback, credential-bearing, and non-HTTP(S) targets.
2. Attempt direct extraction only when browser and CORS policy allow it.
3. Use the configured Cloudflare Worker fallback.
4. Return title, canonical URL, platform, and cleaned public text; for public video posts, include public caption/description and subtitle text only when legitimately available.

The Worker:

- Accepts only one public URL and a short-lived client token.
- Resolves DNS and blocks private/reserved address ranges before and after redirects.
- Limits redirects, response size, content type, and execution time.
- Does not receive chat history, local files, API keys, character data, or model prompts.
- Does not retain extracted content after the response.
- Returns a structured unsupported/protected-content result instead of bypassing access controls.

Cloudflare deployment code is committed beside the app source. The Worker URL remains optional and configurable; ordinary chat and local-file analysis continue without it.

## Privacy and Storage

- Local files are processed on device by default.
- Temporary binaries are stored only in app cache and deleted automatically.
- Extracted document text becomes part of the local chat history only after the user sends it.
- Public-link fallback transmits only the pasted public URL.
- No analytics event contains extracted text, file content, complete URL query strings, or model credentials.
- Logs contain error categories and byte counts, not document/chat contents.

## Error Handling

Errors are categorized as validation, local extraction, protected link, network, provider capability, provider rejection, or cleanup failure. User messages explain the next action. A failed attachment remains removable and retryable; a failed link extraction offers to send the original URL as plain text.

## Compatibility and Migration

- No change to package id `com.floatapp.mobile`.
- No destructive database migration.
- Existing chat records, characters, provider settings, Supabase settings, and backups remain readable.
- New attachment metadata fields are optional so older records continue to render.
- Android continues to use the existing signing certificate and GitHub update manifest.

## Testing and Release Gates

### Automated

- MIME and extension validation, size limits, URL extraction, SSRF rejection, text normalization, truncation, and capability decisions.
- TXT, fixture PDF, fixture DOCX, and fixture EPUB extraction.
- Video plugin unit tests for frame schedule, track selection, file cleanup, and unsupported tracks.
- Existing app-update and native-file-saver tests.
- Next.js production export, Capacitor sync, Android unit tests, and APK build.
- APK package id, version, signing-certificate SHA-256, and update-manifest SHA-256 verification.

### Manual Android

- Upgrade over v1.1.0 without losing data.
- Grant media/file permissions only when requested.
- Send one fixture of every supported type.
- Test one vision model, one text-only model, one audio-capable model where the customer supplies access, one ordinary URL, one Douyin URL, and one Xiaohongshu URL.
- Verify temporary cache cleanup after success, failure, cancellation, and app restart.

No release is published if build, tests, package identity, signature, or checksum verification fails.
