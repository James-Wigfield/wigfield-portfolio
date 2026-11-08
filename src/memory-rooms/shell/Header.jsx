import { Link } from 'react-router-dom';
import { COPY } from '../copy.js';
import { paths } from '../routes.js';

export default function Header({ page, who, onChangeWho }) {
  return (
    <header className="mr-header">
      <Link to={paths.home()} className="mr-wordmark" aria-label={COPY.app.home}>
        {COPY.app.name}
      </Link>
      <div className="mr-header-actions">
        {page !== 'new' && (
          <Link to={paths.capture()} className="mr-btn mr-btn--primary mr-header-new" data-mr="new-spot">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="mr-header-new-long">{COPY.app.newSpot}</span>
            <span className="mr-header-new-short">{COPY.app.newSpotShort}</span>
          </Link>
        )}
        <button type="button" className="mr-person" onClick={onChangeWho} aria-label={COPY.app.changePerson} title={COPY.app.changePerson} data-mr="who">
          <span className="mr-label">{COPY.app.holding}</span>
          <span className="mr-person-name">{who ? COPY.app.people[who] : '—'}</span>
        </button>
      </div>
    </header>
  );
}
