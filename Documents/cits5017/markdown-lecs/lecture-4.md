# CITS5017 Deep Learning

Topic 4: Processing Sequences Using RNNs and CNNs — Associate Professor Du Huynh (Unit Coordinator and Lecturer) — Semester 2, 2026

*Transcription conventions (part 1, slides 1–18): key terms that are dark red on the slides are written in **bold** (dark-red italic → ***bold italic***); black italic stays *italic*. Maths that is typeset in blue on the slides is written as plain LaTeX. The transpose glyph used throughout the deck is ⊤ (written `^\top`). Activation functions use the curly phi glyph φ (written `\varphi`).*

---

## Slide 1 — CITS5017 Deep Learning / Topic 4: Processing Sequences Using RNNs and CNNs

Associate Professor Du Huynh
(Unit Coordinator and Lecturer)
UWA

Semester 2, 2026

> **Figure (slide 1).** Title banner: white text on a dark-blue rectangle, three centred lines: "CITS5017 Deep Learning", "Topic 4: Processing Sequences Using RNNs", "and CNNs". Below the lecturer/date lines is the UWA crest: a shield whose upper band (chief) is blue with a gold top edge and holds two open books, each showing two pages of text — the left book reads "VIT AM" / "EXC OLU", the right book reads "ERE PER" / "AR TES" (i.e. *Vitam excolere per artes*). The lower part of the shield is blue with a gold/yellow field in the centre on which sits a black swan with a white wing. Beneath the shield is a blue ribbon with white text "SEEK WISDOM". Below the crest is the blue wordmark "THE UNIVERSITY OF / WESTERN / AUSTRALIA". (No slide number is shown on this slide.)

---

## Slide 2 — Today

Chapters 15.

### Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow

> **Figure (slide 2).** Small book-cover image, O'REILLY. Top-left: red "O'REILLY" logo. Top-right corner: a diagonal grey banner reading "Third Edition". Title in black: "Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow". Subtitle in orange: "Concepts, Tools, and Techniques to Build Intelligent Systems". Below it, tiny "powered by" text with a Jupyter logo. Cover illustration: a black salamander with bright yellow spots and stripes, crawling diagonally across the lower half. Author name at bottom right: "Aurélien Géron".

---

## Slide 3 — Chapter Fifteen

### Processing Sequences Using RNNs and CNNs

Here are the main topics we will briefly cover:

- Various application areas of RNNs
- Recurrent neurons
- Memory cells
- Input and output sequences
- Basic RNNs in TensorFlow
- Handling variable length input and output sequences
- Training to predict time series
- Deep RNNs
- Difficulty of training over many time steps
- LSTM architecture

---

## Slide 4 — Recurrent Neural Networks and Various Applications

