# Accuracy check: The Exchange (`the-exchange`)

Lecture 8 · checked 2026-10-23 · sources: `cits5017-lect08-Transformers.pdf` slides 4–6, 12–13, 18–31, 37–41 (rendered 5, 12, 22, 25, 31, 37, 38, 39) + `lecture-8.md` Quirks.
Sample: **32 generated items solved blind** (8 softmax, 4 dot, 4 weighted-sum, 4 scaled, 4 mask, 4 order, 4 row-sum; seeds 1–4 × levels 1–3, `model = null`), plus all 26 choice items and the ORDER item (answers and every distractor) against the slide text, 10 patch-board items read for labelling, and 420 patch items scanned (rows sum to 1 ± 0.03, one weight per key: 0 bad).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | No attention: the encoder hands over only its final hidden state (ŷ(0)–ŷ(2) grey, unused) | x.l1.finalState | 8 · 5 (fig), 12–13, 20 | VERIFIED | optional: add 20 to src (the slide that says it in words) |
| 2 | "soccer" → "fútbol" path is long; the representation is carried over many steps | x.l1.longPath | 8 · 18 | VERIFIED | – |
| 3 | Attention helped most for long sentences (over 30 words) | x.l1.longSentences | 8 · 19 | VERIFIED | – |
| 4 | With attention all encoder outputs are sent too (with final state and previous target word) | x.l1.allOutputs | 8 · 20 | VERIFIED | – |
| 5 | Decoder memory cell computes a weighted sum of all encoder outputs | x.l1.weightedSum | 8 · 20 | VERIFIED | – |
| 6 | α(t, i) = weight of the i-th encoder output at decoder step t; α(3,2) ≫ → "soccer" | x.l1.alpha | 8 · 21 | VERIFIED | – |
| 7 | α from a small alignment model (attention layer) trained jointly | x.l2.alignment | 8 · 22 | VERIFIED | – |
| 8 | One-neuron Dense scores e(3, i) per y(i); softmax turns the three scores into weights | x.l2.denseOne | 8 · 22 (fig) | VERIFIED | – |
| 9 | Alignment-model inputs: h(2) (previous decoder state) and y(0), y(1), y(2) | x.l2.fourInputs | 8 · 22 fn 5 | VERIFIED | – |
| 10 | Bahdanau = concatenative = additive attention | x.l2.bahdanauAlias | 8 · 23 | VERIFIED | – |
| 11 | After "me gusta el" a noun is expected → e(3,2) and α(3,2) high | x.l2.bahdanauExample | 8 · 23 | VERIFIED | – |
| 12 | Luong = multiplicative: dot product of y and h; cheap on modern hardware | x.l2.luongAlias | 8 · 24 | VERIFIED | – |
| 13 | Only constraint: vectors of the same length | x.l2.sameLength | 8 · 24 | VERIFIED | (Quirk: strictly true of the plain dot product only; game quotes the slide) |
| 14 | h(t)ᵀWy(i) = general dot product; hᵀy = dot; vᵀtanh(W[h; y]) = concat | x.l2.variantGeneral | 8 · 25 (rendered) | VERIFIED | – |
| 15 | Concat formula; outperformed by the two dot-product variants, less used | x.l2.variantConcat | 8 · 25 | VERIFIED | – |
| 16 | Keras Attention = Luong, AdditiveAttention = Bahdanau; default score_mode="dot" | x.l2.keras | 8 · 26 | VERIFIED | – |
| 17 | Decoder outputs = queries, encoder outputs = keys (optionally values); [dec, enc] = [queries, keys] | x.l2.queries | 8 · 27–28 | VERIFIED | – |
| 18 | Values omitted → treated as equal to keys | x.l2.valuesDefault | 8 · 28 | VERIFIED | (Quirk: Keras docs default the other way; the slides are the source) |
| 19 | Scaling avoids saturating the softmax (tiny gradients); why flags the 1/d_keys bullet | x.l3.whyScale | 8 · 38 | VERIFIED | – |
| 20 | Q [n_queries, d_keys], K [n_keys, d_keys], V [n_keys, d_values] | x.l3.shapeQ | 8 · 37 | VERIFIED | – |
| 21 | QKᵀ [n_q, n_k]; softmax keeps shape, rows add to 1; output [n_q, d_values] = weighted sum of values | x.l3.shapeOut | 8 · 38 | VERIFIED | – |
| 22 | Encoder MHA is self-attention (all three arrows branch from one line) | x.l3.selfQKV | 8 · 40, 31 (fig) | VERIFIED | – |
| 23 | Decoder upper MHA: keys + values from the encoder, queries from the decoder = cross-attention | x.l3.crossQKV | 8 · 31 (fig), 40 (also 27) | VERIFIED | – |
| 24 | Decoder masked MHA is causal; masking removed once a word is predicted | x.l3.mask | 8 · 31, 41 | VERIFIED | – |
| 25 | H = number of parts V, K, Q are split into (heads); different characteristics captured | x.l3.heads | 8 · 39 | VERIFIED | – |
| 26 | Decoder attends to "soccer" while processing "el" → "fútbol" | x.l3.elSoccer | 8 · 40 | VERIFIED | – |
| 27 | Pipeline: Linear → Split → Scaled Dot-Product Attention → Concat → Linear | ORDER x.l3.mhaOrder | 8 · 37–39 (fig), 39 | VERIFIED | – |
| 28 | α(t,i) = exp(e(t,i)) / Σ exp(e(t,i')); the weights add to 1 | softmaxItem | 8 · 25 (rendered), 22 | VERIFIED | – (8/8 blind) |
| 29 | Luong dot score e(t,i) = h(t)ᵀy(i) | dotItem | 8 · 24–25 | VERIFIED | – (4/4 blind) |
| 30 | h̃(t) = Σ α(t,i) y(i), slide 20's weighted sum | weightedSumItem | 8 · 25, 20 | VERIFIED | – (4/4 blind) |
| 31 | Preset weights α(t,·) = [0.6, 0.4, 0.0] | weightedSumItem alphas | 8 · 25 (softmax, always > 0) | AMBIGUOUS | 0 is unreachable by slide 25's softmax unless read as rounded; use [0.6, 0.3, 0.1] |
| 32 | Scaled score = s / √d_keys | scaledItem, x.l3.whyScale, concept summary | 8 · 37 + 38 equation vs 38 bullet "1/d_keys" | AMBIGUOUS | Slide contradicts itself; game takes the equation (√) and says so in whyScale. Optional: same note in scaledItem.why |
| 33 | Softmax rows of the [n_queries, n_keys] matrix add up to 1 | rowSumItem | 8 · 38 | VERIFIED | – |
| 34 | Causal mask: the word at position i attends to ⟨SOS⟩ … itself; distractor (a) = the words before it only | maskItem | 8 · 31 ("does the same thing" = attends to "all other words"; "doesn't attend to words located after it"), 40 | AMBIGUOUS | Slides never say a word attends to itself; read literally ("all other words"), distractor (a) is defensible. Game takes the standard reading. Replace (a) with a set wrong under both readings (e.g. the word alone, or words i to i+1) |
| 35 | "The masking on a word is removed only once it has been predicted" | maskItem.why | 8 · 41 | VERIFIED | (paraphrase of slide 41's first-word example) |
| 36 | Cross patch: query = decoder token, keys = English encoder words, row t produces the next Spanish word, weighted sum of encoder outputs | patchItem (cross), Board labels, COPY.patchCross | 8 · 27, 31, 40, 20–21 | VERIFIED | optional: add 27 to src (query/key wording) |
| 37 | "its one layer, average of its 2 heads" | patch-cross why | toy `model.meta`: layers 1, heads 2 | VERIFIED | – (labelling) |
| 38 | Board weights are this page's own toy transformer, not the slides' model | OWN, COPY.intro, manifest blurb, `dla-own` footer | — | VERIFIED | – (on every patch item: why + footer) |
| 39 | Self patch: query and keys from the same English sentence | patchItem (self), COPY.patchSelf | 8 · 40, 31 (fig) | VERIFIED | – |
| 40 | "Brightness is the weight; the output is the weighted sum of the values"; plugs normalised to sum 1 | COPY.controls, plugsToWeights | 8 · 38 | VERIFIED | – |
| 41 | Lobby: one cable from the last encoder cell (final state) into a decoder fed ⟨SOS⟩ me gusta el fútbol | TheExchange.jsx Lobby | 8 · 5 (fig) | VERIFIED | – |
| 42 | Concept ids used (encdec.finalState, attn.*, transformer.*): their `slides` teach them | content/lecture8.js | 8 · 5, 12–13, 18–28, 31, 37–41 | VERIFIED | – |

## Blind sample (32 items, solved before reading `answer`)

| item | prompt | mine | game | match |
|---|---|---|---|---|
| L1 s1 softmax | e = [0, 1, 0], α(t,1) | e/(e+2) = 0.58 | 0.58 | yes |
| L1 s2 softmax | e = [1, −1, 2], α(t,2) | e²/(e+e⁻¹+e²) = 0.71 | 0.71 | yes |
| L1 s3 softmax | e = [1, 0, 1], α(t,0) | e/(2e+1) = 0.42 | 0.42 | yes |
| L1 s4 softmax | e = [1, 2, 1], α(t,1) | e²/(e²+2e) = 0.58 | 0.58 | yes |
| L2 s1 softmax | e = [−1, 2, 1], α(t,1) | 0.71 | 0.71 | yes |
| L2 s2 softmax | e = [2, 0, 2], α(t,0) | e²/(2e²+1) = 0.47 | 0.47 | yes |
| L2 s3 softmax | e = [2, 1, 2], α(t,0) | e²/(2e²+e) = 0.42 | 0.42 | yes |
| L2 s4 softmax | e = [0, 2, 2], α(t,1) | 0.47 | 0.47 | yes |
| L2 s1 dot | h = [−2, 2, −2], y = [2, 0, 0] | −4 | −4 | yes |
| L2 s2 dot | h = [1, −1, −2], y = [1, 2, 1] | 1 − 2 − 2 = −3 | −3 | yes |
| L2 s3 dot | h = [−1, 2, 2], y = [−2, 1, −1] | 2 + 2 − 2 = 2 | 2 | yes |
| L2 s4 dot | h = [−1, 1, 2], y = [2, −1, 2] | −2 − 1 + 4 = 1 | 1 | yes |
| L2 s1 wsum | α [0.7, 0.2, 0.1], comp 0 of y = −1, 2, 2 | −0.7 + 0.4 + 0.2 = −0.1 | −0.1 | yes |
| L2 s2 wsum | α [0.1, 0.1, 0.8], comp 0 of y = 1, 1, −1 | −0.6 | −0.6 | yes |
| L2 s3 wsum | α [0.2, 0.5, 0.3], comp 0 of y = 1, 1, 1 | 1.0 | 1 | yes |
| L2 s4 wsum | α [0.7, 0.2, 0.1], comp 1 of y = −2, 1, 0 | −1.4 + 0.2 = −1.2 | −1.2 | yes |
| L3 s1 scaled | −10, d_keys 64 | −10/8 = −1.25 | −1.25 | yes |
| L3 s2 scaled | 4, d_keys 64 | 0.5 | 0.5 | yes |
| L3 s3 scaled | −3, d_keys 4 | −1.5 | −1.5 | yes |
| L3 s4 scaled | 6, d_keys 16 | 1.5 | 1.5 | yes |
| L3 s1 mask | "gusta" (pos 2) | ⟨SOS⟩, me, gusta | ok = same | yes (see row 34) |
| L3 s2 mask | "me" (pos 1) | ⟨SOS⟩, me | ok = same | yes (see row 34) |
| L3 s3 mask | "gusta" (pos 2) | ⟨SOS⟩, me, gusta | ok = same | yes |
| L3 s4 mask | "gusta" (pos 2) | ⟨SOS⟩, me, gusta | ok = same | yes |
| L3 s1–s4 order (4) | shuffled Figure 16-10 cards | Linear, Split, SDPA, Concat, Linear | [0,1,2,3,4] = same | 4/4 yes |
| L3 s1–s4 rowsum (4) | softmax row sum | 1 | 1 | 4/4 yes |

All 26 choice items (answer + 3 distractors each) checked against the slide text: no distractor is true per the slides (rows 1–26). Patch items (not blind-solvable: the answers are the toy's own weights): labelling checked on 10 (e.g. "Patch “me” (producing “encantan”)": row 1 of `cross[0]` predicts `out[1]`; decIn/out alignment correct).

## Other findings (not slide claims)
- Toy-load fallback (`model = null`) at level 1 calls `pick(1, 3)` twice from the same 6 items: 190/200 seeds repeat a choice item within the round. Fix: `pick(1, 6)` once.
- `index.js` `concepts` omits `attn.motivation` and `attn.keras`, used by x.l1.longPath, x.l1.longSentences, x.l2.keras; the scheduler never routes those due concepts here. Add both.
- 78/420 patch items show the toy's raw `<sos>` as the query; the mask items and Lobby use ⟨SOS⟩. Map it for display.
- `TheExchange.jsx` header promises "future sockets locked" for the causal mask; no such board exists (the mask is a choice item). Comment only.

## Summary
1. 42 claims: 39 VERIFIED, 0 WRONG, 0 NOT IN SLIDES, 3 AMBIGUOUS; blind sample 32/32 match; 26/26 choice items and the ORDER item correct against the slides.
2. Fix 1 (row 34): mask distractor "words before it only" is defensible under slides 31/40's literal "all other words". Replace it with a set that is wrong under both readings.
3. Fix 2 (row 31): weighted-sum preset α [0.6, 0.4, 0.0] has a 0 that slide 25's softmax cannot produce. Use [0.6, 0.3, 0.1].
4. Fix 3 (row 32, already handled): √d_keys vs slide 38's "1/d_keys" bullet; the game follows the equation and says so in whyScale. Optionally repeat the note in scaledItem.why.
5. Non-slide: dedupe the level-1 fallback picks, add attn.motivation/attn.keras to the manifest, show ⟨SOS⟩ not `<sos>`; optional src additions (20 on x.l1.finalState, 27 on patch-cross).
