/* ============================================================================
   EXAM PRACTICE — THE LECTURES A PART CAN CITE
   ----------------------------------------------------------------------------
   `code` is what the data uses in a topic ({ lec: 'L67', … }); `label` is what
   the page and the PDF print ("L6–7"). `slides` is the deck's slide count:
   check-papers.mjs rejects any slide receipt outside it. `dot` is the small
   labelled dot that marks a lecture on the paper (fixed colours: the paper is
   paper in every portal theme).
   ========================================================================== */

export const LECTURES = [
  { code: 'L1', label: 'L1', name: 'Intro to ANNs', slides: 64, dot: '#2a78d6' },
  { code: 'L2', label: 'L2', name: 'Training DNNs', slides: 68, dot: '#e0602b' },
  { code: 'L3', label: 'L3', name: 'CNNs', slides: 53, dot: '#14946a' },
  { code: 'L4', label: 'L4', name: 'Processing sequences', slides: 52, dot: '#c98a00' },
  { code: 'L5', label: 'L5', name: 'Autoencoders', slides: 27, dot: '#d4588a' },
  { code: 'L67', label: 'L6–7', name: 'AEs, VAEs & GANs', slides: 32, dot: '#2f7d1f' },
  { code: 'L8', label: 'L8', name: 'Transformers', slides: 51, dot: '#5a46c0' },
  { code: 'L9', label: 'L9', name: 'Reinforcement learning', slides: 69, dot: '#d23f3e' },
];

export const LEC = Object.fromEntries(LECTURES.map((l) => [l.code, l]));

// "slides 43–45" / "slide 24"
export function slideText(slides) {
  const [a, b] = Array.isArray(slides) ? slides : [slides, slides];
  return a === b ? `slide ${a}` : `slides ${a}–${b}`;
}

// "L1 · slides 43–45"
export function topicReceipt(t) {
  return `${LEC[t.lec]?.label ?? t.lec} · ${slideText(t.slides)}`;
}
