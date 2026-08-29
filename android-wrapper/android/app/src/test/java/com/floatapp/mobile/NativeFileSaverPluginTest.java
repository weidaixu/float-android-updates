package com.floatapp.mobile;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import java.io.ByteArrayOutputStream;

import org.junit.Test;

public class NativeFileSaverPluginTest {
    @Test
    public void sanitizesSuggestedFilename() {
        assertEquals("backup.zip", NativeFileSaverPlugin.sanitizeFilename("../backup.zip"));
        assertEquals("download.bin", NativeFileSaverPlugin.sanitizeFilename("../.."));
    }

    @Test
    public void writesChunksInOrder() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        NativeFileSaverPlugin.writeChunk(output, new byte[] { 1, 2, 3 });
        NativeFileSaverPlugin.writeChunk(output, new byte[] { 4, 5 });

        assertArrayEquals(new byte[] { 1, 2, 3, 4, 5 }, output.toByteArray());
    }
}