- ***Recurrent neural networks*** (**RNNs**) is a class of nets that can predict the future (well, up to a point, of course). They can analyze time series data such as stock prices, and tell you when to buy or sell. In autonomous driving systems, they can anticipate car trajectories and help avoid accidents. More generally, they can work on sequences of arbitrary lengths, rather than on fixed-sized inputs like all the nets we have discussed so far.
- As RNNs can take sentences, documents, or audio samples as input, they can be used in automatic translation, speech-to-text, ***sentiment analysis***, or generating the next notes in a melody (e.g., see Google's ***Magenta project*** (`https://magenta.tensorflow.org/`).

(The URL is in a small blue typewriter font.)

---

## Slide 5 — Recurrent Neurons

- So far we have mostly looked at feedforward neural networks, where the activations flow only in one direction, from the input layer to the output layer. A ***recurrent neural network*** (**RNN**) looks very much like a feedforward neural network, except it also has connections pointing backward.
- The simplest possible RNN, composed of just one neuron receiving inputs, producing an output, and sending that output back to itself, as shown in the left diagram.
- At each time step $t$ (also called a ***frame***), this recurrent neuron may receive the inputs $\mathbf{x}_{(t)}$ and its own output from the previous time step, $\hat{\mathbf{y}}_{(t-1)}$. This is called ***unrolling the network through time*** (right diagram).

(Layout: the second bullet's text sits on the left; Figure 15-1 sits to its right; the third bullet runs full width below.)

> **Figure 15-1.** Two diagrams on a white background; all symbol labels in the figure are non-bold italic (scalar style). Each neuron is drawn as a light-blue circle split horizontally into two halves: the top half contains a ramp/ReLU-like activation glyph (a flat segment followed by a rising diagonal), the bottom half contains "Σ".
> *Left diagram (recurrent neuron):* a single neuron. An arrow rises from the label "$x$" below into the bottom of the neuron; an arrow rises from the top of the neuron to the label "$\hat{y}$" above. A feedback loop leaves the top-right of the neuron, arcs to the right and down the right-hand side, and re-enters the bottom of the neuron with an upward arrowhead (next to the $x$ input arrow).
> *Right diagram (unrolled through time):* four copies of the neuron in a row, left to right. Below them the inputs "$x_{(0)}$", "$x_{(1)}$", "$x_{(2)}$", "$x_{(3)}$", each with an upward arrow into its neuron; above them the outputs "$\hat{y}_{(0)}$", "$\hat{y}_{(1)}$", "$\hat{y}_{(2)}$", "$\hat{y}_{(3)}$", each with an upward arrow out of its neuron. At the far left a "0" with a curved line that dips down and enters the bottom of the first neuron with an upward arrowhead (initial previous output). From the top of each neuron a curved line arcs over to the right, drops down past the neuron, and enters the bottom of the next neuron with an upward arrowhead (beside that neuron's $x$ input). After the fourth neuron the curved line drops into a short vertical dashed line, indicating continuation. Underneath the whole unrolled diagram is a long thick horizontal arrow pointing right, labelled "Time" (bold) at its head.

*Caption:* Figure 15-1. A recurrent neuron (left), unrolled through time (right)

---

## Slide 6 — Recurrent Neurons

A layer of recurrent neurons can be easily created. At each time step $t$, every neuron receives both the input vector $\mathbf{x}_{(t)}$ and the output vector from the previous time step $\mathbf{y}_{(t-1)}$, as shown below. Note that both the inputs and outputs are vectors now (when there was just a single neuron, the output was a scalar).

> **Figure 15-2.** Two diagrams; labels in the figure are bold (vector style).
> *Left diagram (a layer of recurrent neurons):* a pale-yellow rounded rectangle containing five neurons in a row. Each neuron is a light-blue circle split horizontally: top half shows the ramp/ReLU-like activation glyph, bottom half shows "Σ". A vertical line rises from the top of each neuron to a common horizontal line above the box; from the centre of this line an arrow rises to the label "$\hat{\mathbf{y}}$", and a further arrow continues upward above "$\hat{\mathbf{y}}$" (the layer's output). From "$\hat{\mathbf{y}}$" a line runs right, curves down the right-hand side outside the yellow box, and ends at a point below the bottom-right of the box; from that point five arrows fan out up-left into the bottoms of all five neurons (the feedback of the previous output). From the label "$\mathbf{x}$" at the bottom centre, five arrows fan out up into the bottoms of all five neurons. So every neuron receives arrows from both $\mathbf{x}$ and the fed-back $\hat{\mathbf{y}}$.
> *Right diagram (unrolled through time):* three pale-yellow rounded rectangles in a row, left to right, each containing a row of five small light-blue circles (the layer). Below them "$\mathbf{x}_{(0)}$", "$\mathbf{x}_{(1)}$", "$\mathbf{x}_{(2)}$" with upward arrows into the boxes; above them "$\hat{\mathbf{y}}_{(0)}$", "$\hat{\mathbf{y}}_{(1)}$", "$\hat{\mathbf{y}}_{(2)}$" with upward arrows out of the boxes. At the far left a bold "0" with a curved line that dips down and enters the bottom of the first box with an upward arrowhead. From the top of each box a curved line arcs right, drops down, and enters the bottom of the next box with an upward arrowhead; after the third box the curve drops into a short vertical dashed line (continuation). A long thick arrow beneath points right, labelled "Time" (bold).

*Caption:* Figure 15-2. A layer of recurrent neurons (left), unrolled through time (right)

---

## Slide 7 — Memory Cells

- Notice that $\mathbf{y}_{(2)}$ depends on $\mathbf{x}_{(2)}$ and $\mathbf{y}_{(1)}$, which in turn depends on $\mathbf{x}_{(1)}$ and $\mathbf{y}_{(0)}$, and so on. So $\mathbf{y}_{(t)}$ is a function of all the inputs since time $t = 0$, i.e., $\mathbf{x}_{(0)}, \mathbf{x}_{(1)}, \cdots, \mathbf{x}_{(t)}$.
- Since the output of a recurrent neuron at time step $t$ is a function of all the inputs from previous time steps, you could say it has a form of ***memory***. A part of a neural network that preserves some state across time steps is called a ***memory cell*** (or simply a ***cell***).
- A single recurrent neuron, or a layer of recurrent neurons, is a very basic cell. There are more complex and powerful types of cells in more complex networks.

---

## Slide 8 — Memory Cells

We use $\mathbf{h}_{(t)}$ (where "h" stands for "hidden") to denote a **cell's state** at time step $t$. In general, a cell's state at time step $t$ is a function of some inputs at $t$ and its state at $t-1$, i.e., $\mathbf{h}_{(t)} = f(\mathbf{x}_{(t)}, \mathbf{h}_{(t-1)})$. Its output $\hat{\mathbf{y}}_{(t)}$ is also a function of the previous state and the current inputs.

> **Figure 15-3.** Two diagrams; labels are bold (vector style). Cells are drawn as pale-yellow rounded rectangles (no internal detail).
> *Left diagram:* one cell. An arrow rises from "$\mathbf{x}$" below into the cell; an arrow rises from the cell to "$\hat{\mathbf{y}}$" above. A loop leaves the top-right of the cell, arcs right and down, and re-enters the bottom of the cell with an upward arrowhead; the loop is labelled "$\mathbf{h}$" on its right side.
> *Right diagram (unrolled):* three cells in a row, left to right. Inputs "$\mathbf{x}_{(0)}$", "$\mathbf{x}_{(1)}$", "$\mathbf{x}_{(2)}$" below with upward arrows; outputs "$\hat{\mathbf{y}}_{(0)}$", "$\hat{\mathbf{y}}_{(1)}$", "$\hat{\mathbf{y}}_{(2)}$" above with upward arrows. Straight horizontal right-pointing arrows connect cell 1 → cell 2 (labelled "$\mathbf{h}_{(0)}$" below the arrow) and cell 2 → cell 3 (labelled "$\mathbf{h}_{(1)}$" below the arrow). After the third cell, a short horizontal dashed line continues to the right. There is no initial-state input drawn on the left of the first cell. A long thick arrow beneath points right, labelled "Time" (bold).

*Caption:* Figure 15-3. A cell's hidden state and its output may be different

---

## Slide 9 — Memory Cells

Mathematically, we have

$$
\begin{aligned}
\mathbf{h}_{(t)}^{\top} &= \varphi_h\left(\mathbf{h}_{(t-1)}^{\top}\mathbf{W}_h + \mathbf{x}_{(t)}^{\top}\mathbf{W}_x + \mathbf{b}_h^{\top}\right)\\
\mathbf{y}_{(t)}^{\top} &= \varphi_y\left(\mathbf{h}_{(t)}^{\top}\mathbf{W}_y + \mathbf{b}_y^{\top}\right)
\end{aligned}
$$

where

$\mathbf{x}_{(t)}^{\top}$ is an input instance (an $n_{\text{inputs}}$-dimensional row vector) at time step $t$;

$\mathbf{y}_{(t)}^{\top}$ is the corresponding output instance (an $n_{\text{outputs}}$-dimensional row vector);

$\mathbf{h}_{(t)}^{\top}$ is the hidden state vector (an $n_{\text{neurons}}$-dimensional row vector) at time step $t$;

$\mathbf{W}_h$ ($n_{\text{neurons}} \times n_{\text{neurons}}$), $\mathbf{W}_x$ ($n_{\text{inputs}} \times n_{\text{neurons}}$), and $\mathbf{W}_y$ ($n_{\text{neurons}} \times n_{\text{outputs}}$) are unknown weight matrices that need to be learned from the training process;

$\mathbf{b}_h^{\top}$ ($n_{\text{neurons}}$-dimensional row vector) and $\mathbf{b}_y^{\top}$ ($n_{\text{outputs}}$-dimensional row vector) are bias vectors that need to be learned also;

$\varphi_h$ is an appropriate activation function (e.g., ReLU, tanh);

$\varphi_y$ is an appropriate activation function (e.g., sigmoid for binary classification, or softmax combined with cross-entropy for multi-class classification)

(The definitions are set as hanging-indent lines with no bullet glyphs, in a smaller font than the body. The subscripts "inputs", "outputs", "neurons" are upright sans-serif text. In the display equations the ⊤ sits directly above the time-step subscript, e.g. $\mathbf{h}^{\top}_{(t-1)}$; $\mathbf{y}$ on the left-hand side of the second equation has **no hat**.)

---

## Slide 10 — Memory Cells (cont.)

For example, the inputs could be the ***temperatures***, ***precipitations***, ***atmospheric pressures***, and ***wind speeds*** for three consecutive days (so $\mathbf{x}_{(0)}, \mathbf{x}_{(1)}, \mathbf{x}_{(2)} \in \mathbb{R}^4$) and we want to train a simple RNN with $5$ neurons to predict the ***temperature*** and ***precipitation*** for the following day (i.e., predict $\hat{\mathbf{y}}_{(3)} \in \mathbb{R}^2$).

#### Left — figure (no figure number)

> **Figure (slide 10).** Three identical yellow rounded rectangles in a row, left to right, each containing the bold black text "RNN cell" and below it "(5 neurons)". All maths labels are blue.
> - Horizontal state arrows (black, pointing right): an arrow enters the first cell from the left (no source drawn), labelled "$\mathbf{h}_{(0)}^{\top}$" above it; an arrow from cell 1 to cell 2 labelled "$\mathbf{h}_{(1)}^{\top}$"; an arrow from cell 2 to cell 3 labelled "$\mathbf{h}_{(2)}^{\top}$". No state arrow leaves the third cell.
> - Inputs (below, black arrows pointing up into each cell): "$\mathbf{x}_{(0)}^{\top} \in \mathbb{R}^4$", "$\mathbf{x}_{(1)}^{\top} \in \mathbb{R}^4$", "$\mathbf{x}_{(2)}^{\top} \in \mathbb{R}^4$".
> - Outputs (above, black arrows pointing up out of each cell): "$\hat{\mathbf{y}}_{(1)}^{\top} \in \mathbb{R}^2$", "$\hat{\mathbf{y}}_{(2)}^{\top} \in \mathbb{R}^2$", "$\hat{\mathbf{y}}_{(3)}^{\top} \in \mathbb{R}^2$". The first two output labels have the black text "(Discarded)" written above them; the third ($\hat{\mathbf{y}}_{(3)}^{\top}$) has no such label.
> - Index pairing as drawn: the cell fed $\mathbf{x}_{(0)}$ and $\mathbf{h}_{(0)}$ emits $\hat{\mathbf{y}}_{(1)}$ and $\mathbf{h}_{(1)}$; the cell fed $\mathbf{x}_{(1)}$ emits $\hat{\mathbf{y}}_{(2)}$ and $\mathbf{h}_{(2)}$; the cell fed $\mathbf{x}_{(2)}$ emits $\hat{\mathbf{y}}_{(3)}$.

#### Right — text

Then

$\mathbf{W}_h \in \mathbb{R}^{5\times 5}$ and $\mathbf{h}_{(t)} \in \mathbb{R}^5$,
$\mathbf{W}_x \in \mathbb{R}^{4\times 5}$,
$\mathbf{W}_y \in \mathbb{R}^{5\times 2}$.

#### Below

We are interested only in $\hat{\mathbf{y}}_{(3)}$, which will be compared with the ground truth $\mathbf{y}_{(3)}$ in the loss function (e.g., average MSE).

The initial hidden state vector $\mathbf{h}_{(0)}^{\top}$ for each training instance is usually set to a zero vector.

---

## Slide 11 — Memory Cells (cont.)

> **Figure (slide 11).** The same three-cell diagram as on slide 10, reproduced at a smaller size and centred at the top of the slide: three yellow rounded rectangles "RNN cell (5 neurons)"; state arrows pointing right labelled $\mathbf{h}_{(0)}^{\top}$ (entering cell 1 from the left), $\mathbf{h}_{(1)}^{\top}$, $\mathbf{h}_{(2)}^{\top}$; inputs below $\mathbf{x}_{(0)}^{\top} \in \mathbb{R}^4$, $\mathbf{x}_{(1)}^{\top} \in \mathbb{R}^4$, $\mathbf{x}_{(2)}^{\top} \in \mathbb{R}^4$; outputs above $\hat{\mathbf{y}}_{(1)}^{\top} \in \mathbb{R}^2$ "(Discarded)", $\hat{\mathbf{y}}_{(2)}^{\top} \in \mathbb{R}^2$ "(Discarded)", $\hat{\mathbf{y}}_{(3)}^{\top} \in \mathbb{R}^2$.

Let $m$ be our minibatch size. Then our training data $\mathbf{X}_{(t)} \in \mathbb{R}^{m\times 4}$ and $\mathbf{Y}_{(t)} \in \mathbb{R}^{m\times 2}$, for all $t$, and the equations on slide 9 become

$$
\mathbb{R}^{m\times 5} \ni \mathbf{H}_{(t)} = \varphi_h\left(\mathbf{H}_{(t-1)}\mathbf{W}_h + \mathbf{X}_{(t)}\mathbf{W}_x + \mathbf{B}_h\right)
$$

$$
\mathbb{R}^{m\times 2} \ni \hat{\mathbf{Y}}_{(t)} = \varphi_y\left(\mathbf{H}_{(t)}\mathbf{W}_y + \mathbf{B}_y\right)
$$

where

$$
\mathbf{B}_h = \begin{bmatrix} \mathbf{b}_h^{\top} \\ \vdots \\ \mathbf{b}_h^{\top} \end{bmatrix} \in \mathbb{R}^{m\times 5}
\quad \text{and} \quad
\mathbf{B}_y = \begin{bmatrix} \mathbf{b}_y^{\top} \\ \vdots \\ \mathbf{b}_y^{\top} \end{bmatrix} \in \mathbb{R}^{m\times 2}
$$

The training data are usually set up as 3D tensors: $\mathbf{X} \in \mathbb{R}^{N\times 3\times 4}$ and $\mathbf{Y} \in \mathbb{R}^{N\times 2}$ for this example, where $N$ is the training set size.

(The "9" in "slide 9" is red — a hyperlink. The "and" between the two $\mathbf{B}$ matrices is blue text inside the display. The matrices $\mathbf{H}$, $\mathbf{X}$, $\mathbf{W}$, $\mathbf{B}$, $\hat{\mathbf{Y}}$ have no transposes; the transposes appear only on the $\mathbf{b}^{\top}$ rows inside $\mathbf{B}_h$, $\mathbf{B}_y$.)

---

## Slide 12 — Input and Output Sequences

1. An RNN can take a sequence of inputs and produce a sequence of outputs, e.g., take $N$ days of stock prices as input and produce the stock prices of $N-1$ ago and of tomorrow.
2. An RNN can take a sequence of inputs and produce a single output at the last step, e.g., take in a sequence of words from a movie review and output a sentiment score (0 (bad) ... 4 (good))
3. An RNN can take a single input at $t = 0$ (and zeros for other time steps) and produce a sequence of outputs, e.g., take in an image and produce a sequence of words that could be a caption of that image.
4. Lastly, you could have a sequence-to-vector network, called an ***encoder***, followed by a vector-to-sequence network, called a ***decoder***. This two-step model is called an ***encoder-decoder***. e.g., translating a sentence from one language to another language.

Recall that an *input* is just a vector (or a number) and an *output* is another vector (or number).

(The list numbers are white digits in small dark-blue squares. The final "Recall …" sentence is in a smaller font, with "input" and "output" in black italic.)

---

## Slide 13 — Input and Output Sequences

> **Figure 15-4.** A 2 × 2 grid of four unrolled-RNN diagrams. In every panel, cells are rounded squares, time runs left to right, consecutive cells are joined by solid black right-pointing arrows, inputs sit below with upward arrows into the cells, and outputs sit above with upward arrows out of the cells. No initial-state input is drawn on the left of any chain.
> - **Top left (sequence-to-sequence):** five pale-yellow cells. Inputs (left to right): "$x_{(0)}$" (lowercase x), "$X_{(1)}$", "$X_{(2)}$", "$X_{(3)}$", "$X_{(4)}$". Outputs: "$Y_{(0)}$" (no hat), "$\hat{Y}_{(1)}$", "$\hat{Y}_{(2)}$", "$\hat{Y}_{(3)}$", "$\hat{Y}_{(4)}$". All arrows and labels black.
> - **Top right (sequence-to-vector):** four pale-yellow cells. Inputs "$X_{(0)}$", "$X_{(1)}$", "$X_{(2)}$", "$X_{(3)}$" (black). The first three outputs "$\hat{Y}_{(0)}$", "$\hat{Y}_{(1)}$", "$\hat{Y}_{(2)}$" and their arrows are greyed out and enclosed in a grey dashed rounded box labelled "Ignored outputs" (grey text). Only the last output "$\hat{Y}_{(3)}$" is black.
> - **Bottom left (vector-to-sequence):** four pale-yellow cells. Every cell receives the same input labelled "X" (no subscript) from below. Outputs "$\hat{Y}_{(0)}$", "$\hat{Y}_{(1)}$", "$\hat{Y}_{(2)}$", "$\hat{Y}_{(3)}$" (black).
> - **Bottom right (encoder-decoder):** two black dashed rounded boxes side by side. The left box is labelled "Encoder" (grey text) and contains two pale-yellow cells with black inputs "$X_{(0)}$", "$X_{(1)}$" and greyed-out outputs "$\hat{Y}_{(0)}$", "$\hat{Y}_{(1)}$" (grey arrows/labels). A black arrow from the second encoder cell crosses the dashed boundary into the right box, labelled "Decoder" (black bold text), which contains three orange/peach cells joined by right arrows; their inputs are grey "0" labels with grey upward arrows, and their outputs are black "$\hat{Y}'_{(0)}$", "$\hat{Y}'_{(1)}$", "$\hat{Y}'_{(2)}$".

*Caption:* Figure 15-4. Sequence-to-sequence (top left), sequence-to-vector (top right), vector-to-sequence (bottom left), and encoder-decoder (bottom right) networks

---

## Slide 14 — Training RNNs

To train an RNN, the trick is to unroll it through time (like we just did) and then use regular backpropagation (Figure 15-5). This strategy is called ***backpropagation through time*** (**BPTT**).

#### Left — figure

> **Figure 15-5.** Five pale-yellow rounded cells in a row, left to right, each labelled "W,b" in bold black (the same parameters at every step).
> - Inputs below: "$X_{(0)}$" … "$X_{(4)}$" in grey, each with a grey **dashed** upward arrow into its cell.
> - Between consecutive cells: a grey **dashed** arrow pointing **right** (forward pass, upper half) and a black **solid** arrow pointing **left** (backward gradient flow, lower half).
> - Outputs: "$\hat{Y}_{(0)}$" and "$\hat{Y}_{(1)}$" are grey, each reached by a grey dashed upward arrow only (not used by the loss). "$\hat{Y}_{(2)}$", "$\hat{Y}_{(3)}$", "$\hat{Y}_{(4)}$" are black; each has a grey dashed upward arrow from its cell to the label and a black solid downward arrow from the label back into its cell.
> - At the top: the loss expression "$\mathscr{L}(Y_{(2)}, Y_{(3)}, Y_{(4)}; \hat{Y}_{(2)}, \hat{Y}_{(3)}, \hat{Y}_{(4)})$" — script L, with the targets $Y_{(2)}, Y_{(3)}, Y_{(4)}$ (no hats) printed in **green** and the predictions $\hat{Y}_{(2)}, \hat{Y}_{(3)}, \hat{Y}_{(4)}$ in black. From each of $\hat{Y}_{(2)}$, $\hat{Y}_{(3)}$, $\hat{Y}_{(4)}$ a grey dashed arrow points up to the loss, and a black solid arrow points from the loss down to that $\hat{Y}$ (diagonal for $\hat{Y}_{(2)}$ and $\hat{Y}_{(3)}$, vertical for $\hat{Y}_{(4)}$).

*Caption:* Figure 15-5. Backpropagation through time

#### Right — text

$\left\{\mathbf{X}_{(t)} \,|\, t = 0, ..., 4\right\}$ denotes the batch of training sequences fed into the network;

$\left\{\hat{\mathbf{Y}}_{(t)} \,|\, t = 0, ..., 4\right\}$ denotes the corresponding computed output.

#### Below

In the example above, the loss function is computed based on the last three outputs only. The gradients of the loss function are then propagated backward through the unrolled network (solid arrows).

---

## Slide 15 — Forecasting a Time Series

```python
tf.keras.utils.get_file(
  "ridership.tgz", "https://github.com/ageron/data/raw/main/ridership.tgz",
  cache_dir=".", extract=True)

import pandas as pd
from pathlib import Path

path = Path("datasets/ridership/CTA_-_Ridership_-_Daily_Boarding_Totals.csv")
df = pd.read_csv(path, parse_dates=["service_date"])
df.columns = ["date", "day_type", "bus", "rail", "total"]  # shorter names
df = df.sort_values("date").set_index("date")
df = df.drop("total", axis=1)  # no need for total, it's just bus + rail
df = df.drop_duplicates()  # remove duplicated months (2011-10 and 2014-07)

>>> df.head()
```

#### Bottom left — output of `df.head()` (rendered as a pandas HTML table image)

| date | day_type | bus | rail |
|---|---|---|---|
| 2001-01-01 | U | 297192 | 126455 |
| 2001-01-02 | W | 780827 | 501952 |
| 2001-01-03 | W | 824923 | 536432 |
| 2001-01-04 | W | 870021 | 550011 |
| 2001-01-05 | W | 890426 | 557917 |

(In the image the column headers "day_type", "bus", "rail" are on the first header row and "date" (the index name) is on a second header row; dates are bold; rows have alternating grey/white shading.)

#### Bottom right — text

Note that data frame `df` has 3 columns: `day_type`, `bus`, and `rail`. Each row of `df` has the name that corresponds to the date the data was collected.

(The inline `df`, `day_type`, `bus`, `rail` are dark-red typewriter text.)

---

## Slide 16 — Forecasting a Time Series (cont.)

```python
import matplotlib.pyplot as plt

df["2019-03":"2019-05"].plot(grid=True, marker=".", figsize=(8, 3.5))
save_fig("daily_ridership_plot")  # extra code { saves the figure for the book
plt.show()
```

> **Figure 15-6.** A matplotlib line plot with grid lines. X-axis label "date"; major tick labels "Mar" (with "2019" beneath it) at the left edge, "Apr", "May"; unlabelled minor ticks at roughly weekly intervals. The x-range spans 1 March 2019 (left edge) to the end of May 2019 (right edge). Y-axis (unlabelled) tick labels: 200000, 300000, 400000, 500000, 600000, 700000, 800000; plotted range ≈ 185,000 to ≈ 875,000. Two lines, both solid with small dot markers on every daily point: **bus** (blue) and **rail** (orange); legend at right-centre with entries "bus", "rail". Both series show a strong weekly pattern — 13 sharp weekend dips across the three months, with flat-topped weekday plateaus between them. Bus weekday plateaus ≈ 700,000–845,000; rail weekday plateaus ≈ 620,000–770,000; the bus line is above the rail line on weekdays. Weekend dips typically reach ≈ 300,000–340,000 (bus) and ≈ 250,000–300,000 (rail). Approximate notable readings: bus maximum ≈ 845,000 (early April, with another peak ≈ 840,000 around 1 May); rail maximum ≈ 770,000 (late April); the deepest dip is in mid-April at ≈ 240,000 (bus) and ≈ 215,000 (rail). The series start at ≈ 810,000 (bus) and ≈ 685,000 (rail) on 1 March.

*Caption:* Figure 15-6. Daily ridership in Chicago

A similar pattern can be seen repeated each week. This is called a weekly ***seasonality***. If we simply copy a past value to make our forecast, then it is called ***naive forecasting***. **Naive forecasting is often a good baseline, and it can even be tricky to beat in some cases.**

(The final sentence is black bold on the slide — not coloured.)

---

## Slide 17 — Forecasting a Time Series (cont.)

In our example, copying the value from the previous week works better, due to the strong weekly seasonality.

```python
diff_7 = df[["bus", "rail"]].diff(7)["2019-03":"2019-05"]

fig, axs = plt.subplots(2, 1, sharex=True, figsize=(8, 5))
df.plot(ax=axs[0], legend=False, marker=".")  # original time series
df.shift(7).plot(ax=axs[0], grid=True, legend=False, linestyle=":")  # lagged
diff_7.plot(ax=axs[1], grid=True, marker=".")  # 7-day difference time series
axs[0].set_ylim([170_000, 900_000])  # extra code { beautifies the plot
save_fig("differencing_plot")  # extra code { saves the figure for the book
plt.show()
```

#### Left — figure

> **Figure 15-7.** Two vertically stacked matplotlib panels sharing the x-axis, both with grid lines.
> - **Shared x-axis** (labels on the bottom panel only): label "date"; major ticks "Mar" (with "2019" beneath) at the left edge, "Apr", "May"; unlabelled weekly minor ticks; range 1 March 2019 to end of May 2019.
> - **Top panel:** y tick labels 200000, 400000, 600000, 800000; y-range 170,000 to 900,000 (per `set_ylim`). Four lines, no legend: bus (blue, solid with dot markers), rail (orange, solid with dot markers), 7-day-lagged bus (green, dotted, no markers) and 7-day-lagged rail (red, dotted, no markers). The dotted lagged curves follow the solid curves closely, shifted one week to the right, with the same weekly dips (≈ 220,000–340,000 at weekends, ≈ 680,000–850,000 on weekdays).
> - **Bottom panel (7-day differences):** y tick labels −400000, −200000, 0, 200000; y-range ≈ −520,000 to ≈ +280,000. Two solid lines with dot markers: bus (blue) and rail (orange); legend at lower left with entries "bus", "rail". Values mostly fluctuate within about ±100,000 around 0. Notable approximate readings: rail spike ≈ +245,000 in mid-March (≈ 16 March); rail dip ≈ −180,000 about a week later (≈ 23 March); a bus dip ≈ −150,000 around 19 April followed by a bus rise to ≈ +165,000 around 25–26 April; the largest deviation is a sharp single-day drop near the right end (≈ 27 May) to ≈ −480,000 (bus) and ≈ −465,000 (rail), returning to ≈ −30,000 the next day.

#### Right — caption

*Caption:* Figure 15-7. Time series overlaid with $7$-day lagged time series (top), and difference between $t$ and $t-7$ (bottom)

(In the caption, "7", "$t$" and "$t-7$" are typeset as blue maths.)

---

## Slide 18 — Forecasting a Time Series (cont.)

The ***mean absolute error*** (**MAE**), also called the *mean absolute deviation* (**MAD**) is:

```python
>>> diff_7.abs().mean()
bus     43915.608696
rail    42143.271739
dtype: float64
```

Dividing the forecast errors above by the target values gives us the ***mean absolute percentage error*** (**MAPE**):

```python
>>> targets = df[["bus", "rail"]]["2019-03":"2019-05"]
>>> (diff_7 / targets).abs().mean()
bus     0.082938
rail    0.089948
dtype: float64
```

While the prediction for number of bus riders using 7-days' shift has a higher MAE than that for the rail rider predictions, its MAPE is actually lower.

This ***7-days' shift*** prediction serves as a baseline for benchmarking our RNN methods later on.

(Note: "mean absolute deviation" is black italic; "MAD" is dark red.)

---

## Slide 19 — Preparing the Data for Machine Learning Models

Data preparation is an important step in sequence processing as the input data usually does not come in the form that can be directly used.

Consider the following simple example:

```python
my_series = [0, 1, 2, 3, 4, 5]
my_dataset = tf.keras.utils.timeseries_dataset_from_array(
    my_series,
    targets=my_series[3:],  # the targets are 3 steps into the future
    sequence_length=3,
    batch_size=2
)
list(my_dataset)

# the output is:
[(<tf.Tensor: shape=(2, 3), dtype=int32, numpy=
  array([[0, 1, 2],
         [1, 2, 3]], dtype=int32)>,
  <tf.Tensor: shape=(2,), dtype=int32, numpy=array([3, 4], dtype=int32)>),
 (<tf.Tensor: shape=(1, 3), dtype=int32, numpy=array([[2, 3, 4]], dtype=int32)
  <tf.Tensor: shape=(1,), dtype=int32, numpy=array([5], dtype=int32)>)]
```

*[The last three output lines run past the right edge of the grey code box; the line beginning `(<tf.Tensor: shape=(1, 3)` is cut off by the right edge of the slide immediately after `dtype=int32)`.]*

---

## Slide 20 — Preparing the Data for Machine Learning Models (cont.)

Our first step is to split our data into a training period, a validation period, and a test period. We will focus on the rail ridership for now.

```python
rail_train = df["rail"]["2016-01":"2018-12"] / 1e6
rail_valid = df["rail"]["2019-01":"2019-05"] / 1e6
rail_test = df["rail"]["2019-06":] / 1e6

seq_length = 56
train_ds = tf.keras.utils.timeseries_dataset_from_array(
    rail_train.to_numpy(),
    targets=rail_train[seq_length:],
    sequence_length=seq_length,
    batch_size=32,
    shuffle=True,
    seed=42)

valid_ds = tf.keras.utils.timeseries_dataset_from_array(
    rail_valid.to_numpy(),
    targets=rail_valid[seq_length:],
    sequence_length=seq_length,
    batch_size=32)
```

---

## Slide 21 — Preparing the Data for Machine Learning Models (cont.)

Inspect $2$ minibatches in `train_ds`:

```python
index = 0
for xx,yy in train_ds.take(2):
    print(f"Minibatch {index}:")
    print("xx.shape =", xx.shape)
    print("yy.shape =", yy.shape)
    index += 1

# The output is:
Minibatch 0:
xx.shape = (32, 56)
yy.shape = (32,)
Minibatch 1:
xx.shape = (32, 56)
yy.shape = (32,)
```

---

## Slide 22 — Preparing the Data for Machine Learning Models (cont.)

Visualise the training data:

```python
_, axes = plt.subplots(1,5,figsize=(15,3), sharey=True)
history_timesteps = range(56)         # input: rail data for days 0 to 55
next_timestep = 56                    # predict: rail data for day 56
for xx,yy in train_ds.take(1):        # look at the first 5 sequences
    for ax,i in zip(axes, range(5)):  # in a minibatch
        ax.plot(history_timesteps, xx[i,:], "b.-")
        ax.plot(next_timestep, yy[i], "r*")
        ax.grid("on")
        ax.set_xlabel("Day")
        if i == 0:
            ax.set_ylabel("Normalised #rail riders")
plt.show()
```

*[The comment `# input: rail data for days 0 to 55` runs slightly past the right edge of the grey code box.]*

> **Figure (slide 22, no number or caption).** A row of five small matplotlib line-plot panels side by side, each with grid lines. In every panel the x-axis is labelled "Day" with tick labels 0, 20, 40 (the axis spans roughly day 0 to day 56). Only the leftmost panel has a y-axis label: "Normalised #rail riders". Each panel has its own y-axis tick labels and its own range. Each panel shows one 56-day input sequence drawn as a blue solid line with small blue dot markers (days 0–55) with a strong weekly pattern (runs of high weekday values around 0.7–0.85 interrupted every 7 days by sharp dips to roughly 0.25–0.45), and a single red star marker at day 56 (the target).
>
> - Panel 1: y ticks 0.4, 0.6, 0.8, 1.0. Blue values mostly ≈0.78–0.92 with dips to ≈0.35–0.45; a spike up to ≈1.14 at about day 47 (the highest value on the slide). The red star at day 56 is at ≈0.34, below the last blue point (≈0.47).
> - Panel 2: y ticks 0.3, 0.4, 0.5, 0.6, 0.7. Blue starts ≈0.49–0.54, then weekly plateaus ≈0.65–0.75 with dips to ≈0.25–0.3. Red star ≈0.74.
> - Panel 3: y ticks 0.4, 0.5, 0.6, 0.7, 0.8. Blue plateaus ≈0.7–0.84 with dips to ≈0.33–0.4. Red star ≈0.75.
> - Panel 4: y ticks 0.4, 0.5, 0.6, 0.7, 0.8. Blue plateaus ≈0.7–0.84 with dips to ≈0.33–0.38. Red star ≈0.54.
> - Panel 5: y ticks 0.4, 0.5, 0.6, 0.7, 0.8, 0.9. Blue plateaus ≈0.75–0.88 with dips to ≈0.35–0.45; maximum ≈0.88 near day 49. Red star ≈0.82.

---

## Slide 23 — Forecasting a Time Series

### Forecasting Using a Linear Model

```python
tf.random.set_seed(42)
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[seq_length]),  # seq_length = 56
    tf.keras.layers.Dense(1)
])

early_stopping_cb = tf.keras.callbacks.EarlyStopping(
    monitor="val_mae", patience=50, restore_best_weights=True)
opt = tf.keras.optimizers.SGD(learning_rate=0.02, momentum=0.9)
model.compile(loss=tf.keras.losses.Huber(), optimizer=opt,
              metrics=["mae"])

history = model.fit(train_ds, validation_data=valid_ds, epochs=500,
                    callbacks=[early_stopping_cb])
```

This model has $57$ trainable parameters ($0$ non-trainable) and it reaches a validation MAE of about $38,245$ (your mileage may vary). Recall that the MAE using *7-days' shift* (slide 18) is $42,143$.

---

## Slide 24 — Forecasting a Time Series (cont.)

### Forecasting Using a Simple RNN

```python
tf.random.set_seed(42)  # extra code - ensures reproducibility
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.SimpleRNN(1)
])
```

Note that all recurrent layers in Keras expect 3D inputs of shape `[batch size, time steps, dimensionality]`, where `dimensionality` is $1$ for univariate time series and more for multivariate time series.

```python
# define a utility function for training and evaluation
def fit_and_evaluate(model, train_set, valid_set, learning_rate, epochs=500):
    early_stopping_cb = tf.keras.callbacks.EarlyStopping(
        monitor="val_mae", patience=50, restore_best_weights=True)
    opt = tf.keras.optimizers.SGD(learning_rate=learning_rate, momentum=0.9)
    model.compile(loss=tf.keras.losses.Huber(), optimizer=opt, metrics=["mae"])
    history = model.fit(train_set, validation_data=valid_set, epochs=epochs,
                        callbacks=[early_stopping_cb])
    valid_loss, valid_mae = model.evaluate(valid_set)
    return valid_mae * 1e6
```

*[The second code box is set in a smaller font than the first.]*

The validation MAE from this model is greater than $100,000$!

---

## Slide 25 — Forecasting a Time Series (cont.)

### Forecasting Using a Simple RNN (cont.)

The large validation MAE was expected for two reasons:

1. The model only has a single recurrent neuron, so the only data it can use to make a prediction at each time step is the input value at the current time step and the output value from the previous time step. In other words, the RNN's memory is extremely limited: the whole model only has $3$ parameters!

```python
>>> model.summary()
Model: "sequential"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 simple_rnn (SimpleRNN)      (None, 1)                 3

=================================================================
Total params: 3
Trainable params: 3
Non-trainable params: 0
```

---

## Slide 26 — Forecasting a Time Series (cont.)

### Forecasting Using a Simple RNN (cont.)

The large validation MAE was expected for two reasons:

2. The time series contains values from $0$ to about $1.4$, but since the default activation function is `tanh`, the recurrent layer can only output values between $-1$ and $+1$. There's no way it can predict values between $1.0$ and $1.4$.

To fix these two issues, we will create a model (the `univar_model` on the next slide) with a larger recurrent layer, say $32$ recurrent neurons, and we will add a dense output layer with a single output neuron and no activation function.

Compiling, fitting, and evaluating this `univar_model` as before, we should get a validation MAE around $27,703$.

---

## Slide 27 — Forecasting a Time Series (cont.)

### Forecasting Using a Simple RNN (cont.)

```python
univar_model = tf.keras.Sequential([
   tf.keras.layers.InputLayer(shape=[None, 1]),
   tf.keras.layers.SimpleRNN(32),
   tf.keras.layers.Dense(1) # no activation function by default
])

>>> univar_model.summary()
Model: "sequential_1"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 simple_rnn_1 (SimpleRNN)    (None, 32)                1088

 dense (Dense)               (None, 1)                 33

=================================================================
Total params: 1,121
Trainable params: 1,121
Non-trainable params: 0
_________________________________________________________________
```

---

## Slide 28 — Forecasting a Time Series (cont.)

### Forecasting Using a Deep RNN

It is quite common to stack multiple layers of cells to form a *deep RNN*.

> **Figure 15-10.** Two diagrams side by side, drawn with yellow rounded rectangles and black arrows; all arrows inside the diagrams point upward (from input to output) or rightward (forward in time).
>
> Left (the folded deep RNN): one tall, darker-yellow rounded rectangle containing three stacked, lighter-yellow rounded cells (three recurrent layers). An input labelled "X" at the bottom has an arrow pointing up into the bottom cell; solid arrows go up from the bottom cell to the middle cell and from the middle cell to the top cell; an arrow leaves the top cell upward out of the rectangle (unlabelled). Each of the three cells has its own curved feedback loop on its right side that runs from the cell's output back into the cell's input, so each cell receives two arrowheads from below (one from the layer beneath / input and one from its own loop).
>
> Right (the same network unrolled through time): a large white rounded rectangle containing four darker-yellow columns, one per time step, left to right. Each column contains three lighter-yellow cells stacked vertically, connected by upward arrows. Inputs at the bottom of the columns are labelled $\mathbf{X}_{(0)}$, $\mathbf{X}_{(1)}$, $\mathbf{X}_{(t-1)}$, $\mathbf{X}_{(t)}$, each with an upward arrow into the bottom cell; outputs at the top are labelled $\hat{\mathbf{Y}}_{(0)}$, $\hat{\mathbf{Y}}_{(1)}$, $\hat{\mathbf{Y}}_{(t-1)}$, $\hat{\mathbf{Y}}_{(t)}$, each with an upward arrow leaving the top cell. At each of the three levels, a solid horizontal arrow points right from each cell to the cell at the same level in the next column (column 0 → column 1, and column $t-1$ → column $t$); between column 1 and column $t-1$ the horizontal connection at each level is a dashed line ending in an arrowhead into column $t-1$, indicating omitted time steps.

*Caption:* Figure 15-10. Deep RNN (left), unrolled through time (right)

---

## Slide 29 — Forecasting a Time Series (cont.)

### Forecasting Using a Deep RNN (cont.)

Implementing a deep RNN with Keras is straightforward: just stack the recurrent layers, as shown below. **Important:** set `return_sequences=True` for all the `SimpleRNN` layers except for the last one.

```python
deep_model = tf.keras.Sequential([
  tf.keras.layers.InputLayer(shape=[None, 1]),
  tf.keras.layers.SimpleRNN(32, return_sequences=True),  # 1,088 params
  tf.keras.layers.SimpleRNN(32, return_sequences=True),  # 2,080 params
  tf.keras.layers.SimpleRNN(32),                         # 2,080 params
  tf.keras.layers.Dense(1)                               #    33 params
])
```

The above model has $5,281$ trainable parameters ($0$ non-trainable parameters). Its validation MAE is about $29,672$, which is worse than the previous "shallower" RNN. It looks like this RNN is a bit too large for our task.

---

## Slide 30 — Forecasting Multivariate Time Series

A great quality of neural networks is their flexibility: in particular, they can deal with multivariate time series with almost no change to their architecture. For example, we can try to predict the rail time series with *day type* as an additional input.

```python
df_mulvar = df[["bus","rail"]]/1e6  # use both bus and rail series
df_mulvar["next_day_type"] = df["day_type"].shift(-1)  # and tomorrow's type
df_mulvar = pd.get_dummies(df_mulvar)  # one-hot encode the day type
mulvar_train = df_mulvar["2016-01":"2018-12"]
mulvar_valid = df_mulvar["2019-01":"2019-05"]
mulvar_test = df_mulvar["2019-06":]
mulvar_train.head()
```

*[The word "type" at the end of the comment `# and tomorrow's type` runs past the right edge of the grey code box.]*

> **Table (slide 30, no number or caption).** A pandas DataFrame rendering (output of `mulvar_train.head()`), with bold index labels, the index name "date" on its own row under the column headers, and alternating grey/white row shading:

|  | bus | rail | next_day_type_A | next_day_type_U | next_day_type_W |
|---|---|---|---|---|---|
| **date** |  |  |  |  |  |
| **2016-01-01** | 0.303321 | 0.319835 | 1 | 0 | 0 |
| **2016-01-02** | 0.448859 | 0.365509 | 0 | 1 | 0 |
| **2016-01-03** | 0.340540 | 0.287661 | 0 | 0 | 1 |
| **2016-01-04** | 0.829429 | 0.703185 | 0 | 0 | 1 |
| **2016-01-05** | 0.846789 | 0.727716 | 0 | 0 | 1 |

---

## Slide 31 — Forecasting Multivariate Time Series (cont.)

```python
train_mulvar_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_train, dtype=tf.float32),  # use all 5 columns
    targets=mulvar_train["rail"][seq_length:],  # forecast only the rail serie
    [...]       # the other 4 arguments are the same as earlier
)
valid_mulvar_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_valid, dtype=tf.float32),
    targets=mulvar_valid["rail"][seq_length:],
    [...]      # the other 2 arguments are the same as earlier
)
```

*[The comments `# use all 5 columns` and `# forecast only the rail serie` run past the right edge of the grey code box; the second is cut off by the right edge of the slide after "serie".]*

Finally we create a simple RNN with $32$ neurons and evaluate it using the `fit_and_evaluate` function (Slide 24):

```python
mulvar_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(1)
])
```

This model reaches a validation MAE of $22,062$ !!!

---

## Slide 32 — Forecasting Multiple Outputs

With small changes to the training and validation datasets, we can train a **multitask** RNN model to predict both the daily numbers of rail and bus riders.

```python
train_multask_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_train, dtype=tf.float32),
    targets=mulvar_train[["bus", "rail"]][seq_length:],  # 2 targets per day
    [...])      # the other 4 arguments are the same as earlier
valid_multask_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_valid, dtype=tf.float32),
    targets=mulvar_valid[["bus", "rail"]][seq_length:],
    [...])      # the other 2 arguments are the same as earlier

multask_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(2) ])

fit_and_evaluate(multask_model, train_multask_ds, valid_multask_ds,
                 learning_rate=0.02)
```

*[The word "day" at the end of the comment `# 2 targets per day` runs past the right edge of the grey code box.]*

---

## Slide 33 — Forecasting Multiple Outputs

This `multask_model` gives $27,855$ MAE. Using the `predict` function to get the raw daily predictions:

```python
Y_preds_valid = multask_model.predict(valid_multask_ds)
for idx, name in enumerate(["bus", "rail"]):
    mae = 1e6 * tf.keras.metrics.MeanAbsoluteError()(
        mulvar_valid[name][seq_length:].to_numpy(), Y_preds_valid[:, idx])
    print(name, int(mae))
```

*[The line ending `Y_preds_valid[:, idx])` runs past the right edge of the grey code box.]*

we get the following MAEs for **bus** and for **rail**.

```text
bus 26,812
rail 28,896
```

Different runs can yield slightly different results. In my 2024 run, the `multask_model` gave a total validation MAE of $24,421$, and a validation MAE of $25,162$ for **bus** and a validation MAE of $23,680$ for **rail**.

---

## Slide 34 — Forecasting Several Time Steps Ahead

We could also forecast several time steps ahead by using the predicted value at time step $t - 1$ as the last input value for time step $t$: (Variable `rail_valid` below was defined on slide 20)

```python
import numpy as np
# recall that rail_valid starts in 2019-01-01
X = rail_valid.to_numpy()[np.newaxis, :seq_length, np.newaxis] # one instance
for step_ahead in range(14):
    y_pred_one = univar_model.predict(X)
    X = np.concatenate([X, y_pred_one.reshape(1, 1, 1)], axis=1)
```

*[The comment `# one instance` runs past the right edge of the grey code box. The plot below is placed so that its top edge overlaps the bottom of the grey code box.]*

#### Left column — figure

> **Figure 15-11.** A matplotlib line plot. The y-axis has tick labels 200000, 300000, 400000, 500000, 600000, 700000, 800000 (no y-axis label; values are raw rider counts, not normalised). The x-axis is labelled "date" and runs from 1 February 2019 to 11 March 2019 with a minor tick per day; major tick labels read "04", "11", "18", "25", "04", "11", with "Feb / 2019" under the left end of the axis and "Mar" under the 1 March tick. Horizontal grey grid lines at every 100000 and a vertical grey grid line at 1 March.
>
> - "True" (blue solid line with small dot markers) runs across the whole range (1 Feb – 11 Mar) with a weekly pattern: weekday values ≈650000–745000 and weekend dips to ≈240000–350000. Its highest point is ≈745000 around 14 Feb; its lowest is ≈240000 on 24 Feb.
> - "Today" (black dashed vertical line) at 25 Feb 2019.
> - "Predictions" (red solid line with "×" markers) covers the 14 days after Today, from 26 Feb to 11 Mar. It closely follows the blue line: ≈715000–722000 for 26–28 Feb, ≈710000 on 1 Mar, ≈393000 on 2 Mar, ≈295000 on 3 Mar, ≈678000 on 4 Mar, ≈722000–730000 for 5–8 Mar, ≈400000 on 9 Mar, ≈302000 on 10 Mar, ≈683000 on 11 Mar. Red values are slightly above the blue values on most days.
> - Legend (left-middle of the plot, semi-transparent box): "True" (blue line with dot), "Predictions" (red line with ×), "Today" (black dashed line).

*Caption:* Figure 15-11. Forecasting 14 steps ahead, 1 step at a time.

Validation MAE $= 30,734$. **NOTE:** This method works only when the input and output vectors at the same features.

#### Right column — note

**NOTE:** `univar_model` (see slide 27) was trained to predict **one** step ahead only. (This diagram may not look the same as the one in the textbook.)

---

## Slide 35 — Forecasting Several Time Steps Ahead (cont.)

We can also train an RNN model to forecast the numbers of rail riders for $14$ days ahead at the last training time step. We need to modify our code slightly to get the correct training and validation datasets:

```python
def split_inputs_and_targets(mulvar_series, ahead=14, target_col=1):
    return mulvar_series[:, :-ahead], mulvar_series[:, -ahead:, target_col]

ahead_train_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_train, dtype=tf.float32),
    targets=None,
    sequence_length=seq_length + 14,
    batch_size=32,
    shuffle=True,
    seed=42
).map(split_inputs_and_targets)

ahead_valid_ds = tf.keras.utils.timeseries_dataset_from_array(
    tf.convert_to_tensor(mulvar_valid, dtype=tf.float32),
    targets=None,
    sequence_length=seq_length + 14,
    batch_size=32
).map(split_inputs_and_targets)
```

*[The `return` line runs past the right edge of the grey code box.]*

---

## Slide 36 — Forecasting Several Time Steps Ahead (cont.)

```python
>>> print("Number of batches in ahead_train_ds =", len(ahead_train_ds))
>>> for x, y in ahead_train_ds.take(1):   # inspect a minibatch
>>>     print(x.shape)
>>>     print(y.shape)
Number of batches in ahead_train_ds = 33
(32, 56, 5)
(32, 14)
```

Some simple data visualisation would help us confirm that our datasets are correctly set up.

```python
_, axes = plt.subplots(1, 2, figsize=(15,4))
days_in = range(seq_length)                 # days 0 to 55
days_out = range(seq_length, seq_length+14) # days 56 to 69
for x, y in ahead_train_ds.take(1):
    for ax,id in zip(axes,range(2)):
        ax.plot(days_in, x[id,:,0], "y.-", label="bus (input)")
        ax.plot(days_in, x[id,:,1], "b.-", label="rail (input)")
        ax.plot(days_out, y[id], "r.-", label="rail (output)")
        ax.grid("on")
        ax.set_xlabel("Day")
        if id == 0:
            ax.set_ylabel("Normalised #daily riders")
        ax.legend(loc="upper left")
plt.show()
```

---

## Slide 37 — Forecasting Several Time Steps Ahead (cont.)

Visualisation of the first two sequences in a minibatch of training set `ahead_train_ds`. Each input timestep is a $5$-dimensional vector. Only the number of rail riders is to be predicted per time step for 14 time steps ahead.

> **Figure (slide 37, no number or caption).** Two matplotlib line plots side by side, with grid lines. In both, the x-axis is labelled "Day" with tick labels 0, 10, 20, 30, 40, 50, 60, 70. Each plot has a legend in the upper-left corner (semi-transparent box) with three entries: "bus (input)" (olive/yellow line with dot markers), "rail (input)" (blue line with dot markers), "rail (output)" (red line with dot markers). In each plot the olive bus line and the blue rail line run over days 0–55 and track each other closely with a weekly pattern (high weekday plateaus and sharp dips every 7 days); the red rail-output line runs over days 56–69 and is not joined to the blue line.
>
> - Left plot: y-axis labelled "Normalised #daily riders", tick labels 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9. Bus plateaus ≈0.83–0.91 (highest ≈0.91 at about day 28); rail plateaus ≈0.77–0.85 (highest ≈0.85 near days 22 and 29); dips to ≈0.32–0.38. Red output: ≈0.78 (day 56), ≈0.80 (57), ≈0.75 (58), ≈0.43 (59), ≈0.29 (60, the lowest point in the plot), ≈0.77 (61), ≈0.76–0.80 (62–64), ≈0.75 (65), ≈0.39 (66), ≈0.30 (67), ≈0.65 (68), ≈0.77 (69).
> - Right plot: no y-axis label; tick labels 0.4, 0.5, 0.6, 0.7, 0.8. Bus and rail plateaus mostly ≈0.70–0.78, dips to ≈0.33–0.38; the rail line peaks at ≈0.86 at day 40 (the highest point in the plot). Red output: ≈0.47 (day 56), ≈0.36 (57), ≈0.67 (58), ≈0.70–0.75 (59–61), ≈0.70 (62), ≈0.44 (63), ≈0.35 (64), ≈0.74 (65), ≈0.76–0.78 (66–68), ≈0.73 (69).

---

## Slide 38 — Forecasting Several Time Steps Ahead (cont.)

Next, we create an RNN, train, and evaluate it:

```python
ahead_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(14) ])
# Training code omitted...
X = mulvar_valid.to_numpy()[np.newaxis, :seq_length]  # shape [1, 56, 5]
Y_pred = ahead_model.predict(X)  # shape [1, 14]
```

This `ahead_model` gave a validation MAE $33,887$ for **rail**.

> **Figure (slide 38, no number or caption).** A single wide matplotlib line plot with grid lines. The y-axis is labelled on two lines "Normalised / #rail riders", with tick labels 0.2, 0.4, 0.6. The x-axis is labelled "Day" with tick labels 0, 10, 20, 30, 40, 50, 60, 70. Legend in the lower-left corner (semi-transparent box): "X" (blue line with dot markers) and "y" (red line with star markers).
>
> - "X" (blue, dots) covers days 0–55: it starts low at ≈0.24 on day 0, rises to ≈0.57–0.63 on days 1–3, then follows a weekly pattern of plateaus ≈0.66–0.75 and dips to ≈0.22–0.33; an irregular stretch around days 26–33 includes a point ≈0.68 at day 27 and the lowest value of the plot, ≈0.10, at day 29. The highest value is ≈0.75 at about day 44.
> - "y" (red, stars) covers days 56–69 and is joined to the last blue point: ≈0.71 (days 56–58), ≈0.68 (59), ≈0.32 (60), ≈0.27 (61), ≈0.66 (62), ≈0.72–0.73 (63–64), ≈0.71 (65), ≈0.67 (66), ≈0.38 (67), ≈0.27 (68), ≈0.67 (69).

This approach works quite well. Forecasting for just one day is obviously better than forecasting for $14$ days into the future. However, even with $5$ input features, `ahead_model` performed slightly worse than the `univar_model` which uses $1$ feature and predicts $1$ day at a time through looping.

---

## Slide 39 — Forecasting Using a Sequence-to-Sequence Model

Instead of training the model to forecast the next $14$ values only at the very last time step, we can train it to forecast the predictions at each and every time step, e.g., use the training data from day $0$ to day $9$ to forecast the output from days $10$ to day $19$; then use the training data from day $1$ to day $10$ to forest the output from day $11$ to day $20$, and so on. This can be done using the Encoder-Decoder architecture (See bottom-right diagram in Figure 15-4 (slide $13$))

We will study the Encoder-Decoder architecture for processing sequences in **lecture topic 8** (*Transformers*) later.

---

## Slide 40 — Handling Long Sequences

- Just like the deep nets that we have seen in previous chapters, training an RNN on long sequences (i.e., many time steps) has the vanishing/exploding gradient problem and takes a long time to train or the training may be unstable. Moreover, when an RNN processes a long sequence, it will gradually forget the first inputs in the sequence.
- To fight the unstable gradients problem in RNNs, tricks, such as good parameter initialization, faster optimizers, and dropout should all be considered. However, nonsaturating activation functions (e.g., `ReLU`) may not help as much here, because the same weights are used in every time step and may lead to exploding outputs.
- You can reduce the risk above by using a smaller learning rate or a saturating activation function like the *hyperbolic tangent* (that's why it's the default).

---

## Slide 41 — Handling Long Sequences (cont.)

- *Batch normalisation* can be put over RNN layers but was reported to be not yielding good results when BN was used at each time step.
- *Layer normalization*<sup>1</sup> has been reported to be better for RNNs. It is very similar to batch normalization, but instead of normalizing across the batch dimension, layer normalization normalizes across the features dimension.

  Example:

  ```python
  model = tf.keras.Sequential([
      tf.keras.layers.InputLayer(shape=[None,5]),
      tf.keras.layers.SimpleRNNCell(32),
      tf.keras.layers.LayerNormalization(),
      tf.keras.layers.Dense(1)
  ])
  ```

**Footnotes:**

1. Jimmy Lei Ba et al., "Layer Normalization", arXiv preprint arXiv:1607.06450 (2016).

---

## Slide 42 — LSTM Cell

Due to the transformations that the data goes through when traversing an RNN, some information is lost at each time step. After a while, the RNN's state contains virtually no trace of the first inputs. To tackle this problem, various types of cells with long-term memory have been introduced.

The long short-term memory (LSTM) cell was proposed in 1997<sup>2</sup>.
If you consider the *Long Short-Term Memory* (LSTM) cell as a black box, it can be used very much like a basic cell, except it will perform much better:

- training will converge faster; and
- it will detect long-term dependencies in the data.

**Footnotes:**

2. Sepp Hochreiter and Jürgen Schmidhuber, "Long Short-Term Memory", Neural Computation 9, no. 8 (1997): 1735–1780.

---

## Slide 43 — LSTM Cell (cont.)

In TensorFlow, you can simply use a `LSTM` layer instead of a `SimpleRNN`:

```python
# Number of trainable parameters: 685
lstm_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.LSTM(12),
    tf.keras.layers.Dense(1)
])
```

The above model gave a validation MAE of $30{,}262$.

LSTM cells manage two state vectors: $\mathbf{h}_{(t)}$ and $\mathbf{c}_{(t)}$ ("c" stands for "cell"). You can think of $\mathbf{h}_{(t)}$ as the short-term state and $\mathbf{c}_{(t)}$ as the long-term state.

The key idea is that the network can learn what to store in the long-term state, what to throw away, and what to read from it.

---

## Slide 44 — LSTM Cell (cont.)

> **Figure 15-12.** A pale-yellow rounded rectangle representing the cell, labelled "**LSTM cell**" in bold at its bottom-right corner. All connector lines are solid black; the only dashed line in the figure is the border of the legend.
>
> **Inputs and outputs.** On the left edge, two solid arrows enter the cell: "c$_{(t-1)}$" near the top and "h$_{(t-1)}$" near the bottom. The input "x$_{(t)}$" comes in from below, as a line rising into the bottom edge of the cell (centre-right). On the right edge, two arrows leave the cell: "c$_{(t)}$" at the top and "h$_{(t)}$" lower down. An arrow leaves the top of the figure labelled "ŷ$_{(t)}$" (with a hat).
>
> **Long-term state line (top).** The c$_{(t-1)}$ line runs horizontally across the top of the cell. It first passes through an element-wise multiplication circle ⊗ labelled "Forget gate" (label above the circle), then through an addition circle ⊕ further right, and continues unchanged out of the right edge as c$_{(t)}$.
>
> **Four fully connected layers.** Along the lower middle of the cell sit four identical light-blue boxes, each containing the text "FC" and each with a coloured band across its top. A label "Fully connected" sits to the right of the fourth box. From left to right, the boxes output:
> - f$_{(t)}$ — pink/red top band (Logistic);
> - g$_{(t)}$ — dark-blue top band (Tanh);
> - i$_{(t)}$ — pink/red top band (Logistic);
> - o$_{(t)}$ — pink/red top band (Logistic).
>
> **Gate wiring.**
> - f$_{(t)}$ rises vertically with an arrow into the bottom of the Forget gate ⊗ on the top line.
> - g$_{(t)}$ rises, turns right, and enters the left side of a second ⊗ labelled "Input gate". i$_{(t)}$ rises vertically with an arrow into the bottom of this Input gate ⊗. The Input gate ⊗'s output runs right and then up, with an arrow into the bottom of the ⊕ on the top line.
> - Just to the right of the ⊕, a line branches down from the top (long-term) line, passes through a tall narrow vertical dark-blue bar (a Tanh), and continues right into the left side of a third ⊗ labelled "Output gate". o$_{(t)}$ rises, turns right, and enters the bottom of the Output gate ⊗ with an arrow.
> - The Output gate ⊗'s output runs right and leaves the cell as h$_{(t)}$. Before the right edge, a branch rises vertically from this h line, passes up out of the top of the cell, and ends in the upward arrow labelled ŷ$_{(t)}$.
>
> **Inputs to the FC layers.** Inside the cell, the h$_{(t-1)}$ line runs right to a junction at the lower left, from which four arrows fan upward into the bottoms of all four FC boxes (straight up into the f box, and diagonally to the g, i and o boxes). The x$_{(t)}$ line rises from below to a junction under the boxes, from which four arrows fan upward into all four FC boxes. The two fans cross each other.
>
> **Legend** (a dashed-border box just outside the cell's bottom-right corner; legend text in italics): ⊗ "Element-wise multiplication"; ⊕ "Addition"; a pink/red bar "Logistic"; a dark-blue bar "Tanh".

*Caption:* Figure 15-12. An LSTM cell

- As the long-term state $\mathbf{c}_{(t-1)}$ traverses the network from left to right, it first goes through a *forget gate*, dropping some memories, and then it adds some new memories via the addition operation (which adds the memories that were selected by an *input gate*). The result $\mathbf{c}_{(t)}$ is sent straight out, without any further transformation.

---

## Slide 45 — LSTM Cell (cont.)

> **Figure 15-12.** The same LSTM-cell figure as on slide 44, shown slightly smaller. It is a yellow cell labelled "**LSTM cell**". c$_{(t-1)}$ enters top-left and runs through the "Forget gate" ⊗ and then a ⊕, leaving as c$_{(t)}$. There are four FC boxes, from left to right f$_{(t)}$ (Logistic band), g$_{(t)}$ (Tanh band), i$_{(t)}$ (Logistic band) and o$_{(t)}$ (Logistic band), with the label "Fully connected". f$_{(t)}$ feeds the Forget gate ⊗. g$_{(t)}$ and i$_{(t)}$ meet at the "Input gate" ⊗, which feeds the ⊕. A branch drops from the top line after the ⊕, passes through a vertical dark-blue Tanh bar, and goes into the "Output gate" ⊗, which o$_{(t)}$ also feeds. The output leaves as h$_{(t)}$, with an upward branch to ŷ$_{(t)}$. h$_{(t-1)}$ (from the left, bottom) and x$_{(t)}$ (from below) each fan out to all four FC boxes. The dashed legend reads: ⊗ Element-wise multiplication; ⊕ Addition; pink/red bar Logistic; dark-blue bar Tanh.

*Caption:* Figure 15-12. An LSTM cell

- Moreover, the result $\mathbf{c}_{(t)}$ is also passed through the tanh function and then filtered by the *output gate*. This produces the short-term state $\mathbf{h}_{(t)}$, which is equal to the LSTM cell's output, $\mathbf{y}_{(t)}$, for this time step.

---

## Slide 46 — LSTM Cell (cont.)

- For the short-term state $\mathbf{h}_{(t-1)}$, new memories come from the input $\mathbf{x}_{(t)}$. Both $\mathbf{h}_{(t-1)}$ and $\mathbf{x}_{(t)}$ are fed to four different fully connected (FC) layers:
  - The main layer is the one that outputs $\mathbf{g}_{(t)}$. It has the usual role of analyzing the current inputs $\mathbf{x}_{(t)}$ and the previous (short-term) state $\mathbf{h}_{(t-1)}$. In an LSTM cell, this layer's output is partially stored in the long-term state.
  - The three other layers are *gate controllers*. Since they use the logistic activation function, their outputs range from 0 to 1.
    - The *forget gate* (controlled by $\mathbf{f}_{(t)}$) controls which parts of the long-term state should be erased.
    - The *input gate* (controlled by $\mathbf{i}_{(t)}$) controls which parts of $\mathbf{g}_{(t)}$ should be added to the long-term state.
    - Finally, the *output gate* (controlled by $\mathbf{o}_{(t)}$) controls which parts of the long-term state should be read and output at this time step (both to $\mathbf{h}_{(t)}$ and $\mathbf{y}_{(t)}$).

---

## Slide 47 — LSTM Cell (cont.)

In short, an LSTM cell can learn to recognize an important input (that is the role of the input gate), store it in the long-term state, learn to preserve it for as long as it is needed (that is the role of the forget gate), and learn to extract it whenever it is needed.

This explains why they have been amazingly successful at capturing long-term patterns in time series, long texts, audio recordings, and more.

LSTM computations:

$$
\begin{aligned}
\mathbf{i}_{(t)}^{\top} &= \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xi} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hi} + \mathbf{b}_{i}^{\top}\right) \\
\mathbf{f}_{(t)}^{\top} &= \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xf} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hf} + \mathbf{b}_{f}^{\top}\right) \\
\mathbf{o}_{(t)}^{\top} &= \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xo} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{ho} + \mathbf{b}_{o}^{\top}\right) \\
\mathbf{g}_{(t)}^{\top} &= \tanh\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xg} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hg} + \mathbf{b}_{g}^{\top}\right) \\
\mathbf{c}_{(t)} &= \mathbf{f}_{(t)} \otimes \mathbf{c}_{(t-1)} + \mathbf{i}_{(t)} \otimes \mathbf{g}_{(t)} \\
\mathbf{y}_{(t)} &= \mathbf{h}_{(t)} = \mathbf{o}_{(t)} \otimes \tanh\left(\mathbf{c}_{(t)}\right)
\end{aligned}
$$

