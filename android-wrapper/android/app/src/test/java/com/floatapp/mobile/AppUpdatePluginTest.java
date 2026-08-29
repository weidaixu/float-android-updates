package com.floatapp.mobile;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AppUpdatePluginTest {
    @Test
    public void onlyHttpsDownloadUrlsAreAllowed() {
        assertTrue(AppUpdatePlugin.isAllowedDownloadUrl("https://github.com/example/app.apk"));
        assertFalse(AppUpdatePlugin.isAllowedDownloadUrl("http://example.com/app.apk"));
        assertFalse(AppUpdatePlugin.isAllowedDownloadUrl("file:///tmp/app.apk"));
    }

    @Test
    public void sha256ComparisonIsCaseInsensitiveAndStrict() {
        String expected = "A".repeat(64);
        assertTrue(AppUpdatePlugin.sha256Matches(expected.toLowerCase(), expected));
        assertFalse(AppUpdatePlugin.sha256Matches("b".repeat(64), expected));
        assertFalse(AppUpdatePlugin.sha256Matches("abc", expected));
    }
}

