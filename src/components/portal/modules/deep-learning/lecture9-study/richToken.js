/* The inline-markup tokeniser for Rich.jsx, kept in a .js file so the checks
   can test it. Groups, in order:
     1 `code`   2 $tex$   3 ***bold italic***   4 **bold**   5 [^n]
     6 [label](#id) or [label](/portal/…)       7 *italic*
   Bold italic comes before bold, so ***term*** is one token rather than
   "**" + "*term" + "**" (which left stray asterisks and italicised the
   text up to the next term). */
export const TOKEN = /(`[^`]+`)|(\$[^$]+\$)|(\*\*\*[^*]+?\*\*\*)|(\*\*.+?\*\*)|(\[\^\d+\])|(\[[^\]]+\]\((?:#[a-z0-9]+|\/[^)\s]+)\))|(\*[^*\n]+?\*)/;

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
