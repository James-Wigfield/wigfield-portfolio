/* The spot page's "Walk in" (a lazy chunk): the link to /memories/:id/walk, and who's
   walking this room right now ("Justin is in this room"), from the room's Durable Object.
   Asked again every 15 s while the page is visible. */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { goWithTransition } from '../lib/transition.js';
import { COPY } from '../copy.js';
import { api } from '../lib/api.js';
import { personName } from '../lib/spots.js';
import { paths } from '../routes.js';

const EVERY_MS = 15000;

export default function WalkEntry({ spot, dive = null }) {
  const c = COPY.walk;
  const [people, setPeople] = useState([]);
  const navigate = useNavigate();
  // "Walk in" dives the camera into the room, then the page crossfades into the walk (view transition)
  const onWalk = (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const go = () => goWithTransition(navigate, paths.walk(spot.id));
    if (dive) dive().then(go, go);
    else go();
  };

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let ctl = null;
    let asking = false; // one request (and one timer) at a time, however often the tab is shown
    const ask = async () => {
      if (asking) return;
      asking = true;
      clearTimeout(timer);
      if (document.visibilityState === 'visible') {
        ctl = new AbortController();
        try {
          const res = await api.walkPresence(spot.id, { signal: ctl.signal });
          if (alive) setPeople(res?.people || []);
        } catch {
          /* offline / no room yet: just no line */
        }
      }
      asking = false;
      if (alive) timer = setTimeout(ask, EVERY_MS);
    };
    const onVisible = () => document.visibilityState === 'visible' && ask();
    ask();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      ctl?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [spot.id]);

  const names = [...new Set(people.map((p) => personName(p.who)))];
  return (
    <section className="mr-walkentry" data-mr="walk-entry">
      <Link
        to={paths.walk(spot.id)}
        onClick={onWalk}
        className="mr-btn mr-btn--primary mr-btn--lg mr-btn--block mr-walkentry__link"
        aria-label={c.linkLabel(spot.title)}
        data-mr="walk-link"
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="10" cy="4.2" r="1.8" fill="currentColor" />
          <path d="M10 7v5m0 0-2.6 5M10 12l2.6 5M6.5 9.5 10 8l3.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {c.link}
      </Link>
      {names.length > 0 && (
        <p className="mr-msg" data-tone="busy" data-mr="walk-here">
          {c.here(names)}
        </p>
      )}
    </section>
  );
}
