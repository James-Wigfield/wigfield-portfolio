/* The inline-markup tokeniser for Rich.jsx, kept in a .js file so the checks
   can test it. Groups, in order:
     1 `code`   2 $tex$   3 ***bold italic***   4 **bold**
     5 a provenance label: {s|L3 · slide 22}  {own}  {beyond}
     6 a link: [label](#stepId)  [label](@topicId)  [label](@topicId#stepId)
               [label](/portal/…)
     7 *italic*
   Bold italic comes before bold, so ***term*** is one token rather than
   "**" + "*term" + "**" (which left stray asterisks and italicised the
   text up to the next term). */
export const TOKEN = /(`[^`]+`)|(\$[^$]+\$)|(\*\*\*[^*]+?\*\*\*)|(\*\*.+?\*\*)|(\{(?:s\|[^{}]+|own|beyond)\})|(\[[^\]]+\]\((?:#[a-z0-9-]+|@[a-z0-9_-]+(?:#[a-z0-9-]+)?|\/[^)\s]+)\))|(\*[^*\n]+?\*)/;

/* The three provenance labels (Provenance.jsx draws them):
     slide    "L3 · slide 22" — a slide states or prints it
     own      "this page's own · checked in TF" — computed here, verified by
              tools/dl-tricky-topics/verify_counts.py
     beyond   "beyond the slides" — true and useful, not in the lecture notes */
export const PROV_TEXT = {
  own: 'this page’s own · checked in TF',
  beyond: 'beyond the slides',
};

export function provOf(tok) {
  const body = tok.slice(1, -1);
  if (body === 'own') return { kind: 'own', text: PROV_TEXT.own };
  if (body === 'beyond') return { kind: 'beyond', text: PROV_TEXT.beyond };
  return { kind: 'slide', text: body.slice(2) };
}

// every slide receipt in a string, for the checks: "L3 · slide 22" …
export const RECEIPT_RE = /\{s\|([^{}]+)\}/g;

/* A Slide check folds to its first sentence on screen. The cut is the first
   ". " followed by a capital, outside any `code` or $tex$ span; a short
   remainder isn't worth folding. */
export function firstSentence(text, min = 140) {
  let code = false;
  let tex = false;
  for (let i = 0; i < text.length - 2; i++) {
    const c = text[i];
    if (c === '`') code = !code;
    else if (c === '$' && !code) tex = !tex;
    else if (!code && !tex && c === '.' && text[i + 1] === ' ' && /[A-Z“‘`$]/.test(text[i + 2])) {
      const head = text.slice(0, i + 1);
      return text.length - head.length < min ? text : head;
    }
  }
  return text;
}
