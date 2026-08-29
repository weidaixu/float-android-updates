# Chat File and Link Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local file/video analysis and automatic public-link extraction to the existing Float chat composer and ship it through the signed Android update channel.

**Architecture:** Typed attachment jobs normalize local documents, images, and Android-extracted video parts before the existing chat request is assembled. A conservative model-capability adapter blocks unsupported media. URL detection is automatic; direct extraction falls back to a locked-down Cloudflare Worker that receives only a public URL.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node test runner, Capacitor 7, Java 21, Android MediaMetadataRetriever/MediaExtractor/MediaMuxer, pdfjs-dist, mammoth, JSZip, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-08-29-chat-file-link-analysis-design.md`

## Global Constraints

- Preserve package id `com.floatapp.mobile` and signing certificate SHA-256 `14eaa56eca4dc41a4f09be90dcd9ad78e4ea608ac51ed58619222a94a02bd154`.
- Preserve existing characters, chats, provider settings, Supabase settings, backups, UI styling, and update behavior.
- Local files must not be uploaded to the link resolver or any public storage service.
- Reject private, loopback, reserved, credential-bearing, and non-HTTP(S) link targets.
- Do not bypass authentication, private posts, paywalls, DRM, CAPTCHAs, or platform access controls.
- Do not publish when tests, build, package identity, signature, or checksum verification fails.

---

### Task 1: Normalized attachment model and validation

**Files:**
- Create: `lib/chat-attachments/types.ts`
- Create: `lib/chat-attachments/validation.ts`
- Test: `tests/chat-attachment-validation.test.mjs`

**Interfaces:**
- Produces: `AttachmentKind`, `PendingAttachment`, `AnalysisPart`, `validateAttachment(fileLike)`, `formatAttachmentError(error)`.

- [ ] **Step 1: Write failing validation tests** covering MIME/extension fallback, 20 MiB image, 30 MiB document, 200 MiB video, unsupported types, and filename sanitization.
- [ ] **Step 2: Run** `node --test tests/chat-attachment-validation.test.mjs`; expect missing-module failure.
- [ ] **Step 3: Implement exact discriminated unions and validation limits** from the spec; return `{ ok: false, code, message }` rather than throwing for user input.
- [ ] **Step 4: Run the validation tests** and expect all assertions to pass.
- [ ] **Step 5: Commit** with `git commit -m "feat: define validated chat attachments"`.

### Task 2: Local TXT, PDF, DOCX, and EPUB extraction

**Files:**
- Create: `lib/chat-attachments/text-normalizer.ts`
- Create: `lib/chat-attachments/document-extractor.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/document-extractor.test.mjs`
- Create: `tests/fixtures/attachments/sample.txt`
- Create: `tests/fixtures/attachments/sample.pdf`
- Create: `tests/fixtures/attachments/sample.docx`
- Create: `tests/fixtures/attachments/sample.epub`

**Interfaces:**
- Consumes: `AnalysisPart` from Task 1.
- Produces: `extractDocument(file): Promise<{ part: AnalysisPart; warnings: string[] }>` and `normalizeExtractedText(text, maxChars)`.

- [ ] **Step 1: Add fixture-driven failing tests** asserting ordered text, chapter/page labels, table text, BOM decoding, whitespace cleanup, and 120,000-character truncation.
- [ ] **Step 2: Run** `node --test tests/document-extractor.test.mjs`; expect missing extractor failure.
- [ ] **Step 3: Install bundled parsers** with `npm install pdfjs-dist mammoth jszip` and commit the lockfile changes.
- [ ] **Step 4: Implement local extraction**: TXT via `TextDecoder`, PDF via `pdfjs-dist`, DOCX via `mammoth.extractRawText`, EPUB via JSZip plus container/package/spine parsing and DOMParser.
- [ ] **Step 5: Run document and validation tests** and expect zero failures.
- [ ] **Step 6: Commit** with `git commit -m "feat: extract chat documents locally"`.

### Task 3: Model capability resolution and request mapping

**Files:**
- Create: `lib/chat-attachments/model-capabilities.ts`
- Create: `lib/chat-attachments/request-parts.ts`
- Modify: `lib/chat-service.ts`
- Modify: `lib/api-config-storage.ts`
- Test: `tests/model-capabilities.test.mjs`

**Interfaces:**
- Consumes: `AnalysisPart[]` and the selected provider/model configuration.
- Produces: `resolveModelCapabilities(config): ModelCapabilities`, `assertPartsSupported(parts, capabilities)`, and provider-ready image/audio/text content parts.

- [ ] **Step 1: Write failing tests** for explicit capability overrides, conservative unknown OpenAI-compatible defaults, known vision models, audio rejection, and document text fallback.
- [ ] **Step 2: Run** `node --test tests/model-capabilities.test.mjs`; expect missing-module failure.
- [ ] **Step 3: Add optional `capabilities` settings** without changing existing saved configs and implement conservative resolution.
- [ ] **Step 4: Map image parts to the existing `image_url` path, audio only to providers declaring audio input, and document/link text to bounded prompt blocks.
- [ ] **Step 5: Run capability tests and existing chat-service tests**; expect zero failures.
- [ ] **Step 6: Commit** with `git commit -m "feat: enforce attachment model capabilities"`.

### Task 4: Chat composer attachment interaction

**Files:**
- Create: `components/chat/chat-attachment-tray.tsx`
- Create: `components/chat/chat-attachment-picker.tsx`
- Modify: `components/chat/chat-room.tsx`
- Modify: `lib/chat-storage.ts`
- Test: `tests/chat-attachment-message.test.mjs`

**Interfaces:**
- Consumes: validators, extractors, request mapper, and current chat send callback.
- Produces: one attachment picker, processing tray, retry/remove controls, and optional attachment metadata on user messages.

- [ ] **Step 1: Write failing storage tests** confirming old messages remain valid and new attachment metadata serializes without binary payloads.
- [ ] **Step 2: Run** `node --test tests/chat-attachment-message.test.mjs`; expect the new metadata assertion to fail.
- [ ] **Step 3: Add the picker and tray** using existing chat CSS variables and icons; disable send only while required processing is active.
- [ ] **Step 4: Wire extracted parts into the existing send pipeline** while storing only visible metadata and bounded extracted text.
- [ ] **Step 5: Run message, document, validation, and capability tests**; expect zero failures.
- [ ] **Step 6: Run** `npm run build`; expect a successful production build.
- [ ] **Step 7: Commit** with `git commit -m "feat: add chat attachment analysis UI"`.

### Task 5: Android local video extraction plugin

**Files:**
- Create: `android-wrapper/android/app/src/main/java/com/floatapp/mobile/VideoAnalysisPlugin.java`
- Create: `android-wrapper/android/app/src/test/java/com/floatapp/mobile/VideoAnalysisPluginTest.java`
- Modify: `android-wrapper/android/app/src/main/java/com/floatapp/mobile/MainActivity.java`
- Create: `lib/chat-attachments/video-extractor.ts`
- Test: `tests/video-extractor.test.mjs`

**Interfaces:**
- Produces native methods `inspect`, `extractFrames`, `extractAudio`, and `cleanup`; web function `extractVideo(file): Promise<{ parts: AnalysisPart[]; warnings: string[]; cleanup(): Promise<void> }>`.

- [ ] **Step 1: Write failing Java tests** for evenly spaced frame timestamps, preferred audio/subtitle track selection, cache filename safety, and expiry cleanup.
- [ ] **Step 2: Run** `cd android-wrapper/android && ./gradlew testDebugUnitTest`; expect missing class failure.
- [ ] **Step 3: Implement the Capacitor plugin** with MediaMetadataRetriever, MediaExtractor, MediaMuxer, cache-only output, 12-frame maximum, cancellation, and cleanup.
- [ ] **Step 4: Register the plugin and implement the TypeScript bridge**, with browser fallback limited to metadata and canvas keyframes.
- [ ] **Step 5: Run Java and Node video tests**; expect zero failures.
- [ ] **Step 6: Commit** with `git commit -m "feat: analyze videos locally on Android"`.

### Task 6: Automatic URL detection and safe extraction

**Files:**
- Create: `lib/link-analysis/url-detection.ts`
- Create: `lib/link-analysis/link-resolver.ts`
- Modify: `components/chat/chat-room.tsx`
- Test: `tests/link-analysis.test.mjs`

**Interfaces:**
- Produces: `extractPublicUrls(text)`, `classifyPublicUrl(url)`, `resolvePublicLink(url, options): Promise<AnalysisPart>`.

- [ ] **Step 1: Write failing tests** for punctuation, duplicate URLs, Douyin/Xiaohongshu classification, credentials, localhost, IPv4/IPv6 private ranges, redirect limits, and plain-text fallback.
- [ ] **Step 2: Run** `node --test tests/link-analysis.test.mjs`; expect missing-module failure.
- [ ] **Step 3: Implement URL normalization and client-side HTML extraction** with response size/type/time limits and readable title/text cleanup.
- [ ] **Step 4: Invoke resolution automatically before send** and offer original-URL plain-text fallback on protected or failed pages.
- [ ] **Step 5: Run link and chat tests**; expect zero failures.
- [ ] **Step 6: Commit** with `git commit -m "feat: analyze public links from chat text"`.

### Task 7: Cloudflare public-link fallback

**Files:**
- Create: `services/link-resolver/wrangler.toml`
- Create: `services/link-resolver/src/index.ts`
- Create: `services/link-resolver/src/security.ts`
- Create: `services/link-resolver/test/security.test.ts`
- Create: `services/link-resolver/package.json`
- Create: `services/link-resolver/package-lock.json`
- Modify: `components/settings/backend-api-settings.tsx`

**Interfaces:**
- Consumes: one HTTPS public URL and bearer token.
- Produces JSON `{ ok, url, canonicalUrl, platform, title, text, warnings, errorCode }` and a configurable Worker URL/token setting.

- [ ] **Step 1: Write failing Worker tests** for DNS rebinding checks, redirect revalidation, private/reserved addresses, content limits, timeout, HTML cleanup, and no-store headers.
- [ ] **Step 2: Run** `npm test --prefix services/link-resolver`; expect missing implementation failure.
- [ ] **Step 3: Implement the Worker** with allowlisted HTTP methods, bearer authentication, DNS/IP validation before every fetch, five redirects maximum, 5 MiB response maximum, and no persistence.
- [ ] **Step 4: Add optional Worker settings** and client fallback; never send chat text or attachment bytes.
- [ ] **Step 5: Run Worker and link-client tests**; expect zero failures.
- [ ] **Step 6: Commit** with `git commit -m "feat: add private public-link resolver"`.

### Task 8: Full verification, signed APK, and update publication

**Files:**
- Modify: `android-wrapper/android/app/build.gradle`
- Modify: `latest.json`
- Modify: `.upstream-commit` only if upstream changed during development.

**Interfaces:**
- Consumes all prior tasks.
- Produces a signed versionCode 3+ APK, GitHub Release asset, and matching `latest.json`.

- [ ] **Step 1: Run all Node tests** with `node --test tests/*.test.mjs android-wrapper/tests/*.test.mjs`; expect zero failures.
- [ ] **Step 2: Run Worker tests** with `npm test --prefix services/link-resolver`; expect zero failures.
- [ ] **Step 3: Run Android tests** with `cd android-wrapper/android && ./gradlew testDebugUnitTest`; expect `BUILD SUCCESSFUL`.
- [ ] **Step 4: Build the APK** with `node android-wrapper/scripts/build-mobile.mjs`, `npm ci --prefix android-wrapper`, `npx --prefix android-wrapper cap sync android`, and `android-wrapper/android/gradlew assembleDebug`; expect exit code 0.
- [ ] **Step 5: Verify package and signing certificate** using Android `aapt` and `apksigner`; require `com.floatapp.mobile` and the certificate in Global Constraints.
- [ ] **Step 6: Install over v1.1.0 on a physical Android device** and verify existing chats, roles, API settings, one fixture of each file type, one supported/unsupported model path, and cache cleanup.
- [ ] **Step 7: Publish only after device confirmation**, upload the APK to a new GitHub Release, calculate SHA-256, update `latest.json`, download the release asset, and confirm its hash matches.
- [ ] **Step 8: Commit** with `git commit -m "release: Float Android file and link analysis"` and push `main`.