(Typesetting as on the slide: the transpose glyph is ⊤ (`\top`). All vectors and matrices are bold upright and the weight and bias subscripts are italic and non-bold. $\sigma$ is italic. "tanh" is upright sans-serif. The parentheses are large `\left( … \right)`. The equations are aligned on the first "=" sign. There is no hat on $\mathbf{y}_{(t)}$.)

---

## Slide 48 — GRU Cells

#### Left column — figure

> **Figure 15-13.** A pale-yellow rounded rectangle representing the cell, labelled "**GRU cell**" in bold at its bottom-right corner. All connector lines are solid black; the only dashed line is the legend border. There is only one state line; this cell has no separate long-term state c.
>
> **Inputs and outputs.** "h$_{(t-1)}$" enters from the left at the top as a plain line with no arrowhead. "x$_{(t)}$" comes in from below, as a line rising into the bottom edge of the cell (centre). "h$_{(t)}$" leaves the right edge at the top as an arrow. "ŷ$_{(t)}$" (with a hat) is an upward arrow leaving the top of the cell near its right end.
>
> **State line (top).** The h$_{(t-1)}$ line runs horizontally along the top of the cell. It passes through an element-wise multiplication circle ⊗ (top centre), then continues right into an addition circle ⊕ (top right). The ⊕'s output continues right and leaves as the arrow h$_{(t)}$. Between the ⊕ and the right edge, a branch rises vertically out of the top of the cell as the arrow ŷ$_{(t)}$.
>
> **Three fully connected layers.** Each is a light-blue box containing "FC" with a coloured band across its top:
> - bottom-left box: output r$_{(t)}$, pink/red band (Logistic);
> - bottom-centre box: output z$_{(t)}$, pink/red band (Logistic);
> - right box, at mid-height: output g$_{(t)}$, dark-blue band (Tanh).
>
> **Wiring.**
> - A vertical line drops from the h$_{(t-1)}$ top line, just inside the cell's left edge, down to the bottom of the cell.
>   - At mid-height it branches right into a ⊗ (left-middle of the cell). r$_{(t)}$ rises from the r FC box with an arrow into the bottom of this ⊗. The ⊗'s output runs right as a long horizontal arrow into the left side of the g FC box. (So the g FC layer receives r$_{(t)}$ ⊗ h$_{(t-1)}$.)
>   - At the bottom, the vertical line turns right. It feeds up-arrows into the r FC box and the z FC box (the left-hand arrow under each box) and ends at the z box.
> - The x$_{(t)}$ line rises from below to the z FC box (the right-hand arrow under that box). On the way up, a branch runs left beneath the boxes and rises into the r FC box (the right-hand arrow under that box). A second branch runs right along the bottom and then up, with an arrow into the bottom of the g FC box. (So x$_{(t)}$ feeds all three FC boxes, and h$_{(t-1)}$ feeds the r and z boxes directly.)
> - z$_{(t)}$ rises vertically from the z FC box with an arrow into the bottom of the top-centre ⊗, which multiplies the h$_{(t-1)}$ line. From this vertical z line, a branch goes right into a small white rounded box labelled "1-z$_{(t)}$" (with a hyphen). The box's output arrow points right into a fourth circle, a ⊗ located just below the ⊕.
> - g$_{(t)}$ rises from the top of the g FC box into the bottom of this lower-right ⊗. The lower-right ⊗'s output arrow points up into the bottom of the ⊕.
>
> **Legend** (a dashed-border box below the cell on the right, outside it; legend text in italics): ⊗ "Element-wise multiplication"; ⊕ "Addition"; a pink/red bar "Logistic"; a dark-blue bar "Tanh".

