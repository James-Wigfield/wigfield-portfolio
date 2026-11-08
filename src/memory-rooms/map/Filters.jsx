import { COPY } from '../copy.js';

const PEOPLE = ['all', 'james', 'justin'];
const STATUSES = ['all', 'captured', 'modelling', 'rendered'];

function Seg({ label, name, options, value, onChange, labelOf }) {
  return (
    <div className="mr-filter">
      <span className="mr-label">{label}</span>
      <div className="mr-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} data-mr={`filter-${name}`} data-value={o} onClick={() => onChange(o)}>
            {labelOf(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Filters({ person, status, onPerson, onStatus }) {
  return (
    <div className="mr-filters">
      <Seg
        label={COPY.list.person}
        name="person"
        options={PEOPLE}
        value={person}
        onChange={onPerson}
        labelOf={(o) => (o === 'all' ? COPY.list.all : COPY.app.people[o])}
      />
      <Seg
        label={COPY.list.status}
        name="status"
        options={STATUSES}
        value={status}
        onChange={onStatus}
        labelOf={(o) => (o === 'all' ? COPY.list.all : COPY.app.status[o])}
      />
    </div>
  );
}
