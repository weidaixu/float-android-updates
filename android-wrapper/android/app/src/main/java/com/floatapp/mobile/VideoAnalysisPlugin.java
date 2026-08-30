package com.floatapp.mobile;

import android.graphics.Bitmap;
import android.media.MediaExtractor;
import android.media.MediaCodec;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.media.MediaMuxer;
import android.net.Uri;
import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "VideoAnalysis")
public class VideoAnalysisPlugin extends Plugin {
    private static final int MAX_FRAMES = 12;
    private static final long MAX_CACHE_AGE_MS = 24L * 60L * 60L * 1000L;

    static long[] evenlySpacedTimestamps(long durationUs, int requestedCount) {
        int count = Math.max(1, Math.min(MAX_FRAMES, requestedCount));
        if (durationUs <= 0 || count == 1) return new long[]{0L};
        long[] result = new long[count];
        for (int i = 0; i < count; i++) result[i] = durationUs * i / (count - 1);
        return result;
    }

    static int selectPreferredTrack(List<String> mimeTypes, String prefix) {
        for (int i = 0; i < mimeTypes.size(); i++) {
            String mime = mimeTypes.get(i);
            if (mime != null && mime.toLowerCase(Locale.ROOT).startsWith(prefix)) return i;
        }
        return -1;
    }

    static String safeCacheName(String ignoredOriginalName, String suffix) {
        String safeSuffix = suffix != null && suffix.matches("\\.[A-Za-z0-9]{1,8}") ? suffix : ".bin";
        return UUID.randomUUID().toString().replace("-", "_") + safeSuffix;
    }

    static boolean isExpired(long createdAt, long now, long maxAge) {
        return now - createdAt > maxAge;
    }

    private File cacheDirectory() {
        File directory = new File(getContext().getCacheDir(), "video-analysis");
        if (!directory.exists()) directory.mkdirs();
        return directory;
    }

    private Uri requireUri(PluginCall call) {
        String value = call.getString("uri");
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException("缺少视频 URI");
        return Uri.parse(value);
    }

