/* A quiet full-page message (not found, couldn't load): a mono label, one
   line, a sentence, and a way out. */

import { Link } from 'react-router-dom';
import { COPY } from '../../copy.js';
import { paths } from '../../routes.js';
import { Arrow } from './icons.jsx';

export default function PageMessage({ label, title, body, onRetry, retryLabel, dataState }) {
  return (
    <main className="mr-message" data-mr-page={dataState}>
      <div className="mr-message__inner">
        <span className="mr-label">{label}</span>
        <h1 className="mr-message__title">{title}</h1>
        {body && <p className="mr-message__body">{body}</p>}
        <div className="mr-message__actions">
          {onRetry && (
            <button type="button" className="mr-btn" onClick={onRetry}>
              {retryLabel}
            </button>
          )}
          <Link className="mr-btn mr-btn--quiet" to={paths.home()}>
            <Arrow dir="left" />
            {COPY.spot.backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
