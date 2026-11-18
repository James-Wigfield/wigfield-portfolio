/* page-check's edit walk (/memories/:id/edit), called from page-check.mjs with its helpers.

   Per width (390 touch, 1440 mouse), each in its own browser context, on one of the two
   rendered example spots (seed-dev.mjs --examples-only):
     spot page → Edit → change the title, the day and the location (drag the pin, then a
     typed place; at 1440 also "Use where I am" far away, the Mazda case: the saved label
     switches to the nearest place and says so) → Save → the spot page shows the new values,
     a reload keeps them, /memories puts its marker at the new place and, past zoom 15,
     its 3D diorama too. Mapbox loads: 0 until "Change location", then 1.
   390 also: offline (Save disabled, what's typed survives a reload) and ?map=atlas.
   1440 also: two phones (a stale form gets the conflict line, Reload, save) and leaving
   with unsaved changes (asks; beforeunload is armed).
   Every spot it touches is put back through the API afterwards. */

const DAY_MS = 24 * 3600 * 1000;
const pad2 = (n) => String(n).padStart(2, '0');
const localDay = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const localTime = (iso) => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const KEEP = ['title', 'note', 'lat', 'lng', 'locAccuracyM', 'locSource', 'placeLabel', 'capturedAt', 'createdBy', 'scaleHint'];
const fieldsOf = (s) => Object.fromEntries(KEEP.map((k) => [k, s[k]]));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

