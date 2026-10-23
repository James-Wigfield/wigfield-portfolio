# Accuracy check: Wave Stamp (`wave-stamp`)

- Date: 2026-10-23 · checker: fresh agent, no part in the build
- Sources: `cits5017-lect08-Transformers.pdf`, slides 31–36 and 44–48. I rendered slide 32 at 200 dpi and slides 33, 35, 36, 46 and 47 at 110 dpi and read them. For slides 31, 34, 44, 45 and 48 I used pdftotext. I also used the Quirks section of `lecture-8.md` for slides 32–36 and 44–48.
- Files read:
  - `games/wave-stamp/*`: WaveStamp.jsx, index.js and glyph.jsx (I did not read wave-stamp.css)
  - `content/wave-stamp.js` and `maths/waveStamp.js`
  - `posEncoding`, `PE_BASE` and `vitPatches` in `lecture8-study/attn.js`
  - in `content/lecture8.js`: the 7 concept ids, `EQUATIONS.posenc`, `posencCode` and `vitPatch`, `CODE` `l8.posenc.class` and `l8.posenc.use`, and the l8.posenc and l8.vit QUIRKS
- Blind sample: **72 items**, all **72/72 match**:
  - L1 with seeds 3, 11 and 29
  - L2 with seeds 3, 11 and 29
  - L3 with seeds 3 and 11
