/* =====================================================================
   gen-icons.mjs — Generateur d'icones PWA SANS dependance.
   Dessine un athlete suspendu a une barre de traction (ambre sur fond
   sombre), avec anti-aliasing par supersampling, et encode en PNG
   (zlib natif). Genere icons/ 180, 192, 512 + variantes maskable.
   Lancer : node tools/gen-icons.mjs
   ===================================================================== */
import zlib from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'icons');
mkdirSync(OUT, { recursive: true });

const BG = [14, 14, 17];       // #0e0e11
const AMBER = [232, 163, 61];  // #e8a33d
const AMBER_D = [201, 133, 42];

/* ---------- mini "canvas" RGBA ---------- */
function canvas(w, h) { return { w, h, px: new Uint8ClampedArray(w * h * 4) }; }
function fill(c, col) {
  for (let i = 0; i < c.px.length; i += 4) { c.px[i] = col[0]; c.px[i + 1] = col[1]; c.px[i + 2] = col[2]; c.px[i + 3] = 255; }
}
function setpx(c, x, y, col) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4; c.px[i] = col[0]; c.px[i + 1] = col[1]; c.px[i + 2] = col[2]; c.px[i + 3] = 255;
}
function rect(c, x0, y0, w, h, col) {
  for (let y = Math.floor(y0); y < y0 + h; y++) for (let x = Math.floor(x0); x < x0 + w; x++) setpx(c, x, y, col);
}
function roundRect(c, x0, y0, w, h, r, col) {
  const x1 = x0 + w, y1 = y0 + h;
  for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) {
    let dx = 0, dy = 0;
    if (x < x0 + r) dx = x0 + r - x; else if (x > x1 - r) dx = x - (x1 - r);
    if (y < y0 + r) dy = y0 + r - y; else if (y > y1 - r) dy = y - (y1 - r);
    if (dx * dx + dy * dy <= r * r) setpx(c, x, y, col);
  }
}
function circle(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r) setpx(c, x, y, col);
  }
}

/* ---------- police "bloc" pour le wordmark ---------- */
const GLYPHS = {
  S: [[0, 1, 1, 1, 1], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0], [0, 1, 1, 1, 0], [0, 0, 0, 0, 1], [0, 0, 0, 0, 1], [1, 1, 1, 1, 0]],
  B: [[1, 1, 1, 1, 0], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 0], [1, 0, 0, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 0]],
};
function drawGlyph(c, g, x, y, cell, col) {
  for (let r = 0; r < g.length; r++) for (let q = 0; q < g[r].length; q++) {
    if (g[r][q]) rect(c, x + q * cell, y + r * cell, cell + 0.7, cell + 0.7, col);
  }
}

/* ---------- composition de l'icone : haltère + wordmark SSBS ---------- */
function drawIcon(size, { maskable = false } = {}) {
  const SS = 4, S = size * SS;
  const c = canvas(S, S);
  fill(c, BG);

  const inset = maskable ? 0.16 : 0.07;
  const x0 = inset * S, y0 = inset * S, w = (1 - 2 * inset) * S, h = (1 - 2 * inset) * S;
  const X = n => x0 + n * w, Y = n => y0 + n * h, W = n => n * w, H = n => n * h;
  const A = AMBER, AD = AMBER_D;

  // haltère (barre + disques)
  const barH = H(0.055);
  roundRect(c, X(0.16), Y(0.27), W(0.68), barH, barH / 2, A);     // barre
  roundRect(c, X(0.195), Y(0.135), W(0.062), H(0.33), W(0.026), A);  // disque ext. gauche
  roundRect(c, X(0.272), Y(0.175), W(0.046), H(0.25), W(0.02), AD);  // disque int. gauche
  roundRect(c, X(0.743), Y(0.135), W(0.062), H(0.33), W(0.026), A);  // disque ext. droite
  roundRect(c, X(0.682), Y(0.175), W(0.046), H(0.25), W(0.02), AD);  // disque int. droite

  // wordmark "SSBS"
  const word = ['S', 'S', 'B', 'S'];
  const cols = word.length * 5 + (word.length - 1);
  const cell = Math.min(W(0.66) / cols, H(0.26) / 7);
  let gx = X(0.5) - (cols * cell) / 2;
  const gy = Y(0.56) + (H(0.26) - 7 * cell) / 2;
  for (const ch of word) { drawGlyph(c, GLYPHS[ch], gx, gy, cell, A); gx += 6 * cell; }

  return downscale(c, size, SS);
}

/* moyenne SSxSS -> anti-aliasing */
function downscale(c, size, SS) {
  const out = canvas(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const i = ((y * SS + sy) * c.w + (x * SS + sx)) * 4; r += c.px[i]; g += c.px[i + 1]; b += c.px[i + 2];
    }
    const n = SS * SS, i = (y * size + x) * 4;
    out.px[i] = r / n; out.px[i + 1] = g / n; out.px[i + 2] = b / n; out.px[i + 3] = 255;
  }
  return out;
}

/* ---------- encodage PNG ---------- */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(c) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = c.w * 4;
  const raw = Buffer.alloc((stride + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(c.px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- generation ---------- */
const jobs = [
  ['icon-180.png', 180, {}],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-192-maskable.png', 192, { maskable: true }],
  ['icon-512-maskable.png', 512, { maskable: true }],
];
for (const [name, size, opts] of jobs) {
  const png = encodePNG(drawIcon(size, opts));
  writeFileSync(join(OUT, name), png);
  console.log(`✓ icons/${name} (${size}×${size}, ${(png.length / 1024).toFixed(1)} ko)`);
}
console.log('Icones generees.');
