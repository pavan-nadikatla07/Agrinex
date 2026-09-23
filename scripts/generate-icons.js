import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, colorR, colorG, colorB) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // color type 6: RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with scanline filter byte (0)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * 0.46;
  const rSafe = width * 0.35;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = colorR, g = colorG, b = colorB, a = 255;
      
      // Inside circle symbol
      if (dist < rSafe) {
        // leaf sprout shape
        if (Math.abs(dx) < width * 0.04 && dy > -height * 0.25 && dy < height * 0.28) {
          // White stem
          r = 255; g = 255; b = 255;
        } else if (dx < 0 && dy < 0 && dist > width * 0.08 && dist < width * 0.28) {
          // Left leaf green
          r = 74; g = 222; b = 128;
        } else if (dx > 0 && dy < height * 0.05 && dist > width * 0.08 && dist < width * 0.28) {
          // Right leaf golden
          r = 250; g = 204; b = 21;
        } else if (Math.abs(dy - height * 0.28) < height * 0.04 && Math.abs(dx) < width * 0.25) {
          // Horizontal node bar
          r = 255; g = 255; b = 255;
        }
      } else if (dist > rOuter) {
        // slightly darker rounded edge
        r = Math.max(0, colorR - 25);
        g = Math.max(0, colorG - 25);
        b = Math.max(0, colorB - 25);
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, body, crc]);
}

// CRC32 implementation
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

// Emerald theme color: rgb(22, 163, 74)
fs.writeFileSync('./public/pwa-192x192.png', createPNG(192, 192, 22, 163, 74));
fs.writeFileSync('./public/pwa-512x512.png', createPNG(512, 512, 22, 163, 74));
fs.writeFileSync('./public/pwa-maskable-512x512.png', createPNG(512, 512, 22, 163, 74));
fs.writeFileSync('./public/apple-touch-icon.png', createPNG(180, 180, 22, 163, 74));
fs.writeFileSync('./public/favicon.ico', createPNG(48, 48, 22, 163, 74));

console.log('PWA icons created successfully');
