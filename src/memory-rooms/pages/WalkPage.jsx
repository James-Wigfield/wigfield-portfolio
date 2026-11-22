/* /memories/:spotId/walk: walk around a spot's 3D room as your character, together
   with whoever else is in it right now (walk/WalkGame.js draws and moves; walk/net.js
   is the room's socket; the Durable Object is workers/memory-walk.js).
   /memories/b/:buildingId/walk (PlaceWalkPage): the same game through a whole place, every level and the
   stairs between them; you see the people on your level, and a line says who is up or down the stairs.

   You're the person picked at the gate (mr:who). Offline (or the socket lost), you keep
   walking alone and one line says so; others reappear when the connection is back. */

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COPY } from '../copy.js';
import { api } from '../lib/api.js';
import { mediaNamed } from '../lib/api.js';
import { personName, roomModelOf } from '../lib/spots.js';
import { roomFrame } from '../building/geometry.js';
import { readWho } from '../lib/storage.js';
import { paths } from '../routes.js';
import PageMessage from './spot/PageMessage.jsx';
import { spotPhotos } from './spot/photos.js';
import { WalkGame } from '../walk/WalkGame.js';
import { WalkNet } from '../walk/net.js';
import '../walk/walk.css';

const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export default function WalkPage() {
  const { spotId } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState(null);
  const key = `${spotId}#${attempt}`;

  useEffect(() => {
    let alive = true;
    api.getSpot(spotId).then(
      (spot) => alive && setRes({ key, kind: spot && !spot.deletedAt ? 'ok' : 'missing', spot }),
      (error) => alive && setRes({ key, kind: error?.status === 404 || error?.status === 400 ? 'missing' : 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [spotId, key]);

  const c = COPY.walk;
  const current = res?.key === key ? res : null;
  if (!current) return <div className="mr-walk" data-state="loading" role="status" aria-label={c.loading} />;
  if (current.kind === 'missing') return <PageMessage dataState="missing" label={COPY.spot.missingLabel} title={COPY.spot.missingTitle} body={COPY.spot.missingBody} />;
  if (current.kind === 'error')
    return (
      <PageMessage
        dataState="error"
        label={COPY.spot.errorLabel}
        title={COPY.spot.errorTitle}
        body={current.error?.message === 'offline' ? COPY.spot.errorOffline : null}
        retryLabel={COPY.spot.retry}
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  const model = roomModelOf(current.spot);
  if (!model?.url) return <PageMessage dataState="noroom" label={COPY.walk.back} title={c.noRoomTitle} body={c.noRoom} />;
  const spot = current.spot;
  return (
    <Walk
      key={spot.id}
      title={spot.title}
      back={{ to: paths.spot(spot.id), text: c.back, label: c.backLabel }}
      net={{ spotId: spot.id }}
      load={(game) => game.load({ glbUrl: model.url, scene: spot.scene, photos: spotPhotos(spot) })}
    />
  );
}

/** /memories/b/:buildingId/walk: the whole place, once it has been built (its plan + level models). */
export function PlaceWalkPage() {
  const { buildingId } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [res, setRes] = useState(null);
  const key = `${buildingId}#${attempt}`;
  useEffect(() => {
    let alive = true;
    Promise.all([api.getBuilding(buildingId), api.listSpots()]).then(
      ([place, spots]) => alive && setRes({ key, kind: place && !place.deletedAt ? 'ok' : 'missing', place, spots: (spots || []).filter((s) => s.buildingId === buildingId && !s.deletedAt) }),
      (error) => alive && setRes({ key, kind: error?.status === 404 || error?.status === 400 ? 'missing' : 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [buildingId, key]);

  const c = COPY.walk;
  const current = res?.key === key ? res : null;
  if (!current) return <div className="mr-walk" data-state="loading" role="status" aria-label={c.loadingPlace} />;
  if (current.kind === 'missing') return <PageMessage dataState="missing" label={COPY.place.label} title={COPY.place.missingTitle} body={COPY.place.missingBody} />;
  if (current.kind === 'error')
    return (
      <PageMessage
        dataState="error"
        label={COPY.place.label}
        title={COPY.place.errorTitle}
        body={current.error?.message === 'offline' ? COPY.place.offline : null}
        retryLabel={COPY.place.retry}
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  const { place, spots } = current;
  const plan = place.plan;
  const url = (name) => mediaNamed(place, 'model', name)?.url || null;
  const levels = (plan?.levels || [])
    .map((l) => ({ id: l.id, name: l.name || l.id, elevation: l.elevation, height: l.height, glbUrl: url(`level-${l.id}`) }))
    .filter((l) => l.glbUrl)
    .sort((a, b) => a.elevation - b.elevation);
  if (!levels.length) return <PageMessage dataState="noroom" label={c.backPlace} title={c.noRoomTitle} body={c.noPlace} />;
  // every captured room: its scene (photo cameras, seats) and photos, with its room frame's origin in the plan
  const rooms = plan.rooms
    .map((r) => {
      const spot = spots.find((s) => s.roomId === r.id && s.scene);
      return spot ? { id: r.id, level: r.level, origin: roomFrame(plan, r).origin, scene: spot.scene, photos: spotPhotos(spot) } : null;
    })
    .filter(Boolean);
  return (
    <Walk
      key={place.id}
      title={place.title}
      back={{ to: paths.place(place.id), text: c.backPlace, label: c.backPlaceLabel }}
      net={{ placeId: place.id }}
      load={(game) => game.loadPlace({ building: plan, levels, exteriorUrl: url('exterior'), rooms })}
    />
  );
}

function Walk({ title, back, net: netOpts, load }) {
  const c = COPY.walk;
  const stageRef = useRef(null);
  const gameRef = useRef(null);
  const netRef = useRef(null);
  const chatRef = useRef(null);
  const [who] = useState(() => readWho() || 'james');
  const [state, setState] = useState('loading');
  const [status, setStatus] = useState('connecting');
  const [others, setOthers] = useState({}); // id → who
  const [note, setNote] = useState(null); // { text, n }
  const [hint, setHint] = useState(null);
  const [view, setView] = useState('third');
  const [chatOpen, setChatOpen] = useState(false);
  const [text, setText] = useState('');
  const [touch] = useState(isTouch);

  const [levels, setLevels] = useState(null); // a place: { name, away: [{ who, where, name }] }
  useEffect(() => {
    document.title = `${c.pageTitle(title)} · ${COPY.app.name}`;
  }, [title, c]);
  const loadRef = useRef(load);
  const netKey = netOpts.spotId || `b:${netOpts.placeId}`;

  useEffect(() => {
    const stage = stageRef.current;
    const game = new WalkGame(stage, { who });
    gameRef.current = game;
    game.setNames(COPY.app.people);
    let myId = null;
    const say = (text) => setNote((n) => ({ text, n: (n?.n || 0) + 1 }));
    const net = new WalkNet({
      ...(netOpts.placeId ? { placeId: netOpts.placeId } : { spotId: netOpts.spotId }),
      who,
      on: {
        hello: (m) => {
          myId = m.id;
          for (const id of [...game.peers.keys()]) game.removePeer(id);
          for (const p of m.people || []) game.addPeer(p);
          setOthers(Object.fromEntries((m.people || []).map((p) => [p.id, p.who])));
          game.sendLocal(true);
        },
        join: ({ person }) => {
          game.addPeer(person);
          setOthers((o) => ({ ...o, [person.id]: person.who }));
          say(c.joined(personName(person.who)));
        },
        leave: ({ id, who: w }) => {
          game.removePeer(id);
          setOthers((o) => {
            const next = { ...o };
            delete next[id];
            return next;
          });
          say(c.left(personName(w)));
        },
        state: (m) => game.peerState(m),
        emote: (m) => game.peerEmote(m.id, m.e),
        chat: (m) => m.id !== myId && game.say(m.id, m.text),
        correct: (m) => game.correct(m.p),
        status: setStatus,
        lost: () => {
          for (const id of [...game.peers.keys()]) game.removePeer(id);
          setOthers({});
        },
      },
    });
    netRef.current = net;
    stage.__walkNet = net; // the headless check drops the socket through this
    const offs = [
      game.on('ready', () => setState('ready')),
      game.on('error', () => setState('error')),
      game.on('local', (s) => net.send({ t: 'state', ...s })),
      game.on('emote', ({ e }) => net.send({ t: 'emote', e })),
      game.on('hint', setHint),
      game.on('view', (v) => setView(v.view)),
      game.on('levels', setLevels),
    ];
    const ro = new ResizeObserver(([e]) => game.setSize(e.contentRect.width, e.contentRect.height));
    ro.observe(stage);
    loadRef.current(game);
    net.start();
    return () => {
      ro.disconnect();
      for (const off of offs) off();
      net.stop();
      game.dispose();
      delete stage.__walkNet;
      gameRef.current = null;
      netRef.current = null;
    };
    // the walk is made once per place / spot (its key); `load` and `netOpts` are fixed for it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netKey, who, c]);

  // Enter opens the chat line (when not already typing); Escape closes it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && !chatOpen && !e.target?.closest?.('input, textarea, button, a')) {
        e.preventDefault();
        setChatOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chatOpen]);
  useEffect(() => {
    if (chatOpen) chatRef.current?.focus();
  }, [chatOpen]);

  const send = (e) => {
    e.preventDefault();
    const line = text.trim().slice(0, 80);
    if (line) {
      gameRef.current?.say('me', line);
      netRef.current?.send({ t: 'chat', text: line });
    }
    setText('');
    setChatOpen(false);
  };

  const names = Object.values(others).map(personName);
  const line = status === 'live' ? c.live([...new Set(names)]) : status === 'offline' ? c.offline : status === 'retrying' ? c.retrying : c.connecting;
  const hintText = hint
    ? hint.kind === 'seat'
      ? touch
        ? c.hint.seatTouch(hint.seat)
        : c.hint.seat(hint.seat)
      : hint.kind === 'stand'
        ? touch
          ? c.hint.standTouch
          : c.hint.stand
        : hint.kind === 'photo'
          ? c.hint.photo(hint.photo)
          : c.hint.mark
    : null;
  const act = hint ? (hint.kind === 'seat' ? c.interact.seat(hint.seat) : c.interact[hint.kind]) : null;
  const g = () => gameRef.current;

  return (
    <div className="mr-walk" data-state={state} data-status={status} data-touch={touch ? '' : undefined}>
      <div className="mr-walk__stage" ref={stageRef} />

      <header className="mr-walk__top">
        <Link to={back.to} className="mr-btn mr-walk__back" aria-label={back.label} data-mr="walk-back">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {back.text}
        </Link>
        <div className="mr-walk__where">
          <span className="mr-walk__title">
            {title}
            {levels?.name && (
              <span className="mr-label mr-walk__level" data-mr="walk-level">
                {' · '}
                {levels.name}
              </span>
            )}
          </span>
          <span className="mr-dot mr-label" data-tone={status === 'live' ? 'ok' : status === 'offline' ? 'danger' : 'busy'} data-mr="walk-status">
            {line}
          </span>
        </div>
      </header>

      <div className="mr-walk__lines" aria-live="polite">
        {note && (
          <p key={note.n} className="mr-walk__note" data-mr="walk-note">
            {note.text}
          </p>
        )}
        {levels?.away?.length > 0 && (
          <p className="mr-walk__note" data-mr="walk-away">
            {c.away(levels.away.map((a) => ({ name: personName(a.who), where: a.where, level: a.name })))}
          </p>
        )}
        {state === 'ready' && hintText && !(touch && hint?.kind === 'seat') && (
          <p className="mr-walk__hint" data-mr="walk-hint">
            {hintText}
          </p>
        )}
        {state === 'loading' && <p className="mr-walk__hint">{c.loading}</p>}
        {state === 'error' && (
          <p className="mr-walk__hint" data-tone="danger">
            {c.error}
          </p>
        )}
      </div>

      <footer className="mr-walk__bar">
        {chatOpen ? (
          <form className="mr-walk__chat" onSubmit={send}>
            <input
              ref={chatRef}
              className="mr-input"
              value={text}
              maxLength={80}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setChatOpen(false)}
              onBlur={() => !text && setChatOpen(false)}
              placeholder={c.chatPlaceholder}
              aria-label={c.chatLabel}
              enterKeyHint="send"
              data-mr="walk-chat-input"
            />
            <button type="submit" className="mr-btn mr-btn--primary" data-mr="walk-chat-send">
              {c.send}
            </button>
          </form>
        ) : (
          <>
            {!touch && <p className="mr-walk__keys mr-label">{c.keys}</p>}
            {touch && <p className="mr-walk__keys mr-label">{c.touch}</p>}
            <div className="mr-walk__buttons" role="group" aria-label={c.emotesLabel}>
              {act && (
                <button type="button" className="mr-btn mr-btn--primary" onClick={() => g()?.interact()} data-mr="walk-interact">
                  {act}
                </button>
              )}
              {['wave', 'jump', 'sit'].map((e) => (
                <button key={e} type="button" className="mr-btn" onClick={() => g()?.emote(e)} data-mr={`walk-emote-${e}`}>
                  {c.emotes[e]}
                </button>
              ))}
              <button type="button" className="mr-btn" onClick={() => setChatOpen(true)} data-mr="walk-chat">
                {c.chat}
              </button>
              <button type="button" className="mr-btn" onClick={() => g()?.toggleView()} aria-pressed={view === 'first'} data-mr="walk-view">
                {view === 'first' ? c.view.third : c.view.first}
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  );
}
