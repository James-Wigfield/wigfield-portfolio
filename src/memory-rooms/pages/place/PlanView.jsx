/* A place's rooms drawn as a plan (from the sketch's rectangles) or marked on a
   floor-plan photo, each filled in once a spot has captured it. Read-only: the
   place page's checklist on the plan. Tapping a room picks it. */

import { COPY } from '../../copy.js';

const PAD = 0.6; // metres of paper around the drawn rooms

/** The drawn rooms of one level, framed: { rooms, box: [x0, z0, w, d] }. */
function frameRooms(rooms) {
  const drawn = rooms.filter((r) => r.room.rect);
  if (!drawn.length) return null;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const { room } of drawn) {
    const [x, z, w, d] = room.rect;
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x + w);
    z1 = Math.max(z1, z + d);
  }
  return { rooms: drawn, box: [x0 - PAD, z0 - PAD, x1 - x0 + 2 * PAD, z1 - z0 + 2 * PAD] };
}

export default function PlanView({ rooms, selected, onPick, north = null }) {
  const framed = frameRooms(rooms);
  if (!framed) return null;
  const [bx, bz, bw, bd] = framed.box;
  const copy = COPY.place;
  return (
    <svg className="mr-planview" viewBox={`${bx} ${bz} ${bw} ${bd}`} role="group" aria-label={copy.planLabel} data-mr="plan-view">
      <defs>
        <pattern id="mr-plangrid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
          <path d="M0.5 0 H0 V0.5" className="mr-planview__grid" />
        </pattern>
      </defs>
      <rect x={bx} y={bz} width={bw} height={bd} fill="url(#mr-plangrid)" />
      {framed.rooms.map(({ room, state }) => {
        const [x, z, w, d] = room.rect;
        const fs = Math.max(0.22, Math.min(0.42, Math.min(w, d) / 6));
        return (
          <g
            key={room.id}
            className="mr-planview__room"
            data-state={state}
            data-sel={selected === room.id ? '' : undefined}
            data-mr="plan-room"
            data-id={room.id}
            role="button"
            tabIndex={0}
            aria-label={copy.roomState(room.name, state)}
            onClick={() => onPick?.(room.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick?.(room.id))}
          >
            <rect x={x} y={z} width={w} height={d} />
            <text x={x + w / 2} y={z + d / 2} fontSize={fs}>
              {room.name}
            </text>
            <text className="mr-planview__state" x={x + w / 2} y={z + d / 2 + fs * 1.25} fontSize={fs * 0.62}>
              {copy.stateShort[state]}
            </text>
          </g>
        );
      })}
      {north != null && (
        <g className="mr-planview__north" transform={`translate(${bx + bw - 0.45} ${bz + 0.55}) rotate(${-north})`}>
          <path d="M0 -0.32 L0.14 0.22 L0 0.12 L-0.14 0.22 Z" />
          <text y="-0.38" fontSize="0.2">
            {COPY.titleBlock.north}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Rooms marked on a floor-plan photo: numbered marks, filled once captured. */
export function PhotoMarks({ url, rooms, selected, onPick }) {
  const marked = rooms.filter((r) => r.room.mark);
  const copy = COPY.place;
  return (
    <figure className="mr-planphoto" data-mr="plan-photo">
      <img src={url} alt={copy.planPhotoAlt} />
      {marked.map(({ room, state }, i) => (
        <button
          key={room.id}
          type="button"
          className="mr-planphoto__mark"
          data-state={state}
          data-sel={selected === room.id ? '' : undefined}
          style={{ left: `${room.mark.u * 100}%`, top: `${room.mark.v * 100}%` }}
          aria-label={copy.roomState(room.name, state)}
          onClick={() => onPick?.(room.id)}
        >
          <span className="mr-planphoto__n">{String(i + 1).padStart(2, '0')}</span>
          <span className="mr-planphoto__name">{room.name}</span>
        </button>
      ))}
    </figure>
  );
}
