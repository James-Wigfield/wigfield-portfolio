# Accuracy check: Signal Keeper (`signal-keeper`)

- Date: 2026-10-23 · checker: fresh agent, no part in the build
- Sources: `cits5017-lect02-Training-DNNs.pdf` slides 5–29 (text), with slides 6, 7, 8, 11, 12, 15, 16, 17, 21, 22, 24, 27, 28 and 29 rendered at 110 dpi and read. Transcript `lecture-2.md` (slide 27 table). It has no Quirks section, and none of the QUIRKS in `content/lecture2.js` fall in slides 5–29.
- Files read: `games/signal-keeper/*` (SignalKeeper.jsx, view.js, index.js, glyph.jsx), `content/signal-keeper.js`, `maths/signalKeeper.js`, `maths/signalKeeperSim.js`, and the 14 concept ids in `content/lecture2.js`.
- Blind sample: **68 items**: L1 seeds 101 and 102, L2 seeds 203 and 204, L3 seeds 305 and 306 (60 items), plus 8 extra x̂, z and clipnorm items from L3 seeds 1–8. They cover every numeric kind and most choice templates. **68/68 answers match.**
- Sweep: 9,000 rounds (seeds 1–3000 × 3 levels, 90,000 items). I recomputed every numeric answer independently from its prompt: fan_avg, Glorot σ² and r, He and LeCun σ², leaky ReLU, the ELU and SELU floors, μ_B, σ²_B, x̂, z, the BN parameter counts, clipvalue and clipnorm. **0 mismatches.** Every choice answer is among its choices. x̂ stays within tolerance even with Keras's ε = 1e‑3. I also ran the stack simulation for every scene (whichInit before and after, the 10 diagnose scenes, bnHeals, whichAct fixes).

