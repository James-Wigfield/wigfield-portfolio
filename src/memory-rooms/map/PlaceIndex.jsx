/* Whole places in the map's index, under the spots: each place's name in the
   serif and how many of its rooms are captured, linking to its page (the room
   checklist, later the building). The server's places plus any still only on
   this phone. Nothing shows until there is a place. */

import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import { usePlaces } from '../lib/places.js';
import { paths } from '../routes.js';

export default function PlaceIndex({ spots }) {
  const places = usePlaces();
  if (!places.length) return null;
  return (
    <section className="mr-list-group mr-placeindex" data-mr="place-index">
      <h3 className="mr-label mr-list-group-title">{COPY.list.places}</h3>
      <ul className="mr-list-rows">
        {places.map((p) => {
          const rooms = p.sketch?.rooms || [];
          const ids = new Set(rooms.map((r) => r.id));
          const done = new Set(spots.filter((s) => s.buildingId === p.id && s.roomId && ids.has(s.roomId)).map((s) => s.roomId)).size;
          return (
            <li key={p.id}>
              <Link className="mr-row mr-placerow" to={paths.place(p.id)} data-mr="place-row" data-id={p.id}>
                <svg className="mr-placerow__glyph" viewBox="0 0 56 44" aria-hidden="true">
                  <path d="M6 38 V8 H50 V38 Z" />
                  <path d="M28 8 V24 H50 M6 24 H20 M28 30 V38" />
                </svg>
                <span className="mr-row-main">
                  <span className="mr-row-title">{p.title || COPY.place.label}</span>
                  <span className="mr-row-sub">
                    {[p.placeLabel, COPY.place.progress(done, rooms.length), p.local ? COPY.place.onPhone : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
