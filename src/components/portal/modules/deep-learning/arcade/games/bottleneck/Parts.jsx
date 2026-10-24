import { Prompt, Feedback } from '../../kit/RoundShell';
import { Maths, MLine, MEq } from '../../kit/Maths';
import { receipt, fmtAnswer } from '../../kit/why';
import { WORDS } from '../../content/bottleneck';

/* Bottleneck — shared bits: the prompt strip with the stage tag, the
   feedback line, and the "Show the maths" drawer lines (content/bottleneck.js
   drawer entries: { kind: 'text' | 'eq' | 'code', text | tex, src, beyond }). */

export function StageHead({ item, round }) {
  return (
    <div className="dla-bn__head">
      <Prompt k={`${item.tag} · ${round.index + 1} / ${round.total}`} sub={item.sub}>{item.prompt}</Prompt>
      <Feedback feedback={round.feedback} format={(a, it) => fmtAnswer(it, a)} />
    </div>
  );
}

function Receipt({ line }) {
  return (
    <span className="dla-bn__rcpt">
      {receipt(line.src)}
      {line.beyond && <span className="dla-bn__beyond" title={line.note}> · {WORDS.beyond}</span>}
    </span>
  );
}

export function Lines({ lines, extra = null }) {
  return (
    <Maths label={WORDS.drawer}>
      {lines.map((l, i) => {
        if (l.kind === 'eq') return <div key={i} className="dla-bn__mrow"><MEq tex={l.tex} /><Receipt line={l} /></div>;
        if (l.kind === 'code') return <p key={i} className="dla-mline"><code className="dla-code dla-bn__mcode">{l.text}</code> <Receipt line={l} /></p>;
        return <MLine key={i} text={l.text}> <Receipt line={l} /></MLine>;
      })}
      {extra}
    </Maths>
  );
}
