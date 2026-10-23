import { useEffect, useMemo, useState } from 'react';
import manifest from './index.js';
import { useRound } from '../../kit/useRound';
import { RoundShell } from '../../kit/RoundShell';
import { rng } from '../../core/rng';
import { makeItems, makeModel } from '../../maths/latentSurfer';
import { INTRO, UI } from '../../content/latent-surfer';
import { FindStage, SampleStage, InterpStage, LossStage, FactStage } from './stages.jsx';
import './latent-surfer.css';

/* ============================================================================
   LATENT SURFER (Lectures 6–7, slides 10–18)
   ----------------------------------------------------------------------------
   The latent space of this page's own trained VAE (the Lectures 6–7 study
   page's run of slides 14–15's code; codings_size = 10), decoded live in the
   browser. A round mixes five stations:
     find      steer 2 of the 10 coding dimensions until the decode matches
               a target (graded by pixel MSE ≤ τ)
     sample    slide 14's Sampling: μ + exp(γ/2) · ε on the keypad
     mid/slot  semantic interpolation (slides 17–18): pick the decoded image
     interpT   where images[k] sits in np.linspace(…, 10)
     loss      slide 12's γ-form latent loss on the keypad, with the heat meter
     fact      a term / sign / wiring question
   The decoder (~228 KB) is dynamic-imported here, then the round is built.
   Items: maths/latentSurfer.js; words and receipts: content/latent-surfer.js.
   ========================================================================== */
let modelP = null;
const loadModel = () => (modelP ??= import('../../../lecture6-7-study/data/vae.js').then((m) => makeModel(m.VAE)));

export default function LatentSurfer(props) {
  const [load, setLoad] = useState({ model: null, error: null });
  useEffect(() => {
    let live = true;
    loadModel()
      .then((model) => { if (live) setLoad({ model, error: null }); })
      .catch((e) => {
        modelP = null;
        if (live) setLoad({ model: null, error: String(e?.message ?? e) });
      });
    return () => { live = false; };
  }, []);
  if (load.error) {
    return (
      <div className="dla-broken">
        <p className="dla-broken__msg">{UI.failed}</p>
        <button type="button" className="dla-btn" onClick={() => props.host?.onExit?.()}>{UI.back}</button>
      </div>
    );
  }
  if (!load.model) return <p className="dla-loading" role="status">{UI.loading}</p>;
  return <Game {...props} model={load.model} />;
}

function Game({ seed, level, mode, durationMs, onRoundEnd, host, model }) {
  const items = useMemo(() => makeItems(rng(seed), level, model), [seed, level, model]);
  const round = useRound({ gameId: manifest.id, seed, level, mode, durationMs, onRoundEnd, items });
  const item = round.current;
  return (
    <RoundShell game={manifest} round={round} host={host} intro={INTRO} stageClass="dla-ls">
      {item && <Station key={item.id} item={item} round={round} model={model} />}
    </RoundShell>
  );
}

function Station({ item, round, model }) {
  switch (item.type) {
    case 'find': return <FindStage item={item} round={round} model={model} />;
    case 'sample': return <SampleStage item={item} round={round} />;
    case 'mid':
    case 'slot':
    case 'interpT': return <InterpStage item={item} round={round} model={model} />;
    case 'loss': return <LossStage item={item} round={round} />;
    default: return <FactStage item={item} round={round} />;
  }
}
