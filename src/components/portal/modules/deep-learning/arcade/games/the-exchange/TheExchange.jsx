import { useEffect, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell, Prompt, Feedback } from '../../kit/RoundShell';
import { Keypad } from '../../kit/Keypad';
import { Choice } from '../../kit/Choice';
import { Why } from '../../kit/WhyText';
import { rng } from '../../core/rng';
import { makeItems, plugsToWeights } from '../../maths/theExchange';
import { COPY } from '../../content/the-exchange';
import { loadToyMT } from '../../../lecture8-study/toyMT';
import { Token, Beam } from '../../../lecture8-study/svgParts';
import './the-exchange.css';

/* ============================================================================
   THE EXCHANGE (Lecture 8) — a 1940s telephone switchboard
   ----------------------------------------------------------------------------
   Level 1  one cable: the plain encoder–decoder hands over one final state
            (choice items on slides 5, 18–21), then the patch board: patch
            the decoder's query into the English keys; each plug's
            brightness is its weight; graded against the toy transformer's
            real cross-attention (maths/theExchange.js)
   Level 2  the Bahdanau and Luong desks: alignment model, aliases, the
            three Luong scores, Keras layers, queries/keys/values, plus
            softmax / dot-product / weighted-sum arithmetic by hand
   Level 3  the transformer floor: √d_keys scaling, the causal mask (future
            sockets locked), the multi-head pipeline order, self- vs
            cross-attention patching, shapes
   The toy transformer (lecture8-study/toyMT.js + data) loads lazily; until
   it arrives the round is not mounted (a loading line shows instead).
   ========================================================================== */
const INTRO = { line: COPY.intro, controls: COPY.controls };
const CYCLE = { off: 'dim', dim: 'bright', bright: 'off' };
const fmtAns = (a, it) => (it.kind === 'choice' ? (it.choices.find((c) => c.value === a)?.label ?? String(a)) : typeof a === 'number' ? String(Math.round(a * 100) / 100) : it.format ? it.format(a) : String(a));

