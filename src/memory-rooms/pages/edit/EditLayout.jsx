/* The edit page's "Photos and layout" (CONTRACTS.md 8): mark a spot's photos as old photos (freeform), give their
   era, and open the layout + viewpoint editor to sketch the room and place where each photo was taken, before
   or after a render. While the spot has a rendered room, its outline is drawn faintly under the editor. It is
   part of the edit form: the capture goes in the same PATCH (ifUpdatedAt, 409) and the same sessionStorage draft. */

import { Suspense, lazy, useMemo, useState } from 'react';
import { COPY } from '../../copy.js';
import { mediaOf } from '../../lib/api.js';
import { useMedia } from '../../lib/useMedia.js';
import { resolveShell } from '../../scene/shell.js';

const LayoutEditor = lazy(() => import('../../capture/layout/LayoutEditor.jsx'));

/** The rendered room's outline in the scene frame (a box or a polygon; a room of a building has none here). */
function guideOf(scene) {
  try {
    const sh = scene ? resolveShell(scene) : null;
    return sh?.outline?.length >= 3 ? sh.outline : null;
  } catch {
    return null;
  }
}

export default function EditLayout({ spot, capture, onChange }) {
  const c = COPY.layout;
  const narrow = useMedia('(max-width: 819px)');
  const [open, setOpen] = useState(false);
  const freeform = capture?.mode === 'freeform';
  const photos = useMemo(() => {
    const thumbs = new Map(mediaOf(spot, 'thumb').map((m) => [m.name, m]));
    return mediaOf(spot, 'photo')
      .map((m) => ({ n: Number(m.name), url: thumbs.get(m.name)?.url || m.url, full: m.url, width: m.width, height: m.height, exif: m.exif || null, caption: capture?.captions?.[m.name] || '' }))
      .sort((a, b) => a.n - b.n);
  }, [spot, capture?.captions]);
  const guide = useMemo(() => guideOf(spot?.scene), [spot?.scene]);
  if (!photos.length) return null;
  const views = capture?.views?.length || 0;

  return (
    <section className="mr-edit-sec mr-edit-layout" data-mr="edit-layout">
      <h2 className="mr-label">{c.editTitle}</h2>
      <p className="mr-field-hint">{c.editLede}</p>
      <label className="mr-oldtoggle" data-mr="edit-freeform">
        <input type="checkbox" checked={freeform} onChange={(e) => onChange({ ...(capture || {}), mode: e.target.checked ? 'freeform' : 'guided' })} />
        <span className="mr-oldtoggle__text">
          <span className="mr-oldtoggle__label">{COPY.freeform.toggle}</span>
          <span className="mr-field-hint">{COPY.freeform.toggleHint}</span>
        </span>
      </label>
      {freeform && (
        <label className="mr-field">
          <span className="mr-label">{c.eraLabel}</span>
          <input className="mr-input" type="text" maxLength={60} value={capture?.era || ''} placeholder={COPY.freeform.eraPlaceholder} onChange={(e) => onChange({ ...capture, era: e.target.value })} data-mr="edit-era" />
        </label>
      )}
      <p className="mr-dot" data-tone={views || capture?.layout ? 'ok' : 'idle'}>
        {COPY.freeform.sketched(views, Boolean(capture?.layout))}
      </p>
      {open ? (
        <Suspense fallback={<p className="mr-state-body">{COPY.app.loading}</p>}>
          {guide && <p className="mr-field-hint">{c.guideNote}</p>}
          <LayoutEditor
            value={{ layout: capture?.layout || null, views: capture?.views || [] }}
            photos={photos}
            guide={guide}
            onChange={(next) => onChange({ ...(capture || { mode: 'guided' }), layout: next.layout, views: next.views })}
            compact={narrow}
          />
        </Suspense>
      ) : (
        <button type="button" className="mr-btn" onClick={() => setOpen(true)} data-mr="edit-layout-open">
          {c.editOpen}
        </button>
      )}
    </section>
  );
}