- Sweep: seeds 1–2000 × 3 levels (54,000 items). I recomputed every generated answer with my own slide-32 and slide-35 maths, not `posEncoding`. **0 mismatches.** The sweep covered:
  - the stamp rows, and that the match candidates are distinct
  - p0, parity, angle, pair, base, twin and compare
  - the code index, the code angle and both shapes
  - the patch counts, 768 and the order
  - Every choice answer is among its choices, and no choice set repeats a label. `vit-count` is the only kind marked `beyond`.

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | P(p,i) = sin(p/1000^{i/d}) for even i and cos(p/1000^{(i−1)/d}) for odd i, with a bold P, as typeset | lecture8 EQUATIONS.posenc · drawer · FormulaPic | L8 · 32 (200 dpi) | VERIFIED | — |
| 2 | d = "the dimension of the keys, values and queries vectors" | ws.l1.d answer | L8 · 32 | VERIFIED | — |
| 3 | "The code on slide 35 calls the same size embed_size". Twin/compare items use one d for both bases | ws.l1.d why · posenc vars note | L8 · 32, 35, 37 | AMBIGUOUS | Slide 32 defines d as the K/V/Q dimension, but the code uses embed_size (QUIRK l8.posenc.symbols). The game reads them as equal. Reword to "the code uses embed_size in its place". |
| 4 | Slide 32's "iᵗʰ encoding … iᵗʰ word" is a position. The game writes p for it and says so | ws.l1.added why | L8 · 32 | VERIFIED | — |
| 5 | PEs are dense vectors (much like word embeddings), added to the word embedding at that position | ws.l1.added | L8 · 31, 32 | VERIFIED | — |
| 6 | Easiest way: an Embedding layer over positions 0 … max length in the batch, added to the word embeddings | ws.l1.easiest | L8 · 32 | VERIFIED | — |
| 7 | The paper chose fixed sine/cosine encodings at different frequencies. The Embedding-layer distractor is correctly false here | ws.l1.fixed | L8 · 32 | VERIFIED | — |
| 8 | Each position has a unique PE, so the model has access to each word's absolute position | ws.l1.unique · NOTES.unique · intro | L8 · 33 | VERIFIED | — |
| 9 | Low components oscillate fastest. Fig 16-9 (transposed) has fast stripes near i = 0 and broad bands at large i | ws.l1.fast | L8 · 32, 33 (rendered) | VERIFIED | — |
| 10 | P[0,·] reads 0, 1, 0, 1, … | p0 why | L8 · 32 | VERIFIED | — |
| 11 | Even i → sin with i/d, odd i → cos with (i−1)/d. An odd i shares its frequency with i − 1 | parity · angle · pair why | L8 · 32 | VERIFIED | — |
| 12 | "The angle is in radians" | NOTES.radians · match drawer line | — | NOT IN SLIDES | No slide states units. They come from np.sin. Low priority: leave as a convention or tag it. |
| 13 | Slide 32 uses base 1000, slide 35 uses 10_000 (a factor of 10) | NOTES.base · base item · rack labels | L8 · 32, 35 (rendered) | VERIFIED | — |
| 14 | Only i = 0 and 1 agree under both bases (exponent 0) | ws.l2.agree · twin why | L8 · 32, 35 | VERIFIED | — |
| 15 | A bigger base divides p by more, so the angle is smaller, the waves slower and the bands broader | compare · twin why | L8 · 32, 35 | VERIFIED | — |
| 16 | `assert embed_size % 2 == 0, "embed_size must be even"`. Sines go in ::2, cosines in 1::2 | ws.l2.even | L8 · 35 | VERIFIED | — |
| 17 | i = 2 * np.arange(embed_size // 2) takes even values only. The cosine reuses i/embed_size, which is slide 32's (i−1)/d | NOTES.codeIndex · index items | L8 · 35, 32 | VERIFIED | — |
| 18 | The posencCode drawer gives P(p,2k) = sin(p/10000^{2k/embed_size}) and P(p,2k+1) = cos(the same), labelled "the code, written as maths" | EQUATIONS.posencCode | L8 · 35 | VERIFIED | — |
| 19 | pos_emb = np.empty((1, max_length, embed_size)). pos_encodings is a tf.constant of it | shape-posemb | L8 · 35 | VERIFIED | — |
| 20 | batch_max_length = tf.shape(inputs)[1]. inputs + pos_encodings[:, :bml] gives (1, L, E) | shape-call | L8 · 34, 35 | VERIFIED | — |
| 21 | The matrix is precomputed in the constructor for efficiency. call() truncates it to the max input length and adds it | ws.l2.precompute | L8 · 34, 35 | VERIFIED | — |
| 22 | supports_masking=True propagates the input's automatic mask to the next layer | ws.l2.masking | L8 · 34 (35) | VERIFIED | — |
| 23 | max_length sets the positions (np.arange). batch_max_length is used only in call() | ws.l2.args | L8 · 35, 36 | VERIFIED | — |
| 24 | pos_embed_layer is applied to encoder_embeddings and decoder_embeddings. The why flags "encoder's outputs" | ws.l2.added | L8 · 36 (rendered) | AMBIGUOUS | Slide 36's sentence contradicts its own code. The game takes the code's reading and says so (QUIRK l8.posenc.outputsWording). Optional: the distractor "outputs of the encoder's attention layers" echoes the slide's own words, so swap it for one the slide never says. |
| 25 | Code excerpts show the right lines: assert, sin/cos, masking, call, args, base mask | content `code.lines` · generator stages | L8 · 35, 36 | VERIFIED | — |
| 26 | Code captions read "slide 35" and "slide 36" | WaveStamp.jsx CODE_SLIDE | L8 · 35, 36 | VERIFIED | — |
| 27 | 16 × 16 × 3 = 768, where 3 is the RGB colour channels | ws.l3.channels · vit-768 · vitPatch | L8 · 46 (rendered) | VERIFIED | — |
| 28 | Chop the image into little 16 × 16 squares and treat them as a sequence of word representations | ws.l3.chop | L8 · 46 | VERIFIED | — |
| 29 | The linear layer transforms the vectors but keeps their dimensionality (768) | ws.l3.linear · vit-linear | L8 · 46 | VERIFIED | — |
| 30 | Treat them as word embeddings: add positional embeddings, then pass them to the transformer | ws.l3.sequence | L8 · 46 | VERIFIED | — |
| 31 | Pipeline order: chop → flatten 768 → linear → + positional embeddings → transformer | ORDER | L8 · 46 | VERIFIED | — |
| 32 | Beat SOTA on ImageNet but needed over 300 million additional images | ws.l3.data | L8 · 46 | VERIFIED | — |
| 33 | Fewer inductive biases than CNNs, so extra data to learn what CNNs implicitly assume | ws.l3.bias | L8 · 46 | VERIFIED | — |
| 34 | Patch counts for the page's own sizes (all multiples of 16), marked `beyond` with a note and a kicker | VIT_SIZES · vit-count | L8 · 46 (QUIRK l8.vit.missingDetails) | VERIFIED (beyond) | — |
| 35 | Every patch picture carries the line "this image and its size are this page's own example" | COPY.ownImage | L8 · 46 | VERIFIED | — |
| 36 | Captioning: CNN feature maps, then a decoder RNN with attention writes one word at a time. "Not a transformer" despite the heading | ws.l3.caption | L8 · 44 | VERIFIED | — |
| 37 | Most attention was on the frisbee just before the word "frisbee" | ws.l3.frisbee | L8 · 45 | VERIFIED | — |
| 38 | The caption and frisbee items show the ViT picture (image gridded into "16 px squares") | choiceItem stage `patches`, focus default `chop` | L8 · 44, 45 | WRONG | The picture implies the captioner chops 16 × 16 patches, and it draws the `vit` distractor. Give these two items a neutral stage or a CNN → RNN sketch. |
| 39 | Slide 47: "(Materials from this slide onward are not covered in the exam)". Only its exam status is asked, nothing from 47–48 is drilled, and vit.variants is not in the manifest's concepts | NOT_EXAMINED · index.js | L8 · 47 (rendered) | VERIFIED | — |
| 40 | The concept slides teach their concepts: posenc.formula 32, 35 · why 31–33 · code 34–36 · vit.* 44–48 | lecture8.js CONCEPTS | L8 · 31–48 | VERIFIED | — |
| 41 | Every distractor in the 19 content choice sets and the generated sets is false per the slides | CHOICE · NOT_EXAMINED · parity/base/compare | L8 · 31–47 | VERIFIED | (see row 24) |
| 42 | Every `src` slide number on content and generated items is correct, none off by one | content + generator | L8 · 31–47 | VERIFIED | — |
| 43 | Match stamps: one row per position, candidates ≥ 0.4 apart, face-down p ≥ 1 | matchItem | L8 · 32, 33 | VERIFIED (sweep) | — |
| 44 | Labels: "slide 32 · base 1000", "slide 35 code · base 10_000", level names, intro | COPY · manifest | L8 · 32, 35 | VERIFIED | — |

## Blind sample (I worked my answer from the slides first, then checked the game's)

| # | item | prompt (short) | mine | game | ✓ |
|---|---|---|---|---|---|
| 1 | L1 s3 match-up | stamp (0.14, −0.99, 0.51, 0.86, …), d 8 | sin 3, cos 3 → p = 3 | 3 | ✓ |
| 2 | ws.l1.added | what is done with the PE | added | added | ✓ |
| 3 | p0 | P(0,6), d 8 | sin 0 = 0 | 0 | ✓ |
| 4 | parity | P(p,2), d 12 | sin(p/1000^{2/12}) | ok | ✓ |
| 5 | match-down | stamp (−0.28, 0.96, 0.88, 0.48, …) | sin 6, cos 6 → 6 | 6 | ✓ |
| 6 | ws.l1.easiest | easiest way | Embedding layer | embedding | ✓ |
| 7 | angle | P(30,2), d 6 | 30/1000^{1/3} = 3 | 3 | ✓ |
| 8 | angle | P(75,5), d 6 | odd: 75/1000^{4/6} = 0.75 | 0.75 | ✓ |
| 9 | pair | P(4,1), d 8 | cos 4 = −0.65 | −0.65 | ✓ |
| 10 | L1 s11 match-up | stamp (−0.96, 0.28, 0.78, …) | sin 5, cos 5 → 5 | 5 | ✓ |
| 11 | ws.l1.unique | why the model knows positions | unique | unique | ✓ |
| 12 | p0 | P(0,1), d 8 | cos 0 = 1 | 1 | ✓ |
| 13 | parity | P(p,7), d 12 | cos(p/1000^{6/12}) | ok | ✓ |
| 14 | match-down | stamp (−0.28, 0.96, …) | 6 | 6 | ✓ |
| 15 | ws.l1.d | what d is | K/V/Q dimension | dim | ✓ |
| 16 | angle | P(75,8), d 12 | 75/1000^{8/12} = 0.75 | 0.75 | ✓ |
| 17 | angle | P(12,3), d 6 | odd: 12/1000^{2/6} = 1.2 | 1.2 | ✓ |
| 18 | pair | P(3,1), d 8 | cos 3 = −0.99 | −0.99 | ✓ |
| 19 | L1 s29 match-up | stamp (−0.96, 0.28, …) | 5 | 5 | ✓ |
| 20 | ws.l1.easiest | easiest way | embedding | embedding | ✓ |
| 21 | p0 | P(0,5), d 16 | cos 0 = 1 | 1 | ✓ |
| 22 | parity | P(p,2), d 12 | sin(p/1000^{2/12}) | ok | ✓ |
| 23 | match-down | stamp (−0.96, 0.28, …) | 5 | 5 | ✓ |
| 24 | ws.l1.added | PE use | added | added | ✓ |
| 25 | angle | P(25,2), d 6 | 2.5 | 2.5 | ✓ |
| 26 | angle | P(150,9), d 12 | odd: 150/1000^{8/12} = 1.5 | 1.5 | ✓ |
| 27 | pair | P(2,1), d 8 | cos 2 = −0.42 | −0.42 | ✓ |
| 28 | L2 s3 base | code's base | 10_000 | code | ✓ |
| 29 | ws.l2.added | what pos_embed_layer gets | the embeddings | embeddings | ✓ |
| 30 | twin | which rack is the code's | B: column 2 at p = 1 is 0.10 (1/10), not 0.18 (1/1000^{¼}) | B | ✓ |
| 31 | ws.l2.precompute | what call() does | truncate + add | truncate | ✓ |
| 32 | compare | p 50, i 6, d 8 | 0.28 vs 0.05 → base 1000 larger | slide | ✓ |
| 33 | index-largest | E 8 | [0, 2, 4, 6] → 6 | 6 | ✓ |
| 34 | ws.l2.agree | where the bases agree | i = 0, 1 | first | ✓ |
| 35 | code-angle | pos_emb[0,500,6], E 8 | 500/10000^{6/8} = 0.5 | 0.5 | ✓ |
| 36 | shape-call | ml 50, E 16, inputs (16,10,16) | (1, 10, 16) | [1,10,16] | ✓ |
| 37 | L2 s11 base | code's base | 10_000 | code | ✓ |
| 38 | ws.l2.added | — | embeddings | embeddings | ✓ |
| 39 | twin | code rack | A (0.10 at p = 1, column 2) | A | ✓ |
| 40 | ws.l2.even | assert | even | even | ✓ |
| 41 | compare | p 20, i 2, d 8 | 3.56 vs 2 → slide | slide | ✓ |
| 42 | index-largest | E 16 | 14 | 14 | ✓ |
| 43 | ws.l2.args | which argument sets the positions | max_length | max_length | ✓ |
| 44 | code-angle | pos_emb[0,250,6] | 0.25 | 0.25 | ✓ |
| 45 | shape-call | ml 100, inputs (16,40,8) | (1, 40, 8) | [1,40,8] | ✓ |
| 46 | L2 s29 base | slide 32's base | 1000 | slide | ✓ |
| 47 | ws.l2.added | — | embeddings | embeddings | ✓ |
| 48 | twin | base-1000 rack | B (0.18 at p = 1, column 2) | B | ✓ |
| 49 | ws.l2.agree | — | first | first | ✓ |
| 50 | compare | p 100, i 3, d 8 | odd: 17.78 vs 10 → slide | slide | ✓ |
| 51 | index-column | E 6, column 4 | i = 4 | 4 | ✓ |
| 52 | ws.l2.precompute | — | truncate | truncate | ✓ |
| 53 | code-angle | pos_emb[0,5,2] | 5/10 = 0.5 | 0.5 | ✓ |
| 54 | shape-posemb | ml 100, E 128 | (1, 100, 128) | [1,100,128] | ✓ |
| 55 | L3 s3 vit-768 | flattened patch size | 768 | 768 | ✓ |
| 56 | ws.l3.chop | how ViT reads an image | chop | chop | ✓ |
| 57 | ws.l3.linear | what comes next | linear | linear | ✓ |
| 58 | vit-count (beyond) | 64 × 64 | 4 × 4 = 16 | 16 | ✓ |
| 59 | vit-order | 5 steps | chop, flatten, linear, +pos, transformer | [0,1,2,3,4] | ✓ |
| 60 | ws.l3.bias | why so much data | fewer biases | bias | ✓ |
| 61 | ws.l3.caption | what writes the caption | decoder RNN | rnn | ✓ |
| 62 | vit-count (beyond) | 64 × 128 | 4 × 8 = 32 | 32 | ✓ |
| 63 | notExamined | slide 47 onward | not covered | not | ✓ |
| 64 | L3 s11 vit-768 | — | 768 | 768 | ✓ |
| 65 | ws.l3.chop | — | chop | chop | ✓ |
| 66 | ws.l3.linear | — | linear | linear | ✓ |
| 67 | vit-count (beyond) | 48 × 64 | 3 × 4 = 12 | 12 | ✓ |
| 68 | vit-order | — | identity | [0,1,2,3,4] | ✓ |
| 69 | ws.l3.data | what training needed | 300 M extra images | more | ✓ |
| 70 | ws.l3.frisbee | attention before "frisbee" | the frisbee | frisbee | ✓ |
| 71 | vit-linear | dimension after the linear layer | 768 | 768 | ✓ |
| 72 | notExamined | — | not | not | ✓ |

I also checked the why-card numbers in the sample:
- cos 0.75 = 0.73 and cos 1.2 = 0.36
- P(50,6): 0.28 and 0.05
- P(20,2): −0.40 and 0.91
- P(100,3): 0.48 and −0.84
- sin 0.5 = 0.48 and sin 0.25 = 0.25

All agree with my own values.

## Summary
1. Verdicts (44 rows): **40 VERIFIED** (1 of them beyond: the patch counts), **1 WRONG**, **2 AMBIGUOUS**, **1 NOT IN SLIDES**. Blind sample: 72/72. Sweep: 54,000 items with 0 mismatches.
2. Fix 1 (WRONG, picture): `ws.l3.caption` and `ws.l3.frisbee` (slides 44–45) show the ViT 16 × 16 patch grid. The picture implies the captioner chops patches, and it draws the `vit` distractor. Give them a neutral or CNN → RNN stage.
3. Fix 2 (AMBIGUOUS): the `ws.l1.d` why says slide 35 "calls the same size embed_size". Slide 32 defines d as the K/V/Q dimension (QUIRK l8.posenc.symbols). Reword to "the code uses embed_size in its place".
4. Fix 3 (AMBIGUOUS, optional): in `ws.l2.added`, the distractor "outputs of the encoder's attention layers" echoes slide 36's own "encoder's outputs" wording. Swap it for one the slide never says.
5. Fix 4 (NOT IN SLIDES, low): "the angle is in radians" (NOTES.radians, match drawer) is a NumPy convention that no slide states. Leave it or tag it as a convention.
