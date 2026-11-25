/* Dream Rooms · the harness page (see main.jsx for the query flags). */

import { useEffect, useMemo, useState } from 'react';
import DreamStage from '../../../src/dream-rooms/viewer/DreamStage.jsx';
import { firstWords } from '../../../src/dream-rooms/contracts/rows.js';

const q = new URLSearchParams(window.location.search);
const WORLD = q.get('world') || '/src/dream-rooms/contracts/fixtures/sample.world.json';
const GREY = q.get('greybox') === '1';
const GLB = GREY ? null : q.get('glb') || null;
const KIT = q.get('kit') === '0' ? null : q.get('kit') || undefined;
const MOOD = { intensity: Number(q.get('intensity') || 0.6) };
const DELAY = Number(q.get('delay') || 0);

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return res.json();
}

/** Fixture rows (the seed format) → the lean list GET /api/dreams returns. */
function leanRows(data) {
  const list = Array.isArray(data) ? data : data.dreams || [];
  return list.map((r) => ({
    id: r.id,
    dreamt_on: r.dreamt_on,
    night_order: r.night_order,
    status: r.status,
    title: r.status === 'rendered' ? r.title || null : null,
    first_words: r.first_words || firstWords(r.raw_text || ''),
    still_key: null,
    split_from: r.split_from || null,
  }));
}

async function loadDream() {
  const world = await fetchJson(WORLD);
  if (DELAY) await new Promise((r) => setTimeout(r, DELAY * 1000));
  return { world, model_url: GLB, stills: [], mood: MOOD };
}

export default function Harness() {
  const corridor = q.get('corridor') === '1';
  const [rows, setRows] = useState(null);
  const [world, setWorld] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (corridor) {
      const src = q.get('rows');
      if (!src || src === 'empty') {
        Promise.resolve([]).then(setRows);
        return;
      }
      fetchJson(src).then((d) => setRows(leanRows(d)), () => setRows([]));
    } else {
      fetchJson(WORLD).then(setWorld, () => setState('error'));
    }
  }, [corridor]);

  const dream = useMemo(() => (world ? { id: q.get('id') || 'sample', world, model_url: GLB, stills: [], mood: MOOD } : null), [world]);

  return (
    <div style={{ position: 'fixed', inset: 0 }} data-harness-state={state}>
      {corridor ? (
        rows && (
          <DreamStage
            mode="corridor"
            rows={rows}
            at={q.get('at')}
            enter={q.get('enter')}
            autopilot={q.get('autopilot') === '1'}
            loadDream={loadDream}
            kitUrl={KIT}
            onState={setState}
          />
        )
      ) : (
        dream && <DreamStage mode="dream" dream={dream} autopilot={q.get('autopilot') === '1'} still={q.get('still') === '1'} onState={setState} onWake={() => setState('woken')} />
      )}
    </div>
  );
}

