import { Tex } from '../../kit';

// "text with $x^2$ maths" → spans and KaTeX
export function Why({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('$') && p.endsWith('$') && p.length > 2 ? <Tex key={i} src={p.slice(1, -1)} /> : <span key={i}>{p}</span>))}
    </>
  );
}

