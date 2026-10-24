import { useState } from 'react';
import { Tex } from '../../kit';
import { Why } from './WhyText';

/* "Show the maths": a closed-by-default drawer under a game's stage holding
   the slide's equation with the item's current values. */
export function Maths({ children, label = 'Show the maths', open: openIn = false }) {
  const [open, setOpen] = useState(openIn);
  return (
    <div className="dla-maths">
      <button type="button" className="dla-maths__btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <span aria-hidden="true" style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', fontSize: '0.75em' }}>▾</span>
      </button>
      {open && <div className="dla-maths__body">{children}</div>}
    </div>
  );
}

export function MLine({ text, children }) {
  return <p className="dla-mline">{text && <Why text={text} />}{children}</p>;
}

export function MEq({ tex }) {
  return <div className="dla-meq"><Tex block src={tex} /></div>;
}
