/* What a live landscape shows over the 3D: its points of interest (a labelled dot standing over each, a card
   with the facts and their sources) and, in the walk, a minimap. Plain DOM in the stage's overlay layer, the
   same in the spot viewer (orbit) and the walk (first person).

     const ov = new LandOverlay(overlayEl, land, { pois, mode: 'walk' | 'orbit' })
     ov.update(camera, rect, me)      // every frame; rect = the view's CSS rect { x, y, w, h }; me = { x, z, heading }
     ov.dispose()

   POIs come from scene.site.terrain.live.pois ({ id, name, at: [x, y, z], text, sources }). In the walk a card
   opens by itself when you come within NEAR m of one and closes when you walk away; a tap on a label opens it
   anywhere. The minimap is the detailed box, north up: land, sea, paths, the sites, the POIs, you (an arrow)
   and the others walking (dots); M (or a tap on it) makes it bigger. */

import * as THREE from 'three';
import './landscape.css';

const NEAR = 9;
const LEAVE = 16;
const SHOW_WALK = 260;

export class LandOverlay {
  constructor(parent, land, { pois = [], mode = 'walk' } = {}) {
    this.land = land;
    this.mode = mode;
    this.pois = pois.map((p) => {
      const g = land.field.heightAt(p.at[0], p.at[2]);
      return { ...p, pos: new THREE.Vector3(p.at[0], Math.max(p.at[1], g + 2.4), p.at[2]) };
    });
    this.root = document.createElement('div');
    this.root.className = 'mr-land';
    this.root.dataset.mode = mode;
    parent.append(this.root);
    this.labels = this.pois.map((p) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mr-land__poi';
      el.dataset.poi = p.id;
      el.innerHTML = '<span class="mr-land__dot" aria-hidden="true"></span><span class="mr-land__name"></span>';
      el.querySelector('.mr-land__name').textContent = p.name;
      el.hidden = true;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open(p.id, true);
      });
      this.root.append(el);
      return el;
    });
    this.card = document.createElement('section');
    this.card.className = 'mr-land__card';
    this.card.hidden = true;
    this.card.setAttribute('aria-live', 'polite');
    this.root.append(this.card);
    this.openId = null;
    this.pinned = false;
    this.v = new THREE.Vector3();
    if (mode === 'walk') this.buildMinimap();
    this.onKey = (e) => {
      if (e.code === 'KeyM' && !e.target.closest?.('input, textarea')) this.toggleMap();
      if (e.code === 'Escape' && this.openId) this.close();
    };
    window.addEventListener('keydown', this.onKey);
  }

  open(id, pinned = false) {
    const p = this.pois.find((q) => q.id === id);
    if (!p) return;
    this.openId = id;
    this.pinned = pinned;
    const c = this.card;
    c.innerHTML = '';
    const h = document.createElement('h2');
    h.className = 'mr-land__title';
    h.textContent = p.name;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'mr-land__close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
    const t = document.createElement('p');
    t.className = 'mr-land__text';
    t.textContent = p.text || '';
    c.append(close, h, t);
    if (p.sources?.length) {
      const s = document.createElement('p');
      s.className = 'mr-land__sources';
      s.textContent = `Sources: ${p.sources.join(' · ')}`;
      c.append(s);
    }
    c.hidden = false;
    this.root.dataset.open = id;
  }

  close() {
    this.openId = null;
    this.pinned = false;
    this.card.hidden = true;
    delete this.root.dataset.open;
  }

  buildMinimap() {
    const f = this.land.field;
    const box = f.box;
    const W = Math.round((box.max[0] - box.min[0]) / 2);
    const H = Math.round((box.max[1] - box.min[1]) / 2);
    const base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    const ctx = base.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = box.min[0] + (i + 0.5) * 2;
        const z = -box.max[1] + (j + 0.5) * 2;
        const h = f.heightAt(x, z);
        const o = (j * W + i) * 4;
        let r;
        let g;
        let b;
        if (h < 0) {
          const d = Math.min(1, -h / 8);
          r = 150 - 110 * d;
          g = 205 - 95 * d;
          b = 215 - 60 * d;
        } else {
          const k = Math.min(1, h / 25);
          r = 214 - 70 * k;
          g = 204 - 50 * k;
          b = 170 - 60 * k;
        }
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const px = (x) => (x - box.min[0]) / 2;
    const pz = (z) => (z + box.max[1]) / 2;
    const ways = this.land.meta.ways || {};
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.2;
    for (const p of [...(ways.paths || []), ...(ways.roads || [])]) {
      ctx.beginPath();
      p.pts.forEach(([x, z], k) => (k ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
      ctx.stroke();
    }
    this.mapBase = base;
    this.mapPx = px;
    this.mapPz = pz;
    const wrap = document.createElement('button');
    wrap.type = 'button';
    wrap.className = 'mr-land__map';
    wrap.setAttribute('aria-label', 'Map (M to enlarge)');
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    wrap.append(cv);
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMap();
    });
    this.root.append(wrap);
    this.map = wrap;
    this.mapCanvas = cv;
  }

  toggleMap() {
    if (!this.map) return;
    this.map.toggleAttribute('data-big');
  }

  /** the theme's colours for the map's marks (the .mr tokens), read once */
  tokens() {
    if (this.tok) return this.tok;
    const cs = getComputedStyle(this.root);
    const t = (n, d) => cs.getPropertyValue(n).trim() || d;
    this.tok = { ink: t('--mr-ink', '#1f1d1a'), bg: t('--mr-bg', '#fbf8f1'), accent: t('--mr-accent', '#c2410c'), peer: t('--mr-person-justin', '#3b6fb6') };
    return this.tok;
  }

  drawMap(me, peers = []) {
    const cv = this.mapCanvas;
    if (!cv) return;
    const T = this.tokens();
    const ctx = cv.getContext('2d');
    ctx.drawImage(this.mapBase, 0, 0);
    const px = this.mapPx;
    const pz = this.mapPz;
    for (const p of this.pois) {
      ctx.beginPath();
      ctx.arc(px(p.pos.x), pz(p.pos.z), p.id === this.openId ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = T.ink;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = T.bg;
      ctx.stroke();
    }
    for (const q of peers) {
      ctx.beginPath();
      ctx.arc(px(q.x), pz(q.z), 4, 0, Math.PI * 2);
      ctx.fillStyle = q.color || T.peer;
      ctx.fill();
    }
    if (me) {
      const x = px(me.x);
      const y = pz(me.z);
      ctx.save();
      ctx.translate(x, y);
      // heading: atan2(dx, dz) in the walk; on the map +z is down
      ctx.rotate(Math.PI - me.heading);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fillStyle = T.accent;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = T.bg;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** is the ground in the way between a and b? (24 samples; a little slack so a label on a ridge still shows) */
  hidden(a, b) {
    const f = this.land.field;
    for (let k = 1; k < 24; k++) {
      const t = k / 24;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const y = a.y + (b.y - a.y) * t;
      if (f.heightAt(x, z) > y + 0.6) return true;
    }
    return false;
  }

  update(camera, rect, me = null, peers = []) {
    const v = this.v;
    let nearest = null;
    for (let k = 0; k < this.pois.length; k++) {
      const p = this.pois[k];
      const el = this.labels[k];
      const dist = camera.position.distanceTo(p.pos);
      v.copy(p.pos).project(camera);
      const onScreen = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      // in the walk a label behind a hill is hidden (the ground sampled along the line of sight)
      const show = onScreen && (this.mode === 'orbit' || (dist < SHOW_WALK && !this.hidden(camera.position, p.pos)));
      el.hidden = !show;
      if (show) {
        const x = rect.x + ((v.x + 1) / 2) * rect.w;
        const y = rect.y + ((1 - v.y) / 2) * rect.h;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        el.style.opacity = this.mode === 'walk' ? String(Math.max(0.35, Math.min(1, 1.4 - dist / SHOW_WALK))) : '1';
      }
      if (me) {
        const d = Math.hypot(me.x - p.pos.x, me.z - p.pos.z);
        if (!nearest || d < nearest.d) nearest = { id: p.id, d };
      }
    }
    if (me && nearest) {
      if (nearest.d < NEAR && this.openId !== nearest.id && !this.pinned) this.open(nearest.id);
      else if (this.openId && !this.pinned) {
        const p = this.pois.find((q) => q.id === this.openId);
        if (p && Math.hypot(me.x - p.pos.x, me.z - p.pos.z) > LEAVE) this.close();
      }
    }
    if (this.mode === 'walk') this.drawMap(me, peers);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}