export default function TheExchange(props) {
  const [model, setModel] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadToyMT().then((m) => { if (live) setModel(m); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  if (!model && !failed) return <p className="dla-loading"><span className="dla-dot" />connecting the exchange (loading the toy transformer)…</p>;
  return <ExchangeRound {...props} model={model} />;
}

function ExchangeRound({ seed, level, mode, durationMs, onRoundEnd, host, model }) {
  const items = useMemo(() => makeItems(rng(seed), level, model), [seed, level, model]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-xc">
      {item && <ItemStage key={item.id} item={item} round={round} />}
    </RoundShell>
  );
}

function ItemStage({ item, round }) {
  const live = !round.feedback && round.state === 'play';
  const [value, setValue] = useState('');
  const [plugs, setPlugs] = useState(() => (item.board ? item.board.keys.map(() => 'off') : []));
  const [order, setOrder] = useState(() => (item.order ? item.order.start.slice() : []));

  const submitNumber = () => { if (value !== '') round.submit(Number(value)); };
  const submitPatch = () => { if (plugs.some((p) => p !== 'off')) round.submit(plugsToWeights(plugs)); };
  const cycle = (j) => setPlugs((p) => p.map((x, k) => (k === j ? CYCLE[x] : x)));

  // keyboard: digits cycle sockets / move order cards; Enter connects
  useEffect(() => {
    if (!live || (!item.board && !item.order)) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (item.board && n >= 1 && n <= plugs.length) { e.preventDefault(); cycle(n - 1); }
      else if (item.order && n >= 1 && n <= order.length) { e.preventDefault(); setOrder((o) => moveUp(o, n - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (item.board) submitPatch(); else if (item.order) round.submit(order); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="dla-floor dla-xc__floor">
        {item.board
          ? <Board board={item.board} plugs={plugs} onCycle={live ? cycle : null} real={round.feedback ? item.answer : null} />
          : <Lobby level={round.level} />}
      </div>
      <div className="dla-stagegrid">
        <div>
          <Prompt k={`${round.index + 1} / ${round.total}${item.beyond ? ' · beyond the slides' : ''}`}>
            {typeof item.question === 'string' && item.question.includes('$') ? <Why text={item.question} /> : item.question}
          </Prompt>
          <Feedback feedback={round.feedback} format={fmtAns} />
          {item.kind === 'choice' && (
            <Choice choices={item.choices} onPick={(v) => round.submit(v)} picked={round.feedback ? round.feedback.given : null} answer={round.feedback ? item.answer : null} active={live} columns={1} />
          )}
          {item.board && (
            <div className="dla-xc__patchbar">
              <span className="dla-k">{item.board.mode === 'cross' ? COPY.patchCross : COPY.patchSelf}</span>
              <button type="button" className="dla-btn dla-btn--primary" onClick={submitPatch} disabled={!live || !plugs.some((p) => p !== 'off')}>
                Connect <span className="dla-btn__key">Enter</span>
              </button>
            </div>
          )}
          {item.order && (
            <OrderCards steps={item.order.steps} order={order} onMove={(k) => live && setOrder((o) => moveUp(o, k))} onSubmit={() => live && round.submit(order)} disabled={!live} />
          )}
        </div>
        {item.kind === 'number' && (
          <Keypad value={value} onChange={setValue} onSubmit={submitNumber} decimal={!!item.decimal} negative={!!item.negative} disabled={!live} active={live} label="Your answer" />
        )}
      </div>
      {item.board && <p className="dla-own">{COPY.own}</p>}
    </>
  );
}

const moveUp = (o, k) => (k <= 0 ? o : [...o.slice(0, k - 1), o[k], o[k - 1], ...o.slice(k + 1)]);

/* ── the patch board ─────────────────────────────────────────────────────── */
function Board({ board, plugs, onCycle, real }) {
  const n = board.keys.length;
  const W = Math.max(360, n * 82 + 48);
  const H = 270;
  const kx = (j) => 40 + ((W - 80) / Math.max(1, n - 1)) * j;
  const qx = W / 2;
  const ky = 62;
  const qy = 218;
  const w = plugsToWeights(plugs);
  const any = plugs.some((p) => p !== 'off');
  const label = `Patch board: query “${board.query}”${board.produces ? ` producing “${board.produces}”` : ''}; keys ${board.keys.join(', ')}; plugs ${plugs.join(', ')}${real ? `; the toy’s real weights ${real.join(', ')}` : ''}`;
  return (
    <svg className="dl8s-svg dla-xc__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: W }}>
      <text x={8} y={13} className="dla-t dla-t--xs dla-t--m">{board.mode === 'cross' ? 'KEYS · encoder (English)' : 'KEYS · the same sentence'}</text>
      <text x={8} y={H - 4} className="dla-t dla-t--xs dla-t--m">{board.mode === 'cross' ? 'QUERY · decoder (Spanish)' : 'QUERY · encoder word'}</text>
      {/* the player's cables */}
      {board.keys.map((k, j) => (any ? <Beam key={`b${j}`} x1={qx} y1={qy - 16} x2={kx(j)} y2={ky + 16} w={w[j]} max={18} min={0} role="q" className={plugs[j] === 'off' ? 'dl8s-hide' : ''} /> : null))}
      {/* the toy's real cables after the answer */}
      {real && board.keys.map((k, j) => <Beam key={`r${j}`} x1={qx + 6} y1={qy - 16} x2={kx(j) + 6} y2={ky + 16} w={real[j]} max={14} min={0.5} role="k" className="dla-xc__real" />)}
      {board.keys.map((k, j) => (
        <g key={k + j}>
          <circle className={`dla-xc__lamp dla-xc__lamp--${plugs[j]}`} cx={kx(j)} cy={ky - 27} r={5.5} />
          <Token x={kx(j)} y={ky} w={Math.min(80, (W - 80) / Math.max(1, n - 1) - 8)} h={30} word={k} role={board.mode === 'cross' ? 'enc' : 'k'} on={plugs[j] !== 'off'} onPick={onCycle ? () => onCycle(j) : undefined} label={`${j + 1}: socket “${k}”, plug ${plugs[j]}; press to cycle`} />
          {real && <text x={kx(j)} y={ky + 32} textAnchor="middle" className="dla-t dla-t--xs dla-t--m">{real[j].toFixed(2)}</text>}
        </g>
      ))}
      <Token x={qx} y={qy} w={Math.min(150, board.query.length * 13 + 44)} h={32} word={board.query} role={board.mode === 'cross' ? 'dec' : 'q'} on />
      {board.produces && <text x={qx} y={qy + 34} textAnchor="middle" className="dla-t dla-t--s">→ {board.produces}</text>}
    </svg>
  );
}

/* ── the idle picture for non-patch items: one cable from the last encoder cell */
function Lobby({ level }) {
  const words = ['I', 'like', 'soccer'];
  const out = ['⟨SOS⟩', 'me', 'gusta', 'el', 'fútbol'];
  const W = 560;
  const H = 150;
  return (
    <svg className="dl8s-svg dla-xc__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The encoder–decoder: the English words go into the encoder; one cable carries its final state to the decoder, which produces the Spanish words." style={{ maxWidth: W }}>
      <text x={20} y={18} className="dla-t dla-t--xs dla-t--m">ENCODER</text>
      {words.map((wd, i) => <Token key={wd} x={60 + i * 80} y={56} w={66} h={28} word={wd} role="enc" />)}
      <path className="dl8s-wire dl8s-wire--on" d={`M${60 + 2 * 80 + 33} 56 H 300 V 110 H 320`} />
      <text x={262} y={48} className="dla-t dla-t--xs">final state</text>
      <text x={330} y={18} className="dla-t dla-t--xs dla-t--m">DECODER</text>
      {out.map((wd, i) => <Token key={wd} x={360 + i * 48} y={110} w={44} h={26} word={wd} role="dec" ghost={level === 1 && i > 2} />)}
    </svg>
  );
}

function OrderCards({ steps, order, onMove, onSubmit, disabled }) {
  return (
    <div className="dla-xc__order" role="group" aria-label="Pipeline order: press a card to move it up one place">
      {order.map((k, i) => (
        <button key={k} type="button" className="dla-xc__card" onClick={() => onMove(i)} disabled={disabled || i === 0} aria-label={`${i + 1}: ${steps[k]}; move up`}>
          <span className="dla-choice__n" aria-hidden="true">{i + 1}</span>
          <span>{steps[k]}</span>
          {i > 0 && <span className="dla-xc__up" aria-hidden="true">▲</span>}
        </button>
      ))}
      <button type="button" className="dla-btn dla-btn--primary" onClick={onSubmit} disabled={disabled}>Connect <span className="dla-btn__key">Enter</span></button>
    </div>
  );
}
