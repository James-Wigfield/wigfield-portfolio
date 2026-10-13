/* ============================================================================
   PSMA APP GUIDE — CAPTURES
   ----------------------------------------------------------------------------
   The captures are 3840 x 2160 PNGs (and clipped player frames) in the
   gitignored motion-data/app-guide/, served only by the dev server's
   `psma-motion-data` middleware (vite.config.js, apply: 'serve'). A production
   build contains none of them.

   Full captures decode to about 33 MB each, so they are not all held at once:
   need(files) loads and decodes exactly what a frame draws (seek awaits it),
   and the store keeps the most recently used bitmaps under a byte budget.
   ========================================================================== */

export const DATA_URL = '/__psma-motion-data/app-guide';

export async function loadManifest() {
  const res = await fetch(`${DATA_URL}/manifest.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status} (run tools/psma-app-guide/capture_app.py)`);
  return res.json();
}

export class ImageStore {
  constructor(budgetBytes = 1.6e9) {
    this.budget = budgetBytes;
    this.items = new Map(); // file -> { bmp, bytes, used }
    this.pending = new Map(); // file -> Promise
    this.clock = 0;
  }

  get(file) {
    const it = this.items.get(file);
    if (!it) return null;
    it.used = ++this.clock;
    return it.bmp;
  }

  has(file) {
    return this.items.has(file);
  }

  load(file) {
    if (this.items.has(file)) return Promise.resolve(this.get(file));
    if (this.pending.has(file)) return this.pending.get(file);
    const p = (async () => {
      const res = await fetch(`${DATA_URL}/${file}`);
      if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
      const bmp = await createImageBitmap(await res.blob());
      this.items.set(file, { bmp, bytes: bmp.width * bmp.height * 4, used: ++this.clock });
      this.pending.delete(file);
      return bmp;
    })();
    this.pending.set(file, p);
    return p;
  }

  /** Load + decode every file in `files`; then trim to the budget, never dropping these. */
  async need(files) {
    const list = [...new Set(files)].filter(Boolean);
    await Promise.all(list.map((f) => this.load(f)));
    list.forEach((f) => this.get(f));
    this.trim(new Set(list));
  }

  trim(keep) {
    let total = 0;
    this.items.forEach((it) => { total += it.bytes; });
    if (total <= this.budget) return;
    const order = [...this.items.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [file, it] of order) {
      if (total <= this.budget) break;
      if (keep.has(file)) continue;
      it.bmp.close?.();
      this.items.delete(file);
      total -= it.bytes;
    }
  }

  clear() {
    this.items.forEach((it) => it.bmp.close?.());
    this.items.clear();
  }
}
