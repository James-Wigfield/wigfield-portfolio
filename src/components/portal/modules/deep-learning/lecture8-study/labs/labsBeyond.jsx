import { useRef, useState } from 'react';
import { Stage } from '../stage';
import { useStudy } from '../context';
import './labsBeyond.css';

/* ============================================================================
   §16 · BEYOND THE EXAM: A QUIET TIMELINE  (slides 46–49; NOT EXAMINED)
   ----------------------------------------------------------------------------
   Slide 47: "Materials from this slide onward are not covered in the exam".
   ViT (slide 46, examined) and what followed it on slides 47–48, then
   Hugging Face (slide 49), as dots on one line in the slides' order. Click a
   dot (or ← →) for its one line: the slide's facts, its footnote number.
   Dates are the slides' own words ("just two months later" …); nothing is
   placed on a time scale the slides don't give. Wide: a row; narrow: a
   column. Print lists every line.
   ========================================================================== */

const EVENTS = [
  { name: 'ViT', when: 'Oct 2020', slide: 46, fn: 10, line: 'Google researchers introduced a fully transformer-based vision model, called a vision transformer (ViT).' },
  { name: 'DeiT', when: '2 months later', slide: 47, fn: 11, line: 'Data-efficient image transformers (DeiTs), from a team of Facebook: a distillation technique reduces the number of training images required.' },
  { name: 'Perceiver', when: 'Mar 2021', slide: 47, fn: 12, line: 'DeepMind’s Perceiver: a multimodal transformer, which can handle text, images, audio, etc.' },
  { name: 'DINO', when: 'a month later', slide: 47, fn: 13, line: 'Caron et al.: a vision transformer trained entirely without labels and capable of high-accuracy semantic segmentation.' },
  { name: 'Scaling ViTs', when: '2021', slide: 48, fn: 14, line: 'Google showed how to scale ViTs up or down: a huge 2 billion parameter model reached over 90.4% top-1 accuracy on ImageNet; a scaled-down one reached over 84.8% using only 10,000 images, just 10 images per class.' },
  { name: 'Flamingo', when: 'Apr 2022', slide: 48, fn: 15, line: 'DeepMind: a family of models pretrained on a wide variety of tasks across multiple modalities, including text, images, and videos.' },
  { name: 'GATO', when: 'May 2022', slide: 48, fn: 16, line: 'DeepMind: a multimodal model that can be used as a policy for a reinforcement learning agent.' },
  { name: 'Hugging Face', when: 'today', slide: 49, fn: null, line: 'An AI company with an ecosystem of easy-to-use open source tools; its Transformers library downloads a pretrained model with its tokenizer, ready to fine-tune on your own dataset.' },
];

const source = (ev) => `slide ${ev.slide}${ev.fn ? ` · footnote ${ev.fn}` : ''}`;

export function TimelineLab() {
  const { printing } = useStudy();
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);
  const ev = EVENTS[sel];

  const move = (i) => {
    const n = Math.max(0, Math.min(EVENTS.length - 1, i));
    setSel(n);
    listRef.current?.querySelectorAll('.dl8s-tl__node')[n]?.focus();
  };
  const onKey = (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (d !== undefined) { e.preventDefault(); move(sel + d); }
    else if (e.key === 'Home') { e.preventDefault(); move(0); }
    else if (e.key === 'End') { e.preventDefault(); move(EVENTS.length - 1); }
  };

  return (
    <Stage
      title="After ViT: two fast years"
      slides="slides 46–49"
      tryThis="Predict which paper trained a vision transformer without labels, then click the dots to check."
      caption="**Not examined (slide 47)**: everything after ViT on this line is context only."
      own={null}
    >
      <div className="dl8s-tl">
        <ol ref={listRef} className="dl8s-tl__row" aria-label="Papers after ViT, in the slides’ order (arrow keys move along)" onKeyDown={onKey}>
          {EVENTS.map((e, i) => (
            <li key={e.name} className="dl8s-tl__item">
              <button
                type="button"
                className={`dl8s-tl__node${i === sel ? ' dl8s-tl__node--on' : ''}${i === 0 ? ' dl8s-tl__node--exam' : ''}`}
                aria-pressed={i === sel}
                tabIndex={i === sel ? 0 : -1}
                onClick={() => setSel(i)}
              >
                <span className="dl8s-tl__when">{e.when}</span>
                <span className="dl8s-tl__dot" aria-hidden="true" />
                <span className="dl8s-tl__name">{e.name}</span>
              </button>
            </li>
          ))}
        </ol>
        {printing ? (
          <dl className="dl8s-tl__all">
            {EVENTS.map((e) => (
              <div key={e.name}>
                <dt><b>{e.name}</b> <span className="dl8s-tl__src">{e.when} · {source(e)}</span></dt>
                <dd>{e.line}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="dl8s-tl__detail" aria-live="polite">
            <span className="dl8s-tl__head"><b>{ev.name}</b> <span className="dl8s-tl__src">{ev.when} · {source(ev)}{sel === 0 ? ' · examined' : ''}</span></span>
            <span>{ev.line}</span>
          </p>
        )}
      </div>
    </Stage>
  );
}