*Caption:* Figure 15-13. GRU cell

#### Right column — text

The GRU cell is a simplified version of the LSTM cell:

- Both state vectors are merged into a single vector $\mathbf{h}_{(t)}$
- A single gate controller $\mathbf{z}_{(t)}$ controls both the forget gate and the input gate.
- There is no output gate; the full state vector is output at every time step.

---

## Slide 49 — GRU Cells (cont.)

GRU computations:

$$
\begin{aligned}
\mathbf{z}_{(t)}^{\top} &= \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xz} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hz} + \mathbf{b}_{z}^{\top}\right) \\
\mathbf{r}_{(t)}^{\top} &= \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xr} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hr} + \mathbf{b}_{r}^{\top}\right) \\
\mathbf{g}_{(t)}^{\top} &= \tanh\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xg} + \left(\mathbf{r}_{(t)}^{\top}\mathbf{W}_{hg} \otimes \mathbf{h}_{(t-1)}^{\top}\right) + \mathbf{b}_{g}^{\top}\right) \\
\mathbf{h}_{(t)} &= \mathbf{z}_{(t)} \otimes \mathbf{h}_{(t-1)} + \left(1 - \mathbf{z}_{(t)}\right) \otimes \mathbf{g}_{(t)}
\end{aligned}
$$

