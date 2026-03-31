/**
 * KRDS Chrome Extension Icon Generator
 * Node.js built-in modules only (zlib, fs, path)
 * Creates 16x16, 48x48, 128x128 PNG icons
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const CRC_TABLE = (() => {
  const t = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crcVal = crc32(crcBuf);
  const result = Buffer.alloc(4 + 4 + data.length + 4);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crcVal, 8 + data.length);
  return result;
}

function createPNG(size) {
  const R = 37, G = 110, B = 244; // #256ef4 KRDS Primary
  const WR = 255, WG = 255, WB = 255; // white

  // Pixel data: filter(1) + RGB(3) per pixel per row
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size, 0);

  const padding = Math.max(2, Math.floor(size * 0.15));
  const innerSize = size - padding * 2;

  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const off = y * stride + 1 + x * 3;
      // Background: primary blue
      let r = R, g = G, b = B;

      // Draw "K" letter in white within inner bounds
      const lx = x - padding;
      const ly = y - padding;
      const stemW = Math.max(1, Math.floor(innerSize * 0.22));
      const midY = Math.floor(innerSize * 0.5);
      const diagThick = Math.max(1, Math.floor(innerSize * 0.18));

      if (lx >= 0 && lx < innerSize && ly >= 0 && ly < innerSize) {
        // Vertical stem (left part of K)
        if (lx < stemW) {
          r = WR; g = WG; b = WB;
        }
        // Upper diagonal arm (top-right part of K)
        else if (ly < midY) {
          const diagDist = Math.abs((lx - stemW) - (midY - ly));
          if (diagDist < diagThick) {
            r = WR; g = WG; b = WB;
          }
        }
        // Lower diagonal arm (bottom-right part of K)
        else {
          const diagDist = Math.abs((lx - stemW) - (ly - midY));
          if (diagDist < diagThick) {
            r = WR; g = WG; b = WB;
          }
        }
      }

      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw);

  const ihdr = Buffer.alloc(13, 0);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });

[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ Created icon${size}.png (${png.length} bytes)`);
});
