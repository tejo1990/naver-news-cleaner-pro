// Simple PNG icon generator using Canvas
// Generates 16x16, 48x48, 128x128 PNG icons

const { createCanvas } = (() => {
    // Minimal PNG encoder - no external dependencies needed
    // We'll create a simple colored icon using raw PNG encoding

    function createPNG(width, height, pixels) {
        // PNG file structure
        const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

        // IHDR chunk
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(width, 0);
        ihdr.writeUInt32BE(height, 4);
        ihdr[8] = 8; // bit depth
        ihdr[9] = 6; // color type (RGBA)
        ihdr[10] = 0; // compression
        ihdr[11] = 0; // filter
        ihdr[12] = 0; // interlace

        // Prepare raw image data with filter bytes
        const rawData = [];
        for (let y = 0; y < height; y++) {
            rawData.push(0); // filter type: None
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                rawData.push(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
            }
        }

        // Compress using zlib
        const zlib = require('zlib');
        const compressed = zlib.deflateSync(Buffer.from(rawData));

        // Build chunks
        function makeChunk(type, data) {
            const typeBuffer = Buffer.from(type);
            const length = Buffer.alloc(4);
            length.writeUInt32BE(data.length, 0);
            const combined = Buffer.concat([typeBuffer, data]);
            const crc = crc32(combined);
            const crcBuffer = Buffer.alloc(4);
            crcBuffer.writeUInt32BE(crc >>> 0, 0);
            return Buffer.concat([length, combined, crcBuffer]);
        }

        // CRC32 calculation
        function crc32(buf) {
            let crc = -1;
            for (let i = 0; i < buf.length; i++) {
                crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
            }
            return crc ^ -1;
        }

        // CRC32 lookup table
        const crc32Table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            crc32Table[i] = c;
        }

        const ihdrChunk = makeChunk('IHDR', ihdr);
        const idatChunk = makeChunk('IDAT', compressed);
        const iendChunk = makeChunk('IEND', Buffer.alloc(0));

        return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
    }

    return {
        createPNG,
    };
})();

const fs = require('fs');
const path = require('path');

// Draw icon at given size
function drawIcon(size) {
    const pixels = new Uint8Array(size * size * 4);
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.45;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= r) {
                // Inside circle - gradient from #6c5ce7 to #a29bfe
                const t = (x + y) / (size * 2);
                const r1 = Math.round(108 + (162 - 108) * t);
                const g1 = Math.round(92 + (155 - 92) * t);
                const b1 = Math.round(231 + (254 - 231) * t);

                // Shield shape check
                const nx = (x - cx) / r;
                const ny = (y - cy) / r;
                const shieldTop = -0.65;
                const shieldBottom = 0.65;

                const inShield =
                    ny >= shieldTop &&
                    ny <= shieldBottom &&
                    Math.abs(nx) <= (ny < 0 ? 0.55 : 0.55 - (ny * 0.4));

                if (inShield) {
                    // White shield
                    // Filter/funnel inside shield
                    const funnelTop = -0.35;
                    const funnelMiddle = 0.05;
                    const funnelBottom = 0.45;

                    let inFunnel = false;
                    if (ny >= funnelTop && ny <= funnelMiddle) {
                        const funnelWidth = 0.35 - (ny - funnelTop) * 0.45;
                        inFunnel = Math.abs(nx) <= funnelWidth;
                    } else if (ny > funnelMiddle && ny <= funnelBottom) {
                        inFunnel = Math.abs(nx) <= 0.08;
                    }

                    if (inFunnel) {
                        pixels[idx] = r1;
                        pixels[idx + 1] = g1;
                        pixels[idx + 2] = b1;
                        pixels[idx + 3] = 230;
                    } else {
                        pixels[idx] = 255;
                        pixels[idx + 1] = 255;
                        pixels[idx + 2] = 255;
                        pixels[idx + 3] = 240;
                    }
                } else {
                    // Circle background
                    pixels[idx] = r1;
                    pixels[idx + 1] = g1;
                    pixels[idx + 2] = b1;

                    // Anti-aliasing at edge
                    if (dist > r - 1.5) {
                        pixels[idx + 3] = Math.round(255 * Math.max(0, (r - dist) / 1.5));
                    } else {
                        pixels[idx + 3] = 255;
                    }
                }
            } else {
                // Transparent
                pixels[idx] = 0;
                pixels[idx + 1] = 0;
                pixels[idx + 2] = 0;
                pixels[idx + 3] = 0;
            }
        }
    }

    return pixels;
}

const { createPNG } = (() => {
    function createPNG(width, height, pixels) {
        const zlib = require('zlib');
        const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(width, 0);
        ihdr.writeUInt32BE(height, 4);
        ihdr[8] = 8;
        ihdr[9] = 6;

        const rawData = [];
        for (let y = 0; y < height; y++) {
            rawData.push(0);
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                rawData.push(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]);
            }
        }
        const compressed = zlib.deflateSync(Buffer.from(rawData));

        const crc32Table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crc32Table[i] = c;
        }
        function crc32(buf) {
            let crc = -1;
            for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
            return crc ^ -1;
        }
        function makeChunk(type, data) {
            const typeBuffer = Buffer.from(type);
            const length = Buffer.alloc(4);
            length.writeUInt32BE(data.length, 0);
            const combined = Buffer.concat([typeBuffer, data]);
            const crcVal = crc32(combined);
            const crcBuffer = Buffer.alloc(4);
            crcBuffer.writeUInt32BE(crcVal >>> 0, 0);
            return Buffer.concat([length, combined, crcBuffer]);
        }

        return Buffer.concat([
            signature,
            makeChunk('IHDR', ihdr),
            makeChunk('IDAT', compressed),
            makeChunk('IEND', Buffer.alloc(0)),
        ]);
    }
    return { createPNG };
})();

// Generate icons
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

sizes.forEach((size) => {
    const pixels = drawIcon(size);
    const png = createPNG(size, size, pixels);
    const filePath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`✅ Generated ${filePath} (${png.length} bytes)`);
});

console.log('🎉 All icons generated!');