(Typesetting as on the slide: the transpose glyph is ⊤ (`\top`). In the $\mathbf{g}_{(t)}$ line, $\mathbf{W}_{hg}$ sits between $\mathbf{r}_{(t)}^{\top}$ and $\otimes$, inside the inner parentheses, exactly as shown. "tanh" is upright sans-serif. The equations are aligned on the "=" sign.)

**Example:**

```python
# Number of trainable parameters: 1401
gru_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.GRU(20),
    tf.keras.layers.Dense(1)
])
```

Validation MAE from `gru_model` $= 26{,}497$.

---

## Slide 50 — Using 1D Convolution Layers to Process Sequences

Similar to using 2D convolution layers for images, we can use 1D convolutional layer for sequences to produce 1D feature map per kernel. If you use $10$ kernels, then the layer's output will be composed of $10$ 1D sequences (all of the same length), or equivalently you can view this output as a single 10D sequence.

```python
# Number of trainable parameters: 1283
cnn_gru_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.Conv1D(filters=8, kernel_size=3, strides=1, activation="relu"),
    tf.keras.layers.Conv1D(filters=16, kernel_size=3, strides=2, activation="relu"),
    tf.keras.layers.GRU(10),
    tf.keras.layers.Dense(1)
])
```

If you train and evaluate this model, you will find that it performed similarly well compared to those previous models. Its validation MAE was $30{,}209$.

