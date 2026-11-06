/**
 * /films/:slug — mounts one film's own route component, lazy, full screen.
 * Unknown slugs go back to the index. The black fallback is the colour every
 * film's gate opens on, so the chunk load never flashes the site's theme.
 */

import { Suspense } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { FILM_COMPONENTS } from './registry';

const BLACK = { position: 'fixed', inset: 0, background: '#000' };

export default function FilmPlayer() {
  const { slug } = useParams();
  const Film = FILM_COMPONENTS[slug];
  if (!Film) return <Navigate to="/films" replace />;
  return (
    <Suspense fallback={<div style={BLACK} />}>
      <Film key={slug} />
    </Suspense>
  );
}