    @PluginMethod
    public void pickVideo(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("video/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "videoPicked");
    }

    @ActivityCallback
    private void videoPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("已取消选择视频");
            return;
        }
        Uri uri = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {}
        JSObject output = new JSObject();
        output.put("uri", uri.toString());
        call.resolve(output);
    }

    @PluginMethod
    public void inspect(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                retriever.setDataSource(getContext(), requireUri(call));
                long durationMs = Long.parseLong(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
                JSObject result = new JSObject();
                result.put("durationMs", durationMs);
                result.put("width", parseLong(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)));
                result.put("height", parseLong(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("无法读取视频信息", error);
            } finally {
                try { retriever.release(); } catch (Exception ignored) {}
            }
        });
    }

    @PluginMethod
    public void extractFrames(PluginCall call) {
        final Uri uri;
        try { uri = requireUri(call); } catch (Exception error) { call.reject(error.getMessage()); return; }
        int requested = call.getInt("count", 8);
        getBridge().execute(() -> {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                retriever.setDataSource(getContext(), uri);
                long durationMs = parseLong(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
                JSArray frames = new JSArray();
                for (long timeUs : evenlySpacedTimestamps(durationMs * 1000L, requested)) {
                    Bitmap bitmap = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                    if (bitmap == null) continue;
                    File output = new File(cacheDirectory(), safeCacheName("frame", ".jpg"));
                    try (FileOutputStream stream = new FileOutputStream(output)) {
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream);
                    } finally {
                        bitmap.recycle();
                    }
                    JSObject frame = new JSObject();
                    frame.put("uri", Uri.fromFile(output).toString());
                    frame.put("timeMs", timeUs / 1000L);
                    frames.put(frame);
                }
                JSObject result = new JSObject();
                result.put("frames", frames);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("关键帧提取失败", error);
            } finally {
                try { retriever.release(); } catch (Exception ignored) {}
            }
        });
    }

    @PluginMethod
    public void extractAudio(PluginCall call) {
        final Uri uri;
        try { uri = requireUri(call); } catch (Exception error) { call.reject(error.getMessage()); return; }
        getBridge().execute(() -> {
            MediaExtractor extractor = new MediaExtractor();
            MediaMuxer muxer = null;
            try {
                extractor.setDataSource(getContext(), uri, null);
                int audioTrack = -1;
                MediaFormat format = null;
                for (int i = 0; i < extractor.getTrackCount(); i++) {
                    MediaFormat candidate = extractor.getTrackFormat(i);
                    String mime = candidate.getString(MediaFormat.KEY_MIME);
                    if (mime != null && mime.startsWith("audio/")) { audioTrack = i; format = candidate; break; }
                }
                if (audioTrack < 0 || format == null) { call.reject("视频中没有音轨"); return; }
                extractor.selectTrack(audioTrack);
                File output = new File(cacheDirectory(), safeCacheName("audio", ".m4a"));
                muxer = new MediaMuxer(output.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
                int outputTrack = muxer.addTrack(format);
                muxer.start();
                int maxInput = format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE) ? format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE) : 1024 * 1024;
                ByteBuffer buffer = ByteBuffer.allocateDirect(Math.max(64 * 1024, maxInput));
                MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
                while (true) {
                    int size = extractor.readSampleData(buffer, 0);
                    if (size < 0) break;
                    info.offset = 0;
                    info.size = size;
                    info.presentationTimeUs = extractor.getSampleTime();
                    info.flags = extractor.getSampleFlags();
                    muxer.writeSampleData(outputTrack, buffer, info);
                    extractor.advance();
                }
                JSObject result = new JSObject();
                result.put("uri", Uri.fromFile(output).toString());
                result.put("mimeType", "audio/mp4");
                call.resolve(result);
            } catch (Exception error) {
                call.reject("音轨提取失败", error);
            } finally {
                extractor.release();
                if (muxer != null) try { muxer.stop(); muxer.release(); } catch (Exception ignored) {}
            }
        });
    }

    @PluginMethod
    public void extractSubtitles(PluginCall call) {
        final Uri uri;
        try { uri = requireUri(call); } catch (Exception error) { call.reject(error.getMessage()); return; }
        getBridge().execute(() -> {
            MediaExtractor extractor = new MediaExtractor();
            try {
                extractor.setDataSource(getContext(), uri, null);
                int subtitleTrack = -1;
                for (int i = 0; i < extractor.getTrackCount(); i++) {
                    String mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
                    if (mime != null && (mime.startsWith("text/") || mime.contains("subrip") || mime.contains("ttml")
                            || mime.contains("vtt") || mime.contains("tx3g"))) {
                        subtitleTrack = i;
                        break;
                    }
                }
                JSObject result = new JSObject();
                if (subtitleTrack < 0) {
                    result.put("text", "");
                    call.resolve(result);
                    return;
                }
                extractor.selectTrack(subtitleTrack);
                ByteBuffer buffer = ByteBuffer.allocate(256 * 1024);
                StringBuilder text = new StringBuilder();
                while (text.length() < 120000) {
                    buffer.clear();
                    int size = extractor.readSampleData(buffer, 0);
                    if (size < 0) break;
                    byte[] sample = new byte[size];
                    buffer.position(0);
                    buffer.get(sample);
                    int offset = 0;
                    if (size > 2) {
                        int declared = ((sample[0] & 0xff) << 8) | (sample[1] & 0xff);
                        if (declared > 0 && declared <= size - 2) offset = 2;
                    }
                    String cue = new String(sample, offset, size - offset, StandardCharsets.UTF_8)
                            .replaceAll("[\\p{Cc}&&[^\\n\\t]]", " ").trim();
                    if (!cue.isEmpty()) {
                        long seconds = Math.max(0L, extractor.getSampleTime() / 1_000_000L);
                        text.append(String.format(Locale.ROOT, "[%02d:%02d] %s\\n", seconds / 60L, seconds % 60L, cue));
                    }
                    extractor.advance();
                }
                result.put("text", text.toString().trim());
                call.resolve(result);
            } catch (Exception error) {
                call.reject("字幕提取失败", error);
            } finally {
                extractor.release();
            }
        });
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        long now = System.currentTimeMillis();
        int deleted = 0;
        File[] files = cacheDirectory().listFiles();
        if (files != null) for (File file : files) {
            if (isExpired(file.lastModified(), now, MAX_CACHE_AGE_MS) && file.delete()) deleted++;
        }
        JSObject result = new JSObject();
        result.put("deleted", deleted);
        call.resolve(result);
    }

    private static long parseLong(String value) {
        try { return value == null ? 0L : Long.parseLong(value); } catch (NumberFormatException ignored) { return 0L; }
    }
}
