// Generates icon.png (1024x1024) and adaptive-icon.png (1024x1024)
// Pure Node.js – no external deps
const fs = require('fs');
const zlib = require('zlib');

const SIZE = 1024;

// --- PNG helpers ---
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const crc = crc32(Buffer.concat([t, d]));
  return Buffer.concat([u32(d.length), t, d, u32(crc)]);
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// RGBA pixel buffer
function makePixels(size, drawFn) {
  const px = Buffer.alloc(size * size * 4, 0);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    // alpha blend over existing
    const sa = a / 255, da = px[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return;
    px[i]     = Math.round((px[i]     * da * (1 - sa) + r * sa) / oa);
    px[i + 1] = Math.round((px[i + 1] * da * (1 - sa) + g * sa) / oa);
    px[i + 2] = Math.round((px[i + 2] * da * (1 - sa) + b * sa) / oa);
    px[i + 3] = Math.round(oa * 255);
  };
  drawFn(set, size);
  return px;
}

// Anti-aliased circle fill
function fillCircle(set, cx, cy, r, R, G, B, A = 255) {
  const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1);
  const y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const alpha = Math.max(0, Math.min(1, r + 0.5 - d));
      if (alpha > 0) set(x, y, R, G, B, Math.round(A * alpha));
    }
  }
}

// Anti-aliased filled rectangle
function fillRect(set, x, y, w, h, R, G, B, A = 255) {
  for (let py = Math.floor(y); py <= Math.ceil(y + h); py++) {
    for (let px2 = Math.floor(x); px2 <= Math.ceil(x + w); px2++) {
      const ax = Math.min(px2 + 1, x + w) - Math.max(px2, x);
      const ay = Math.min(py + 1, y + h) - Math.max(py, y);
      const alpha = Math.max(0, ax) * Math.max(0, ay);
      if (alpha > 0) set(px2, py, R, G, B, Math.round(A * alpha));
    }
  }
}

// Thick anti-aliased line
function drawLine(set, x1, y1, x2, y2, thick, R, G, B, A = 255) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    fillCircle(set, cx, cy, thick / 2, R, G, B, A);
  }
}

// Rounded rectangle (filled)
function fillRoundRect(set, x, y, w, h, r, R, G, B, A = 255) {
  // fill inner rects
  fillRect(set, x + r, y, w - 2 * r, h, R, G, B, A);
  fillRect(set, x, y + r, w, h - 2 * r, R, G, B, A);
  // corners
  fillCircle(set, x + r, y + r, r, R, G, B, A);
  fillCircle(set, x + w - r, y + r, r, R, G, B, A);
  fillCircle(set, x + r, y + h - r, r, R, G, B, A);
  fillCircle(set, x + w - r, y + h - r, r, R, G, B, A);
}

function buildPNG(pixels, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const ihdrChunk = chunk('IHDR', ihdr);

  // raw scanlines: filter byte 0 + RGBA row
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0;
    pixels.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// ── DRAW ICON ──────────────────────────────────────────────────────────────
// Palette
const NAVY   = [18, 38, 58];      // #12263A
const GOLD   = [184, 145, 47];    // #B8912F
const LGOLD  = [230, 190, 80];    // lighter gold
const DGOLD  = [140, 105, 20];    // darker gold shadow
const WHITE  = [255, 255, 255];
const CREAM  = [255, 245, 200];

// Draw a filled arc (pie slice) for coin shine
function fillArc(set, cx, cy, r, a0, a1, R, G, B, A = 255) {
  const steps = Math.ceil(r * (a1 - a0));
  for (let i = 0; i <= steps; i++) {
    const angle = a0 + (a1 - a0) * i / steps;
    drawLine(set, cx, cy, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 2, R, G, B, A);
  }
}

function drawIcon(set, S) {
  const cx = S / 2, cy = S / 2;

  // 1. Deep navy background (full bleed rounded square)
  fillRoundRect(set, 0, 0, S, S, S * 0.15, ...NAVY);

  // 2. Outer gold glow ring
  for (let t = 0; t < 18; t++) {
    fillCircle(set, cx, cy, S * 0.46 - t, ...GOLD, Math.round(22 - t * 1.2));
  }

  // 3. Main gold coin (large circle)
  fillCircle(set, cx, cy, S * 0.40, ...GOLD);

  // 4. Coin bevel: slightly darker outer ring
  for (let t = 0; t < 6; t++) {
    fillCircle(set, cx, cy, S * 0.40 - t, ...DGOLD, 80 - t * 12);
  }

  // 5. Inner coin face (lighter gold)
  fillCircle(set, cx, cy, S * 0.33, ...LGOLD);

  // 6. Coin shine highlight (top-left arc)
  fillArc(set, cx - S * 0.08, cy - S * 0.08, S * 0.18, -2.4, -0.8, ...CREAM, 55);

  // 7. Navy inner circle (emblem background)
  fillCircle(set, cx, cy, S * 0.26, ...NAVY);

  // 8. Bold "K" lettermark in bright gold
  const thick = S * 0.052;
  const kx    = cx - S * 0.075;
  const ky    = cy - S * 0.155;
  const kh    = S * 0.31;
  // vertical bar
  drawLine(set, kx, ky, kx, ky + kh, thick, ...LGOLD);
  // upper diagonal arm
  drawLine(set, kx + thick * 0.5, cy - thick * 0.3, kx + S * 0.145, ky, thick, ...LGOLD);
  // lower diagonal arm
  drawLine(set, kx + thick * 0.5, cy + thick * 0.3, kx + S * 0.145, ky + kh, thick, ...LGOLD);

  // 9. Three stacked gold coins at bottom (wealth symbol)
  const coinY = cy + S * 0.30;
  const coinR = S * 0.055;
  const gap   = S * 0.13;
  for (let i = -1; i <= 1; i++) {
    const ccx = cx + i * gap;
    fillCircle(set, ccx, coinY, coinR, ...GOLD);
    for (let t = 0; t < 3; t++)
      fillCircle(set, ccx, coinY, coinR - t, ...DGOLD, 60 - t * 18);
    fillCircle(set, ccx, coinY, coinR * 0.55, ...LGOLD);
  }

  // 10. Thin decorative gold ring outline on main coin
  for (let t = 0; t < 3; t++) {
    fillCircle(set, cx, cy, S * 0.40 - t, ...LGOLD, 45 - t * 14);
  }
}

// ── GENERATE FILES ─────────────────────────────────────────────────────────
const iconPx = makePixels(SIZE, drawIcon);
fs.writeFileSync('assets/icon.png', buildPNG(iconPx, SIZE));
console.log('✅ assets/icon.png written');

// Adaptive icon: same design, full bleed (no extra padding needed)
fs.writeFileSync('assets/adaptive-icon.png', buildPNG(iconPx, SIZE));
console.log('✅ assets/adaptive-icon.png written');
