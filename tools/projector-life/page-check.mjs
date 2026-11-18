/* ============================================================================
   PROJECTOR LIFE — headless page check of /portal/projector-life
   (puppeteer-core + local Edge on the real GPU, through the portal gate)
   ----------------------------------------------------------------------------
     node tools/projector-life/page-check.mjs [outDir]        (dev server on 5191)
     SITE_URL=http://localhost:5191 ONLY=load,fps node tools/projector-life/page-check.mjs
     UNCAPPED=1 ONLY=fps node tools/projector-life/page-check.mjs   (no vsync: headroom)
   outDir defaults to Documents/projector-life/screenshots/page-check (results.json,
   the saved PNG, the layout shots).

   Checks (ONLY=… picks some)
     load      navigation → live render (stage ready, life ticking, canvas lit);
               target ≈ 2 s, FAIL above 4 s; nothing in the module above the
               stage but the tab bar; the stage fills the viewport; default preset
     fps       in-page rAF counter, ≥ 5 s per scene at 1440×900: default ≥ 45,
               every preset ≥ 20
     presets   each preset applies by a click in the Scenes list: name, blurb,
               values, camera view; no console errors; the ‹ › arrows cycle
     roof      the apex slider (keyboard Home/End) moves pitchDeg and the roof
               patches' gravity; ceiling behaviour over equal sim time at
               2.7 m vs 4.2 m (creature roof falls, Particle Life peel-off)
     seed      a click (not a drag) on a lit wall in the cutaway seeds life
     png       Save PNG downloads a non-empty, non-black PNG blob
     tabs      Plan + Applications render; MCP drawer JSON parses; arrow keys
     leaks     10 × (Visualiser → Plan → Applications → Visualiser, then away to
               another portal module via the sidebar and back): live WebGL
               contexts ≤ 1, no renderer.info growth, heap roughly flat
     layout    no horizontal scroll at 390 and 1440; panel beside the stage on
               desktop, drawer below on phones; insets never collide (every preset)
     reduced   prefers-reduced-motion: renders, views switch instantly
     storage   localStorage throwing: the page still renders
     console   zero page errors / warnings across the whole run
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, PRESETS, coerce, launch, openPage, waitLive, canvasLight, pixelStats, applyPreset, waitCamera,
  measureFps, memSample, clickTab, clickNav, splitNoise, sleep, fmt,
} from './qa-kit.mjs';

const OUT = path.resolve(process.argv[2] || path.join(REPO, 'Documents/projector-life/screenshots/page-check'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
fs.mkdirSync(OUT, { recursive: true });

const rows = [];
const results = {};
const ok = (check, cond, label, extra = '') => {
  rows.push({ check, pass: !!cond, label, extra: String(extra) });
  console.log(`${cond ? 'PASS' : 'FAIL'}  [${check}] ${label}${extra !== '' ? `  — ${extra}` : ''}`);
};
const info = (check, label, extra = '') => {
  rows.push({ check, pass: null, label, extra: String(extra) });
  console.log(`INFO  [${check}] ${label}${extra !== '' ? `  — ${extra}` : ''}`);
};
async function guard(check, fn) {
  try {
    await fn();
  } catch (e) {
    ok(check, false, 'check threw', String(e?.stack || e).split('\n').slice(0, 3).join(' | '));
  }
}

const LOG = []; // every console error / warning of every page
const browser = await launch();

/** Every element of the module that sits fully above the stage, outside the tab bar. */
const aboveStage = (page) =>
  page.evaluate(() => {
    const root = document.querySelector('.pjl');
    const frame = document.querySelector('.pjl-frame');
    const tabs = document.querySelector('.pjl-tabs');
    const fr = frame.getBoundingClientRect();
    const bad = [];
    for (const el of root.querySelectorAll('*')) {
      if (tabs.contains(el) || frame.contains(el) || el.contains(frame)) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const before = el.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING;
      if (r.bottom <= fr.top + 0.5 || before) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.top)}–${Math.round(r.bottom)}`);
    }
    return bad;
  });

const stageState = (page) =>
  page.evaluate(() => {
    const s = window.__pjlStage;
    if (!s) return null;
    const st = s._stats();
    return {
      view: st.view,
      values: s.getValues(),
      cam: s.camera.position.toArray(),
      target: s.controls.target.toArray(),
      tween: !!s.tween,
      viewPos: s.room.views[st.view]?.position || null,
      name: document.querySelector('.pjl-ov__name')?.textContent.trim(),
      blurb: document.querySelector('.pjl-ov__blurb')?.textContent.trim(),
      status: document.querySelector('.pjl-tabs__statusv')?.textContent.trim(),
      active: document.querySelector('.pjl-scenes__btn.is-active .pjl-scenes__name')?.textContent.trim(),
    };
  });

const valueMismatches = (values, preset) =>
  Object.entries(preset.values)
    .filter(([k, v]) => values[k] !== coerce(k, v))
    .map(([k, v]) => `${k}=${values[k]}≠${v}`);

const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : Infinity);

try {
  // ══ main page: arcade 1440×900 ════════════════════════════════════════════
  const { page } = await openPage(browser, { theme: 'arcade', width: 1440, height: 900, tag: 'main', sink: LOG, wait: false });

  // ── load (always waits for the live stage; reports only when wanted) ──────
  {
    await guard('load', async () => {
      const tLive = await waitLive(page);
      let light = await canvasLight(page);
      let tLit = await page.evaluate(() => performance.now());
      for (let i = 0; i < 40 && light.frac < 0.05; i++) {
        await sleep(100);
        light = await canvasLight(page);
        tLit = await page.evaluate(() => performance.now());
      }
      const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        return { dcl: n?.domContentLoadedEventEnd, load: n?.loadEventEnd };
      });
      const ms = Math.max(tLive, light.frac >= 0.05 ? tLit : Infinity);
      results.load = { tickingMs: Math.round(tLive), litMs: Math.round(tLit), liveMs: Math.round(ms), litFrac: light.frac, dclMs: Math.round(nav.dcl), cold: true };
      if (want('load')) {
        ok('load', Number.isFinite(ms) && ms <= 4000, `live render (stage ready, life ticking, canvas lit) in ${(ms / 1000).toFixed(2)} s — target ≈ 2 s, FAIL > 4 s (cold browser cache)`, `ticking at ${Math.round(tLive)} ms, ${Math.round(light.frac * 100)} % of the stage lit at ${Math.round(tLit)} ms (screenshot latency included), DOMContentLoaded ${Math.round(nav.dcl)} ms`);
        await sleep(2500); // the opening glide (fresh load, no restored scroll)
        const bad = await aboveStage(page);
        ok('load', bad.length === 0, 'nothing in the module above the stage except the tab bar (DOM order + boxes)', bad.slice(0, 4).join(' | ') || 'clean');
        const geo = await page.evaluate(() => {
          const r = (s) => document.querySelector(s)?.getBoundingClientRect();
          const head = r('.portal__topbar');
          const tabs = r('.pjl-tabs');
          const frame = r('.pjl-frame');
          return { headBottom: head?.bottom, tabsTop: tabs.top, tabsBottom: tabs.bottom, frameTop: frame.top, frameBottom: frame.bottom, frameH: frame.height, vh: innerHeight, scrollY };
        });
        results.load.geometry = geo;
        ok('load', geo.frameBottom <= geo.vh + 1 && geo.frameH >= 0.7 * geo.vh, 'after the opening glide the whole stage is in view and fills most of the viewport', `stage ${Math.round(geo.frameTop)}–${Math.round(geo.frameBottom)} px of ${geo.vh} (${Math.round((geo.frameH / geo.vh) * 100)} %), tab bar ${Math.round(geo.tabsTop)}–${Math.round(geo.tabsBottom)} vs the sticky header's bottom ${Math.round(geo.headBottom)}, scrollY ${Math.round(geo.scrollY)}`);
        const st = await stageState(page);
        const mism = valueMismatches(st.values, PRESETS[0]);
        ok('load', st.name === PRESETS[0].name && st.status?.startsWith(PRESETS[0].name) && st.view === PRESETS[0].camera && mism.length === 0, `default preset "${PRESETS[0].name}" on stage (name, tab-bar status, ${PRESETS[0].camera} view, values)`, `${st.name} · ${st.status} · ${st.view}${mism.length ? ` · ${mism.join(', ')}` : ''}`);
        // warm reloads (the browser restores the scroll offset on reload, so the glide is skipped)
        const warm = [];
        for (let i = 0; i < 2; i++) {
          await page.reload({ waitUntil: 'domcontentloaded' });
          warm.push(Math.round(await waitLive(page)));
        }
        results.load.warmMs = warm;
        info('load', 'warm reloads (HTTP cache primed): stage ready + ticking', warm.map((w) => `${w} ms`).join(', '));
        await sleep(1000);
      }
    });
  }

  // ── fps + presets (one pass over the presets) ─────────────────────────────
  if (want('fps') || want('presets')) {
    results.fps = [];
    await guard('fps', async () => {
      if (want('fps')) {
        await sleep(1500);
        const d = await measureFps(page, 6000);
        results.fps.push({ id: PRESETS[0].id, name: PRESETS[0].name, ...d, initial: true });
        ok('fps', d.fps >= 45, `default preset ≥ 45 fps at 1440×900 (in-page rAF counter, ${d.secs.toFixed(1)} s)`, `${fmt(d.fps)} fps · Stage ${fmt(d.stageFps)} fps · frame ${fmt(d.frameMs, 2)} ms (CPU) · sim ${fmt(d.simMs, 2)} ms/frame, ${fmt(d.tickMs, 2)} ms/tick at ${fmt(d.ticksPerSec, 0)} ticks/s · frame gaps p50 ${fmt(d.gapP50)} / p95 ${fmt(d.gapP95)} / p99 ${fmt(d.gapP99)} / max ${fmt(d.gapMax)} ms, ${d.over20} > 20 ms`);
      }
    });
    for (const p of PRESETS) {
      await guard('presets', async () => {
        const errs0 = LOG.filter((m) => m.type === 'error' || m.type === 'pageerror').length;
        await applyPreset(page, p);
        await sleep(100);
        await waitCamera(page);
        await sleep(600);
        const st = await stageState(page);
        const mism = valueMismatches(st.values, p);
        const errs = LOG.filter((m) => m.type === 'error' || m.type === 'pageerror').length - errs0;
        const camOk = p.camera === 'projector' ? !st.tween : dist(st.cam, st.viewPos) < 0.05;
        if (want('presets')) {
          ok(
            'presets',
            st.name === p.name && st.blurb === p.blurb && st.active === p.name && st.view === (p.camera || 'cutaway') && camOk && mism.length === 0 && errs === 0,
            `${String(PRESETS.indexOf(p) + 1).padStart(2, '0')} ${p.name}: applies by click — name, blurb, values, ${p.camera} view, no errors`,
            [st.name !== p.name && `name "${st.name}"`, st.blurb !== p.blurb && 'blurb differs', st.view !== p.camera && `view ${st.view}`, !camOk && `camera ${dist(st.cam, st.viewPos).toFixed(3)} m off the view`, mism.length && mism.join(', '), errs && `${errs} console errors`].filter(Boolean).join(' · ') || 'ok',
          );
        }
        if (want('fps')) {
          await sleep(2500);
          const d = await measureFps(page, 5000);
          results.fps.push({ id: p.id, name: p.name, ...d });
          ok('fps', d.fps >= (p === PRESETS[0] ? 45 : 20), `${p.name}: ${fmt(d.fps)} fps (≥ ${p === PRESETS[0] ? 45 : 20})`, `Stage ${fmt(d.stageFps)} fps · frame ${fmt(d.frameMs, 2)} ms (CPU) · sim ${fmt(d.simMs, 2)} ms/frame, ${fmt(d.tickMs, 2)} ms/tick at ${fmt(d.ticksPerSec, 0)} ticks/s · frame gaps p50 ${fmt(d.gapP50)} / p95 ${fmt(d.gapP95)} / p99 ${fmt(d.gapP99)} / max ${fmt(d.gapMax)} ms, ${d.over20} > 20 ms`);
        }
      });
    }
    if (want('presets')) {
      await guard('presets', async () => {
        // the ‹ › arrows on the stage
        await applyPreset(page, PRESETS[0]);
        await sleep(300);
        await page.click('.pjl-ov__arrow[aria-label="Next scene"]');
        await sleep(300);
        const a = await stageState(page);
        await page.click('.pjl-ov__arrow[aria-label="Previous scene"]');
        await sleep(300);
        await page.click('.pjl-ov__arrow[aria-label="Previous scene"]');
        await sleep(300);
        const b = await stageState(page);
        ok('presets', a.name === PRESETS[1].name && b.name === PRESETS[PRESETS.length - 1].name && valueMismatches(b.values, PRESETS[PRESETS.length - 1]).length === 0, 'the ‹ › arrows on the stage cycle the scenes (and wrap)', `→ ${a.name}; ← ← ${b.name}`);
        await applyPreset(page, PRESETS[0]);
        await waitCamera(page);
      });
    }
  }

  // ── roof ──────────────────────────────────────────────────────────────────
  if (want('roof')) {
    await guard('roof', async () => {
      await applyPreset(page, PRESETS[0]);
      await waitCamera(page);
      // open the Room group if a pref closed it
      await page.evaluate(() => {
        if (!document.querySelector('#pjl-c-room-apex')) document.querySelector('#pjl-g-room .pjl-group__btn')?.click();
      });
      await page.waitForSelector('#pjl-c-room-apex', { timeout: 3000 });
      const readRoof = () =>
        page.evaluate(() => {
          const s = window.__pjlStage;
          const roof = s.getPatches().filter((p) => p.kind === 'roof');
          const g = roof[0].gravity;
          const slider = document.querySelector('#pjl-c-room-apex');
          return {
            apex: s.getValues()['room.apex'],
            pitchDeg: s._stats().pitchDeg,
            gt: Math.hypot(g.gt[0], g.gt[1]),
            gn: g.gn,
            facetPitch: roof[0].pitchDeg,
            readout: slider.closest('.pjl-ctl').querySelector('.pjl-ctl__val')?.textContent.trim(),
            sliderValue: slider.value,
            roofPatches: roof.length,
          };
        });
      const ceilingRun = (ticks) =>
        page.evaluate((N) => {
          const s = window.__pjlStage;
          s.pause();
          s.reseed();
          const L = s.life;
          const a = L.stats();
          const pick = (st) => ({
            tick: st.tick,
            fell: st.creatures.fell,
            fellRoof: st.creatures.fallsFrom?.roof || 0,
            releases: st.creatures.releases,
            catches: st.creatures.catches,
            misses: st.creatures.misses,
            slid: st.creatures.slid,
            detached: st.systems.particlelife.detached,
            plCeiling: st.particles.ceiling,
          });
          const p0 = pick(a);
          const t0 = performance.now();
          for (let i = 0; i < N; i++) L.step(1 / 30);
          const ms = performance.now() - t0;
          const p1 = pick(L.stats());
          s.play();
          const d = {};
          for (const k of Object.keys(p0)) d[k] = p1[k] - p0[k];
          d.plCeilingEnd = p1.plCeiling;
          d.ms = Math.round(ms);
          return d;
        }, ticks);

      const start = await readRoof();
      await page.focus('#pjl-c-room-apex');
      await page.keyboard.press('Home');
      await sleep(250);
      const lo = await readRoof();
      await page.keyboard.press('End');
      await sleep(250);
      const hi = await readRoof();
      results.roof = { start, lo, hi };
      ok('roof', Math.abs(lo.apex - 2.7) < 1e-6 && Math.abs(hi.apex - 4.2) < 1e-6 && lo.pitchDeg < 13 && hi.pitchDeg > 40, 'the apex slider (keyboard Home / End) sets 2.70 m and 4.20 m and stats.pitchDeg follows', `${start.apex} m ${fmt(start.pitchDeg)}° → ${lo.apex} m ${fmt(lo.pitchDeg)}° → ${hi.apex} m ${fmt(hi.pitchDeg)}°; readout "${lo.readout}" / "${hi.readout}"`);
      ok('roof', hi.gt > lo.gt + 0.4 && Math.abs(hi.gn) < Math.abs(lo.gn) - 0.2, 'roof patches rebuild: steeper roof = more downslope g_t, less peel-off g_n', `|g_t| ${fmt(lo.gt, 3)} → ${fmt(hi.gt, 3)}, g_n ${fmt(lo.gn, 3)} → ${fmt(hi.gn, 3)}, facet pitch ${fmt(lo.facetPitch)}° → ${fmt(hi.facetPitch)}°`);
      // ceiling behaviour over equal sim time (default scene: Particle Life on the roof, 10 roof creatures)
      const TICKS = 1800; // 60 s of sim time at 30 Hz
      const runs = { lo: [], hi: [] };
      for (let rep = 0; rep < 2; rep++) {
        await page.focus('#pjl-c-room-apex');
        await page.keyboard.press('Home');
        await sleep(200);
        runs.lo.push(await ceilingRun(TICKS));
        await page.focus('#pjl-c-room-apex');
        await page.keyboard.press('End');
        await sleep(200);
        runs.hi.push(await ceilingRun(TICKS));
      }
      results.roof.runs = runs;
      const sum = (a, k) => a.reduce((x, r) => x + r[k], 0);
      const ticksOk = [...runs.lo, ...runs.hi].every((r) => r.tick === TICKS);
      const det = { lo: sum(runs.lo, 'detached'), hi: sum(runs.hi, 'detached') };
      const fr = { lo: sum(runs.lo, 'fellRoof'), hi: sum(runs.hi, 'fellRoof') };
      const rl = { lo: sum(runs.lo, 'releases'), hi: sum(runs.hi, 'releases') };
      const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.max(a, b));
      const fmtRun = (r) => `peel ${r.detached}, roof falls ${r.fellRoof} (all falls ${r.fell}), releases ${r.releases}, catches ${r.catches}, misses ${r.misses}, PL on roof at end ${r.plCeilingEnd}`;
      info('roof', `apex 2.70 m (11.7°), 2 × ${TICKS} ticks`, runs.lo.map(fmtRun).join(' || '));
      info('roof', `apex 4.20 m (41.8°), 2 × ${TICKS} ticks`, runs.hi.map(fmtRun).join(' || '));
      results.roof.sums = { det, fr, rl };
      ok('roof', ticksOk && (rel(det.lo, det.hi) >= 0.25 || rel(fr.lo, fr.hi) >= 0.25 || rel(rl.lo, rl.hi) >= 0.25), 'the apex visibly changes ceiling behaviour over equal sim time (≥ 25 % change in roof peel-off, roof falls or swing releases)', `2.7 m → 4.2 m: Particle Life peel-off ${det.lo} → ${det.hi} (${Math.round((det.hi / Math.max(1, det.lo) - 1) * 100)} %), creature roof falls ${fr.lo} → ${fr.hi}, swing releases ${rl.lo} → ${rl.hi} (${Math.round((rl.hi / Math.max(1, rl.lo) - 1) * 100)} %) — sums of 2 runs × 60 s sim; ticks equal: ${ticksOk}`);
      // put the default scene back
      await applyPreset(page, PRESETS[0]);
      await waitCamera(page);
    });
  }

  // ── seed ──────────────────────────────────────────────────────────────────
  if (want('seed')) {
    await guard('seed', async () => {
      await applyPreset(page, PRESETS[0]);
      await waitCamera(page);
      await sleep(800);
      const cands = await page.evaluate(() => {
        const s = window.__pjlStage;
        const cov = s.projection.coverage({ force: true })?.perPatch || {};
        const rect = s.renderer.domElement.getBoundingClientRect();
        const V = s.camera.position.constructor;
        const out = [];
        for (const p of s.getPatches().filter((q) => q.kind === 'wall')) {
          // a few points on the wall, a bit above the loft deck
          for (const [fx, fy] of [[0.5, 0.62], [0.3, 0.75], [0.7, 0.75], [0.5, 0.4]]) {
            const lx = p.width * fx;
            const ly = p.height * fy;
            const w = new V(p.origin[0] + lx * p.u[0] + ly * p.v[0], p.origin[1] + lx * p.u[1] + ly * p.v[1], p.origin[2] + lx * p.u[2] + ly * p.v[2]);
            const ndc = w.clone().project(s.camera);
            if (Math.abs(ndc.x) > 0.95 || Math.abs(ndc.y) > 0.95 || ndc.z > 1) continue;
            const x = rect.left + ((ndc.x + 1) / 2) * rect.width;
            const y = rect.top + ((1 - ndc.y) / 2) * rect.height;
            if (document.elementFromPoint(x, y) !== s.renderer.domElement) continue;
            out.push({ id: p.id, cov: cov[p.id] || 0, x, y });
          }
        }
        return out.sort((a, b) => b.cov - a.cov);
      });
      let hit = null;
      let tried = 0;
      for (const c of cands.filter((q) => q.cov > 0.2).slice(0, 8)) {
        tried++;
        const before = await page.evaluate(() => window.__pjlStage._stats().lastSeed);
        await page.mouse.click(c.x, c.y, { delay: 40 });
        await sleep(250);
        const after = await page.evaluate(() => ({ seed: window.__pjlStage._stats().lastSeed, hint: document.querySelector('.pjl-ov__hint')?.textContent.trim() }));
        if (after.seed && after.seed !== before && after.seed.patchId === c.id) {
          hit = { ...c, seed: after.seed, hint: after.hint };
          break;
        }
      }
      results.seed = { hit, candidates: cands.length };
      ok('seed', !!hit, 'a click (not a drag) on a lit wall in the cutaway seeds life there (_stats().lastSeed)', hit ? `${hit.id} (coverage ${Math.round(hit.cov * 100)} %) at (${Math.round(hit.x)}, ${Math.round(hit.y)}) → lastSeed ${hit.seed.patchId} local [${hit.seed.local.map((v) => v.toFixed(2)).join(', ')}] · hint "${hit.hint}"` : `${tried} lit-wall points tried of ${cands.length}`);
      if (hit) {
        // a drag at the same spot must NOT seed
        const before = await page.evaluate(() => JSON.stringify(window.__pjlStage._stats().lastSeed));
        await page.mouse.move(hit.x, hit.y);
        await page.mouse.down();
        await page.mouse.move(hit.x + 40, hit.y + 10, { steps: 6 });
        await page.mouse.up();
        await sleep(250);
        const after = await page.evaluate(() => JSON.stringify(window.__pjlStage._stats().lastSeed));
        ok('seed', before === after, 'a drag (orbit) on the same wall does not seed');
        await page.evaluate(() => [...document.querySelectorAll('.pjl-ov__view')].find((b) => b.textContent.trim() === 'Cutaway')?.click());
        await waitCamera(page);
      }
    });
  }

  // ── png ───────────────────────────────────────────────────────────────────
  if (want('png')) {
    await guard('png', async () => {
      await page.evaluate(() => {
        window.__pjlDl = [];
        const orig = HTMLAnchorElement.prototype.click;
        window.__pjlRestoreClick = () => {
          HTMLAnchorElement.prototype.click = orig;
        };
        HTMLAnchorElement.prototype.click = function click() {
          const rec = { href: this.href, download: this.download };
          window.__pjlDl.push(rec);
          if (this.href.startsWith('blob:')) {
            rec.pending = fetch(this.href)
              .then((r) => r.arrayBuffer())
              .then((b) => {
                const u8 = new Uint8Array(b);
                let s = '';
                for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
                rec.b64 = btoa(s);
                rec.size = u8.length;
              })
              .catch((e) => {
                rec.err = String(e);
              });
          }
        };
      });
      await page.click('.pjl-tbtn[aria-label="Save PNG"]');
      await page.waitForFunction(() => window.__pjlDl.length > 0 && (window.__pjlDl[0].size || window.__pjlDl[0].err), { timeout: 8000 });
      const dl = await page.evaluate(() => {
        window.__pjlRestoreClick();
        const r = window.__pjlDl[0];
        return { href: r.href.slice(0, 12), download: r.download, size: r.size, err: r.err, b64: r.b64 };
      });
      let px = null;
      let sig = false;
      if (dl.b64) {
        const buf = Buffer.from(dl.b64, 'base64');
        sig = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        fs.writeFileSync(path.join(OUT, dl.download || 'save.png'), buf);
        px = await pixelStats(buf);
      }
      results.png = { download: dl.download, size: dl.size, sig, px };
      ok('png', sig && dl.size > 10000 && px && px.frac > 0.05, 'Save PNG downloads a blob that is a non-empty, non-black PNG', `${dl.download} · ${dl.href}… · ${dl.size} bytes · ${px ? `${px.w}×${px.h}, ${Math.round(px.frac * 100)} % lit` : dl.err}`);
    });
  }

  // ── tabs ──────────────────────────────────────────────────────────────────
  if (want('tabs')) {
    await guard('tabs', async () => {
      // MCP preview drawer (on the Visualiser)
      await page.click('.pjl-mcp__bar');
      await page.waitForSelector('.pjl-mcp__body .pjl-code__code', { timeout: 3000 });
      const mcp = await page.evaluate(() => {
        const lead = Number(document.querySelector('.pjl-mcp__lead b')?.textContent);
        const txt = document.querySelector('.pjl-mcp__body .pjl-code__code').textContent;
        let parsed = null;
        let err = null;
        try {
          parsed = JSON.parse(txt);
        } catch (e) {
          err = String(e);
        }
        return { lead, n: parsed?.length, err, tools: parsed ? [...new Set(parsed.map((c) => c.tool))] : [], shape: parsed ? parsed.every((c) => typeof c.tool === 'string' && c.args && typeof c.args === 'object') : false, exp: document.querySelector('.pjl-mcp__bar').getAttribute('aria-expanded') };
      });
      ok('tabs', mcp.exp === 'true' && !mcp.err && mcp.n === mcp.lead && mcp.shape, 'the MCP preview drawer opens and its JSON parses (one call per line)', mcp.err || `${mcp.n} calls (bar says ${mcp.lead}) · tools: ${mcp.tools.join(', ')}`);
      await page.evaluate(() => [...document.querySelectorAll('.pjl-mcp__f')].find((b) => /pretty/.test(b.textContent))?.click());
      await sleep(200);
      const pretty = await page.evaluate(() => {
        try {
          return JSON.parse(document.querySelector('.pjl-mcp__body .pjl-code__code').textContent).length;
        } catch (e) {
          return String(e);
        }
      });
      ok('tabs', pretty === mcp.n, 'pretty-printed JSON parses too', String(pretty));
      await page.click('.pjl-mcp__bar');
      // Plan + Applications
      for (const [label, id] of [['Plan', 'plan'], ['Applications', 'apps']]) {
        await clickTab(page, label);
        await page.waitForFunction((pid) => {
          const el = document.getElementById(`pjl-panel-${pid}`);
          return el && el.getBoundingClientRect().height > 400 && !el.querySelector('.pjl-wait');
        }, { timeout: 8000 }, id);
        await sleep(400);
        const t = await page.evaluate((pid) => {
          const el = document.getElementById(`pjl-panel-${pid}`);
          return {
            h: Math.round(el.getBoundingClientRect().height),
            svgs: el.querySelectorAll('svg').length,
            words: el.innerText.split(/\s+/).length,
            cards: el.querySelectorAll('.pjl-apps__grid > li').length,
            canvas: !!document.querySelector('canvas.pjl-canvas'),
            gl: window.__pjlGLReport().live,
            sel: document.querySelector('.pjl-tabs__tab[aria-selected="true"]')?.textContent.trim(),
          };
        }, id);
        const enough = id === 'apps' ? t.cards >= 4 : t.words > 60;
        ok('tabs', t.h > 400 && enough && t.sel.endsWith(label) && !t.canvas && t.gl === 0, `${label} tab renders (and the stage is gone: canvas removed, 0 live WebGL contexts)`, `${t.h} px tall, ${t.svgs} SVGs, ~${t.words} words${id === 'apps' ? `, ${t.cards} cards` : ''}; stage canvas present: ${t.canvas}; live GL contexts ${t.gl}`);
        if (id === 'plan') {
          // every Plan sub-section, and every phase on the timeline
          const subs = await page.$$eval('.pjl-subnav__b', (bs) => bs.map((b) => b.textContent.replace(/^\d+/, '').trim()));
          const seen = [];
          for (let i = 0; i < subs.length; i++) {
            await page.evaluate((k) => document.querySelectorAll('.pjl-subnav__b')[k].click(), i);
            await sleep(250);
            seen.push(await page.evaluate(() => {
              const b = document.querySelector('.pjl-plan__body');
              const r = b.getBoundingClientRect();
              return { h: Math.round(r.height), words: b.innerText.split(/\s+/).filter(Boolean).length, svgs: b.querySelectorAll('svg').length, cur: document.querySelector('.pjl-subnav__b[aria-current="true"]')?.textContent.replace(/^\d+/, '').trim() };
            }));
          }
          const thin = seen.map((s, i) => ({ ...s, name: subs[i] })).filter((s) => s.h < 120 || s.words < 15 || s.cur !== s.name);
          ok('tabs', subs.length >= 5 && thin.length === 0, `Plan: all ${subs.length} sub-sections render (${subs.join(' · ')})`, seen.map((s, i) => `${subs[i]} ${s.h}px/${s.words}w/${s.svgs}svg`).join(', '));
          await page.evaluate(() => document.querySelectorAll('.pjl-subnav__b')[0].click());
          await sleep(250);
          const phases = await page.$$eval('.pjl-tl__track [role="tab"]', (bs) => bs.length);
          const titles = [];
          for (let i = 0; i < phases; i++) {
            await page.evaluate((k) => document.querySelectorAll('.pjl-tl__track [role="tab"]')[k].click(), i);
            await sleep(120);
            titles.push(await page.evaluate(() => document.querySelector('.pjl-tl__title')?.textContent.trim()));
          }
          ok('tabs', phases >= 7 && new Set(titles).size === phases, `Plan: the phase timeline shows each of its ${phases} phases`, titles.map((t, i) => `${i}. ${t}`).join(' · '));
        }
      }
      // arrow keys along the top tabs
      await clickTab(page, 'Visualiser');
      await waitLive(page);
      await page.focus('.pjl-tabs__tab[aria-selected="true"]');
      const seq = [];
      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Home']) {
        await page.keyboard.press(key);
        await sleep(120);
        seq.push(await page.evaluate(() => `${document.activeElement?.textContent.replace(/^\d+/, '').trim()}:${document.activeElement?.getAttribute('aria-selected')}`));
      }
      const expect = ['Plan:true', 'Applications:true', 'Visualiser:true', 'Applications:true', 'Visualiser:true', 'Applications:true', 'Visualiser:true'];
      ok('tabs', seq.join(',') === expect.join(','), 'arrow keys / Home / End move focus and selection along the top tabs (wrapping)', seq.join(', '));
      await waitLive(page);
    });
  }
  await page.close();

  // ══ leaks: a fresh page ═══════════════════════════════════════════════════
  if (want('leaks')) {
    await guard('leaks', async () => {
      const { page: lp } = await openPage(browser, { theme: 'arcade', width: 1440, height: 900, tag: 'leaks', sink: LOG });
      await sleep(3000);
      // document-level listeners (OrbitControls puts a capture keydown on the canvas's root node)
      const cdp = await lp.createCDPSession();
      const docListeners = async () => {
        const { result } = await cdp.send('Runtime.evaluate', { expression: 'document' });
        const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
        await cdp.send('Runtime.releaseObject', { objectId: result.objectId });
        const by = {};
        for (const l of listeners) by[l.type] = (by[l.type] || 0) + 1;
        return { total: listeners.length, keydown: by.keydown || 0 };
      };
      const ls0 = await docListeners();
      const m0 = await memSample(lp);
      const gl0 = await lp.evaluate(() => window.__pjlGLReport());
      const awayLabel = 'Dev Setup · Home PC';
      const newStage = async (old) => {
        // return a boolean: a returned object (the room) would come back as a JSHandle that keeps
        // the old room alive for the rest of the run and poison the heap numbers
        const h = await lp.waitForFunction((o) => !!(window.__pjlStage && window.__pjlStage !== window[o] && window.__pjlStage.room), { timeout: 20000 }, old);
        await h.dispose();
        await waitLive(lp);
      };
      const timings = [];
      for (let i = 0; i < 10; i++) {
        const t0 = Date.now();
        await lp.evaluate(() => {
          window.__pjlOld = window.__pjlStage;
        });
        await clickTab(lp, 'Plan');
        await lp.waitForFunction(() => document.getElementById('pjl-panel-plan')?.getBoundingClientRect().height > 400 && !document.querySelector('.pjl-wait'), { timeout: 8000 });
        await sleep(150);
        await clickTab(lp, 'Applications');
        await lp.waitForFunction(() => document.getElementById('pjl-panel-apps')?.getBoundingClientRect().height > 400 && !document.querySelector('.pjl-wait'), { timeout: 8000 });
        await sleep(150);
        await clickTab(lp, 'Visualiser');
        await newStage('__pjlOld');
        await sleep(300);
        await lp.evaluate(() => {
          window.__pjlOld = window.__pjlStage;
        });
        const away = await clickNav(lp, awayLabel);
        if (!away) throw new Error(`sidebar item "${awayLabel}" not found`);
        await lp.waitForFunction(() => !document.querySelector('.pjl'), { timeout: 8000 });
        await sleep(400);
        const back = await clickNav(lp, 'Projector Life');
        if (!back) throw new Error('sidebar item "Projector Life" not found');
        await newStage('__pjlOld');
        await sleep(300);
        timings.push(Date.now() - t0);
      }
      await lp.evaluate(() => {
        delete window.__pjlOld;
      });
      await sleep(3000);
      const m1 = await memSample(lp);
      const gl1 = await lp.evaluate(() => window.__pjlGLReport());
      // one more settle + GC to see whether the heap comes back
      await sleep(4000);
      const m2 = await memSample(lp);
      const gl2 = await lp.evaluate(() => window.__pjlGLReport());
      const ls1 = await docListeners();
      results.leaks = { m0, m1, m2, gl0, gl1, gl2, ls0, ls1, cycleMs: timings };
      ok('leaks', gl1.live <= 1 && gl1.liveList.every((e) => e.connected), `live WebGL contexts after 10 cycles (20 stage rebuilds): ${gl1.live}`, `created ${gl1.created}, lost ${gl1.lost}, collected ${gl1.collected} (start: created ${gl0.created}, lost ${gl0.lost}); live: ${JSON.stringify(gl1.liveList)}`);
      const released = gl2.lost + gl2.collected - (gl0.lost + gl0.collected);
      ok('leaks', gl2.created - gl0.created >= 20 && released === gl2.created - gl0.created, 'every stage the switches created released its context (webglcontextlost, or its canvas was collected first)', `+${gl2.created - gl0.created} created (2 per mount: React StrictMode mounts twice in dev), +${gl2.lost - gl0.lost} lost events, +${gl2.collected - gl0.collected} collected before the event`);
      ok('leaks', m1.geometries <= m0.geometries && m1.textures <= m0.textures && m1.programs <= m0.programs, 'renderer.info of the fresh stage ≤ the first stage (geometries / textures / programs)', `first ${m0.geometries} / ${m0.textures} / ${m0.programs} → fresh ${m1.geometries} / ${m1.textures} / ${m1.programs}`);
      const growth = m2.heapMB - m0.heapMB;
      ok('leaks', gl2.retained === 0, 'disposed stages are garbage-collectable (no lost-context canvas still reachable after a forced GC)', `${gl2.retained} of ${gl2.lost} disposed stage canvases still reachable`);
      ok('leaks', ls1.keydown <= ls0.keydown, 'no document-level listeners left behind (keydown on document, via CDP)', `document listeners ${ls0.total} → ${ls1.total}; keydown ${ls0.keydown} → ${ls1.keydown}`);
      ok('leaks', growth < 25, 'JS heap roughly flat after 20 rebuilds (forced GC; FAIL ≥ 25 MB)', `${fmt(m0.heapMB)} MB → ${fmt(m1.heapMB)} MB → ${fmt(m2.heapMB)} MB after a further settle (${growth >= 0 ? '+' : ''}${fmt(growth)} MB); a cycle took ${Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)} ms`);
      await lp.close();
    });
  }

  // ══ layout ════════════════════════════════════════════════════════════════
  if (want('layout')) {
    for (const [theme, width, height] of [['arcade', 1440, 900], ['jade', 390, 844]]) {
      await guard('layout', async () => {
        const { page: yp } = await openPage(browser, { theme, width, height, tag: `layout-${width}`, sink: LOG });
        await sleep(2500); // the opening glide
        const glide = await yp.evaluate(() => {
          const r = (q) => document.querySelector(q)?.getBoundingClientRect();
          const head = r('.portal__topbar');
          const tabs = r('.pjl-tabs');
          const frame = r('.pjl-frame');
          return { head: head.bottom, tabsTop: tabs.top, tabsBottom: tabs.bottom, frameTop: frame.top, frameBottom: frame.bottom, vh: innerHeight, scrollY };
        });
        ok('layout', glide.tabsTop >= glide.head - 2 && glide.frameBottom <= glide.vh + 1, `${width}: after the opening glide the tab bar sits below the sticky portal header (visible) and the stage is in view`, `header bottom ${Math.round(glide.head)}, tab bar ${Math.round(glide.tabsTop)}–${Math.round(glide.tabsBottom)}, stage ${Math.round(glide.frameTop)}–${Math.round(glide.frameBottom)} of ${glide.vh}, scrollY ${Math.round(glide.scrollY)}`);
        const ov = await yp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok('layout', ov <= 1, `${width}×${height}: no horizontal page scroll`, `${ov} px`);
        const lay = await yp.evaluate(() => {
          const R = (el) => el && el.getBoundingClientRect();
          const frame = R(document.querySelector('.pjl-frame'));
          const panel = R(document.querySelector('.pjl-panel'));
          const inter = !(panel.left >= frame.right - 0.5 || panel.right <= frame.left + 0.5 || panel.top >= frame.bottom - 0.5 || panel.bottom <= frame.top + 0.5);
          // smallest text in the panel, and clipped text
          let minFont = 99;
          let minFontAt = '';
          let minSvg = 99;
          let minSvgAt = '';
          const clipped = [];
          for (const el of document.querySelectorAll('.pjl-panel *')) {
            if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            if (el.closest('svg')) {
              // SVG text: font-size is in user units; judge the rendered glyph box (cap+descender ≈ 1.2 em)
              const px = r.height / 1.2;
              if (px < minSvg) {
                minSvg = px;
                minSvgAt = `"${el.textContent.trim().slice(0, 16)}"`;
              }
              continue;
            }
            if (parseFloat(cs.fontSize) < minFont) {
              minFont = parseFloat(cs.fontSize);
              minFontAt = `"${el.textContent.trim().slice(0, 16)}"`;
            }
            if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflow + cs.overflowX) && cs.textOverflow !== 'ellipsis') clipped.push(el.textContent.trim().slice(0, 30));
          }
          return { frame: { l: frame.left, t: frame.top, r: frame.right, b: frame.bottom, w: frame.width, h: frame.height }, panel: { l: panel.left, t: panel.top, r: panel.right, b: panel.bottom, w: panel.width }, inter, minFont, minFontAt, minSvg, minSvgAt, clipped };
        });
        if (width >= 860) {
          ok('layout', !lay.inter && lay.panel.l >= lay.frame.r - 1 && lay.panel.w >= 260, `${width}: side panel sits beside the stage, not over it`, `stage ${Math.round(lay.frame.w)}×${Math.round(lay.frame.h)}, panel ${Math.round(lay.panel.w)} px wide at x ${Math.round(lay.panel.l)}`);
        } else {
          ok('layout', !lay.inter && lay.panel.t >= lay.frame.b - 1, `${width}: the controls are a drawer below the stage`, `stage ${Math.round(lay.frame.w)}×${Math.round(lay.frame.h)} ends at ${Math.round(lay.frame.b)}, panel starts at ${Math.round(lay.panel.t)}`);
        }
        ok('layout', lay.minFont >= 8.5 && lay.minSvg >= 8 && lay.clipped.length === 0, `${width}: panel text readable (HTML ≥ 8.5 px — the mono micro-labels are 0.56–0.6 rem by design — SVG labels ≥ 8 px rendered, nothing clipped without an ellipsis)`, `smallest HTML ${lay.minFont}px ${lay.minFontAt}; smallest SVG label ≈ ${fmt(lay.minSvg)}px ${lay.minSvgAt}${lay.clipped.length ? `; clipped: ${lay.clipped.slice(0, 4).join(' | ')}` : ''}`);
        // insets + overlay blocks never collide, for every preset
        const coll = [];
        for (const p of PRESETS) {
          await applyPreset(yp, p);
          await waitCamera(yp);
          await sleep(700);
          const c = await yp.evaluate(() => {
            const s = window.__pjlStage;
            const cv = s.renderer.domElement.getBoundingClientRect();
            const boxes = [];
            for (const r of s._stats().insets || []) boxes.push({ k: `projector inset ${r.index + 1}`, l: cv.left + r.x, t: cv.top + r.y, r: cv.left + r.x + r.w, b: cv.top + r.y + r.h });
            const add = (k, el) => {
              if (!el) return;
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) boxes.push({ k, l: r.left, t: r.top, r: r.right, b: r.bottom });
            };
            add('net inset', document.querySelector('.pjl-net'));
            document.querySelectorAll('.pjl-ov__inset').forEach((el, i) => add(`inset label ${i + 1}`, el));
            add('scene card', document.querySelector('.pjl-ov__scene'));
            add('transport', document.querySelector('.pjl-ov__transport'));
            add('views', document.querySelector('.pjl-ov__views'));
            add('fps', document.querySelector('.pjl-ov__fps'));
            const hits = [];
            for (let i = 0; i < boxes.length; i++) {
              for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i];
                const b = boxes[j];
                // a label belongs to its own inset; the scene card's box may contain the coverage readout
                if (/inset label/.test(a.k) && /projector inset/.test(b.k)) continue;
                if (/projector inset/.test(a.k) && /inset label/.test(b.k)) continue;
                const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l);
                const iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
                if (ix > 1 && iy > 1) hits.push(`${a.k} × ${b.k} (${Math.round(ix)}×${Math.round(iy)} px)`);
              }
              // off the stage?
              const a = boxes[i];
              if (a.l < cv.left - 1 || a.r > cv.right + 1 || a.t < cv.top - 1 || a.b > cv.bottom + 1) hits.push(`${a.k} spills off the stage`);
            }
            return hits;
          });
          if (c.length) coll.push(`${p.id}: ${c.join(', ')}`);
        }
        ok('layout', coll.length === 0, `${width}: projector-output inset, net inset and overlay blocks never collide (all ${PRESETS.length} presets)`, coll.join(' || ') || 'clean');
        await yp.close();
      });
    }
  }

  // ══ reduced motion ════════════════════════════════════════════════════════
  if (want('reduced')) {
    await guard('reduced', async () => {
      const { page: rp } = await openPage(browser, { theme: 'jade', width: 1440, height: 900, reduced: true, tag: 'reduced', sink: LOG });
      await sleep(500);
      const light = await canvasLight(rp);
      ok('reduced', light.frac > 0.05, 'prefers-reduced-motion: the stage renders and is alive', `${Math.round(light.frac * 100)} % lit`);
      const jumps = [];
      for (const v of ['Door', 'Plan', 'Loft', 'Cutaway']) {
        await rp.evaluate((label) => [...document.querySelectorAll('.pjl-ov__view')].find((b) => b.textContent.trim() === label)?.click(), v);
        const st = await rp.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
          const s = window.__pjlStage;
          res({ tween: !!s.tween, d: Math.hypot(...s.camera.position.toArray().map((c, i) => c - s.room.views[s.view].position[i])), view: s.view });
        })));
        jumps.push(`${v}: ${st.tween ? 'tweening' : `${st.d.toFixed(4)} m`}`);
        if (st.tween || st.d > 0.01) jumps.push('!');
      }
      await applyPreset(rp, PRESETS[3]);
      const pr = await rp.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
        const s = window.__pjlStage;
        res({ tween: !!s.tween, d: Math.hypot(...s.camera.position.toArray().map((c, i) => c - s.room.views[s.view].position[i])), view: s.view });
      })));
      jumps.push(`preset → ${pr.view}: ${pr.tween ? 'tweening' : `${pr.d.toFixed(4)} m`}`);
      if (pr.tween || pr.d > 0.01) jumps.push('!');
      ok('reduced', !jumps.includes('!'), 'prefers-reduced-motion: views (buttons and presets) switch instantly, on the next frame', jumps.filter((j) => j !== '!').join(' · '));
      await rp.close();
    });
  }

  // ══ broken storage ════════════════════════════════════════════════════════
  if (want('storage')) {
    await guard('storage', async () => {
      const { page: bp } = await openPage(browser, { theme: 'arcade', width: 1440, height: 900, brokenStorage: true, tag: 'storage', sink: LOG, wait: false });
      let live = false;
      try {
        await waitLive(bp, 20000);
        live = true;
      } catch {
        /* reported below */
      }
      const light = live ? await canvasLight(bp) : { frac: 0 };
      const dom = await bp.evaluate(() => ({ pjl: !!document.querySelector('.pjl'), portal: !!document.querySelector('.portal'), text: document.body.innerText.slice(0, 120).replace(/\s+/g, ' ') }));
      ok('storage', live && light.frac > 0.05, 'with localStorage throwing, the page still renders a live stage', live ? `${Math.round(light.frac * 100)} % lit` : `no live stage · portal ${dom.portal} · module ${dom.pjl} · "${dom.text}"`);
      if (live) {
        await applyPreset(bp, PRESETS[1]);
        await sleep(500);
        await clickTab(bp, 'Plan');
        await sleep(800);
        const plan = await bp.evaluate(() => document.getElementById('pjl-panel-plan')?.getBoundingClientRect().height || 0);
        ok('storage', plan > 400, 'with localStorage throwing, presets and the Plan tab still work', `${Math.round(plan)} px`);
      }
      await bp.close();
    });
  }
} finally {
  await browser.close();
}

// ── console ─────────────────────────────────────────────────────────────────
const { kept, excluded } = splitNoise(LOG);
results.console = { kept, excluded };
const excl = [...new Set(excluded.map((m) => m.why))];
ok('console', kept.length === 0, 'zero console errors and warnings attributable to the page across the whole run', kept.length ? kept.slice(0, 6).map((m) => `[${m.tag}] ${m.type}: ${m.text.slice(0, 160)}`).join(' || ') : `excluded ${excluded.length} (${excl.join('; ') || 'none'})`);

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ when: new Date().toISOString(), rows, results }, null, 2));
const fails = rows.filter((r) => r.pass === false);
console.log('\n| check | result | what | measured |\n|---|---|---|---|');
for (const r of rows) console.log(`| ${r.check} | ${r.pass === null ? 'info' : r.pass ? 'PASS' : '**FAIL**'} | ${r.label} | ${r.extra.replace(/\|/g, '/')} |`);
console.log(`\n${fails.length ? `${fails.length} FAILED` : 'ALL PASS'}  (${OUT})`);
process.exit(fails.length ? 1 : 0);
