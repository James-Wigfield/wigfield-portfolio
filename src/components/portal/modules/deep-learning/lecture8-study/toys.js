/* ============================================================================
   LECTURE 8 STUDY — THE PAGE'S OWN TOY NUMBERS
   ----------------------------------------------------------------------------
   One running example, the slides' own sentence pair (slides 4, 19–23, 27):
   "I like soccer" → "me gusta el fútbol". Every vector here is tiny (d = 4,
   so a vector draws as a strip of four cells) and made up by this page to
   make the pictures readable. None of it is a trained model or a number
   from the slides, and every lab that shows it says so.
   ========================================================================== */

export const EN = ['I', 'like', 'soccer'];
export const ES = ['me', 'gusta', 'el', 'fútbol'];

/* §6 · Bahdanau attention. The encoder's outputs y(0), y(1), y(2), one
   per English word, each with its own pattern so a weighted sum of them is
   easy to read. */
export const Y = [
  [0.9, -0.5, 0.2, 0.4], // y(0)  "I"
  [-0.4, 0.9, 0.6, -0.6], // y(1)  "like"
  [0.1, -0.3, -0.8, 0.9], // y(2)  "soccer"
];

/* The alignment model's scores e(t,i) for each decoder step t (the word
   the decoder outputs at that step) and encoder output i. Toy values,
   chosen to match slide 23's story: at t = 3, after "me gusta el", the
   decoder expects a noun and "soccer" scores highest, so α(3,2) is large. */
export const E_SCORES = [
  [2.0, 0.2, -0.6], // t = 0  "me"
  [0.1, 2.2, 0.3], // t = 1  "gusta"
  [-0.5, 0.5, 1.6], // t = 2  "el"
  [-0.6, 0.1, 2.4], // t = 3  "fútbol"
];

/* §11 · scaled dot-product attention, as the decoder's cross-attention:
   4 queries (one per Spanish word) against 3 keys and values (one per
   English word), d_keys = d_values = 4. The values reuse §6's encoder
   outputs, so an output row can be compared with the strips there. */
export const Q4 = [
  [2.2, -0.4, 0.1, 0.4], // me
  [-0.3, 2.3, 0.6, -0.5], // gusta
  [0.1, 0.4, 1.3, 1.0], // el
  [0.0, -0.4, 2.1, 2.0], // fútbol
];
export const K3 = [
  [1.8, -0.5, 0.3, 0.2], // I
  [-0.4, 1.9, 0.5, -0.3], // like
  [0.2, -0.3, 1.5, 1.4], // soccer
];
export const V3 = Y;
