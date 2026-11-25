/* page-check's walk through the /memories LIST (2026-11-25): run by page-check.mjs, on the SVG atlas so it costs
   no Mapbox loads (the globe's opening view is checked in page-check's own map section).

     no day slider; the map opens on Perth (map/start.js); the list is grouped into collection sections, a
     section collapses and STAYS collapsed after a reload (localStorage, per viewer); picking a collection flies
     the map to it and offers "Play <name>", picking it again takes that away; and on a phone (390 × 844, touch)
     the whole list scrolls with a finger, every row is a ≥ 44 px target, the LAST place in the list can be
     tapped and opens its page (the bug where places below the first could not be reached), the map still pans
     when touched, and nothing scrolls sideways.

   Writes one throwaway collection holding one spot and deletes it at the end (its spot goes back to ungrouped).
   Extra places for the phone test are injected into the page's place list (nothing written). */

import { START } from '../../src/memory-rooms/map/start.js';

const PHONE = 390;

export async function listWalk({ base, api, open, record, shot, sel, wait, noErrors }) {
  const spots = await api.listSpots();
  const target = spots.find((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && !s.buildingId && !s.collectionId) || spots.find((s) => Number.isFinite(s.lat));
  const [[w, s], [e, n]] = START.bounds;
  const inStart = (c) => c && c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e;
  const centerOf = (page) =>
    page.$eval(`${sel('map')}`, (el) => {
      const [lat, lng] = (el.dataset.center || '').split(',').map(Number);
      return Number.isFinite(lat) ? { lat, lng } : null;
    });

  // one throwaway collection holding one spot (a known name for the Play button)
  let coll = null;
  const name = `page-check ${Date.now().toString(36)}`;
  const ping = await api.ping();
  if ((ping.features || []).includes('collections') && target) {
    coll = await api.saveCollection({ id: crypto.randomUUID(), name });
    await api.patchSpot(target.id, { collectionId: coll.id });
  } else {
    record('list: the Worker has collections (ping) and there is a spot with a location', false, JSON.stringify(ping.features));
  }

  try {
    for (const width of [1440, PHONE]) {
      const page = await open(width);
      // a fresh viewer: no remembered collapsed sections
      await page.evaluateOnNewDocument(() => {
        try {
          if (!sessionStorage.getItem('mr:pc-list')) {
            localStorage.removeItem('mr:collapsed');
            sessionStorage.setItem('mr:pc-list', '1');
          }
        } catch {
          /* ignore */
        }
      });
      await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2' });
      await page.waitForSelector(`${sel('map')} .mr-atlas-land`, { timeout: 20000 }).catch(() => null);
      await page.waitForSelector(sel('collection'), { timeout: 15000 }).catch(() => null);
      await wait(600);

      record(`list ${width}: no day slider`, !(await page.$(sel('day-strip'))) && !(await page.$('.mr-days')));
      const c0 = await centerOf(page);
      record(`list ${width}: the map opens on ${START.name}`, inStart(c0), c0 ? `centre ${c0.lat.toFixed(3)}, ${c0.lng.toFixed(3)}` : 'no centre');

      // sections: one per collection + Ungrouped, each with a name and a count
      const sections = await page.$$eval(sel('collection'), (els) => els.map((el) => ({ id: el.dataset.id, open: el.hasAttribute('data-open'), name: el.querySelector('.mr-coll-title')?.textContent, count: el.querySelector('[data-mr="collection-count"]')?.textContent })));
      const mine = coll && sections.find((x) => x.id === coll.id);
      record(`list ${width}: the list is grouped by collection (Ungrouped last)`, Boolean(mine) && mine.name === name && /1 spot/.test(mine.count || '') && (sections.at(-1)?.id === 'none' || !sections.some((x) => x.id === 'none')), sections.map((x) => `${x.name} (${x.count})`).join(' | '));

      if (mine) {
        // collapse, reload: still collapsed; open it again
        await page.click(`${sel('collection')}[data-id="${coll.id}"] ${sel('collection-toggle')}`);
        await wait(250);
        const closed = await page.$eval(`${sel('collection')}[data-id="${coll.id}"]`, (el) => !el.hasAttribute('data-open') && !el.querySelector('[data-mr="spot-row"]'));
        await page.reload({ waitUntil: 'networkidle2' });
        await page.waitForSelector(`${sel('collection')}[data-id="${coll.id}"]`, { timeout: 15000 }).catch(() => null);
        await wait(400);
        const stillClosed = await page.$eval(`${sel('collection')}[data-id="${coll.id}"]`, (el) => !el.hasAttribute('data-open')).catch(() => false);
        await page.click(`${sel('collection')}[data-id="${coll.id}"] ${sel('collection-toggle')}`);
        await wait(250);
        const reopened = await page.$eval(`${sel('collection')}[data-id="${coll.id}"]`, (el) => el.hasAttribute('data-open') && Boolean(el.querySelector('[data-mr="spot-row"]')));
        record(`list ${width}: a section collapses, stays collapsed after a reload, and opens again`, closed && stillClosed && reopened, `closed ${closed}, after reload ${stillClosed}, reopened ${reopened}`);

        // pick it: the map flies to its spot, "Play <name>" shows; pick again: gone
        const noPlay = !(await page.$(sel('fly-play')));
        await page.click(`${sel('collection')}[data-id="${coll.id}"] ${sel('collection-head')}`);
        await wait(1600);
        const c1 = await centerOf(page);
        const play = await page.$eval(sel('fly-play'), (el) => el.textContent).catch(() => null);
        const flown = c1 && Math.abs(c1.lat - target.lat) < 0.05 && Math.abs(c1.lng - target.lng) < 0.05;
        record(`list ${width}: picking a collection flies the map to it and offers "Play ${name}"`, noPlay && flown && play?.includes(name), `before: ${noPlay ? 'no Play' : 'Play shown'}; centre ${c1?.lat?.toFixed(3)}, ${c1?.lng?.toFixed(3)} (spot ${target.lat.toFixed(3)}, ${target.lng.toFixed(3)}); button "${play}"`);
        await shot(page, `list-${width}-picked`);
        await page.click(`${sel('collection')}[data-id="${coll.id}"] ${sel('collection-head')}`);
        await wait(300);
        record(`list ${width}: picking it again hides Play`, !(await page.$(sel('fly-play'))));
      }
      noErrors(page, `list ${width}`);
      await page.close();
    }

    // ── the phone bug: places further down the list must scroll into reach and open on a tap ──
    {
      const page = await open(PHONE);
      const real = await api.listBuildings().catch(() => []);
      const fakes = [1, 2, 3].map((i) => ({
        id: `7a3e1c55-0000-4000-8000-0000000fa${String(i).padStart(3, '0')}`,
        createdAt: `2020-01-0${i}T00:00:00.000Z`,
        updatedAt: `2020-01-0${i}T00:00:00.000Z`,
        capturedAt: `2020-01-0${i}T00:00:00.000Z`,
        deletedAt: null,
        createdBy: 'james',
        title: `page-check place ${i}`,
        placeLabel: 'Perth, WA',
        lat: -31.95,
        lng: 115.86,
        status: 'captured',
        sketch: { version: 1, levels: [{ id: 'ground', name: 'Ground' }], rooms: [] },
        plan: null,
        planVersion: 0,
        collectionId: null,
        media: [],
      }));
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/memories/buildings' && r.method() === 'GET') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [...real.filter((b) => !b.deletedAt), ...fakes] }) });
        else r.continue();
      });
      await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2' });
      await page.waitForSelector(sel('place-row'), { timeout: 20000 }).catch(() => null);
      await wait(800);
      const places = await page.$$eval(sel('place-row'), (els) => els.map((e) => e.dataset.id));
      const lastId = places.at(-1);
      // every row in the list is a full target of at least 44 px
      const small = await page.$$eval(`.mr-list ${sel('spot-row')}, .mr-list ${sel('place-row')}`, (els) => els.map((e) => e.getBoundingClientRect().height).filter((h) => h < 44));
      record(`list ${PHONE}: ${places.length} places in the list, every row ≥ 44 px tall`, places.length >= 3 && small.length === 0, small.length ? `${small.length} rows under 44 px: ${small.slice(0, 4).map((h) => h.toFixed(0)).join(', ')}` : `${places.length} places`);

      // a finger swipe up on the list scrolls it (the list, not the page) until the last place is in view
      const list = await page.$('.mr-list');
      const lb = await list.boundingBox();
      const cdp = await page.createCDPSession();
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      const visible = () =>
        page.$eval(`${sel('place-row')}[data-id="${lastId}"]`, (el) => {
          const r = el.getBoundingClientRect();
          const list = document.querySelector('.mr-list').getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { inside: r.top >= list.top - 1 && r.bottom <= list.bottom + 1, hits: Boolean(hit && el.contains(hit)), top: r.top, bottom: r.bottom };
        });
      let v = await visible();
      const startTop = await page.$eval('.mr-list', (el) => el.scrollTop);
      // short, slow swipes (a pause before lifting the finger, so no fling): stop as soon as the row is fully in
      // view and nothing sits on it (a section's sticky header covers the top of the list)
      for (let swipe = 0; swipe < 30 && !(v.inside && v.hits); swipe++) {
        const x = lb.x + lb.width * 0.6;
        const y0 = lb.y + lb.height * 0.75;
        await touch('touchStart', x, y0);
        for (let k = 1; k <= 8; k++) {
          await touch('touchMove', x, y0 - k * 12);
          await wait(16);
        }
        await wait(250);
        await touch('touchEnd');
        await wait(350);
        v = await visible();
      }
      const scrolled = await page.$eval('.mr-list', (el) => el.scrollTop);
      const pageScroll = await page.evaluate(() => document.scrollingElement.scrollTop);
      record(`list ${PHONE}: a finger swipe scrolls the list until the last place is fully in view and on top`, v.inside && v.hits && scrolled > startTop && pageScroll === 0, `list scrollTop ${startTop} → ${scrolled}, page ${pageScroll}, last place ${v.top.toFixed(0)}–${v.bottom.toFixed(0)} px, hit-tests ${v.hits}`);
      await shot(page, `list-${PHONE}-scrolled`);
      await wait(1600); // Chrome swallows a tap within ~1.5 s of a fast synthetic touch drag
      const box = await (await page.$(`${sel('place-row')}[data-id="${lastId}"]`)).boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      const went = await page.waitForFunction((id) => location.pathname.endsWith(`/b/${id}`), { timeout: 8000 }, lastId).then(() => true).catch(() => false);
      record(`list ${PHONE}: tapping the last place opens it`, went, await page.evaluate(() => location.pathname));

      // the map still pans when touched directly
      await page.goto(`${base}/memories?map=atlas`, { waitUntil: 'networkidle2' });
      await page.waitForSelector(`${sel('map')} .mr-atlas-land`, { timeout: 20000 }).catch(() => null);
      await wait(500);
      const mb = await (await page.$(sel('map'))).boundingBox();
      const before = await centerOf(page);
      const cdp2 = await page.createCDPSession();
      const t2 = (type, x, y) => cdp2.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t2('touchStart', mb.x + mb.width * 0.7, mb.y + mb.height * 0.5);
      for (let k = 1; k <= 10; k++) await t2('touchMove', mb.x + mb.width * 0.7 - k * 14, mb.y + mb.height * 0.5);
      await t2('touchEnd');
      await wait(500);
      const after = await centerOf(page);
      const panned = before && after && Math.abs(after.lng - before.lng) > 1e-4;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      record(`list ${PHONE}: a finger drag on the map pans it, and nothing scrolls sideways`, panned && overflow <= 1, `lng ${before?.lng?.toFixed(4)} → ${after?.lng?.toFixed(4)}, overflow ${overflow}px`);
      // (a fake place's page asks the server for it: a 404 there is the injected data, not an error)
      page.problems = page.problems.filter((p) => !/404|not found/i.test(p));
      noErrors(page, `list ${PHONE} (phone scroll + tap)`);
      await page.close();
    }
  } finally {
    if (coll) await api.deleteCollection(coll.id).catch(() => {});
  }
}