| # | claim | where (file / item id) | source (lecture · slide) | verdict | fix |
|---|---|---|---|---|---|
| 1 | Glorot normal σ² = 1/fan_avg, fan_avg = (fan_in + fan_out)/2 | INITS.glorot, MATHS.glorot, TEXT.fanAvg/glorotVar | L2 · 7 | VERIFIED | — |
| 2 | Glorot uniform over [−r, +r], r = √(3/fan_avg) | TEXT.glorotLimit, MATHS.glorot, LayerScene | L2 · 7 | VERIFIED | — |
| 3 | He σ² = 2/fan_in, LeCun σ² = 1/fan_in (Normal); "fan_out does not enter" | INITS, TEXT.heVar/lecunVar | L2 · 8 | VERIFIED | — |
| 4 | Table 11-1: Glorot ↔ None, tanh, sigmoid, softmax; He ↔ ReLU, Leaky ReLU, ELU, GELU, Swish, Mish; LeCun ↔ SELU; caption verbatim | TABLE, whichInitRev.why, TableScene | L2 · 8 | VERIFIED | — |
| 5 | He et al. for ReLU and its variants (incl. ELU); LeCun preferred for SELU with a normal distribution | TEXT.whichInit.more | L2 · 8 | VERIFIED | — |
| 6 | Glorot "a good compromise that has proven to work very well in practice" | whichInit.more.glorot | L2 · 7 | VERIFIED | — |
| 7 | Keras default = Glorot uniform; set kernel_initializer (e.g. "he_normal") | kerasDefault, SCENES.initPrompt | L2 · 9 | VERIFIED | — |
| 8 | Vanishing: gradients smaller and smaller down to lower layers, weights virtually unchanged; exploding: larger and larger | TEXT.diagnose.why | L2 · 5 | VERIFIED | — |
| 9 | Culprit = logistic sigmoid + the then-popular init N(0, 1); output variance ≫ input variance | culprit | L2 · 5–6 | VERIFIED | — |
| 10 | Sigmoid saturates at 0 or 1 with derivative extremely close to 0; mean 0.5 not 0 | saturate | L2 · 6 | VERIFIED | — |
| 11 | diagnose answers come from the sim. In every scene the layer-1 ∂L/∂z bar settles it, and only the three Table 11-1 pairs read healthy | SCENES.diagnose, verdict() | L2 · 5, 8 | VERIFIED | — (ReLU, None or SELU on N(0,1) explode ×10⁶–10⁷; ReLU, leaky, GELU or Mish on Glorot uniform vanish ×0.004–0.04) |
| 12 | Every whichInit "before" stack is unhealthy and its Table 11-1 fix gets 10/10 healthy | SCENES.whichInit | L2 · 8 (own sim) | VERIFIED | — |
| 13 | LeakyReLU_α(z) = max(αz, z), α small e.g. 0.01; a larger leak e.g. 0.2 tends to perform better | ACTS.leaky, LEAKY.alpha small/larger, formulas.leaky | L2 · 11 | VERIFIED | optional: "its example of the small constant" (0.2 also appears on the slide, as the larger leak) |
| 14 | Keras LeakyReLU default alpha / negative_slope = 0.3; tf‑2.16 renames alpha → negative_slope; slide code passes 0.2 | LEAKY.alpha.keras | L2 · 12 | VERIFIED | — |
| 15 | The sim's leaky α = 0.2 is the slide 12 code's negative_slope=0.2 | SIM.acts.leaky, LEAKY_ALPHA_SIM | L2 · 12 | VERIFIED | — |
| 16 | ELU_α(z) = α(exp(z) − 1) if z < 0, z if z ≥ 0 | ACTS.elu, formulas.elu | L2 · 15 | VERIFIED | — |
| 17 | ELU → −α (−1 for α = 1, −2 for α = 2: the figure's dotted lines); smooth everywhere when α = 1 | CURVES.floor elu1/elu2, nameWhy.elu1 | L2 · 15 | VERIFIED | — |
| 18 | SELU(z) = s·ELU₁.₆₇₃₃(z), s = 1.0507 fixed scale, α fixed at 1.6733; slide 17 legend rounds to 1.05 / 1.67 | ACTS.selu, SELU.constants, formulas.selu | L2 · 16–17 | VERIFIED | — |
| 19 | SELU → −s·α ≈ −1.758 (figure ≈ −1.76); slightly steeper than ELU for z ≥ 0 | floor.selu, nameWhy.selu | L2 · 16–17 | VERIFIED | — |
| 20 | SELU's exact three constraints: standardized inputs (mean 0, sd 1); LeCun normal on every hidden layer; no ℓ1/ℓ2, max-norm, batch-norm or dropout | SELU.conditions, SELU.why | L2 · 16 | VERIFIED | — |
| 21 | All 8 checklist distractors are false per slide 16 ([0,1] scaling, He normal, LeCun *uniform*, Glorot default, BN each layer, dropout, ℓ2, clipnorm) | SELU.distractors | L2 · 16 | VERIFIED | — |
| 22 | "SELU preserves the mean and variance … **only if** the slide's constraints hold" | SELU.prompt | L2 · 16 | NOT IN SLIDES | slide says "**if** the following constraints are imposed" (sufficient, not necessary): write "if" |
| 23 | Slide 22: ReLU for simple tasks (fast, hardware); SiLU the better default for complex (try parametrized Swish, tune β); Mish slightly better, more compute; latency → leaky ReLU or PReLU; very deep MLPs → SELU with slide 16's constraints | WHICH_ACT.cues | L2 · 22 | VERIFIED | — |
| 24 | whichAct distractors never include an option the slide also allows for that cue | WHICH_ACT.cues[].others | L2 · 22 | VERIFIED | — |
| 25 | whichAct fixes use Table 11-1 inits (ReLU, SiLU, Mish, leaky → He; SELU → LeCun) | WHICH_ACT.options, .after | L2 · 8 | VERIFIED | — |
| 26 | Distractor formulas: ReLU = max(0, z) (footnote); GELU = zΦ(z), Φ the standard Gaussian CDF; SiLU = zσ(z), named Swish by Ramachandran et al.; Mish = z·tanh(softplus(z)), softplus = log(1 + exp(z)) | CURVES.formulas | L2 · 10, 18, 19, 20 | VERIFIED | — |
| 27 | BN's four equations: μ_B and σ²_B with 1/m_B, x̂ = (x − μ_B)/√(σ²_B + ε), z = γ ⊗ x̂ + β | MATHS.bn, BN.why, bnBatch | L2 · 24 | VERIFIED | — |
| 28 | ε left out: "the slide gives it no value" | BN.epsNote | L2 · 24 | VERIFIED | — |
| 29 | γ and β are trainable, one parameter per input feature, learned with the connection weights | BN.choiceItems.trainable, count.trainable | L2 · 23–24 | VERIFIED | — |
| 30 | At test time BN uses the moving averages estimated over the training mini-batches, which are not trained | testTime, count.nonTrainable | L2 · 23 | VERIFIED | — |
| 31 | Param # = 4n (3,136 / 1,200 / 400 for 784 / 300 / 100); non-trainable 2,368 = 2 × (784 + 300 + 100) | BN.count | L2 · 27 | VERIFIED | — |
| 32 | Ioffe & Szegedy: saturating activations (e.g. tanh) usable; much larger learning rates; BN acts like a regularizer, less need for dropout | BN.benefit | L2 · 25 | VERIFIED | — |
| 33 | The "saturating" benefit item asks about *vanishing* gradients being reduced, but 2 of its 3 "before" stacks (tanh/N(0,1) ×657, ReLU/N(0,1) ×2.3e6) draw *exploding* ∂L/∂z | bnBenefit + SCENES.bnHeals | L2 · 25 | AMBIGUOUS | pair the "saturating" benefit with sigmoid/N(0,1) (the sim vanishes there, ×0.084), or keep tanh/ReLU only for the learning-rate item |
| 34 | "Healed by BN … with the same N(0, 1) init": all three bnHeals stacks reach 10/10 healthy with BN before f (the page's own sim, so labelled) | BN.after, SIM.ownBn | L2 · 24, 28 (own sim) | VERIFIED | — |
| 35 | Slide 26 puts BN after Flatten and after each of the two hidden layers (Dense keeps activation="relu") | slide26, PlacementScene B | L2 · 26 | VERIFIED | — |
| 36 | BN paper authors: BN before the activation; Activation as a separate layer; use_bias=False on the Dense before it | paper, useBias, PlacementScene A | L2 · 28 | VERIFIED | — |
| 37 | Sim BN sits before each activation "as slide 28 does", training mode, γ = 1, β = 0 | SIM.ownBn | L2 · 24, 28 | VERIFIED | — |
| 38 | clipvalue=1.0 clips every component to [−1.0, 1.0]; clipnorm=1.0 keeps the orientation (so clipvalue can change the direction) | CLIP.facts range/orientation, vectorWhy | L2 · 29 | VERIFIED | — |
| 39 | Clipping lessens exploding gradients; mostly useful for RNNs, as BN is tricky to use in RNNs | CLIP.facts problem/rnn | L2 · 29 | VERIFIED | — |
| 40 | clipnorm by hand, g · 1/max(‖g‖, 1), is marked `beyond: true` with a note that the slide only says "retains orientation" | clipNormItem, CLIP.normNote | L2 · 29 | VERIFIED (beyond) | — |
| 41 | clipNorm why for g = (0.3, 0.4) reads "‖g‖ = 0.5, so g × 1.0/0.5 = (0.3, 0.4)". That is false (g × 2 = (0.6, 0.8)). Hit in 75 of 578 clipNorm items in the sweep | CLIP.normWhy (clipNorm-*, g = (0.3, 0.4)) | L2 · 29 | WRONG | when ‖g‖ ≤ 1 use a second template: "‖g‖ = 0.5 ≤ 1.0, so g is left unchanged: (0.3, 0.4)" |
| 42 | Concept slides for the 14 concept ids (init.* 5–9 and 16, act.* 11–17 and 22, bn.* 23–28, clip 29) all teach their concept | content/lecture2.js | L2 · 5–29 | VERIFIED | — |
| 43 | Item receipts (`src`) cite the slide that says the claim, including whichInit's +6 or +9 for the N(0,1) or Keras-default scene | all builders | L2 · 5–29 | VERIFIED | — |
| 44 | Why-text arithmetic prints double minus, "(6 - -1)/√25" and "3 × -1 + 2". The values are right | BN.why xhat/z (tx of negatives) | L2 · 24 | VERIFIED | cosmetic: parenthesize negatives, (6 − (−1)), 3 × (−1) + 2 |
| 45 | heVar prompt "for a ELU layer" | TEXT.heVar with act = ELU | L2 · 8 | VERIFIED | cosmetic: "an ELU" (article by act) |

Note: the sim gives sigmoid on Glorot a layer-1 ∂L/∂z ratio of 1.9e‑6 (vanishing), even though Table 11-1 pairs the two. The builder kept sigmoid out of every stack scene, so the page never shows this. Keep it that way: any future scene with sigmoid on Glorot would contradict slide 7/8's pairing on screen. No diagnose scene uses sigmoid or tanh, so verdict() can never return "saturated" there, which is not one of the three choices.

## Blind sample (68 items; I worked each from the prompt before reading the key)

| # | item (level/seed) | prompt (short) | mine | game | match |
|---|---|---|---|---|---|
| 1 | whichAct (1/101) | complex task, better default | SiLU (Swish) | SiLU (Swish) | ✓ |
| 2 | whichInit | SELU on N(0,1) → Table 11-1 | LeCun | LeCun | ✓ |
| 3 | fanAvg | 100, 700 | 400 | 400 | ✓ |
| 4 | whichInit | Mish on Glorot uniform | He | He | ✓ |
| 5 | kerasDefault | Dense(50), no initializer | Glorot uniform | Glorot uniform | ✓ |
| 6 | glorotVar | 16, 64 | 1/40 = 0.025 | 0.025 | ✓ |
| 7 | whichInitRev | LeCun ↔ ? | SELU | SELU | ✓ |
| 8 | diagnose | GELU on Glorot uniform | vanishing | vanishing | ✓ |
| 9 | glorotLimit | 120, 30 | √(3/75) = 0.2 | 0.2 | ✓ |
| 10 | heVar | ELU, fan_in 50 | 0.04 | 0.04 | ✓ |
| 11 | whichAct (1/102) | complex task, better default | SiLU | SiLU | ✓ |
| 12 | whichInit | ReLU on N(0,1) | He | He | ✓ |
| 13 | fanAvg | 90, 10 | 50 | 50 | ✓ |
| 14 | whichInit | tanh on N(0,1) | Glorot | Glorot | ✓ |
| 15 | culprit | which two things | sigmoid + N(0,1) | sigmoid + N(0,1) | ✓ |
| 16 | glorotVar | 100, 900 | 1/500 = 0.002 | 0.002 | ✓ |
| 17 | whichInitRev | Glorot ↔ ? | tanh | tanh | ✓ |
| 18 | diagnose | SELU on N(0,1) | exploding | exploding | ✓ |
| 19 | glorotLimit | 4, 20 | √(3/12) = 0.5 | 0.5 | ✓ |
| 20 | lecunVar | fan_in 50 | 0.02 | 0.02 | ✓ |
| 21 | whichInit (2/203) | GELU on Glorot uniform | He | He | ✓ |
| 22 | leakyAlpha | small constant example | 0.01 | 0.01 | ✓ |
| 23 | curveName | plotted (SELU curve) | SELU | SELU | ✓ |
| 24 | seluConstants | s, α | 1.0507, 1.6733 | same | ✓ |
| 25 | formulaName | max(αz, z) | leaky ReLU | leaky ReLU | ✓ |
| 26 | leakyValue | α 0.3, z −5 | −1.5 | −1.5 | ✓ |
| 27 | seluConditions | 6 options | standardized · LeCun normal · no reg | same | ✓ |
| 28 | eluFloor | SELU | −1.0507·1.6733 = −1.758 | −1.758 | ✓ |
| 29 | curveName | plotted (ELU α 1) | ELU | ELU | ✓ |
| 30 | whichInitRev | LeCun ↔ ? | SELU | SELU | ✓ |
| 31 | whichInit (2/204) | SELU on N(0,1) | LeCun | LeCun | ✓ |
| 32 | leakyAlpha | small constant example | 0.01 | 0.01 | ✓ |
| 33 | curveName | plotted (leaky 0.2) | leaky ReLU | leaky ReLU | ✓ |
| 34 | seluConstants | s, α | 1.0507, 1.6733 | same | ✓ |
| 35 | formulaName | α(exp z − 1) / z cases | ELU | ELU | ✓ |
| 36 | leakyValue | α 0.01, z −10 | −0.1 | −0.1 | ✓ |
| 37 | seluConditions | 6 options (LeCun uniform trap) | standardized · LeCun normal · no reg | same | ✓ |
| 38 | eluFloor | ELU α 1 | −1 | −1 | ✓ |
| 39 | curveName | plotted (SELU) | SELU | SELU | ✓ |
| 40 | whichInitRev | Glorot ↔ ? | None (linear) | None (linear) | ✓ |
| 41 | diagnose (3/305) | SELU on LeCun | healthy | healthy | ✓ |
| 42 | bnBenefit | trained with … | much larger LRs | much larger LRs | ✓ |
| 43 | bn-mu | [13, −1, 5, 7] | 24/4 = 6 | 6 | ✓ |
| 44 | testTime | mean/var at test | moving averages | moving averages | ✓ |
| 45 | bn-var | [5, 4, 6, 2, 8] | 20/5 = 4 | 4 | ✓ |
| 46 | slide26 | where is BN | after Flatten + both hidden | same | ✓ |
| 47 | range | clipvalue=1.0 range | [−1.0, 1.0] | same | ✓ |
| 48 | bn-xhat | [0, −2, −8, 6], x = 6 | μ −1, σ² 25 → 1.4 | 1.4 | ✓ |
| 49 | bnCount-total | 64 features | 256 | 256 | ✓ |
| 50 | clipVector | (0.9, 2.5) | (0.9, 1) | (0.9, 1) | ✓ |
| 51 | whichInit (3/306) | leaky on Glorot uniform | He | He | ✓ |
| 52 | bnBenefit | could use … | saturating, e.g. tanh | same | ✓ |
| 53 | bn-mu | [3, 1, 1, 3] | 2 | 2 | ✓ |
| 54 | trainable | which learnt | γ and β | γ and β | ✓ |
| 55 | bn-var | [−4, 0, 0, −4] | 4 | 4 | ✓ |
| 56 | slide26 | where is BN | after Flatten + both hidden | same | ✓ |
| 57 | range | clipvalue=1.0 range | [−1.0, 1.0] | same | ✓ |
| 58 | bn-z | γ 3, β 2, [0, −2], x = −2 | x̂ −1 → z −1 | −1 | ✓ |
| 59 | bnCount-total | 784 features | 3,136 | 3136 | ✓ |
| 60 | clipVector | (−0.7, −2.4, −1.5) | (−0.7, −1, −1) | same | ✓ |
| 61 | bn-xhat (3/1) | [9, 7], x = 7 | −1 | −1 | ✓ |
| 62 | bn-xhat (3/2) | [11, 9], x = 9 | −1 | −1 | ✓ |
| 63 | bn-z (3/3) | γ 2, β 1, [7, 1], x = 1 | x̂ −1 → −1 | −1 | ✓ |
| 64 | clipNorm (3/6, beyond) | (12, −16) | ‖g‖ 20 → (0.6, −0.8) | same | ✓ |
| 65 | clipNorm (3/7, beyond) | (0.3, 0.4) | ‖g‖ 0.5 ≤ 1 → unchanged | (0.3, 0.4) | ✓ (answer right; why text wrong, row 41) |
| 66 | bn-z (3/7) | γ 2, β 1, [6, 6, 10, 10], x = 10 | x̂ 1 → 3 | 3 | ✓ |
| 67 | clipNorm (3/8, beyond) | (3, 4) | (0.6, 0.8) | same | ✓ |
| 68 | bn-z (3/8) | γ 2, β 0.5, [8, 4, 8, 4], x = 8 | x̂ 1 → 2.5 | 2.5 | ✓ |

## Summary
1. Counts: VERIFIED 42 (1 beyond: clipnorm by hand, flagged correctly; rows 44–45 carry cosmetic fixes) · WRONG 1 · NOT IN SLIDES 1 · AMBIGUOUS 1. Blind sample: 68/68 match. Sweep: 90,000 items, 0 numeric mismatches.
2. Fix 1 (WRONG): the clipNorm why for g = (0.3, 0.4) claims "g × 1.0/0.5 = (0.3, 0.4)". Give the ‖g‖ ≤ 1 case its own template ("left unchanged"). This hits 13% of clipNorm items.
3. Fix 2 (NOT IN SLIDES): the SELU checklist prompt says "only if the slide's constraints hold". Slide 16 says "if … imposed", so use "if".
4. Fix 3 (AMBIGUOUS): the "saturating" BN-benefit item talks about vanishing gradients but can draw an exploding tanh or ReLU N(0,1) stack. Pair it with sigmoid/N(0,1), which vanishes in the sim.
5. Fix 4 (cosmetic): parenthesize negatives in the BN why texts ("6 − (−1)", "3 × (−1) + 2") and fix "a ELU" → "an ELU". Keep sigmoid out of Glorot stack scenes (the sim vanishes there, which would contradict Table 11-1 on screen).