It is actually possible to use only 1D convolutional layers and drop the recurrent layers entirely!

**Exercises:** The `lstm_model`, `gru_model`, and `cnn_gru_model` above use only the #rail riders as input and predict the #rail riders on the 57th day. Modify the codes to take in 5-feature input and train the model.

---

## Slide 51 — Summary

- Know when it would be suitable to use RNNs
- Understand recurrent neurons and memory cells
- Understand input and output sequences in a RNN
- Know how to implement a simple RNN in TensorFlow
- Know how to handle variable length input and output sequences
- Know how to train a simple RNN to predict time series
- Know how to build a deep RNN
- Understand the difficulty of training over many time steps
- Understand the LSTM and GRU architectures
- Know how to use 1D convolutional layers to process sequences

---

## Slide 52 — For the next topic...

Read up to Chapters 17 on Autoencoders, GANs, and Diffusion Models (up to page 647)

And that's all for this lecture.

Have a good week.

---

## Quirks

Things on the slides that look wrong, inconsistent or ambiguous, recorded by the transcribers and **not** fixed in the transcript above.

### Slides slides 1–18

- **Slide 2:** "Chapters 15." — plural "Chapters" for a single chapter. The book title is written "Hands-on Machine Learning…" (lowercase "on") in the slide text, while the cover reads "Hands-On".
- **Slide 3:** The chapter/topic title says "…Using RNNs and CNNs", but the topic list only names RNN/LSTM topics (no CNN item). Possibly fine if CNNs are covered later in the deck.
- **Slide 4:** "Recurrent neural networks (RNNs) **is** a class of nets" — subject–verb agreement. Parentheses are unbalanced: "(e.g., see Google's Magenta project (https://magenta.tensorflow.org/)." opens two "(" but closes only one.
- **Slide 5:** The text uses bold vector notation $\mathbf{x}_{(t)}$, $\hat{\mathbf{y}}_{(t-1)}$ for a *single* neuron, while slide 6 says the single neuron's output "was a scalar" and Figure 15-1 labels everything as non-bold scalars ($x_{(t)}$, $\hat{y}_{(t)}$). The Figure 15-1 caption is split across two lines with a large vertical gap ("…unrolled" / "through time (right)").
- **Slide 6:** The text writes the previous output as $\mathbf{y}_{(t-1)}$ (no hat), but slide 5 writes $\hat{\mathbf{y}}_{(t-1)}$ and Figure 15-2 labels the outputs $\hat{\mathbf{y}}$.
- **Slide 7:** The outputs are written without hats ($\mathbf{y}_{(2)}$, $\mathbf{y}_{(1)}$, $\mathbf{y}_{(0)}$, $\mathbf{y}_{(t)}$), which is inconsistent with the $\hat{\mathbf{y}}$ used on slides 5 and 8 and in Figures 15-1/2/3.
- **Slide 8 vs slides 10–11 (hidden-state indexing):** In Figure 15-3, $\mathbf{h}_{(0)}$ is the state *output by* the first cell (the one fed $\mathbf{x}_{(0)}$), and no initial state is drawn. In the slide 10/11 diagram, $\mathbf{h}_{(0)}$ is the initial state *entering* the first cell, and the first cell outputs $\mathbf{h}_{(1)}$. Under slide 9's recurrence $\mathbf{h}_{(t)} = \varphi_h(\mathbf{h}_{(t-1)}\mathbf{W}_h + \mathbf{x}_{(t)}\mathbf{W}_x + \dots)$, the cell fed $\mathbf{x}_{(0)}$ should produce $\mathbf{h}_{(0)}$, not $\mathbf{h}_{(1)}$.
- **Slides 10–11 (output indexing):** The diagram pairs input $\mathbf{x}_{(t)}$ with output $\hat{\mathbf{y}}_{(t+1)}$ (the cell fed $\mathbf{x}_{(0)}$ emits $\hat{\mathbf{y}}_{(1)}$, …, and the cell fed $\mathbf{x}_{(2)}$ emits $\hat{\mathbf{y}}_{(3)}$). Figures 15-1/2/3/4/5 and slide 9's equation $\mathbf{y}_{(t)} = \varphi_y(\mathbf{h}_{(t)}\mathbf{W}_y + \dots)$ pair $\mathbf{x}_{(t)}$ with $\hat{\mathbf{y}}_{(t)}$.
- **Slide 9:** The output equation's left-hand side is $\mathbf{y}_{(t)}^{\top}$ (no hat) and is called the "output instance". But slide 10 uses $\mathbf{y}_{(3)}$ for the *ground truth* and $\hat{\mathbf{y}}_{(3)}$ for the prediction, and slide 11's matrix form writes $\hat{\mathbf{Y}}_{(t)}$ (with hat).
- **Slide 9:** "$\varphi_y$ is an appropriate activation function (e.g., … softmax combined with cross-entropy …)" — cross-entropy is a loss, not part of an activation function.
- **Slide 9 vs 10:** Slide 9 defines $\mathbf{h}_{(t)}^{\top}$, $\mathbf{x}_{(t)}^{\top}$ as row vectors. Slide 10 writes both $\mathbf{x}_{(0)} \in \mathbb{R}^4$ (text, no ⊤) and $\mathbf{x}_{(0)}^{\top} \in \mathbb{R}^4$ (figure, with ⊤), and $\mathbf{h}_{(t)} \in \mathbb{R}^5$ (no ⊤). Row/column orientation is not distinguished by the $\mathbb{R}^n$ notation.
- **Slide 11:** "$\mathbf{Y}_{(t)} \in \mathbb{R}^{m\times 2}$, for all $t$" conflicts with the example, where only the final output is compared with ground truth. It also conflicts with the stated training-target tensor $\mathbf{Y} \in \mathbb{R}^{N\times 2}$, which has no time axis. The sentence "The training data are usually set up as 3D tensors: $\mathbf{X} \in \mathbb{R}^{N\times 3\times 4}$ and $\mathbf{Y} \in \mathbb{R}^{N\times 2}$" calls both 3D, but $\mathbf{Y}$ is 2D.
- **Slide 11 vs 12:** $N$ is the training-set size on slide 11 but a number of days on slide 12 (symbol reuse).
- **Slide 12, item 1:** "produce the stock prices of $N-1$ ago and of tomorrow" — a word is missing ("days") and the meaning is garbled; presumably the outputs are shifted one day into the future, i.e. from $N-1$ days ago to tomorrow.
- **Slide 12, item 3 vs Figure 15-4 (slide 13):** The text says the vector-to-sequence RNN takes "a single input at $t = 0$ (and zeros for other time steps)". But the bottom-left panel of Figure 15-4 feeds the same input "X" at *every* time step.
- **Slide 12, item 4:** "…called an encoder-decoder. e.g., translating…" — sentence starts with lowercase "e.g." after a full stop. Item 2 has no closing full stop.
- **Slide 13 (Figure 15-4, top left):** The first input is lowercase "$x_{(0)}$" while the others are uppercase "$X_{(1)}$…$X_{(4)}$". The first output is "$Y_{(0)}$" with **no hat** while the others are "$\hat{Y}_{(1)}$…$\hat{Y}_{(4)}$". Both are inconsistencies in the figure itself.
- **Slide 14:** The text writes the input/output sets with bold $\mathbf{X}_{(t)}$, $\hat{\mathbf{Y}}_{(t)}$, while the figure uses non-bold sans-serif $X_{(t)}$, $\hat{Y}_{(t)}$ (cosmetic).
- **Slide 15:** The code uses `tf.keras.utils.get_file` but `import tensorflow as tf` does not appear on the slide. Several long lines (the URL line, the `path = …` line and the two last comment lines) overflow the right edge of the grey code box. The apostrophe in "it's" is rendered as a typographic right quote. Possible environment issue (not visible on the slide): with newer Keras versions, `get_file(..., extract=True)` may extract to a differently named folder, so the hard-coded `datasets/ridership/...` path might not exist.
- **Slides 16–17:** The comments read "`# extra code { saves the figure for the book`" and "`# extra code { beautifies the plot`". The "{" is a typesetting artefact: the book's en dash "–" was rendered as "{" in the typewriter font. `save_fig` is called but never defined on the slides, so the code would not run as shown.
- **Slide 17:** "copying the value from the previous week works better" — "better" than what is not stated (implicitly better than copying the previous day). In the code, `df.plot(...)` and `df.shift(7).plot(...)` plot the *whole* `df` (all dates, and a `day_type` column that pandas skips as non-numeric) rather than a 2019-03..2019-05 slice. The displayed Mar–May 2019 window relies on `sharex=True` with the `diff_7` plot.
- **Slide 18:** "7-days' shift" (grammar; normally "7-day shift"). MAPE values are shown as fractions (0.082938, 0.089948), i.e. ≈ 8.3 % and ≈ 9.0 %, although it is called a "percentage" error. The numbers are internally consistent with the text: bus MAE 43915.6 > rail MAE 42143.3, and bus MAPE 0.0829 < rail MAPE 0.0899.
- **Figure numbering:** 15-1 to 15-7 run consecutively across slides 5, 6, 8, 13, 14, 16, 17, with no jumps. The diagrams on slides 10 and 11 are unnumbered.

