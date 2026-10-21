# CITS5017 Deep Learning

Topic 5: Representation learning and dimension reduction using Autoencoders — Associate Professor Du Huynh (Unit Coordinator and Lecturer) — Semester 2, 2026

*Transcription conventions (slides 1–27): key terms that are dark red on the slides are written in **bold** (dark-red italic → ***bold italic***); black italic stays *italic*; black bold text is flagged in a note where it occurs. Maths that is typeset in blue on the slides is written as plain LaTeX. Bold blue sub-headings directly under a slide title are written as `###` headings. Inline code that is dark-red typewriter on the slides is written as `code`. The transpose glyph is ⊤ (written `^\top`) and the script ell is ℓ (written `\ell`). Slide-number footers ("N / 27") are not recorded.*

---

## Slide 1 — CITS5017 Deep Learning / Topic 5: Representation learning and dimension reduction using Autoencoders

Associate Professor Du Huynh
(Unit Coordinator and Lecturer)

Semester 2, 2026

> **Figure (slide 1).** Title banner: white text on a dark-blue rectangle, three centred lines: "CITS5017 Deep Learning", "Topic 5: Representation learning and dimension", "reduction using Autoencoders". Below the lecturer/date lines is the UWA crest: a shield whose upper band (chief) is blue with a gold top edge and holds two open books, each showing two pages of text — the left book reads "VIT AM" / "EXC OLU", the right book reads "ERE PER" / "AR TES" (i.e. *Vitam excolere per artes*). The lower part of the shield is blue with a gold/yellow field in the centre on which sits a black swan with a white wing. Beneath the shield is a blue ribbon with white text "SEEK WISDOM". Below the crest is the blue wordmark "THE UNIVERSITY OF / WESTERN / AUSTRALIA". (No slide number is shown on this slide.)

---

## Slide 2 — Today

Chapters 17.

### Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow

> **Figure (slide 2).** Small book-cover image, O'REILLY. Top-left: red "O'REILLY" logo. Top-right corner: a diagonal grey banner reading "Third Edition". Title in black: "Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow". Subtitle in orange: "Concepts, Tools, and Techniques to Build Intelligent Systems". Below it, tiny "powered by" text with a Jupyter logo. Cover illustration: a black salamander with bright yellow spots and stripes, crawling diagonally across the lower half. Author name at bottom right: "Aurélien Géron".

---

## Slide 3 — Chapter Seventeen

### Autoencoders, GANs, and Diffusion Models

Here are the main topics we will briefly cover:

- What are Autoencoders?
- Efficient data representations
- Encoder and decoder in an autoencoder
- Performing PCA using an *undercomplete* linear autoencoder
- Stacked autoencoders and how to implement one using Keras in TensorFlow
- Tying the weights in a stacked autoencoder and visualizing the reconstruction
- Unsupervised pre-training using stacked autoencoders
- Training one autoencoder at a time

(*Diffusion models* will not be covered in the unit)

---

## Slide 4 — What Are Autoencoders?

- Autoencoders are artificial neural networks capable of learning efficient representations of the input data, called ***latent representations codings***, without any supervision (i.e., the training set is unlabelled). These codings typically have a **much lower dimensionality** than the input data, making autoencoders useful for **dimensionality reduction**.
- More importantly, autoencoders act as **feature detectors**, and they can be used for unsupervised pre-training of deep neural networks.
- Lastly, some autoencoders are ***generative models***: they are capable of randomly generating new data that looks very similar to the training data. For example, you could train an autoencoder on pictures of faces, and it would then be able to generate new faces. However, the generated images are usually fuzzy and not entirely realistic.

(The whole phrase "latent representations codings" is one dark-red italic run, wrapped across two lines on the slide.)

---

## Slide 5 — Efficient Data Representations

Which of the following number sequences do you find the easiest to memorize?

- 40, 27, 25, 36, 81, 57, 10, 73, 19, 68
- 50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14

While the first sequence is shorter and seemingly easier to remember, the second sequence has a notable pattern (decreasing even numbers from $50$ to $14$).

Just like expert chess players being able to detect patterns in chess games, we can train an autoencoder to convert the inputs to efficient latent representations and then spits out something that (hopefully) look very close to the inputs.

(The two number sequences are plain black text; only the "50" and "14" in the following sentence are blue maths. The second sequence wraps so that "14" sits alone on the next line.)

---

## Slide 6 — Efficient Data Representations (cont.)

#### Left — figure

