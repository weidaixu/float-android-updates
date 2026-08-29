package com.floatapp.mobile;

import static org.junit.Assert.*;
import java.util.Arrays;
import org.junit.Test;

public class VideoAnalysisPluginTest {
    @Test public void timestampsAreEvenlySpacedAndBounded() {
        long[] result = VideoAnalysisPlugin.evenlySpacedTimestamps(10_000_000L, 4);
        assertArrayEquals(new long[]{0L, 3_333_333L, 6_666_666L, 10_000_000L}, result);
        assertTrue(VideoAnalysisPlugin.evenlySpacedTimestamps(20_000_000L, 99).length <= 12);
    }

    @Test public void choosesFirstPreferredTrack() {
        assertEquals(1, VideoAnalysisPlugin.selectPreferredTrack(
                Arrays.asList("video/avc", "audio/mp4a-latm", "audio/opus"), "audio/"));
        assertEquals(-1, VideoAnalysisPlugin.selectPreferredTrack(
                Arrays.asList("video/avc"), "audio/"));
    }

    @Test public void cacheNamesDoNotContainUserPathCharacters() {
        assertTrue(VideoAnalysisPlugin.safeCacheName("../bad\\name.mp4", ".jpg")
                .matches("[A-Za-z0-9_-]+\\.jpg"));
    }

    @Test public void expiryUsesTheConfiguredAge() {
        assertTrue(VideoAnalysisPlugin.isExpired(1_000L, 11_001L, 10_000L));
        assertFalse(VideoAnalysisPlugin.isExpired(1_000L, 11_000L, 10_000L));
    }
}
