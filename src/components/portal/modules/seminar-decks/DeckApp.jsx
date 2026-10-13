import { lazy, Suspense, useCallback } from 'react';
import { usePortalRoute } from '../../portalRoute';
import { useDeckModule } from './engine/decks';
import { buildSequence } from './engine/sequence';
import { indexFromLabel, labelOf } from './engine/controller';
import Landing from './engine/Landing';
import DeckPage from './engine/DeckPage';
import './shared/fonts.css';
import './shared/engine.css';

/* ============================================================================
   SEMINAR DECKS — ROUTES (the portal sub-route after /portal/seminar-decks)
     (none)                     landing: the three decks, matrix, checklist
     <deck>                     deck page (slide sorter)
     <deck>/script|ready|downloads   deck page tabs
     <deck>/present             present mode from slide 1
     <deck>/<n> or <deck>/b<k>  present mode at main slide n or backup k
     <deck>/presenter           presenter view (opens the audience window)
     <deck>/audience            audience window (follows the presenter)
     <deck>/render/<slide-id>   one slide, finished state, for export and gates
     <deck>/phone               the transcript on a phone (decks with transcripts)
     __gates                    machine-readable deck summary for the gates
   ========================================================================== */

const PresentMode = lazy(() => import('./engine/PresentMode.jsx'));
const PresenterView = lazy(() => import('./engine/PresenterView.jsx'));
const RenderView = lazy(() => import('./engine/RenderView.jsx'));
const GatesView = lazy(() => import('./engine/GatesView.jsx'));
const PhoneView = lazy(() => import('./engine/PhoneView.jsx'));

const TABS = ['slides', 'script', 'ready', 'downloads'];

function Loading({ what = 'deck' }) {
  return <div className="pt-module"><p className="pt-module__intro">Loading the {what}...</p></div>;
}

export default function DeckApp() {
  const { sub, setSub } = usePortalRoute();
  const parts = sub.split('/').filter(Boolean);
  const slug = parts[0] && parts[0] !== '__gates' ? parts[0] : null;
  const deck = useDeckModule(slug);
  const go = useCallback((p, opts) => setSub(p, opts), [setSub]);

  if (parts[0] === '__gates') return <Suspense fallback={<Loading what="gates" />}><GatesView /></Suspense>;
  if (!slug) return <Landing go={go} />;
  if (deck instanceof Error) return <div className="pt-module"><p>Could not load this deck: {deck.message}</p></div>;
  if (!deck) return <Loading />;

  const { seq } = buildSequence(deck);
  const mode = parts[1] ?? 'slides';

  if (mode === 'render') {
    return <Suspense fallback={<Loading />}><RenderView deck={deck} slideId={parts[2]} /></Suspense>;
  }
  if (mode === 'phone') {
    return <Suspense fallback={<Loading what="phone script" />}><PhoneView deck={deck} /></Suspense>;
  }
  if (mode === 'presenter') {
    return (
      <Suspense fallback={<Loading what="presenter view" />}>
        <PresenterView deck={deck} onExit={() => go(deck.exitTo ?? deck.slug)} />
      </Suspense>
    );
  }
  if (mode === 'audience') {
    return (
      <Suspense fallback={<Loading what="audience window" />}>
        <PresentMode deck={deck} syncOn audience onExit={() => {}} />
      </Suspense>
    );
  }
  const presentAt = mode === 'present' ? 0 : TABS.includes(mode) ? -1 : indexFromLabel(seq, mode);
  if (presentAt >= 0) {
    return (
      <Suspense fallback={<Loading />}>
        <PresentMode
          deck={deck}
          initialIndex={presentAt}
          onExit={() => go(deck.exitTo ?? deck.slug)}
          onChange={(p) => go(`${deck.slug}/${labelOf(seq, p.index).toLowerCase()}`, { replace: true })}
        />
      </Suspense>
    );
  }
  return <DeckPage deck={deck} tab={TABS.includes(mode) ? mode : 'slides'} go={go} />;
}