> **Figure 17-1.** Two panels side by side.
> *Left panel (chess memory experiment):* drawn bottom-to-top. At the bottom, an 8 × 8 chessboard with alternating dark-blue and light-blue squares and small chess-piece glyphs, labelled "Inputs" to its right. A thick blue upward arrow leads from the board to a greyscale/sepia photograph of a statue of a seated man resting his chin on his hand (it looks like Rodin's *The Thinker*; the figure does not name it), labelled "Latent representation" to its right. A second thick blue upward arrow leads from the photograph to a second 8 × 8 chessboard at the top, labelled "Outputs (≈inputs)" to its right; its piece layout appears identical to the input board.
> *Right panel (a simple autoencoder):* a network drawn bottom-to-top with light-blue circular neurons. At the bottom are three input labels, "$x_1$", "$x_2$", "$x_3$" (italic, no neurons drawn for them). Arrows point upward from each input to each of the two neurons in the middle layer (6 arrows, crossing). From each of the two middle neurons, arrows point upward to each of the three neurons in the top layer (6 arrows, crossing). From each top neuron a single arrow points up to an output label: "$x'_1$", "$x'_2$", "$x'_3$". On the right, a curly brace beside the middle (two-neuron) layer is labelled "Encoder", and a curly brace beside the top (three-neuron) layer is labelled "Decoder".

*Caption:* Figure 17-1. The chess memory experiment (left) and a simple autoencoder (right)

#### Right and below — text

- An autoencoder typically has the same architecture as a **Multi-Layer Perceptron** (**MLP**), except that the number of neurons in the output layer must be equal to the number of neurons in the input layer.
- In the example here, there is just one hidden layer composed of two neurons (the ***encoder***), and one output layer composed of three neurons (the ***decoder***). The outputs are often called the ***reconstructions*** since the autoencoder tries to reconstruct the inputs, and the cost function contains a ***reconstruction loss*** that penalizes the model when the reconstructions are different from the inputs.

(Layout: the first bullet and the start of the second bullet sit in a narrow column to the right of the figure; from "layer composed of three neurons (the decoder)" onward the second bullet runs full width below the figure.)

---

## Slide 7 — Efficient Data Representations (cont.)

#### Left — figure

> **Figure 17-1.** The same figure as on slide 6 (the PDF reuses the identical embedded image): left, the chessboard "Inputs" → photograph of a statue "Latent representation" → chessboard "Outputs (≈inputs)", joined by thick blue upward arrows; right, the bottom-to-top network with inputs $x_1, x_2, x_3$, a two-neuron layer braced "Encoder", a three-neuron layer braced "Decoder", and outputs $x'_1, x'_2, x'_3$.

*Caption:* Figure 17-1. The chess memory experiment (left) and a simple autoencoder (right)

#### Right and below — text

- Because the internal representation has a lower dimensionality than the input data (it is 2D instead of 3D), the autoencoder is said to be ***undercomplete***.
- An undercomplete autoencoder cannot trivially copy its inputs to the codings. So, it must learn to find a way to output a copy of its inputs. i.e., it is forced to learn the most important features in the input data (and drop the unimportant ones).

(Layout: as on slide 6, the bullets start in a narrow right-hand column; from "copy of its inputs. i.e., …" onward the second bullet runs full width below the figure.)

---

## Slide 8 — Performing PCA with an Undercomplete Linear Autoencoder

If the autoencoder uses only **linear activations** and the cost function is the **Mean Squared Error** (**MSE**), then it can be shown that it ends up performing **Principal Component Analysis** (see Chapter 8).

**Example:** Build a simple linear autoencoder to perform PCA:

```python
import tensorflow as tf

encoder = tf.keras.models.Sequential([tf.keras.layers.Dense(2)])
decoder = tf.keras.models.Sequential([tf.keras.layers.Dense(3)])
autoencoder = tf.keras.Sequential([encoder, decoder])

optimizer = tf.keras.optimizers.SGD(learning_rate=0.5)
autoencoder.compile(loss="mse", optimizer=optimizer)
```

**Notes:** **(i)** the autoencoder consists of two subcomponents: the **encoder** and the **decoder**. **(ii)** The autoencoder's number of outputs is equal to the number of inputs (i.e., $3$). **(iii)** To perform PCA, we do not use any activation function (i.e., all neurons are linear), and the cost function is the MSE.

(The slide title wraps over two lines. "Example:", "Notes:", "(i)", "(ii)" and "(iii)" are black bold, not coloured. "encoder" and "decoder" in the Notes are dark red, upright.)

---

## Slide 9 — Performing PCA with an Undercomplete Linear Autoencoder (cont.)

Now let's generate the same 3D data used in Chapter 8:

#### Left — 3D plot (no figure number)

> **Figure (slide 9, left, unnumbered).** A matplotlib 3D scatter plot with grey grid panes. Axis labels: "$x_1$" on the front-left horizontal axis, "$x_2$" on the right-hand horizontal axis, "$x_3$" on the vertical axis at the right. Tick labels on all three axes: −1.0, −0.5, 0.0, 0.5, 1.0. A translucent light-blue (lavender) plane cuts diagonally through the cube, rising towards the back right. Data points: bright-red filled circles (above the plane) and light-red/pink filled circles (below the plane). Each red circle is joined by a short red **dashed** segment, and each pink circle by a pink **dotted** segment, to a small blue "+"-shaped marker on the plane (its projection). The points are spread across the plane, with a denser group towards the front left and a group of bright-red points at the back right.

#### Right — 2D scatter plot (no figure number)

> **Figure (slide 9, right, unnumbered).** A matplotlib 2D scatter plot with grid lines. X-axis label "$z_1$", y-axis label "$z_2$" (large italic serif). X tick labels −1.0, −0.5, 0.0, 0.5, 1.0 (x-range ≈ −1.45 to ≈ 1.35); y tick labels −1.0, −0.5, 0.0, 0.5, 1.0 (y-range −1.0 to ≈ 1.1). Roughly 60 blue filled dots (my count from the image is 60, matching the code comment's "(60,3)"). Most dots form a loose cloud at the lower left (z₁ ≈ −1.35 to −0.45, z₂ ≈ −0.9 to 0.5). A spread of dots runs through the middle (z₁ ≈ −0.5 to 0.1, z₂ ≈ −0.55 to 0.7). A separate group sits at the upper right (z₁ ≈ 0.55 to 1.25, z₂ ≈ 0.1 to 1.03), and one isolated dot is at about (0.46, −0.24). Lowest dot ≈ (−1.35, −0.90); highest ≈ (0.85, 1.03).

#### Caption (small font, below both plots)

**Left:** The 3D training set. Bright/light red dots: 3D points above/below the light blue plane; blue markers: the projections of the 3D points onto the plane. **Right:** The approximate PCA performed by the undercomplete linear autoencoder. (compare the blue markers in the two diagrams)

("Left:" and "Right:" are black bold.)

```python
X_train = [...]  # shape of X_train is (60,3) in the example above
history = autoencoder.fit(X_train, X_train, epochs=500, verbose=False)
codings = encoder.predict(X_train)
```

*[`[...]` is written literally on the slide; the data-generation code is not shown.]*

---

## Slide 10 — Stacked Autoencoders

- Just like other neural networks we have discussed, autoencoders can have multiple hidden layers. In this case they are called ***stacked autoencoders*** (or ***deep autoencoders***).
- Adding more layers helps the autoencoder learn more complex codings. However, one must be careful not to make the autoencoder too powerful. Imagine an encoder so powerful that it just learns to map each input to a single arbitrary number (and the decoder learns the reverse mapping). Obviously such an autoencoder will reconstruct the training data perfectly, but it will not have learned any useful data representation in the process (and it is unlikely to generalize well to new instances).

---

## Slide 11 — Stacked Autoencoders (cont.)

- The architecture of a stacked autoencoder is typically symmetrical with regards to the **central hidden layer** (**the coding layer**). To put it simply, it looks like a sandwich, e.g., an autoencoder for MNIST may have $784$ inputs, then a hidden layer with $100$ neurons, a central hidden layer of $30$ neurons, then another hidden layer with $100$ neurons, and an output layer with $784$ neurons (Figure 17-3).

> **Figure 17-3.** Five rounded rectangles stacked vertically and drawn **bottom-to-top**, joined by plain vertical black lines (no arrowheads between layers). Each box has a bold label inside and a unit count in small text to its left:
> - bottom: "Input layer" — green box, widest — "784 units";
> - "Hidden 1" — light blue-grey box, medium width — "100 units";
> - "Hidden 2" — pink box, narrowest — "30 units";
> - "Hidden 3" — light blue-grey box, medium width — "100 units";
> - top: "Output layer" — green box, widest — "784 units".
>
> A black arrow with an arrowhead rises out of the top of the Output layer. On the left, the bold label "Codings" has a dashed black arrow pointing **right** to the line between Hidden 2 and Hidden 3; the bold label "Reconstruction" has a dashed black arrow pointing **right** to the line above the Output layer. The colours pair the input and output layers (green), the two 100-unit hidden layers (blue-grey), and single out the coding layer (pink). The caption sits to the right of the Input layer.

*Caption:* Figure 17-3. Stacked autoencoder

---

## Slide 12 — Implementing a Stacked Autoencoder Using Keras

You can implement a stacked autoencoder very much like a regular deep MLP. The code below is for the Fashion MNIST dataset.

```python
stacked_encoder = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28,28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(30, activation="relu"),
])
stacked_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(28 * 28),
    tf.keras.layers.Reshape([28, 28])
])
stacked_ae = tf.keras.Sequential([stacked_encoder, stacked_decoder])

stacked_ae.compile(loss="mse", optimizer="nadam")
history = stacked_ae.fit(X_train, X_train, epochs=20,
                         validation_data=(X_valid, X_valid))
```

This model (`stacked_ae`) has $163,814$ trainable parameters.

(The number is blue maths and is typeset "163, 814", with a space after the comma.)

---

## Slide 13 — Implementing a Stacked Autoencoder Using Keras (cont.)

### Visualizing the Reconstructions

One way to ensure that an autoencoder is properly trained is to compare the inputs and the outputs: the differences should not be too significant.

> **Figure 17-4.** A grid of 10 small greyscale Fashion-MNIST-style images in **2 rows × 5 columns**, drawn dark on a white background. Per the caption, the **top row is the originals** and the **bottom row is their reconstructions**; each column is one item. Left to right:
> 1. Original: a dark long-sleeved top. Reconstruction: a blurrier dark long-sleeved top.
> 2. Original: a dark bag with a white logo in the centre and a strap/handle loop on its left side. Reconstruction: a blurry dark, roughly square blob; the logo and handle are gone and the shape looks more like a top than a bag.
> 3. Original: a mid-grey short-sleeved V-neck T-shirt. Reconstruction: a blurrier grey T-shirt with a less distinct neckline.
> 4. Original: a pale long-sleeved top with two thin straps rising from the shoulders and a small dark mark at the lower left. Reconstruction: a blurry pale long-sleeved top; the straps and the mark are gone.
> 5. Original: a light, strappy high-heeled sandal, toe pointing left. Reconstruction: a blurrier, darker and heavier high-heeled shoe with a thick heel.

*Caption:* Figure 17-4. Original images (top) and their reconstructions (bottom)

The reconstructions are recognizable, but a bit too lossy. We may need to train the model for longer, or make the encoder and decoder deeper, or make the codings larger.

(The sub-heading is bold blue.)

---

## Slide 14 — Implementing a Stacked Autoencoder Using Keras (cont.)

### Visualizing Using T-SNE

Once we have reduced the datset's dimensionality, we can use another dimensionality reduction algorithm to see how well the lower-dimensional data is for the downstream classification task. T-SNE<sup>1</sup> is a suitable algorithm as it reduces the data down to 2D for visualization.

```python
from sklearn.manifold import TSNE
X_valid_compressed = stacked_encoder.predict(X_valid)
tsne = TSNE()
X_valid_2D = tsne.fit_transform(X_valid_compressed)
```

**Footnotes:**

1. ***t-distributed stochastic neighbour embedding*** (proposed by van der Maaten and Hinton in 2008) reduces dimensionality while trying to keep similar instances close and dissimilar instances apart.

(The sub-heading is bold blue. In the footnote, "t-distributed stochastic neighbour embedding" is dark-red italic with a lowercase "t".)

---

## Slide 15 — Implementing a Stacked Autoencoder Using Keras (cont.)

### Visualizing Using T-SNE (cont.)

> **Figure 17-5.** A t-SNE scatter plot with **no axes, tick labels, axis labels or legend**. Several thousand small dots, each coloured by class with ten distinct colours (cyan, grey, brown, olive/yellow-green, green, purple, pink, blue, red, orange). On top of the clusters sit **24 small greyscale item thumbnails**, each in a square frame whose border colour matches the dots of the cluster it sits on. The slide never says which colour is which class; the thumbnails are the only key. By region:
> - **Upper left — footwear:** three touching clusters. A **cyan** cluster arcs from the centre-left up towards the top centre, with 2 cyan-framed thumbnails: an ankle boot and a high-top shoe. A **grey** cluster at the far left, with 3 grey-framed thumbnails: a low slip-on shoe and two lace-up sneakers. A **brown** cluster below the cyan one and to the right of the grey one, extending downward, with 2 brown-framed thumbnails: a strappy high-heeled sandal and a light strappy sandal.
> - **Top centre — bags:** an **olive/yellow-green** cluster forms an arc from the middle of the plot up to the top, with 3 olive-framed thumbnails: a shoulder bag, a bag with a logo, and a handbag with top handles. It is well separated from the footwear on its left.
> - **Upper right — tops (heavily mixed):** a large region where **green**, **purple** and **pink** dots are thoroughly intermixed. Thumbnails: 3 green-framed (a long-sleeved top with a printed picture, a black long-sleeved top, a dark V-neck pullover); 1 purple-framed (a buttoned jacket/coat with a collar); 2 pink-framed (a light long-sleeved collared shirt, and a pale long-sleeved top at the region's left edge, near the centre of the plot).
> - **Lower centre/right — blue:** a **blue** cluster, with 4 blue-framed thumbnails: a T-shirt with a dotted print, a plain dark-grey T-shirt, a black sleeveless top with thin straps, and a dark long-sleeved top. Blue dots mix with pink and red at its edges.
> - **Lower centre — red:** a **red** cluster below and left of the blue one, with 2 red-framed thumbnails: a long grey sleeveless dress and a short dark dress with sleeves. Some purple dots sit between the red and blue clusters at the bottom.
> - **Lower left — orange:** a compact **orange** cluster, clearly separated from everything else, with 2 orange-framed thumbnails, both trousers.

*Caption:* Figure 17-5. Fashion MNIST visualization using an autoencoder followed by t-SNE

(The sub-heading is bold blue. The caption writes "t-SNE" with a lowercase "t".)

---

## Slide 16 — Unsupervised Pretraining Using Stacked Autoencoders

So, autoencoders can be used for dimensionality reduction. Another application is for unsupervised pretraining.

As discussed in Chapter 11, if you are tackling a complex supervised task but you do not have a lot of labelled training data, one solution is to find a neural network that performs a similar task and reuse its lower layers. This makes it possible to train a high-performance model using little training data because your neural network won't have to learn all the low-level features; it will just reuse the feature detectors learned by the existing network.

Similarly, we can firstly train a stacked autoencoder using all the data. This training process does not require the data to be labelled. Once the stacked autoencoder is trained, we can reuse its lower layers in our neural network for the actual task. As our neural network has fewer layers that require training, it can cope with fewer labelled training data.

(The second and third paragraphs have an indented first line. There are no bullets.)

---

## Slide 17 — Unsupervised Pretraining Using Stacked Autoencoders (cont.)

> **Figure 17-6.** Two stacks of rounded boxes, drawn **bottom-to-top**, joined by solid black vertical lines.
> - **Left stack (Phase 1):** "Input" (green, wide) → "Hidden 1" (light blue) → "Hidden 2" (pink, narrower) → "Hidden 3" (light blue) → "Output" (green, wide), with a black arrow pointing up out of the Output box. Below it: "**Phase 1**" (bold) and "Train the autoencoder using all the data".
> - **Right stack (Phase 2):** "Input" (green, wide) → "Hidden 1" (light blue) → "Hidden 2" (pink) → "Output" (light blue) → "Softmax" (orange, sitting directly on top of the Output box), with a black arrow pointing up out of the Softmax box. Below it: "**Phase 2**" (bold) and "Train the classifier on the labeled data".
> - Two horizontal **dashed** black arrows point **right** from the Phase 1 stack to the Phase 2 stack: Hidden 1 → Hidden 1 and Hidden 2 → Hidden 2. Between the two arrows is the italic label "*Copy parameters*". Hidden 3 and Output of Phase 1 are not copied.

*Caption:* Figure 17-6. Unsupervised pretraining using autoencoders.

There is nothing special about the implementation: just train an autoencoder using all the training data, then reuse its encoder layers to create a new neural network for your actual task and train it using the labelled data.

(The slide title wraps over two lines. This caption, unlike the others, ends with a full stop.)

---

## Slide 18 — Stacked Autoencoders: Tying the Weights

When an autoencoder is neatly symmetrical, like the one we just built, a common technique is to ***tie the weights*** of the decoder layers to the weights of the encoder layers. This **halves the number of weights** in the model, speeding up training and limiting the risk of overfitting.

---

## Slide 19 — Stacked Autoencoders: Tying the Weights (cont.)

#### Left — figure (no figure number)

> **Figure (slide 19, unnumbered).** The same layer stack as Figure 17-3, drawn **bottom-to-top** with plain vertical black lines between the boxes: "Input layer" (green, "784 units") → "Hidden 1" (light blue-grey, "100 units") → "Hidden 2" (pink, "30 units") → "Hidden 3" (light blue-grey, "100 units") → "Output layer" (green, "784 units"), with an upward arrow out of the top. On the left, "**Codings**" with a dashed black arrow pointing right to the line between Hidden 2 and Hidden 3, and "**Reconstruction**" with a dashed black arrow pointing right to the line above the Output layer.
> On the right, four small bold blue weight labels, each with a blue **dashed** arrow pointing **left** to one of the connecting lines:
> - between Input layer and Hidden 1: $\mathbf{W}_1$;
> - between Hidden 1 and Hidden 2: $\mathbf{W}_2$;
> - between Hidden 2 and Hidden 3 (level with the Codings arrow): $\mathbf{W}_2^{\top}$;
> - between Hidden 3 and Output layer: $\mathbf{W}_1^{\top}$.

*Caption:* Tying the weights in a stacked autoencoder ($N = 4$ in this example).

#### Right — text

Specifically, if the autoencoder has a total of $N$ layers (not counting the input layer), and $\mathbf{W}_{\ell}$ represents the connection weights of the $\ell^{\text{th}}$ layer (e.g., layer 1 is the first hidden layer, layer $\frac{N}{2}$ is the coding layer, and layer $N$ is the output layer), then the decoder layer weights can be defined simply as:

$$
\mathbf{W}_{N-\ell+1} = \mathbf{W}_{\ell}^{\top}
$$

with $\ell = 1, 2, \cdots, N/2$.

#### Below

In this example, only $\mathbf{W}_1$, $\mathbf{W}_2$, and the bias terms need to be learned.

(The "Specifically, …" paragraph has an indented first line. The "th" in $\ell^{\text{th}}$ is upright sans-serif, blue like the $\ell$. The "1" in "layer 1" is plain black text, not maths.)

---

## Slide 20 — Stacked Autoencoders: Tying the Weights (cont.)

(Note the modification (line `# ***`) to Géron's code)

```python
class DenseTranspose(tf.keras.layers.Layer):
    def __init__(self, dense, activation=None, **kwargs):
        super().__init__(**kwargs)
        self.dense = dense
        self.activation = tf.keras.activations.get(activation)

    def build(self, batch_input_shape):
        self.biases = self.add_weight(
                        name="bias",
                        shape=[self.dense.input.shape[-1]],    # ***
                        initializer="zeros")
        super().build(batch_input_shape)

    def call(self, inputs):
        Z = tf.matmul(inputs, self.dense.weights[0], transpose_b=True)
        return self.activation(Z + self.biases)

dense_1 = tf.keras.layers.Dense(100, activation="relu")
dense_2 = tf.keras.layers.Dense(30, activation="relu")
```

(The note above the code is in a small font, with "# ***" in typewriter. The `# ***` marker is on the `shape=[self.dense.input.shape[-1]],` line inside `build`.)

---

## Slide 21 — Stacked Autoencoders: Tying the Weights (cont.)

```python
tied_encoder = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28,28]),
    tf.keras.layers.Flatten(),
    dense_1,
    dense_2
])
tied_decoder = tf.keras.Sequential([
    DenseTranspose(dense_2, activation="relu"),
    DenseTranspose(dense_1),
    tf.keras.layers.Reshape([28, 28])
])

tied_ae = tf.keras.Sequential([tied_encoder, tied_decoder])
tied_ae.compile(loss="mse", optimizer="nadam")
history = tied_ae.fit(X_train, X_train, epochs=10,
                      validation_data=(X_valid, X_valid))
```

Compared to `stacked_ae` which has $163,814$ trainable parameters, `tied_ae` only has $82,414$ trainable parameters (number of parameters that require training is almost halved). It also achieves a slightly lower reconstruction error than `stacked_ae`.

(Both numbers are blue maths typeset with a space after the comma: "163, 814" and "82, 414".)

---

## Slide 22 — Stacked Autoencoders: Tying the Weights (cont.)

### Reconstruction from the tied_ae model

> **Figure (slide 22, unnumbered).** A 2 × 5 grid of small greyscale images in the same layout as Figure 17-4: **top row originals, bottom row reconstructions**. The five originals are the same as on slide 13 (dark long-sleeved top; dark bag with a white logo and a handle on the left; grey V-neck T-shirt; pale long-sleeved top with thin shoulder straps and a small dark mark; light strappy high-heeled sandal facing left). The reconstructions are blurry in the same way as Figure 17-4: a dark long-sleeved top; a dark, roughly square blob with a lighter centre and no logo or handle; a grey T-shirt; a pale long-sleeved top without the straps or mark; a darker, heavier high-heeled shoe. They look very similar to slide 13's reconstructions, but the PDF embeds different reconstruction images on slides 13 and 22.

*Caption:* Original images (top) and their reconstructions (bottom)

(The sub-heading is bold blue sans-serif, not typewriter; "tied_ae" is part of it.)

---

## Slide 23 — Training One Autoencoder at a Time

It is possible to train one shallow autoencoder at a time, then stack all of them into a single stacked autoencoder (hence the name). For example,

#### Left — figure

> **Figure 17-7.** Three stacks of rounded boxes, each drawn **bottom-to-top** with solid black vertical lines between the boxes.
> - **Phase 1 (left):** "Input" (green, wide) → "Hidden 1" (light blue, narrower) → a long vertical line → "Output" (green, wide), then a black upward arrow labelled "Target=inputs". Below: "**Phase 1**" (bold) and "Train the first autoencoder".
> - **Phase 2 (middle, drawn higher up):** "Input" (green, narrow) → "Hidden 2" (pink) → "Output" (light blue), then a black upward arrow labelled "Target=inputs". Below: "**Phase 2**" (bold) and "Train the second autoencoder on the training set encoded by the first encoder".
> - **Phase 3 (right):** "Input" (green, wide) → "Hidden 1" (light blue) → "Hidden 2" (pink) → "Hidden 3" (light blue) → "Output" (green, wide), then a black upward arrow (unlabelled). Below: "**Phase 3**" (bold) and "Stack the autoencoders".
> - **Dashed black arrows**, all ending with arrowheads pointing **right** into Phase 3:
>   - Phase 2 "Output" → Phase 3 "Hidden 3" (straight across);
>   - Phase 2 "Hidden 2" → Phase 3 "Hidden 2" (straight across);
>   - Phase 1 "Hidden 1" → Phase 3 "Hidden 1": the line runs right, drops down, passes underneath the Phase 2 Input box, rises again and enters Phase 3 Hidden 1;
>   - Phase 1 "Output" → Phase 3 "Output": the line runs right, climbs up and over Phase 2's "Target=inputs" label, then drops down and enters Phase 3 Output. The italic label "*Copy parameters*" sits on top of this upper route.

*Caption:* Figure 17-7. Training one autoencoder at a time

#### Right — text

- **Phase 1:** Train the first autoencoder to learn a compressed representation $\mathbf{X}_{(1)}$ of the inputs.
- **Phase 2:** Using $\mathbf{X}_{(1)}$ as input data, train the second autoencoder to learn an even more compressed representation $\mathbf{X}_{(2)}$.
- **Phase 3:** Finally, we build a big sandwich using all these autoencoders.

#### Below

There can be more phases if the autoencoder is very deep.

(The "Phase N:" labels are dark-red bold. $\mathbf{X}_{(1)}$ and $\mathbf{X}_{(2)}$ are bold blue maths.)

---

## Slide 24 — Training One Autoencoder at a Time (cont.)

```python
def train_autoencoder(n_neurons, X_train, X_valid, n_epochs=10,
                      output_activation=None):
    n_inputs = X_train.shape[-1]
    encoder = tf.keras.layers.Dense(n_neurons, activation="relu")
    decoder = tf.keras.layers.Dense(n_inputs, activation=output_activation)
    autoencoder = tf.keras.Sequential([encoder, decoder])
    autoencoder.compile(loss="mse", optimizer="nadam")
    autoencoder.fit(X_train, X_train, epochs=n_epochs,
                    validation_data=(X_valid, X_valid))
    return encoder, decoder, encoder(X_train), encoder(X_valid)

X_train_flat = tf.keras.layers.Flatten()(X_train)
X_valid_flat = tf.keras.layers.Flatten()(X_valid)

# Train the first autoencoder using X_train_flat and X_valid_flat.
# X_train_enc1 and X_valid_enc1 are the compressed representations.
enc1, dec1, X_train_enc1, X_valid_enc1 = train_autoencoder(
    100, X_train_flat, X_valid_flat)

# Train the second autoencoder using X_train_enc1 and X_valid_enc1.
enc2, dec2, _, _ = train_autoencoder(
    30, X_train_enc1, X_valid_enc1, output_activation="relu")

# Stack up to form the final autoencoder.
stacked_ae_1_by_1 = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    enc1, enc2, dec2, dec1,
    tf.keras.layers.Reshape([28, 28])
])
```

(The whole slide is one code box in a small font.)

---

## Slide 25 — Training One Autoencoder at a Time (cont.)

```python
# If needed, we can then continue training the full stacked autoencoder
# for a few epochs
stacked_ae_1_by_1.compile(loss="mse", optimizer="nadam")
history = stacked_ae_1_by_1.fit(X_train, X_train, epochs=5,
                                validation_data=(X_valid, X_valid))

# visualize the reconstruction
plot_reconstructions(stacked_ae_1_by_1) # see the author's Jupyter
                                        # notebook file
plt.show()
```

*[The typewriter font draws the apostrophe in `author's` as a curly quote.]*

> **Figure (slide 25, unnumbered).** A 2 × 5 grid of small greyscale images in the same layout as Figure 17-4: **top row originals, bottom row reconstructions**. The five originals are the same as on slides 13 and 22. The reconstructions are blurry and somewhat blockier and noisier than on slides 13 and 22: a dark long-sleeved top; a dark, roughly square blob with no logo or handle; a grey T-shirt; a pale long-sleeved top with dark streaks down the sides; and a faint, fragmented high-heeled shoe with speckled noise above it. The PDF embeds different reconstruction images here from those on slides 13 and 22.

*Caption:* Original images (top) and their reconstructions (bottom)

---

## Slide 26 — Summary

- Understand that autoencoders can be trained and used as an way to efficiently represent data (analogous to PCA).
- Understand the two main parts in an autoencoder: the ***encoder*** and the ***decoder***.
- Know how to implement an *undercomplete* linear autoencoder in TensorFlow to perform PCA on the input data.
- Understand stacked autoencoders and know how to implement one using TensorFlow.
- Understand the concept of tying the weights in a stacked autoencoder and know how to visualize the reconstruction.
- Understand how to use stacked autoencoders in unsupervised pre-training tasks.

---

## Slide 27 — For the next two topics...

Read up to Chapter 17 on **Autoencoders, GANs, and Diffusion Models** (from page 647 to page 667; excluding the *Sparse Autoencoders* section)

And that's all for this lecture.

Have a good week.

---

## Quirks

Things on the slides that look wrong, inconsistent or ambiguous. They are recorded here and **not** fixed in the transcript above.

- **Slide 1:** The title is in sentence case with one capital ("Representation learning and dimension reduction using Autoencoders"). It also says "dimension reduction", while the body says "dimensionality reduction" (slides 4, 14, 16).
- **Slide 2:** "Chapters 17." uses a plural for a single chapter. The slide text writes "Hands-on" (lowercase "on"), while the cover reads "Hands-On".
- **Slide 3:** The chapter title includes GANs, but GANs are neither covered in this deck nor excluded; only diffusion models are explicitly excluded.
- **Slide 3 vs slide 26:** The topic "Training one autoencoder at a time" (slides 23–25) has no matching outcome in the Summary. Every other topic maps to at least one Summary bullet.
- **Slide 4:** "called latent representations codings" seems to be missing a word between "representations" and "codings" (perhaps "or"). The whole phrase is one dark-red italic run.
- **Slide 4 vs slides 16–17:** "pre-training" (slides 3, 4, 26) and "pretraining" (slides 16–17 titles and text) are both used.
- **Slide 5:** "we can train an autoencoder to convert … and then spits out something that (hopefully) look very close to the inputs". Both verbs disagree: "spits" should be "spit" (it follows "to convert") and "look" should be "looks". The sequence count is consistent: 50 down to 14 in steps of 2 is 19 numbers, and 19 are listed.
- **Slide 7:** "…a copy of its inputs. i.e., it is forced…" starts a sentence with lowercase "i.e.". Figure 17-1 is repeated from slide 6 (same embedded image).
- **Slide 8:** The Notes write "(i) the" in lowercase but "(ii) The" and "(iii) To" capitalised. The encoder and decoder are built with `tf.keras.models.Sequential`, the autoencoder with `tf.keras.Sequential`. Both names work; they are just inconsistent.
- **Slide 9:** The slide says "Now let's generate the same 3D data used in Chapter 8", but the data is elided (`X_train = [...]`). No generation code and no plotting code are shown. The two plots have no figure number. The caption does not say what $z_1$/$z_2$ are. Its last sentence "(compare the blue markers in the two diagrams)" starts lowercase and has no full stop.
- **Figure numbering:** Figure 17-1 (slides 6–7) is followed by 17-3 (slide 11); there is no Figure 17-2 in the deck. The plots on slide 9, the diagram on slide 19 and the image grids on slides 22 and 25 are unnumbered.
- **Slide 11:** "with regards to" is non-standard ("with regard to"). The example says "an autoencoder for MNIST", while the code on slide 12 is for Fashion MNIST. Both are 28 × 28 = 784 inputs, so the numbers agree.
- **Slide 12:** The number is typeset "163, 814", with a space after the comma (LaTeX maths comma). The count checks out: 78,500 + 3,030 + 3,100 + 79,184 = 163,814. `X_train` and `X_valid` are used here and on slides 14, 21, 24 and 25 but never defined or loaded on any slide. The encoder list has a trailing comma after the last `Dense` (valid Python). `shape=[28,28]` has no space; `Reshape([28, 28])` has one.
- **Slide 13:** No code is shown for producing Figure 17-4. `plot_reconstructions` first appears on slide 25.
- **Slide 14:** "datset's" is a typo for "dataset's". The heading and body write "T-SNE" (capital T), while the footnote writes "t-distributed stochastic neighbour embedding" and Figure 17-5's caption writes "t-SNE". "to see how well the lower-dimensional data is for the downstream classification task" is garbled (a word such as "suited" seems to be missing). "neighbour" is British spelling while "Visualizing" is American. The code computes `X_valid_2D`, but no plotting code for Figure 17-5 is shown.
- **Slide 15:** Figure 17-5 has no legend. The colour-to-class mapping is never stated, and only the 24 thumbnails hint at it.
- **Slide 16:** "it can cope with fewer labelled training data" should use "less" with the mass noun "data". "firstly train" is unusual phrasing.
- **Slide 17:** Figure 17-6's caption ends with a full stop, unlike the other numbered captions. The figure says "labeled" (American) while the slide text says "labelled".
- **Slide 19:** pdftotext garbles this slide's maths: it drops ℓ, ⊤ and the subscripts, giving "WN-+1 = W". The image shows $\mathbf{W}_{N-\ell+1} = \mathbf{W}_{\ell}^{\top}$ with $\ell = 1, 2, \cdots, N/2$. This agrees with the diagram: for $N = 4$, $\mathbf{W}_4 = \mathbf{W}_1^{\top}$ and $\mathbf{W}_3 = \mathbf{W}_2^{\top}$. The diagram labels the decoder weights directly as $\mathbf{W}_2^{\top}$ and $\mathbf{W}_1^{\top}$, never as $\mathbf{W}_3$ and $\mathbf{W}_4$.
- **Slide 20:** The note says the modification is on "line # ***". The marker is on the line `shape=[self.dense.input.shape[-1]],` inside `build`. The slide does not show what Géron's original line was. The text layer writes "Géron" as "G�eron" and loses the class's indentation; the image shows the indentation transcribed above.
- **Slide 21:** It claims `tied_ae` "also achieves a slightly lower reconstruction error than `stacked_ae`", but no error values are shown on either slide. The models were also fit for different numbers of epochs: `stacked_ae.fit(..., epochs=20, ...)` on slide 12 and `tied_ae.fit(..., epochs=10, ...)` on slide 21. "82, 414" has the same comma spacing as "163, 814". The count checks out: 78,500 + 3,030 + 100 + 784 = 82,414.
- **Slide 22:** The heading "Reconstruction from the tied_ae model" sets `tied_ae` in bold sans-serif rather than typewriter, and the text layer reads it as "tied ae". No code for producing the grid is shown. The originals are identical to slide 13's, but the reconstruction images are different embedded images.
- **Slide 24:** The second call passes `output_activation="relu"`; the first call uses the default `output_activation=None`. The function's parameters `X_train`/`X_valid` shadow the global names of the same spelling.
- **Slide 25:** `plot_reconstructions` is called but never defined on any slide (the comment points to "the author's Jupyter notebook file"). `plt` is used but `import matplotlib.pyplot as plt` does not appear anywhere in this deck. The comment says "for a few epochs" and the call uses `epochs=5`.
- **Slide 26:** "used as an way" should be "a way".
- **Slide 27:** "Read up to Chapter 17 … (from page 647 to page 667 …)" combines "up to" with a page range. The page numbers cannot be verified from the deck. The excluded "Sparse Autoencoders section" is never mentioned elsewhere in the deck. The title ends with "...".
