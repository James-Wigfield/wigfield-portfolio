/* ============================================================================
   SWERVE VALLEY — the bus, side on
   ----------------------------------------------------------------------------
   An open-top tour bus drawn as pixel art with the whole party on the top deck
   and the designated driver in the cab. Used three ways:
     • live, under the road on every passenger's phone (everyone sways, blushes,
       nods off and stands up for toasts as the server says so)
     • parked, in the lobby and between legs
     • frozen, as a polaroid in the end-of-day photo album
   ========================================================================== */

import { CAST, CAST_IDS, tier, clamp, mulberry32 } from './world.js';

export const BUS_W = 240;
export const BUS_H = 96;

const DECK_Y = 44; //    top of the bus body
const BODY_H = 34;
const CAB_X = 206;

// Body colours sampled from the PixelLab bus.
const CREAM = '#f1e6c4';
const CREAM_D = '#d9c99c';
const WINE = '#6e2238';
const WINE_D = '#4e1626';
const GLASS = '#9ccbd6';

/**
 * Seat positions on the top deck for the ten passengers: two staggered rows.
 * Back row sits 6 px higher and is drawn first.
 */
function seatXY(n) {
  const back = n % 2 === 0;
  const col = Math.floor(n / 2);
  return { x: 10 + col * 38 + (back ? 0 : 19), y: back ? DECK_Y - 38 : DECK_Y - 31, back };
}