export async function editWalk(h) {
  const { browser, base, api, open, record, shot, sel, wait, noErrors, idle, loads, atlasDrawn, jump, modelsSettled, OUT } = h;
  const spots = await api.listSpots();
  const bedroom = spots.find((s) => s.title === 'Front bedroom (example)');
  const diner = spots.find((s) => s.title === 'Corner diner (example)');
  if (!bedroom || !diner) {
    record('edit: the two example spots exist (seed-dev.mjs --examples-only)', false);
    return;
  }
  const PICK = sel('loc-pick-map');
  const offlineNoise = (page) => (page.problems = page.problems.filter((p) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError|net::ERR/i.test(p)));
  const value = (page, name) => page.$eval(sel(name), (el) => el.value);
  /** Sets an input's value the way typing would (React listens for `input`). */
  const setValue = (page, name, v) =>
    page.$eval(
      sel(name),
      (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      v,
    );
  const press = async (page, name, phone) => {
    const el = await page.waitForSelector(sel(name), { visible: true, timeout: 15000 });
    await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await wait(150);
    const b = await el.boundingBox();
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const typeInto = async (page, name, text, phone) => {
    await press(page, name, phone);
    await page.$eval(sel(name), (el) => el.select?.());
    await page.keyboard.type(text);
  };
  const restore = async (spot) => {
    try {
      await api.patchSpot(spot.id, fieldsOf(spot));
    } catch (e) {
      record(`edit: put "${spot.title}" back`, false, e.message);
    }
  };

  for (const [width, spot, place, gpsFar] of [
    [390, bedroom, { query: 'Seattle', label: 'Seattle, WA', lat: 47.6062, lng: -122.3321 }, false],
    [1440, diner, { query: 'Monterey', label: 'Monterey, CA', lat: 36.6002, lng: -121.8947 }, true],
  ]) {
    const phone = width < 600;
    const ctx = await browser.createBrowserContext();
    if (gpsFar) await ctx.overridePermissions(base, ['geolocation']);
    const page = await open(width, { via: ctx });
    if (gpsFar) await page.setGeolocation({ latitude: -31.9523, longitude: 115.8613, accuracy: 15 }); // Perth: the Mazda case
    const newTitle = `${spot.title} · edited`;
    const newDay = localDay(new Date(Date.parse(spot.capturedAt) - 2 * DAY_MS).toISOString());
    try {
      // ── spot page → Edit ──
      await page.goto(`${base}/memories/${spot.id}`, { waitUntil: 'networkidle2' });
      await press(page, 'spot-edit', phone);
      const opened = await page.waitForSelector(sel('edit'), { timeout: 15000 }).then(() => true).catch(() => false);
      record(`edit ${width}: Edit on the spot page opens /memories/:id/edit`, opened && page.url().endsWith(`/memories/${spot.id}/edit`), page.url());
      if (!opened) continue;
      record(`edit ${width}: no map and no Mapbox load until the place section opens`, !(await page.$(PICK)) && (await loads(page)) === 0, `${await loads(page)} load(s)`);
      const locked = await page.$(`${sel('edit-kind')}[data-locked] ${sel('edit-locked')}`);
      record(`edit ${width}: kind and size are locked on a spot with a 3D room`, Boolean(locked) && !(await page.$(sel('edit-kind-interior'))));
      record(`edit ${width}: Save starts disabled (nothing changed)`, await page.$eval(sel('edit-save'), (el) => el.disabled));
      if (phone) {
        const small = await page.$$eval('.mr-edit input, .mr-edit textarea', (els) => els.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length);
        record('edit 390: every input is 16 px or more (no iOS zoom)', small === 0, `${small} smaller`);
      }
      await shot(page, `edit-${width}`);

      // ── title + day ──
      await typeInto(page, 'edit-title', newTitle, phone);
      await setValue(page, 'edit-day', newDay);
      record(`edit ${width}: typing makes the form dirty and enables Save`, (await page.$(`${sel('edit')}[data-dirty]`)) !== null && !(await page.$eval(sel('edit-save'), (el) => el.disabled)));

      // ── place: open (one map load), drag the pin a little ──
      await press(page, 'edit-place-open', phone);
      const ready = await page.waitForSelector(`${PICK}[data-engine="mapbox"][data-ready]`, { timeout: 30000 }).then(() => true).catch(() => false);
      await idle(page, PICK);
      record(`edit ${width}: "Change location" opens the Mapbox picker: one map load`, ready && (await loads(page)) === 1, `${await loads(page)} load(s)`);
      const zoom = await page.$eval(PICK, (el) => Number(el.dataset.zoom));
      record(`edit ${width}: the picker opens on the saved location at street zoom`, zoom >= 15.5, `zoom ${zoom}`);
      await page.$eval(sel('edit-place'), (el) => el.scrollIntoView({ block: 'start' }));
      await wait(400);
      await shot(page, `edit-place-${width}`);
      const savedLabel = await value(page, 'loc-place-input');
      const pin = await page.$(sel('loc-pin'));
      const pb = pin && (await pin.boundingBox());
      if (pb) {
        const from = { x: pb.x + pb.width / 2, y: pb.y + pb.height * 0.4 };
        const to = { x: from.x + 50, y: from.y + 30 };
        if (phone) {
          await page.touchscreen.touchStart(from.x, from.y);
          for (let i = 1; i <= 6; i++) await page.touchscreen.touchMove(from.x + (to.x - from.x) * (i / 6), from.y + (to.y - from.y) * (i / 6));
          await page.touchscreen.touchEnd();
        } else {
          await page.mouse.move(from.x, from.y);
          await page.mouse.down();
          await page.mouse.move(to.x, to.y, { steps: 6 });
          await page.mouse.up();
        }
        await wait(300);
      }
      const dragged = await page.$eval(sel('loc-status'), (el) => el.dataset.source);
      const keptLabel = await value(page, 'loc-place-input');
      record(`edit ${width}: dragging the pin a little moves it and keeps the saved place name`, dragged === 'pin' && keptLabel === savedLabel && !(await page.$(sel('loc-relabeled'))), `source ${dragged}, "${keptLabel}"`);

      // ── GPS far away: the saved label switches and says so (Mazda: San Diego → WA) ──
      if (gpsFar) {
        await press(page, 'loc-gps', phone);
        const gps = await page.waitForFunction(() => document.querySelector('[data-mr="loc-status"]')?.dataset.source === 'gps', { timeout: 10000 }).then(() => true).catch(() => false);
        const label = await value(page, 'loc-place-input');
        const said = await page.$eval(sel('loc-relabeled'), (el) => el.textContent).catch(() => '');
        record(`edit ${width}: "Use where I am" ${'>'}25 km away switches the place name to the nearest place and says so`, gps && label === 'Perth, WA' && said.includes(savedLabel), `"${savedLabel}" → "${label}": ${said}`);
        await wait(1800); // the fly to the fix
        await idle(page, PICK);
        await page.$eval(sel('loc-relabeled'), (el) => el.scrollIntoView({ block: 'end' })).catch(() => {});
        await wait(300);
        await shot(page, `edit-place-gps-${width}`);
      }

      // ── typed place ──
      await typeInto(page, 'loc-place-input', place.query, phone);
      const sugg = await page.waitForSelector(sel('place-suggestion'), { visible: true, timeout: 5000 }).catch(() => null);
      if (sugg) await press(page, 'place-suggestion', phone);
      await wait(300);
      const typed = await page.$eval(sel('loc-status'), (el) => el.dataset.source);
      record(`edit ${width}: a typed place moves the pin there`, typed === 'typed' && (await value(page, 'loc-place-input')) === place.label, `source ${typed}`);
      record(`edit ${width}: still one Mapbox load after drag, GPS and a typed place`, (await loads(page)) === 1, `${await loads(page)} load(s)`);
      if (phone) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        record('edit 390: no horizontal overflow', overflow <= 1, `${overflow}px`);
      }

      // ── save → back on the spot page ──
      await press(page, 'edit-save', phone);
      const back = await page.waitForSelector(sel('spot-saved'), { timeout: 15000 }).then(() => true).catch(() => false);
      const h1 = await page.$eval('.mr-spot__title', (el) => el.textContent).catch(() => '');
      const metaPlace = await page.$$eval('.mr-meta dd', (els) => els.map((e) => e.textContent)).catch(() => []);
      record(`edit ${width}: Save goes back to the spot page, says Saved, shows the new values`, back && page.url().endsWith(`/memories/${spot.id}`) && h1 === newTitle && metaPlace.includes(place.label), `"${h1}", ${metaPlace.join(' | ')}`);
      const after = await api.getSpot(spot.id);
      record(
        `edit ${width}: the API holds the edit (title, place, typed source, new day, same time of day)`,
        after.title === newTitle && near(after.lat, place.lat) && near(after.lng, place.lng) && after.placeLabel === place.label && after.locSource === 'typed' &&
          localDay(after.capturedAt) === newDay && localTime(after.capturedAt) === localTime(spot.capturedAt) && after.note === spot.note,
        `${after.lat},${after.lng} "${after.placeLabel}" ${after.locSource} ${after.capturedAt} (was ${spot.capturedAt})`,
      );
      await page.waitForSelector(`${sel('viewer')}[data-state="ready"]`, { timeout: 60000 }).catch(() => {});
      await wait(800);
      await page.screenshot({ path: `${OUT}/edit-saved-${width}-${h.scheme}.png`, fullPage: phone });
      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForSelector('.mr-spot__title', { timeout: 15000 }).catch(() => {});
      const again = await page.$eval('.mr-spot__title', (el) => el.textContent).catch(() => '');
      record(`edit ${width}: a reload keeps the new values (and "Saved" shows only once)`, again === newTitle && !(await page.$(sel('spot-saved'))), `"${again}"`);
      const draftLeft = await page.evaluate((id) => sessionStorage.getItem(`mr:edit:${id}`), spot.id);
      record(`edit ${width}: no draft is left after saving`, draftLeft === null);
      noErrors(page, `edit ${width} walk`);

      // ── /memories: the marker stands at the new place, and its 3D diorama past zoom 15 ──
      await page.goto(`${base}/memories`, { waitUntil: 'networkidle2' });
      const mapReady = await page.waitForSelector(`${sel('map')}[data-engine="mapbox"][data-ready]`, { timeout: 30000 }).then(() => true).catch(() => false);
      if (mapReady) {
        await jump(page, { center: [place.lng, place.lat], zoom: 9 });
        await wait(600);
        const at = await page.evaluate(
          ({ id, lng, lat }) => {
            const map = document.querySelector('[data-mr="map"]').__mrMap;
            const p = map.project([lng, lat]);
            const dot = document.querySelector(`[data-mr="spot-dot"][data-id="${id}"]`);
            const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(dot?.getAttribute('transform') || '');
            return { p: { x: p.x, y: p.y }, dot: m ? { x: Number(m[1]), y: Number(m[2]) } : null, marker: dot?.dataset.marker || null };
          },
          { id: spot.id, lng: place.lng, lat: place.lat },
        );
        const off = at.dot ? Math.hypot(at.dot.x - at.p.x, at.dot.y - at.p.y) : Infinity;
        record(`edit ${width}: /memories stands the spot's marker at its new place`, off < 3 && Boolean(at.marker), `${off.toFixed(1)} px off, marker ${at.marker}`);
        await jump(page, { center: [place.lng, place.lat], zoom: 16.5 });
        const live = await modelsSettled(page, 1);
        const box = await page.$eval(`${sel('spot-dot')}[data-id="${spot.id}"][data-model] rect`, (el) => {
          const r = el.getBoundingClientRect();
          return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width };
        }).catch(() => null);
        const centre = await page.evaluate(({ lng, lat }) => {
          const el = document.querySelector('[data-mr="map"]');
          const p = el.__mrMap.project([lng, lat]);
          const r = el.getBoundingClientRect();
          return { x: p.x + r.left, y: p.y + r.top };
        }, place);
        record(
          `edit ${width}: past zoom 15 its 3D diorama stands at the new place`,
          live && box && Math.abs(box.cx - centre.x) < box.w / 2,
          box ? `model box centre ${box.cx.toFixed(0)} vs point ${centre.x.toFixed(0)} (w ${box.w.toFixed(0)})` : 'no model',
        );
        await shot(page, `edit-map3d-${width}`);
      } else record(`edit ${width}: /memories map loads`, false);
      noErrors(page, `edit ${width} map`);
    } catch (e) {
      record(`edit ${width}: walk failed`, false, e.message.split('\n')[0]);
    } finally {
      await restore(spot);
    }

    // ── 390: offline, then ?map=atlas ──
    if (phone) {
      try {
        await page.goto(`${base}/memories/${spot.id}/edit`, { waitUntil: 'networkidle2' });
        await page.waitForSelector(sel('edit-title'), { timeout: 15000 });
        await typeInto(page, 'edit-title', 'typed offline', true);
        await page.setOfflineMode(true);
        await wait(300);
        const disabled = await page.$eval(sel('edit-save'), (el) => el.disabled);
        const line = await page.$(sel('edit-offline'));
        record('edit 390: offline, Save is disabled with one line saying why', disabled && Boolean(line));
        await wait(400); // the draft write
        let prompted = null; // the page's own "leave with unsaved changes?" (beforeunload)
        page.once('dialog', (d) => {
          prompted = d.type();
          d.accept();
        });
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        record('edit 390: reloading with unsaved changes asks first (beforeunload)', prompted === 'beforeunload', `dialog ${prompted}`);
        const back = await page.waitForSelector(sel('edit-title'), { timeout: 20000 }).then(() => true).catch(() => false);
        const kept = back ? await value(page, 'edit-title') : null;
        const restoredLine = Boolean(await page.$(sel('edit-restored')));
        record('edit 390: offline, what was typed survives a reload', kept === 'typed offline' && restoredLine, `title "${kept}"`);
        await shot(page, 'edit-offline-390');
        await page.setOfflineMode(false);
        await wait(300);
        await press(page, 'edit-discard', true);
        record('edit 390: Discard puts the saved values back', (await value(page, 'edit-title')) === spot.title && (await page.evaluate((id) => sessionStorage.getItem(`mr:edit:${id}`), spot.id)) === null);
        offlineNoise(page);
        noErrors(page, 'edit 390 offline');

        await page.goto(`${base}/memories/${spot.id}/edit?map=atlas`, { waitUntil: 'networkidle2' });
        await press(page, 'edit-place-open', true);
        const atlas = await atlasDrawn(page, '.mr-pickmap[data-engine="atlas"]');
        await page.$eval(PICK, (el) => el.scrollIntoView({ block: 'center' }));
        await wait(300);
        const r = await page.$eval(PICK, (el) => {
          const b = el.getBoundingClientRect();
          return { x: b.x + b.width * 0.3, y: b.y + b.height * 0.7 };
        });
        await page.touchscreen.tap(r.x, r.y);
        await wait(300);
        const src = await page.$eval(sel('loc-status'), (el) => el.dataset.source);
        await press(page, 'edit-save', true);
        await page.waitForSelector(sel('spot-saved'), { timeout: 15000 }).catch(() => {});
        const moved = await api.getSpot(spot.id);
        record(
          'edit 390: ?map=atlas: the edit works on the atlas (tap → pin → save), no Mapbox load',
          atlas.ok && src === 'pin' && moved.locSource === 'pin' && !(near(moved.lat, spot.lat, 1e-4) && near(moved.lng, spot.lng, 1e-4)) && (await loads(page)) === 0,
          `atlas ${atlas.ok}, ${moved.lat?.toFixed(4)},${moved.lng?.toFixed(4)} (was ${spot.lat},${spot.lng})`,
        );
        noErrors(page, 'edit 390 atlas');
      } catch (e) {
        record('edit 390: offline / atlas failed', false, e.message.split('\n')[0]);
      } finally {
        await page.setOfflineMode(false).catch(() => {});
        await restore(spot);
      }
    }

    // ── 1440: two phones, then leaving with unsaved changes ──
    if (!phone) {
      try {
        await page.goto(`${base}/memories/${spot.id}/edit`, { waitUntil: 'networkidle2' });
        await page.waitForSelector(sel('edit-note'), { timeout: 15000 });
        await typeInto(page, 'edit-note', 'Typed on James’s phone.', false);
        await api.patchSpot(spot.id, { title: `${spot.title} (Justin)` }); // the other phone saves first
        await press(page, 'edit-save', false);
        const conflict = await page.waitForSelector(sel('edit-conflict'), { timeout: 10000 }).then((el) => el.evaluate((e) => e.textContent)).catch(() => '');
        record('edit 1440: a stale form gets "Justin changed this spot while you were editing" and Save waits', /Justin changed this spot/.test(conflict) && (await page.$eval(sel('edit-save'), (el) => el.disabled)), conflict);
        await shot(page, 'edit-conflict-1440');
        await press(page, 'edit-reload', false);
        await wait(200);
        const merged = { title: await value(page, 'edit-title'), note: await value(page, 'edit-note') };
        record('edit 1440: Reload brings their change in and keeps mine', merged.title === `${spot.title} (Justin)` && merged.note === 'Typed on James’s phone.', JSON.stringify(merged));
        await press(page, 'edit-save', false);
        await page.waitForSelector(sel('spot-saved'), { timeout: 15000 }).catch(() => {});
        const both = await api.getSpot(spot.id);
        record('edit 1440: saving after Reload keeps both changes', both.title === `${spot.title} (Justin)` && both.note === 'Typed on James’s phone.', `"${both.title}" / "${both.note}"`);
        await restore(spot);

        await page.goto(`${base}/memories/${spot.id}/edit`, { waitUntil: 'networkidle2' });
        await page.waitForSelector(sel('edit-title'), { timeout: 15000 });
        await typeInto(page, 'edit-title', 'never saved', false);
        const armed = await page.evaluate(() => {
          const e = new Event('beforeunload', { cancelable: true });
          window.dispatchEvent(e);
          return e.defaultPrevented;
        });
        await press(page, 'edit-back', false);
        const asks = await page.waitForSelector(sel('edit-leave-discard'), { timeout: 5000 }).then(() => true).catch(() => false);
        await shot(page, 'edit-leave-1440');
        await press(page, 'edit-leave-stay', false);
        const stayed = page.url().endsWith('/edit') && (await value(page, 'edit-title')) === 'never saved';
        await press(page, 'edit-back', false);
        await press(page, 'edit-leave-discard', false);
        const left = await page.waitForFunction((id) => location.pathname === `/memories/${id}`, { timeout: 10000 }, spot.id).then(() => true).catch(() => false);
        record('edit 1440: leaving with unsaved changes asks first (Back, and beforeunload), Discard leaves', armed && asks && stayed && left && (await api.getSpot(spot.id)).title === spot.title, `beforeunload ${armed}, asks ${asks}, stays ${stayed}, leaves ${left}`);
        // the 409 is the point of the conflict step; the browser logs any 4xx response as a console error
        page.problems = page.problems.filter((p) => !/status of 409/.test(p));
        noErrors(page, 'edit 1440 conflict + leave');
      } catch (e) {
        record('edit 1440: conflict / leave failed', false, e.message.split('\n')[0]);
      } finally {
        await restore(spot);
      }
    }
    await page.close();
    await ctx.close();
  }
}