### Slides slides 19–38

- **Slide 19 — output line cut off.** The line `(<tf.Tensor: shape=(1, 3), dtype=int32, numpy=array([[2, 3, 4]], dtype=int32)` is cut off by the right edge of the slide. The `>,` that should end it (compare the first tensor, `dtype=int32)>,`) is missing, so the printed output is incomplete as shown. The text layer is cut off at the same place.
- **Slide 22 — `sharey=True` does not match the figure.** The code passes `sharey=True`, but each of the five panels has its own y tick labels and its own range (0.4–1.0, 0.3–0.7, 0.4–0.8, 0.4–0.8 and 0.4–0.9). With a shared y-axis, matplotlib would show tick labels only on the first panel and use one range for all five. So the figure was probably not made by this exact code.
- **Slides 23, 24, 26 and 31 — number spacing.** Some MAE figures are typeset in maths mode with a space after the comma: "38, 245", "42, 143", "100, 000", "27, 703" and "22, 062" (LaTeX `$38,245$`). Others have no space: "5,281", "29,672", "27,855", "24,421", "25,162", "23,680", "30,734" and "33,887" on slides 29, 33, 34 and 38 (LaTeX `$5{,}281$`). In the body I wrote them all as `$N,NNN$` so they can be searched; this note keeps the visual difference.
- **Slides 21 and 24 — 2-D data, 3-D layer.** Slide 21 shows `train_ds` inputs with shape `(32, 56)`, which is 2-D. Slide 24 says recurrent layers expect 3-D inputs `[batch size, time steps, dimensionality]` and builds `InputLayer(shape=[None, 1])`. No reshape or `expand_dims` of `train_ds`/`valid_ds` is shown anywhere, so it is not shown how the RNN models on slides 24–29 get 3-D input.
- **Slide 24 — model is never trained on the slide.** `fit_and_evaluate` is defined, but the slide never calls it on the `SimpleRNN(1)` model. The MAE is given only as "greater than 100,000", with no exact figure.
- **Slides 23–38 — mixed API versions.** The code uses the Keras 3 argument `InputLayer(shape=...)`. Older tf.keras used `input_shape=` or `batch_input_shape`. But the `model.summary()` printouts on slides 25 and 27 are in the older tf.keras 2.x text format (underscore/`=` rules, "Total params: 3" with no byte sizes). Keras 3 prints a box-drawn table with sizes, e.g. "(12.00 B)". So code and output seem to come from different library versions.
- **Slide 25 vs slide 27 — summary layout.** Slide 25's summary has no closing underscore rule after "Non-trainable params: 0"; slide 27's does.
- **Slides 27, 29 and others — indentation.** Layers inside `Sequential([...])` are indented 3 spaces in `univar_model` (slide 27), 2 spaces in `deep_model` (slide 29) and 4 spaces elsewhere. I copied each exactly as shown.
- **Slide 29 — `# params` comments are placed correctly.** In the rendered image the four comments sit on the right lines: `# 1,088 params` on the first `SimpleRNN(32, return_sequences=True)`, `# 2,080 params` on the second, `# 2,080 params` on `SimpleRNN(32)` and `#    33 params` on `Dense(1)`. `pdftotext -layout` wrongly shifts them up one line (onto `deep_model = ...` and the `InputLayer` line); `pdftotext -raw` agrees with the image. Trust the image.
- **Slide 29 — what Keras would report.** SimpleRNN params = units·(units+input_dim)+units; Dense params = in·out+out.
  - `SimpleRNN(32)` on input_dim 1: 32·(32+1)+32 = **1,088**, matching `# 1,088 params`.
  - `SimpleRNN(32)` on input_dim 32: 32·(32+32)+32 = **2,080**, matching the first `# 2,080 params`.
  - `SimpleRNN(32)` on input_dim 32: **2,080**, matching the second `# 2,080 params`.
  - `Dense(1)` on 32 inputs: 32·1+1 = **33**, matching `#    33 params`.
  - Total 1,088+2,080+2,080+33 = **5,281**, matching the prose. Every comment matches its own line.
- **Other parameter counts check out.**
  - Linear model (slide 23): `Dense(1)` on 56 inputs = 56+1 = **57**, matching.
  - `SimpleRNN(1)` (slide 25): 1·(1+1)+1 = **3**, matching.
  - `univar_model` (slide 27): `SimpleRNN(32)` = 1,088 and `Dense(1)` = 33, total 1,121, all matching.
  - Not quoted on the slides: `mulvar_model` would have SimpleRNN 32·(32+5)+32 = 1,216, Dense(1) 33, total 1,249. `multask_model`: 1,216 + Dense(2) 66 = 1,282. `ahead_model`: 1,216 + Dense(14) 462 = 1,678.
- **Slide 30 — overflow and pandas version.** The comment `# and tomorrow's type` runs out of the code box. The apostrophe is a straight `'` in the source; the typewriter font draws it curly. The `head()` table shows the one-hot columns as `1`/`0`. pandas ≥ 2.0 `get_dummies` would show `True`/`False` by default, so this output is from an older pandas.
- **Slide 31 — clipped comment and placeholder arguments.** The comment `# forecast only the rail serie` is cut off at the slide edge; it should read "series". The literal `[...]` stands in for omitted arguments, so the code would not run as written: a positional `[...]` after keyword arguments is a SyntaxError. "The other 4 arguments" (sequence_length, batch_size, shuffle, seed) and "the other 2 arguments" (sequence_length, batch_size) agree with slide 20.
- **Slide 32 — placeholders and spelling.** The same `[...])` placeholders mean the code is not runnable as written. The prose says "**multitask**" but the variable names use "multask" (`train_multask_ds`, `valid_multask_ds`, `multask_model`).
- **Slide 33 — missing "(cont.)".** Slide 33 has exactly the same title as slide 32, "Forecasting Multiple Outputs". Every other continuation slide adds "(cont.)".
- **Slide 33 — printed output would differ.** `print(name, int(mae))` would print `bus 26812` with no thousands separator, but the output box shows `bus 26,812` / `rail 28,896`.
- **Slide 33 — two runs quoted.** The current run gives total 27,855, bus 26,812 and rail 28,896; the mean of bus and rail is 27,854, close to 27,855. The "2024 run" gives total 24,421, bus 25,162 and rail 23,680; mean 24,421. Each set agrees with itself.
- **Slide 34 — grammar.** "This method works only when the input and output vectors at the same features." is missing a verb (probably "have").
- **Slide 34 — layout and source of the MAE.** The plot's top edge overlaps the bottom of the code box, and the `# one instance` comment runs out of the box. The MAE 30,734 (univar_model, 14-step-ahead forecast made 1 step at a time) is not produced by any code on the slide. The figure's dates agree with the code: 56 days from 2019-01-01 ends on 25 Feb ("Today"), and the 14 red predictions cover 26 Feb–11 Mar.
- **Slide 34 — text layer.** In the right-hand note, the text layer reads "univar model" (the underscore is drawn as a rule); the image shows `univar_model`.
- **Slide 36 — wrong REPL prompt.** `>>>` is used for the indented lines inside the `for` loop. A Python REPL shows continuation lines as `...`.
- **Slide 36 — batch count is consistent.** 2016-01-01..2018-12-31 is 1,096 rows; windows of 56+14 = 70 give 1,027 sequences, and ⌈1027/32⌉ = 33 batches, matching the slide. The shapes `(32, 56, 5)` and `(32, 14)` match `split_inputs_and_targets` with ahead=14 and the 5 columns. `target_col=1` selects "rail", since columns are bus, rail, next_day_type_A/U/W.
- **Slide 37 — typesetting.** "5" is typeset in blue maths, but "14" in "for 14 time steps ahead" is in plain text.
- **Slide 38 — comment position.** In the image, `# shape [1, 56, 5]` is on the `X = mulvar_valid...` line. `pdftotext -layout` wrongly puts it on the `ahead_model = ...` line. Trust the image. The `X = ...` line also runs slightly past the code box.
- **Slide 38 — wording.** "gave a validation MAE 33,887 for rail" is missing "of".
- **Slide 38 — is "y" the target or the forecast?** The red series is labelled "y" (star markers), and the slide does not say whether it is the true target or `Y_pred`. Its values (≈0.66 on day 62 = 4 Mar, ≈0.38 on day 67 = 9 Mar) differ from the "True" values on slide 34's plot for those dates (≈635000 and ≈327000), so it looks like the forecast `Y_pred`. That reading is an inference.
- **Slide 38 — comparison is consistent.** "ahead_model performed slightly worse than the univar_model" agrees with the quoted figures: 33,887 (ahead_model, 14-step one-shot, rail) vs 30,734 (univar_model, 14 steps looped 1 at a time, slide 34). Note that the two numbers come from different methods, 14 steps in one shot vs a 1-step loop.
- **Cross-references that check out.** "slide 18" (7-day-shift rail MAE 42,143: slide 18 prints `rail 42143.271739`), "Slide 24" (`fit_and_evaluate`), "slide 20" (`rail_valid`), "slide 27" (`univar_model`) and "the next slide" on slide 26 (`univar_model` on slide 27) all point to the right places. The deep RNN (29,672) is worse than the shallower `univar_model` (27,703), as slide 29 claims.
- **Figures.** Only Figure 15-10 (slide 28) and Figure 15-11 (slide 34) have numbers and captions in this range. The plots on slides 22, 37 and 38 and the table on slide 30 have neither.

