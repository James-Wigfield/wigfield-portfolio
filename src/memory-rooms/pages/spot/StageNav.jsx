/* Quiet links laid over the top of the stage: back to the map, and (when the
   spot belongs to a building) on to the whole building. */

import { Link } from 'react-router-dom';
import { COPY } from '../../copy.js';
import { paths } from '../../routes.js';
import { Arrow } from './icons.jsx';

export default function StageNav({ group, groupLabel }) {
  const copy = COPY.spot;
  return (
    <nav className="mr-stagenav">
      <Link className="mr-stagenav__link" to={paths.home()} aria-label={copy.backLabel}>
        <Arrow dir="left" />
        <span>{copy.back}</span>
      </Link>
      {group && (
        <Link className="mr-stagenav__link" to={paths.group(group)} aria-label={copy.groupLabel(groupLabel || group)}>
          <span>{copy.groupLink}</span>
          <Arrow dir="right" />
        </Link>
      )}
    </nav>
  );
}
