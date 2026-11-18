/* The flyover's caption and controls, over either map (the page passes them in as the map's
   children). The caption is the stop: date · who, title, note (and its first photo when
   there's no 3D room); tapping it opens the spot. The bar: previous, play/pause, next, the
   stop counter, 1×/2×, exit. On a phone the bar sits at the bottom of the screen, under the
   thumb (the page gives the map the whole screen while the flyover runs). */

import { Link } from 'react-router-dom';
import { COPY } from '../../copy.js';
import { onMap } from '../geo.js';
import { personName, thumbOf } from '../../lib/spots.js';
import { paths } from '../../routes.js';
import './flyover.css';

const Icon = ({ d, fill = false }) => (
  <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    <path d={d} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const PLAY = 'M6.5 4.5v11l9-5.5z';
const PAUSE = 'M7 4.5v11M13 4.5v11';
const PREV = 'M14.5 5 8 10l6.5 5M5.5 5v10';
const NEXT = 'M5.5 5 12 10l-6.5 5M14.5 5v10';
const CLOSE = 'M5 5l10 10M15 5 5 15';

export default function FlyoverOverlay({ fly, engine }) {
  const c = COPY.fly;
  const { stop, index, count, phase, playing, speed, reduced } = fly;
  if (!stop) return null;
  const spot = stop.spot;
  const ended = phase === 'end';
  const showCaption = phase === 'linger' || ended;
  const thumb = !stop.rendered ? thumbOf(spot) : null;
  const meta = c.meta(COPY.spot.date(spot.capturedAt), personName(spot.createdBy));
  const off = engine === 'atlas' && !onMap(stop);

  return (
    <div
      className="mr-fly"
      data-mr="flyover"
      data-index={index}
      data-count={count}
      data-phase={phase}
      data-playing={playing ? '' : undefined}
      data-speed={speed}
      data-stop={stop.id}
      data-at={stop.at}
      data-rendered={stop.rendered ? '' : undefined}
      data-reduced={reduced ? '' : undefined}
    >
      {reduced && <div className="mr-fly__fade" data-on={phase === 'flying' && (playing || fly.stepping) ? '' : undefined} aria-hidden="true" />}

      {showCaption && !ended && (
        <Link key={stop.id} to={paths.spot(stop.id)} className="mr-fly__caption" aria-label={c.open(spot.title)} data-mr="fly-caption">
          {thumb?.url && <img className="mr-fly__thumb" src={thumb.url} alt="" />}
          <span className="mr-fly__text">
            <span className="mr-label mr-fly__meta">
              {meta}
              {off && ` · ${c.offMap}`}
            </span>
            <span className="mr-fly__title">{spot.title}</span>
            {spot.note && <span className="mr-fly__note">{spot.note}</span>}
          </span>
        </Link>
      )}
      {ended && (
        <div className="mr-fly__caption mr-fly__caption--end" data-mr="fly-end">
          <span className="mr-fly__text">
            <span className="mr-fly__title">{c.endTitle}</span>
            <span className="mr-fly__note">{c.endBody(count)}</span>
          </span>
        </div>
      )}

      <div className="mr-fly__bar" role="toolbar" aria-label={c.label}>
        <button type="button" className="mr-fly__btn" onClick={fly.prev} disabled={index === 0 && !ended} aria-label={c.prev} title={c.prev} data-mr="fly-prev">
          <Icon d={PREV} />
        </button>
        <button
          type="button"
          className="mr-fly__btn mr-fly__btn--main"
          onClick={fly.toggle}
          aria-label={ended ? c.again : playing ? c.pause : c.resume}
          title={ended ? c.again : playing ? c.pause : c.resume}
          data-mr="fly-toggle"
        >
          <Icon d={playing ? PAUSE : PLAY} fill={!playing} />
        </button>
        <button type="button" className="mr-fly__btn" onClick={fly.next} disabled={index >= count - 1} aria-label={c.next} title={c.next} data-mr="fly-next">
          <Icon d={NEXT} />
        </button>
        <span className="mr-label mr-fly__count" aria-live="polite" data-mr="fly-count">
          {c.counter(index + 1, count)}
        </span>
        <button type="button" className="mr-fly__btn mr-fly__speed" onClick={fly.toggleSpeed} aria-label={c.speedLabel(speed)} data-mr="fly-speed">
          {c.speed(speed)}
        </button>
        <button type="button" className="mr-fly__btn" onClick={fly.exit} aria-label={c.exitLabel} title={c.exit} data-mr="fly-exit">
          <Icon d={CLOSE} />
        </button>
      </div>
    </div>
  );
}

/** The "Play the trip" button over the map (top left). */
export function PlayButton({ onPlay, disabled }) {
  const c = COPY.fly;
  return (
    <button type="button" className="mr-fly-play" onClick={onPlay} disabled={disabled} aria-label={c.playLabel} data-mr="fly-play">
      <Icon d={PLAY} fill />
      {c.play}
    </button>
  );
}
