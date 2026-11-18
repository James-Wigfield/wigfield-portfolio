// All DOM lives here. main.js owns the loop and the systems; this file turns a
// system's `params`, `presets` and optional extras (an affinity matrix, a
// colour key) into instruments, and paints the readout.
import { hex } from './lib/palette.js';

const NBSP_THIN = ' ';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function decimalsFor(d) {
  if (d.digits != null) return d.digits;
  if (d.integer || d.step >= 1) return 0;
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(d.step))));
}

function formatValue(v, d) {
  const dec = decimalsFor(d);
  if (dec === 0) {
    const n = Math.round(v);
    return Math.abs(n) >= 10000
      ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP_THIN)
      : String(n);
  }
  return v.toFixed(dec);
}

function shortSigned(v) {
  if (Math.abs(v) < 0.045) return '·';
  const s = v.toFixed(2);
  return s.replace('0.', '.').replace('-0.', '-.');
}

function rgba(hexStr, a) {
  const [r, g, b] = hex(hexStr);
  return `rgba(${r},${g},${b},${a})`;
}

export function createUI(hooks) {
  const nodes = {
    index: document.getElementById('index'),
    record: document.getElementById('record-body'),
    presets: document.getElementById('presets'),
    presetNote: document.getElementById('preset-note'),
    dials: document.getElementById('dials'),
    extras: document.getElementById('extras'),
    speedDial: document.getElementById('speed-dial'),
    state: document.getElementById('state'),
    fps: document.getElementById('fps'),
    ms: document.getElementById('ms'),
    metric: document.getElementById('metric'),
    metricLabel: document.getElementById('metric-label'),
    ticks: document.getElementById('ticks'),
    trace: document.getElementById('trace'),
    plateNo: document.getElementById('plate-no'),
  };

  let sys = null;
  let dialRefs = [];
  let presetRefs = [];
  let matrixCells = null;
  let censusRefs = null;
  const history = new Float32Array(180);
  let historyLen = 0;
  const tctx = nodes.trace.getContext('2d');

  // ---------- index of plates -------------------------------------------
  const rows = hooks.catalogue.map((entry, i) => {
    const li = el('li');
    const row = el('button', 'index__row');
    row.type = 'button';
    row.appendChild(el('span', 'index__num', entry.plate.toLowerCase() + '.'));
    row.appendChild(el('span', 'index__latin', entry.latin));
    row.appendChild(el('span', 'index__name', entry.name));
    row.addEventListener('click', () => hooks.onSelect(i));
    li.appendChild(row);
    nodes.index.appendChild(li);
    return row;
  });

  nodes.state.addEventListener('click', () => hooks.onPause());

  // ---------- one dial --------------------------------------------------
  function makeDial(d, onChange) {
    const wrap = el('div', 'dial');
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'slider');
    wrap.setAttribute('aria-label', d.label);

    wrap.appendChild(el('div', 'dial__label', d.label));

    const row = el('div', 'dial__row');
    const track = el('div', 'dial__track');
    const rail = el('div', 'dial__rail');
    const tick = el('i', 'dial__tick');
    track.append(rail, tick);
    const value = el('div', 'dial__value mono');
    row.append(track, value);
    wrap.appendChild(row);

    const paint = (v) => {
      const pct = ((v - d.min) / (d.max - d.min)) * 100;
      wrap.style.setProperty('--p', pct.toFixed(3));
      value.innerHTML = '';
      value.appendChild(document.createTextNode(formatValue(v, d)));
      if (d.unit) value.appendChild(el('span', 'dial__unit', d.unit));
      wrap.setAttribute('aria-valuemin', String(d.min));
      wrap.setAttribute('aria-valuemax', String(d.max));
      wrap.setAttribute('aria-valuenow', String(v));
      wrap.setAttribute('aria-valuetext', formatValue(v, d) + (d.unit || ''));
    };

    const quantise = (v) => {
      const snapped = d.min + Math.round((v - d.min) / d.step) * d.step;
      const clamped = Math.min(d.max, Math.max(d.min, snapped));
      // step can be fractional; keep float noise out of the readout
      return Number(clamped.toFixed(6));
    };

    const fromPointer = (ev) => {
      const r = track.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      return quantise(d.min + t * (d.max - d.min));
    };

    let dragging = false;
    track.addEventListener('pointerdown', (ev) => {
      dragging = true;
      track.setPointerCapture(ev.pointerId);
      const v = fromPointer(ev);
      paint(v);
      onChange(v);
      ev.preventDefault();
    });
    track.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const v = fromPointer(ev);
      paint(v);
      onChange(v);
    });
    const end = (ev) => {
      if (!dragging) return;
      dragging = false;
      if (track.hasPointerCapture(ev.pointerId)) track.releasePointerCapture(ev.pointerId);
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);

    wrap.addEventListener('keydown', (ev) => {
      const big = (d.max - d.min) / 10;
      let v = null;
      const cur = Number(wrap.getAttribute('aria-valuenow'));
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') v = cur - d.step;
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') v = cur + d.step;
      else if (ev.key === 'PageDown') v = cur - big;
      else if (ev.key === 'PageUp') v = cur + big;
      else if (ev.key === 'Home') v = d.min;
      else if (ev.key === 'End') v = d.max;
      if (v == null) return;
      ev.preventDefault();
      ev.stopPropagation();
      const q = quantise(v);
      paint(q);
      onChange(q);
    });

    paint(d.value);
    return { node: wrap, paint, descriptor: d };
  }

  // ---------- speed dial (system independent) ----------------------------
  const speedDesc = { key: 'speed', label: 'substeps / frame', min: 1, max: 8, step: 1, value: hooks.speed, integer: true };
  const speedDial = makeDial(speedDesc, (v) => hooks.onSpeed(v));
  nodes.speedDial.appendChild(speedDial.node);

  // ---------- affinity matrix -------------------------------------------
  function buildMatrix(m) {
    const box = el('div', 'matrix');
    const head = el('div', 'matrix__head');
    head.appendChild(el('span', 'matrix__title', 'affinity table'));
    const reroll = el('button', 'matrix__reroll', 'reroll');
    reroll.type = 'button';
    reroll.addEventListener('click', () => {
      m.reroll();
      paintMatrix();
      hooks.onMatrix();
    });
    head.appendChild(reroll);
    box.appendChild(head);

    const wrap = el('div', 'matrix__wrap');
    const rowKeys = el('div', 'matrix__keys matrix__keys--rows');
    rowKeys.style.display = 'grid';
    rowKeys.style.gridTemplateRows = `repeat(${m.size}, 1fr)`;
    rowKeys.style.gap = '1px';
    for (let i = 0; i < m.size; i++) {
      const k = el('i', 'matrix__key');
      k.style.background = m.colours[i];
      k.style.width = '3px';
      k.title = m.species[i];
      rowKeys.appendChild(k);
    }
    const colKeys = el('div', 'matrix__keys matrix__keys--cols');
    colKeys.style.gridTemplateColumns = `repeat(${m.size}, 1fr)`;
    for (let j = 0; j < m.size; j++) {
      const k = el('i', 'matrix__key');
      k.style.background = m.colours[j];
      k.title = m.species[j];
      colKeys.appendChild(k);
    }
    const grid = el('div', 'matrix__grid');
    matrixCells = [];
    for (let i = 0; i < m.size; i++) {
      for (let j = 0; j < m.size; j++) {
        const cell = el('button', 'matrix__cell');
        cell.type = 'button';
        cell.tabIndex = 0;
        cell.dataset.i = String(i);
        cell.dataset.j = String(j);
        let dragFrom = null;
        cell.addEventListener('pointerdown', (ev) => {
          dragFrom = { y: ev.clientY, v: m.get(i, j) };
          cell.setPointerCapture(ev.pointerId);
          ev.preventDefault();
        });
        cell.addEventListener('pointermove', (ev) => {
          if (!dragFrom) return;
          const dv = (dragFrom.y - ev.clientY) / 90;
          m.set(i, j, Math.round((dragFrom.v + dv) * 20) / 20);
          paintCell(cell, m);
          hooks.onMatrix();
        });
        const stop = (ev) => {
          dragFrom = null;
          if (cell.hasPointerCapture(ev.pointerId)) cell.releasePointerCapture(ev.pointerId);
        };
        cell.addEventListener('pointerup', stop);
        cell.addEventListener('pointercancel', stop);
        cell.addEventListener('keydown', (ev) => {
          const d = ev.key === 'ArrowUp' ? 0.05 : ev.key === 'ArrowDown' ? -0.05 : 0;
          if (!d) return;
          ev.preventDefault();
          ev.stopPropagation();
          m.set(i, j, Math.round((m.get(i, j) + d) * 20) / 20);
          paintCell(cell, m);
          hooks.onMatrix();
        });
        grid.appendChild(cell);
        matrixCells.push(cell);
      }
    }
    wrap.append(colKeys, rowKeys, grid);
    const foot = el('p', 'matrix__foot', 'row acts on column · drag a cell');
    box.append(wrap, foot);
    return box;
  }

  function paintCell(cell, m) {
    const i = Number(cell.dataset.i), j = Number(cell.dataset.j);
    const v = m.get(i, j);
    const accent = sys && sys.accent ? sys.accent : '#e8e4d9';
    cell.style.background = v >= 0
      ? rgba(accent, 0.1 + 0.8 * Math.abs(v))
      : rgba('#5f80a0', 0.1 + 0.8 * Math.abs(v));
    cell.textContent = shortSigned(v);
    cell.title = `${m.species[i]} → ${m.species[j]}: ${v.toFixed(2)}`;
    cell.setAttribute('aria-label', cell.title);
  }

  function paintMatrix() {
    if (!matrixCells || !sys || !sys.matrix) return;
    for (const cell of matrixCells) paintCell(cell, sys.matrix);
  }

  // ---------- census: live figures and the leading genome ----------------
  // One grid for the genome so the row keys line up with every cell:
  // [row key] [grows] | [kin x4] | [strangers x4]
  function buildCensus() {
    const c = sys.census();
    const box = el('div', 'census');
    const head = el('div', 'matrix__head');
    head.appendChild(el('span', 'matrix__title', 'census'));
    box.appendChild(head);

    const dl = el('dl', 'census__rows');
    const rowsRef = c.rows.map(([k, v]) => {
      const row = el('div', 'census__row');
      const dd = el('dd', 'mono', v);
      row.append(el('dt', null, k), dd);
      dl.appendChild(row);
      return dd;
    });
    box.appendChild(dl);

    const bar = el('div', 'census__bar');
    const barRef = c.mix.map((m) => {
      const seg = el('i');
      seg.style.background = m.colour;
      seg.title = m.name;
      bar.appendChild(seg);
      return seg;
    });
    const keys = el('div', 'census__keys');
    const pctRef = c.mix.map((m) => {
      const k = el('span', 'census__key');
      const sw = el('i', 'key__swatch');
      sw.style.background = m.colour;
      const pct = el('span', 'mono');
      k.append(sw, el('span', 'census__name', m.name), pct);
      keys.appendChild(k);
      return pct;
    });
    box.append(bar, keys);

    const ghead = el('div', 'matrix__head');
    const count = el('span', 'census__count mono');
    ghead.append(el('span', 'matrix__title', 'leading genome'), count);
    const lineage = el('p', 'census__lineage');
    const lsw = el('i', 'key__swatch');
    const ltxt = el('span');
    lineage.append(lsw, ltxt);

    const grid = el('div', 'genome');
    const put = (node, col, row, span = 1) => {
      node.style.gridColumn = `${col} / span ${span}`;
      node.style.gridRow = String(row);
      grid.appendChild(node);
      return node;
    };
    put(el('span', 'genome__label', 'grows'), 2, 1);
    put(el('span', 'genome__label', 'kin'), 4, 1, 4);
    put(el('span', 'genome__label', 'strangers'), 9, 1, 4);
    for (let j = 0; j < 4; j++) {
      for (const base of [4, 9]) {
        const k = put(el('i', 'genome__colkey'), base + j, 2);
        k.style.background = c.colours[j];
        k.title = c.roles[j];
      }
    }
    const growRef = [], kinRef = [], forRef = [];
    for (let r = 0; r < 4; r++) {
      const rk = put(el('i', 'genome__rowkey'), 1, r + 3);
      rk.style.background = c.colours[r];
      rk.title = c.roles[r];
      growRef.push(put(el('span', 'genome__cell genome__cell--grow mono'), 2, r + 3));
      for (let j = 0; j < 4; j++) {
        kinRef.push(put(el('span', 'genome__cell mono'), 4 + j, r + 3));
        forRef.push(put(el('span', 'genome__cell mono'), 9 + j, r + 3));
      }
    }
    const foot = el('p', 'census__foot', 'row acts on column · blank: no rule, default');
    box.append(ghead, lineage, grid, foot);

    censusRefs = { rowsRef, barRef, pctRef, count, lsw, ltxt, growRef, kinRef, forRef };
    return box;
  }

  function setText(node, t) {
    if (node.textContent !== t) node.textContent = t;
  }

  function paintRule(cell, v, names, a, b, kind) {
    if (v == null) {
      cell.style.background = '';
      setText(cell, '');
      cell.title = `${names[a]} → ${kind} ${names[b]}: no rule`;
      return;
    }
    const accent = sys && sys.accent ? sys.accent : '#e8e4d9';
    cell.style.background = v >= 0
      ? rgba(accent, 0.12 + 0.78 * Math.abs(v))
      : rgba('#c86f5f', 0.12 + 0.78 * Math.abs(v));
    setText(cell, shortSigned(v));
    cell.title = `${names[a]} → ${kind} ${names[b]}: ${v.toFixed(2)}`;
  }

  function paintCensus() {
    if (!censusRefs || !sys || !sys.census) return;
    const c = sys.census();
    const R = censusRefs;
    c.rows.forEach(([, v], k) => setText(R.rowsRef[k], v));
    c.mix.forEach((m, k) => {
      R.barRef[k].style.width = (m.frac * 100).toFixed(2) + '%';
      setText(R.pctRef[k], Math.round(m.frac * 100) + '%');
    });
    const g = c.genome;
    if (!g) {
      setText(R.count, '—');
      setText(R.ltxt, 'no organisms');
      R.lsw.style.background = 'transparent';
      for (const cell of [...R.growRef, ...R.kinRef, ...R.forRef]) { cell.style.background = ''; setText(cell, ''); }
      return;
    }
    setText(R.count, `${g.rules} of ${c.cap} rules`);
    R.lsw.style.background = g.colour;
    setText(R.ltxt, `${g.cells} cells in the dish · body of ${g.size}`);
    for (let r = 0; r < 4; r++) {
      const w = g.grow[r];
      const cell = R.growRef[r];
      cell.style.background = w > 0 ? rgba(c.colours[r], 0.18 + 0.7 * w) : '';
      setText(cell, w > 0 ? String(Math.round(w * 100)) : '');
      cell.title = w > 0 ? `grows ${c.roles[r]}: ${Math.round(w * 100)}% of the body` : `grows no ${c.roles[r]}`;
      for (let j = 0; j < 4; j++) {
        paintRule(R.kinRef[r * 4 + j], g.kin[r * 4 + j], c.roles, r, j, 'kin');
        paintRule(R.forRef[r * 4 + j], g.foreign[r * 4 + j], c.roles, r, j, 'stranger');
      }
    }
  }

  function buildKey(legend) {
    const box = el('div', 'key');
    box.appendChild(el('p', 'matrix__title', 'colour key — neighbours n'));
    for (const item of legend) {
      const row = el('div', 'key__row');
      const sw = el('i', 'key__swatch');
      sw.style.background = item.colour;
      row.append(sw, el('span', 'key__name', item.name), el('span', 'key__range mono', item.range));
      box.appendChild(row);
    }
    return box;
  }

  // ---------- bind a system ---------------------------------------------
  function bind(next, index) {
    sys = next;
    matrixCells = null;
    censusRefs = null;
    historyLen = 0;

    rows.forEach((r, i) => r.setAttribute('aria-current', i === index ? 'true' : 'false'));
    nodes.plateNo.textContent = `pl. ${sys.plate.toLowerCase()} / ${ROMAN[hooks.catalogue.length - 1] || hooks.catalogue.length}`;

    // field record
    nodes.record.innerHTML = '';
    nodes.record.appendChild(el('p', 'record__latin', sys.latin));
    nodes.record.appendChild(el('p', 'record__name', sys.name));
    const meta = el('dl', 'record__meta');
    const add = (k, v) => { meta.appendChild(el('dt', null, k)); meta.appendChild(el('dd', null, v)); };
    add('accession', sys.accession);
    add('described', String(sys.described));
    add('plate', sys.plate);
    nodes.record.appendChild(meta);
    nodes.record.appendChild(el('p', 'record__note', sys.note));
    nodes.record.appendChild(el('p', 'record__source', sys.source));

    // presets
    nodes.presets.innerHTML = '';
    presetRefs = sys.presets.map((pr, i) => {
      const b = el('button', 'preset', pr.name);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => hooks.onPreset(i));
      nodes.presets.appendChild(b);
      return b;
    });

    // dials
    nodes.dials.innerHTML = '';
    dialRefs = sys.params.map((d) => {
      const dial = makeDial(d, (v) => {
        sys.setParam(d.key, v);
        syncDials();
      });
      nodes.dials.appendChild(dial.node);
      return dial;
    });

    // extras
    nodes.extras.innerHTML = '';
    if (sys.matrix) {
      nodes.extras.appendChild(buildMatrix(sys.matrix));
      paintMatrix();
    }
    if (sys.legend) nodes.extras.appendChild(buildKey(sys.legend));
    if (sys.census) {
      nodes.extras.appendChild(buildCensus());
      paintCensus();
    }

    nodes.metricLabel.textContent = sys.metric().label;
    setPreset(sys.preset ?? 0);
    layoutTrace();
  }

  function setPreset(i) {
    presetRefs.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
    const pr = sys && sys.presets[i];
    nodes.presetNote.textContent = pr ? pr.note : '';
  }

  // Params can move without the dials touching them: a preset, or a system
  // that rewrites a value itself (PPS density follows the population).
  function syncDials() {
    for (const d of dialRefs) d.paint(d.descriptor.value);
    if (sys && sys.matrix) paintMatrix();
    nodes.metricLabel.textContent = sys.metric().label;
  }

  // ---------- readout ----------------------------------------------------
  function layoutTrace() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(64, Math.round(nodes.trace.clientWidth * dpr));
    const h = Math.round(34 * dpr);
    if (nodes.trace.width !== w || nodes.trace.height !== h) {
      nodes.trace.width = w;
      nodes.trace.height = h;
    }
  }

  function drawTrace(accent) {
    const w = nodes.trace.width, h = nodes.trace.height;
    tctx.clearRect(0, 0, w, h);
    // baseline
    tctx.fillStyle = '#1c1b17';
    tctx.fillRect(0, h - 1, w, 1);
    if (historyLen < 2) return;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < historyLen; i++) {
      const v = history[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!(hi > lo)) { hi = lo + 1e-9; }
    const pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;
    tctx.strokeStyle = accent;
    tctx.lineWidth = Math.max(1, Math.round(h / 34));
    tctx.beginPath();
    for (let i = 0; i < historyLen; i++) {
      const x = (i / (history.length - 1)) * w;
      const y = h - 1 - ((history[i] - lo) / (hi - lo)) * (h - 3);
      if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y);
    }
    tctx.stroke();
  }

  function readout(r) {
    nodes.fps.textContent = r.fps ? r.fps.toFixed(0) + ' fps' : '—';
    nodes.ms.textContent = r.ms.toFixed(1) + ' ms';
    nodes.metric.textContent = r.metric.text;
    nodes.ticks.textContent = r.ticks >= 10000
      ? String(r.ticks).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP_THIN)
      : String(r.ticks);
    nodes.state.textContent = r.paused ? 'Held' : 'Running';
    nodes.state.dataset.paused = r.paused ? 'true' : 'false';

    // A held plate is not producing new samples; keep the trace as it was
    // rather than flattening it with repeats.
    if (!r.paused) {
      if (historyLen < history.length) {
        history[historyLen++] = r.metric.value;
      } else {
        history.copyWithin(0, 1);
        history[history.length - 1] = r.metric.value;
      }
    }
    drawTrace(r.accent);
    paintCensus();
  }

  function setHidden(hidden) {
    document.body.classList.toggle('ui-hidden', hidden);
  }

  return { bind, setPreset, syncDials, readout, setHidden, layoutTrace };
}