### Slides slides 39–52

- **Slide 39, typo:** "to forest the output from day 11 to day 20" — "forest" should almost certainly be "forecast".
- **Slide 39, wording:** "from days 10 to day 19" mixes "days" and "day".
- **Slide 39, inconsistent example:** The first sentence talks about forecasting "the next 14 values" at every time step. The worked example instead uses 10-day input windows (days 0–9) mapped to 10 output days (days 10–19). That matches neither the 14-step horizon nor the 56-step input window used earlier in the deck (`seq_length = 56`, slide 20).
- **Slide 39, possible conflation:** The slide is titled sequence-to-sequence but says "This can be done using the Encoder-Decoder architecture". The cross-reference itself is correct: slide 13's Figure 15-4 caption does say "encoder-decoder (bottom right)". However, the textbook's sequence-to-sequence forecaster is the top-left (sequence-to-sequence) network of that figure, not an encoder–decoder. The slide has no code for this model.
- **Slide 39, forward reference:** "lecture topic 8 (*Transformers*)" cannot be checked from this deck.
- **Slide 41, spelling:** "*Batch normalisation*" uses British -s, while the same slide also uses "batch normalization" and "Layer normalization" with -z.
- **Slide 41, code will not run as written:** `tf.keras.layers.SimpleRNNCell(32)` is placed directly inside `tf.keras.Sequential`.
  - A cell handles a single time step and must be wrapped in `tf.keras.layers.RNN(...)`. Its `call()` needs a `states` argument, which `Sequential` never passes: in Keras 3 the signature is `call(self, sequence, states, training=False)` and in Keras 2 it is `call(self, inputs, states, training=None)`. Building or calling the model therefore fails with a missing-`states` `TypeError`.
  - The cell also expects 2D per-step input `[batch, features]`, whereas `InputLayer(shape=[None,5])` produces 3D `[batch, time, 5]`.
  - Even if it were wrapped as `RNN(SimpleRNNCell(32))`, `LayerNormalization()` would then be applied once after the whole RNN layer, not at each time step inside the cell, which is the technique the slide describes. Géron's version defines a custom `LNSimpleRNNCell` that applies layer norm, then the activation, inside the cell's `call`, and wraps it in `tf.keras.layers.RNN(...)`.
  - No parameter count is quoted. For reference, a working `RNN(SimpleRNNCell(32))` on 5 features would have 32·(32+5)+32 = 1,216, plus LayerNormalization 2·32 = 64, plus Dense 32+1 = 33, for a total of 1,313.
  - Keras/TensorFlow is not installed in this environment, so this was not executed. The conclusion comes from the Keras API signatures.
- **Slide 41, code style:** `shape=[None,5]` has no space after the comma, whereas slides 43, 49 and 50 write `shape=[None, 1]`. Also, `InputLayer(shape=...)` is the Keras 3 keyword (the older Keras 2 keyword was `input_shape`); this is consistent across the deck.
- **Slide 42, text layer:** pdftotext garbles the footnote's "Jürgen" (as "Ju�rgen") and the en dash in "1735–1780". The image shows "Jürgen" and "1735–1780".
- **Slide 42, redundancy:** The acronym is expanded twice in consecutive sentences, with different capitalisation: "The long short-term memory (LSTM) cell was proposed in 1997" and then "If you consider the *Long Short-Term Memory* (LSTM) cell…".
- **Slide 43, grammar:** "use a `LSTM` layer" should read "an LSTM layer".
- **Slide 43, parameter count verified: 685 is correct.** LSTM(12) on 1 input: 4·(12·(12+1)+12) = 4·168 = 672. Dense(1): 12+1 = 13. Total 685.
- **Slides 44, 45 and 47, ŷ vs y:** Figure 15-12 labels the cell output "ŷ$_{(t)}$" (with a hat), as slide 8 also does. The prose on slides 45 and 46 and the equation on slide 47 write $\mathbf{y}_{(t)}$ without a hat.
- **Slides 44 and 45, labels:** The figure (a raster image from the book) labels vectors in non-bold sans-serif (c, h, x, f, g, i, o), while the prose uses bold serif $\mathbf{c}_{(t)}$ and so on. This is only a rendering difference.
- **Slide 46, ambiguous phrasing:** "For the short-term state $\mathbf{h}_{(t-1)}$, new memories come from the input $\mathbf{x}_{(t)}$." This reads as if new memories for h come only from x. The next sentence, and the figure, show that both $\mathbf{h}_{(t-1)}$ and $\mathbf{x}_{(t)}$ feed all four FC layers.
- **Slide 47, mixed vector convention:** The i, f, o and g equations use the transposed (row-vector) form, with ⊤ on the gate, x, h and b. The $\mathbf{c}_{(t)}$ and $\mathbf{y}_{(t)} = \mathbf{h}_{(t)}$ lines drop the ⊤ entirely. This is harmless because those operations are element-wise, but it is inconsistent within one block. The same applies on slide 49, where the $\mathbf{h}_{(t)}$ line has no ⊤.
- **Slides 47 and 49, notation change vs slide 9:** Slide 9 writes $\mathbf{h}_{(t)}^{\top} = \varphi_h\left(\mathbf{h}_{(t-1)}^{\top}\mathbf{W}_h + \mathbf{x}_{(t)}^{\top}\mathbf{W}_x + \mathbf{b}_h^{\top}\right)$, with the h-term first, single-subscript $\mathbf{W}_h$/$\mathbf{W}_x$, and a generic activation $\varphi$.
  - Slides 47 and 49 put the x-term first, use two-letter weight subscripts ($\mathbf{W}_{xi}$, $\mathbf{W}_{hi}$, …, $\mathbf{W}_{xz}$, $\mathbf{W}_{hr}$, …), use per-gate biases, and name the activations ($\sigma$, tanh).
  - The ⊤ glyph (`\top`) is the same throughout.
  - Géron's book (Eq. 15-4) uses the column form $\mathbf{W}_{xi}^{\intercal}\mathbf{x}_{(t)} + \mathbf{W}_{hi}^{\intercal}\mathbf{h}_{(t-1)} + \mathbf{b}_i$. The slide's form is its transpose and is equivalent.
- **Slide 47, ordering:** The equations are listed in the order i, f, o, g, whereas the figure's FC boxes run f, g, i, o from left to right. This is not an error.
- **Slides 47 and 50, layout overflow:** The body text starts immediately under the title bar. On slide 50, the top of the first line ("Similar to using 2D convolution layers…") is slightly clipped by the title bar.
- **Slide 48, omission:** The prose never introduces $\mathbf{r}_{(t)}$ (the reset gate, which controls how much of $\mathbf{h}_{(t-1)}$ is shown to the main layer) or the GRU's $\mathbf{g}_{(t)}$. Both appear in Figure 15-13 and in the slide 49 equations.
- **Slide 48, minor:** The figure's box reads "1-z$_{(t)}$" with a hyphen, while slide 49 writes $\left(1 - \mathbf{z}_{(t)}\right)$. The first bullet ("…into a single vector $\mathbf{h}_{(t)}$") has no full stop, unlike the other two.
- **Slide 49, likely error in the g equation:** It is typeset as $\left(\mathbf{r}_{(t)}^{\top}\mathbf{W}_{hg} \otimes \mathbf{h}_{(t-1)}^{\top}\right)$. Under normal precedence that means $(\mathbf{r}_{(t)}^{\top}\mathbf{W}_{hg}) \otimes \mathbf{h}_{(t-1)}^{\top}$: the reset gate is multiplied by the weight matrix, and the result is then gated element-wise with the previous state.
  - This contradicts Figure 15-13 on slide 48, where $\mathbf{r}_{(t)} \otimes \mathbf{h}_{(t-1)}$ is formed first and then fed into the FC layer. That would be $(\mathbf{r}_{(t)} \otimes \mathbf{h}_{(t-1)})^{\top}\mathbf{W}_{hg}$, i.e. Géron's Eq. 15-5, $\mathbf{W}_{hg}^{\intercal}(\mathbf{r}_{(t)} \otimes \mathbf{h}_{(t-1)})$.
  - It also differs from Keras's default `reset_after=True` form, $\mathbf{r}_{(t)} \otimes (\mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hg} + \mathbf{b}_{hg})$.
  - Because $\mathbf{W}_{hg}$ is square (units × units), the slide's version is dimensionally valid, so the error is silent.
- **Slide 49, parameter count verified: 1401 is correct for Keras's default GRU.** GRU(20) on 1 input with `reset_after=True`: 3·(20·(20+1) + 2·20) = 3·460 = 1,380. Dense(1): 20+1 = 21. Total 1,401. With `reset_after=False` it would be 3·(20·21+20) = 1,320, plus 21, for 1,341. The quoted 1,401 therefore reflects Keras's two-bias-per-gate variant, while the slide's equations show a single bias per gate ($\mathbf{b}_z$, $\mathbf{b}_r$, $\mathbf{b}_g$) and the Géron reset placement. The equations and the parameter count describe slightly different GRU variants.
- **Slide 50, parameter count verified: 1283 is correct.**
  - Conv1D(8, k=3) on 1 channel: 3·1·8+8 = 32.
  - Conv1D(16, k=3) on 8 channels: 3·8·16+16 = 400.
  - GRU(10) on 16 inputs (`reset_after=True`): 3·(10·(10+16) + 2·10) = 3·280 = 840.
  - Dense(1): 10+1 = 11.
  - Total: 32+400+840+11 = 1,283.
- **Slide 50, illustrative vs actual numbers:** The prose example uses "$10$ kernels" giving "$10$ 1D sequences" or "a single 10D sequence". The code actually uses `filters=8` and then `filters=16`.
- **Slide 50, sequence length (derived, not stated on the slide):** Both Conv1D layers use the default `padding="valid"`. With the deck's 56-step windows (slide 20), the length becomes 56 → 54 after the k=3, s=1 layer, then ⌊(54−3)/2⌋+1 = 26 after the k=3, s=2 layer, before reaching `GRU(10)`. The model is sequence-to-vector (one output, `Dense(1)`). This is a simplification of Géron's Conv1D+GRU example, which is sequence-to-sequence with cropped targets.
- **Slide 50, MAE comparison:** "performed similarly well compared to those previous models". The quoted MAEs are LSTM 30,262 (slide 43), GRU 26,497 (slide 49) and CNN+GRU 30,209.
- **Slide 50, minor:** "Modify the codes" is a non-standard plural. "The 57th day" is consistent with slide 22 (input days 0–55, predict day 56).
- **Slide 51:** The summary items are unnumbered square bullets on the slide, not a numbered list.
- **Slide 52:** "Read up to Chapters 17" uses a plural with a single chapter number. "(up to page 647)" cannot be verified from the deck.
