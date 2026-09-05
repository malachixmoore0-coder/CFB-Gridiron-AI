/**
 * Generates the app icon set (assets/icon.png + public/*.png) without any
 * native image dependency: draws a football on a navy field with laces and a
 * gold outline, then encodes it as PNG using zlib.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CFB variant: turf-green field stripes instead of the NFL app's navy so the two icons are distinguishable side by side.
const NAVY = [16, 74, 48];
const NAVY_LIGHT = [22, 92, 60];
const LEATHER = [140, 74, 40];
const LEATHER_DARK = [104, 52, 26];
const GOLD = [245, 183, 0];
const CHALK = [242, 245, 250];
const TURF = [242, 245, 250];

function draw(size) {
  const c = size / 2;
  return (x, y) => {
    const nx = (x - c) / size, ny = (y - c) / size; // -0.5..0.5
    // Rounded-square background.
    const rr = 0.22, ax = Math.abs(nx), ay = Math.abs(ny);
    const qx = Math.max(ax - 0.5 + rr, 0), qy = Math.max(ay - 0.5 + rr, 0);
    if (Math.sqrt(qx * qx + qy * qy) > rr) return [0, 0, 0, 0];
    // Subtle field stripes.
    let base = ((Math.floor((ny + 0.5) * 8) % 2) === 0) ? NAVY : NAVY_LIGHT;
    // Yard line near the bottom.
    if (ny > 0.34 && ny < 0.355) base = TURF;
    // Football: rotated ellipse.
    const ang = -Math.PI / 5;
    const rx = nx * Math.cos(ang) - ny * Math.sin(ang);
    const ry = nx * Math.sin(ang) + ny * Math.cos(ang);
    const e = (rx / 0.34) ** 2 + (ry / 0.2) ** 2;
    if (e <= 1) {
      // Outline.
      if (e > 0.86) return [...GOLD, 255];
      // Laces: a short bar along the major axis with cross ticks.
      const onSeam = Math.abs(ry) < 0.012 && Math.abs(rx) < 0.16;
      const onLace = Math.abs(rx % 0.05) < 0.012 && Math.abs(ry) < 0.045 && Math.abs(rx) < 0.14;
      if (onSeam || onLace) return [...CHALK, 255];
      // End stripes.
      if (Math.abs(rx) > 0.22 && Math.abs(rx) < 0.26) return [...CHALK, 255];
      const shade = ry < 0 ? LEATHER : LEATHER_DARK;
      return [...shade, 255];
    }
    return [...base, 255];
  };
}

const out = [
  ['assets/icon.png', 1024],
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
];
for (const [file, size] of out) {
  const p = path.join(__dirname, '..', file);
  fs.writeFileSync(p, encodePng(size, draw(size)));
  console.log('wrote', file, size + 'px');
}