export function createBusView(canvas, art) {
  const ctx = canvas.getContext('2d');
  canvas.width = BUS_W;
  canvas.height = BUS_H;
  ctx.imageSmoothingEnabled = false;
  let A = art;
  let scroll = 0;
  let lastT = null;

  function setArt(a) {
    A = a;
  }

  /**
   * o = {
   *   t, v (0..1 speed), leg, dusk, driver (cid|null), me (cid),
   *   st: { [cid]: { tip, asleep, lost, human } },
   *   standing: Set(cid) (up for a toast), lean: -1|0|1, jolt (0..1),
   *   photo: { [cid]: 's'|'b'|'z'|'d' } | null, glasses: bool, sky: [top, bottom], ground
   * }
   */
  function render(o) {
    const t = o.t || 0;
    const dt = lastT == null ? 0 : Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    scroll += dt * (o.v || 0) * 90;

    // backdrop: sky, a strip of vineyard rushing past
    const g = ctx.createLinearGradient(0, 0, 0, BUS_H);
    g.addColorStop(0, o.sky?.[0] || '#7ec8f2');
    g.addColorStop(1, o.sky?.[1] || '#cfeefc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BUS_W, BUS_H);
    ctx.fillStyle = o.ground || '#76a845';
    ctx.fillRect(0, 70, BUS_W, 26);
    for (let x = -24; x < BUS_W + 24; x += 12) {
      const xx = Math.round(x - (scroll % 12));
      ctx.fillStyle = '#3f7d2a';
      ctx.fillRect(xx, 62, 9, 7);
      ctx.fillStyle = '#56a03a';
      ctx.fillRect(xx + 1, 61, 6, 3);
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(xx + 4, 66, 1, 6);
    }
    ctx.fillStyle = '#8b5a3a';
    ctx.fillRect(0, 84, BUS_W, 12);
    ctx.fillStyle = '#9d6a46';
    for (let x = 0; x < BUS_W; x += 7) ctx.fillRect(Math.round(x - ((scroll * 1.6) % 7)), 88, 3, 1);
    if (o.dusk > 0.4) {
      ctx.fillStyle = `rgba(20,10,40,${(o.dusk - 0.4) * 0.6})`;
      ctx.fillRect(0, 0, BUS_W, BUS_H);
    }

    // whole bus rocks with the party and leans with the passengers
    const party = o.party || 0;
    const rock = Math.sin(t / 380) * party * 1.2 + (o.jolt || 0) * Math.sin(t / 40) * 2;
    const leanPx = (o.lean || 0) * 3;
    ctx.save();
    ctx.translate(0, Math.round(rock));

    // passengers (behind the deck side panel)
    const pax = CAST_IDS.filter((id) => id !== o.driver);
    const order = pax.map((id, n) => ({ id, n, ...seatXY(n) }));
    order.sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
    for (const s of order) drawPerson(s.id, s.x + leanPx, s.y, o, t, s.n);

    drawBody(o, t);
    // driver in the cab window
    if (o.driver) drawDriver(o.driver, o, t);
    ctx.restore();

    // "me" marker
    if (o.me && !o.photo) {
      const n = pax.indexOf(o.me);
      if (n >= 0) {
        const s = seatXY(n);
        const bob = Math.round(Math.sin(t / 220) * 1.5);
        marker(s.x + 16 + leanPx, s.y - 6 + bob, CAST.find((c) => c.id === o.me)?.color || '#fff');
      } else if (o.me === o.driver) {
        marker(CAB_X + 15, DECK_Y - 2 + Math.round(Math.sin(t / 220) * 1.5), '#ffcf5a');
      }
    }
  }

  function marker(x, y, col) {
    ctx.fillStyle = '#1b1220';
    ctx.fillRect(x - 4, y - 5, 9, 5);
    ctx.fillRect(x - 2, y, 5, 2);
    ctx.fillRect(x - 1, y + 2, 3, 1);
    ctx.fillStyle = col;
    ctx.fillRect(x - 3, y - 4, 7, 3);
    ctx.fillRect(x - 1, y - 1, 3, 2);
  }

  function drawBody() {
    // top-deck railing
    ctx.fillStyle = WINE_D;
    ctx.fillRect(6, DECK_Y - 11, CAB_X - 10, 1);
    for (let x = 8; x < CAB_X - 4; x += 8) ctx.fillRect(x, DECK_Y - 11, 1, 11);
    // deck side panel (hides the passengers' laps)
    ctx.fillStyle = CREAM;
    ctx.fillRect(4, DECK_Y - 6, CAB_X - 2, 7);
    ctx.fillStyle = WINE;
    ctx.fillRect(4, DECK_Y - 6, CAB_X - 2, 2);
    // main body
    ctx.fillStyle = CREAM;
    ctx.fillRect(2, DECK_Y, BUS_W - 6, BODY_H);
    ctx.fillStyle = CREAM_D;
    ctx.fillRect(2, DECK_Y + BODY_H - 4, BUS_W - 6, 4);
    ctx.fillStyle = WINE;
    ctx.fillRect(2, DECK_Y + 16, BUS_W - 6, 5);
    ctx.fillStyle = WINE_D;
    ctx.fillRect(2, DECK_Y + 21, BUS_W - 6, 1);
    // lower windows
    for (let x = 10; x < CAB_X - 10; x += 22) {
      ctx.fillStyle = WINE_D;
      ctx.fillRect(x - 1, DECK_Y + 3, 18, 11);
      ctx.fillStyle = GLASS;
      ctx.fillRect(x, DECK_Y + 4, 16, 9);
      ctx.fillStyle = '#c8e6ec';
      ctx.fillRect(x + 1, DECK_Y + 5, 4, 2);
    }
    // the cab: a step up at the front
    ctx.fillStyle = CREAM;
    ctx.fillRect(CAB_X - 4, DECK_Y - 14, BUS_W - CAB_X - 2, 14);
    ctx.fillStyle = WINE;
    ctx.fillRect(CAB_X - 4, DECK_Y - 15, BUS_W - CAB_X - 2, 2);
    ctx.fillStyle = WINE_D;
    ctx.fillRect(CAB_X + 1, DECK_Y - 11, 31, 25);
    ctx.fillStyle = GLASS;
    ctx.fillRect(CAB_X + 2, DECK_Y - 10, 29, 23);
    // headlight + bumper
    ctx.fillStyle = '#ffe9a6';
    ctx.fillRect(BUS_W - 6, DECK_Y + 24, 3, 4);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(BUS_W - 8, DECK_Y + BODY_H - 3, 6, 3);
    ctx.fillRect(0, DECK_Y + BODY_H - 3, 6, 3);
    // destination board
    ctx.fillStyle = '#1b1220';
    ctx.fillRect(10, DECK_Y + 24, 46, 6);
    ctx.fillStyle = '#ffcf5a';
    for (let x = 12; x < 54; x += 3) ctx.fillRect(x, DECK_Y + 26, 2, 2);
    // wheels
    for (const wx of [36, 186]) wheel(wx, DECK_Y + BODY_H);
  }

  function wheel(cx, cy) {
    ctx.fillStyle = '#1d1d1d';
    ctx.fillRect(cx - 9, cy - 6, 18, 12);
    ctx.fillRect(cx - 7, cy - 8, 14, 16);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.fillStyle = '#5c5c5c';
    const a = (scroll / 4) % 2 < 1;
    ctx.fillRect(cx - (a ? 1 : 3), cy - (a ? 3 : 1), a ? 2 : 6, a ? 6 : 2);
  }

  function portrait32(id, x, y, clipBottom) {
    const img = A?.cast32;
    if (!img || !img.width) return;
    const i = CAST_IDS.indexOf(id);
    const h = clipBottom != null ? Math.max(0, Math.min(32, clipBottom - y)) : 32;
    if (h <= 0) return;
    ctx.drawImage(img, i * 32, 0, 32, h, Math.round(x), Math.round(y), 32, h);
  }

  function face(id) {
    const f = A?.faces?.[id];
    if (!f) return { x: 10, y: 10, w: 12, h: 5 };
    return { x: f.x / 2, y: f.y / 2, w: f.w / 2, h: f.h / 2 };
  }

  function drawPerson(id, x, y, o, t, n) {
    const st = o.st?.[id] || {};
    const tr = tier(st.tip || 0);
    const ph = o.photo ? o.photo[id] : null;
    const asleep = ph ? ph === 'z' : st.asleep;
    const standing = !o.photo && o.standing?.has(id);
    const phase = n * 1.7;
    let sx = 0;
    let sy = 0;
    if (!o.photo) {
      sx = Math.sin(t / (520 - tr * 60) + phase) * (0.4 + tr * 0.8);
      sy = Math.sin(t / 300 + phase) * (o.v > 0.05 ? 0.6 : 0.2);
      if (asleep) sy += 3;
      if (standing) sy -= 9 + Math.abs(Math.sin(t / 120)) * 2;
      if (o.jolt) sy -= Math.abs(Math.sin(t / 50 + phase)) * 4 * o.jolt;
    }
    const px = x + sx;
    const py = y + sy;
    portrait32(id, px, py, standing ? DECK_Y + 2 : DECK_Y - 6);

    const f = face(id);
    // blush from "Merry" up
    if (tr >= 1 && !ph) {
      ctx.fillStyle = tr >= 3 ? 'rgba(232,60,90,0.75)' : 'rgba(240,110,130,0.6)';
      const cy = Math.round(py + f.y + f.h - 2);
      ctx.fillRect(Math.round(px + f.x), cy, 2, 1);
      ctx.fillRect(Math.round(px + f.x + f.w - 2), cy, 2, 1);
    }
    // blinking / asleep in a photo
    if (ph === 'b' || ph === 'z' || asleep) closeEyes(id, px, py, f);
    if (asleep) {
      const zt = (t / 700 + n * 0.3) % 1;
      ctx.fillStyle = '#ffffff';
      zzz(px + 24 + zt * 4, py + 4 - zt * 6);
    }
    // a glass in hand once the tasting has started
    if (o.glasses && !asleep && !standing) glass(px + (n % 2 ? 2 : 26), py + 22, o.wine);
    if (standing) {
      glass(px + 28, py + 10, o.wine);
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(px + 31), Math.round(py + 4), 1, 3);
    }
    if (ph === 's' && o.photo) {
      // a little sparkle for the smilers
      ctx.fillStyle = '#fff6b0';
      ctx.fillRect(Math.round(px + 27), Math.round(py + 3), 1, 3);
      ctx.fillRect(Math.round(px + 26), Math.round(py + 4), 3, 1);
    }
  }

  function closeEyes(id, x, y, f) {
    // paint over the eye band with the cheek colour, then two shut lids
    const img = A?.cast32;
    let col = '#e8b48a';
    if (A?.skin?.[id]) col = A.skin[id];
    else if (img) col = '#e2b08a';
    const ex = Math.round(x + f.x + 1);
    const ey = Math.round(y + f.y);
    const ew = Math.max(4, Math.round(f.w - 2));
    ctx.fillStyle = col;
    ctx.fillRect(ex, ey, ew, 2);
    ctx.fillStyle = '#2a1a14';
    const half = Math.floor(ew / 2);
    ctx.fillRect(ex + 1, ey + 1, Math.max(2, half - 2), 1);
    ctx.fillRect(ex + half + 1, ey + 1, Math.max(2, half - 2), 1);
  }

  function zzz(x, y) {
    const X = Math.round(x);
    const Y = Math.round(y);
    ctx.fillRect(X, Y, 3, 1);
    ctx.fillRect(X + 1, Y + 1, 1, 1);
    ctx.fillRect(X, Y + 2, 3, 1);
  }

  function glass(x, y, wine) {
    const X = Math.round(x);
    const Y = Math.round(y);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(X, Y, 4, 1);
    ctx.fillRect(X, Y + 1, 1, 3);
    ctx.fillRect(X + 3, Y + 1, 1, 3);
    ctx.fillRect(X + 1, Y + 4, 2, 1);
    ctx.fillRect(X + 1, Y + 5, 1, 2);
    ctx.fillRect(X, Y + 7, 3, 1);
    ctx.fillStyle = wine || '#7a1022';
    ctx.fillRect(X + 1, Y + 2, 2, 2);
  }

  function drawDriver(id, o, t) {
    const x = CAB_X + 1;
    const y = DECK_Y - 13 + Math.round(Math.sin(t / 300) * 0.4);
    // through the cab glass: draw clipped to the window
    ctx.save();
    ctx.beginPath();
    ctx.rect(CAB_X + 2, DECK_Y - 10, 29, 23);
    ctx.clip();
    portrait32(id, x, y, null);
    ctx.restore();
    // steering wheel
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(CAB_X + 4, DECK_Y + 8, 10, 2);
    ctx.fillRect(CAB_X + 8, DECK_Y + 10, 2, 3);
    // glass glare
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(CAB_X + 24, DECK_Y - 9, 2, 8);
    if (o.photo && o.photo[id] === 'd') {
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(CAB_X + 26, DECK_Y - 9, 4, 3); // a little "keys" tag
    }
  }

  return { render, setArt };
}

/** Freeze one photo from the day into a canvas (for the album). */
export function renderPhoto(canvas, art, photo, todEntry, wine) {
  const view = createBusView(canvas, art);
  const st = {};
  for (const id of CAST_IDS) st[id] = { tip: 0 };
  const driver = Object.keys(photo.who).find((k) => photo.who[k] === 'd') || null;
  const rnd = mulberry32(photo.leg * 99 + 7);
  view.render({
    t: 1000 + rnd() * 1000,
    v: 0,
    driver,
    st,
    photo: photo.who,
    glasses: photo.leg > 0,
    wine,
    sky: todEntry?.sky,
    ground: todEntry?.ground?.[0],
    dusk: todEntry?.dusk || 0,
    party: 0,
  });
  return canvas;
}

export { clamp };
