# CITS5017 Deep Learning

Topics 6&7: Convolutional AEs, Denoising AEs, Variational AEs, GANs, and DCGANs — Associate Professor Du Huynh (Unit Coordinator and Lecturer) — Semester 2, 2026

*Transcription conventions (slides 1–32): key terms that are dark red on the slides are written in **bold** (dark-red italic → ***bold italic***); where dark-red text is also bold-weight on the slide, a note says so; black italic stays *italic*; black bold text is flagged in a note where it occurs. Maths that is typeset in blue on the slides is written as plain LaTeX; bold maths symbols are written with `\boldsymbol`. Bold blue sub-headings directly under a slide title are written as `###` headings. Inline code that is dark-red typewriter on the slides is written as `code` (so is the blue typewriter URL on slide 25). Underlined text is written as <u>…</u>. The script L on slides 12–13 is the RSFS script letter, written `\mathscr{L}`. Curly quotation marks and apostrophes are written as straight ones. The multiplication sign in code comments (slide 5) is written ×, as it is printed. Code is transcribed with the exact column positions of the slides' monospaced text. Slide-number footers ("N / 32") are not recorded.*

---

## Slide 1 — CITS5017 Deep Learning / Topics 6&7: Convolutional AEs, Denoising AEs, Variational AEs, GANs, and DCGANs

Associate Professor Du Huynh
(Unit Coordinator and Lecturer)

Semester 2, 2026

> **Figure (slide 1).** Title banner: white text on a dark-blue rectangle, three centred lines: "CITS5017 Deep Learning", "Topics 6&7: Convolutional AEs, Denoising AEs,", "Variational AEs, GANs, and DCGANs". Below the lecturer/date lines is the UWA crest: a shield whose upper band is blue with a gold top edge and holds two open books, each showing two pages of text — the left book reads "VIT AM" / "EXC OLU", the right book reads "ERE PER" / "AR TES" (i.e. *Vitam excolere per artes*). Below the books, a gold field rises to a point in the centre of the blue shield; on it sits a black swan with a white wing. Beneath the shield is a blue ribbon with white text "SEEK WISDOM". Below the crest is the blue wordmark "THE UNIVERSITY OF / WESTERN / AUSTRALIA". (No slide number is shown on this slide.)

---

## Slide 2 — Today

Chapters 17.

### Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow

> **Figure (slide 2).** Small book-cover image, O'REILLY. Top-left: red "O'REILLY" logo. Top-right corner: a diagonal grey banner reading "Third Edition". Title in black: "Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow". Subtitle in orange: "Concepts, Tools, and Techniques to Build Intelligent Systems". Below it, small "powered by" text with a Jupyter logo. Cover illustration: a black salamander with bright yellow-orange spots and stripes, crawling diagonally across the lower half. Author name at bottom right: "Aurélien Géron".

---

## Slide 3 — Chapter Seventeen

### Autoencoders, GANs, and Diffusion Models

Here are the main topics we will briefly cover:

- Convolutional autoencoders
- Denoising autoencoders
- Variational autoencoders
- Generative Adversarial Networks
- Deep convolutional generative adversarial networks (DCGANs)

(The sub-heading is large black text, not blue.)

---

## Slide 4 — Convolutional Autoencoders

If you are dealing with images, then the autoencoders we have seen so far will not work well. So if you want to build an **autoencoder for images** (e.g., for ***unsupervised pretraining*** or ***dimensionality reduction***), you will need to build a ***convolutional autoencoder***.

The ***encoder*** of a convolutional autoencoder is just a regular CNN composed of convolutional layers and pooling layers. It typically reduces the spatial dimensionality of the inputs (i.e., height and width) while increasing the depth (i.e., number of channels).

The ***decoder*** must do the reverse operation (upscale the image and reduce its depth back to the original dimensions), and for this you can use ***transpose convolutional layers*** (alternatively, you could combine upsampling layers with convolutional layers).

("autoencoder for images" is dark red but upright, not italic; it wraps across a line break after "autoencoder". There are no bullets on this slide.)

---

## Slide 5 — Convolutional Autoencoders (cont.)

Here is a simple convolutional autoencoder for Fashion MNIST:

```python
conv_encoder = tf.keras.Sequential([
    tf.keras.layers.Reshape([28, 28, 1]),
    tf.keras.layers.Conv2D(16, 3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),  # output: 14 × 14 × 16
    tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),  # output: 7 × 7 × 32
    tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),  # output: 3 × 3 × 64
    tf.keras.layers.Conv2D(30, 3, padding="same", activation="relu"),  # output: 3 × 3 × 30
    tf.keras.layers.GlobalAvgPool2D()  # output: 30
])
conv_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(3 * 3 * 16),     # 144 neurons
    tf.keras.layers.Reshape((3, 3, 16)),   # output: 3 × 3 × 16
    tf.keras.layers.Conv2DTranspose(32, 3, strides=2, activation="relu"), # output: 7 × 7 × 32
    tf.keras.layers.Conv2DTranspose(16, 3, strides=2, padding="same",
                                    activation="relu"),                 # output: 14 × 14 × 16
    tf.keras.layers.Conv2DTranspose(1, 3, strides=2, padding="same"),   # output: 28 × 28 × 1
    tf.keras.layers.Reshape([28, 28])
])
conv_ae = tf.keras.Sequential([conv_encoder, conv_decoder])

# compile and fit the model
conv_ae.compile(loss="mse", optimizer="nadam")
history = conv_ae.fit(X_train, X_train, epochs=10,
                      validation_data=(X_valid, X_valid))
```

(The whole code box is in a small font. The × in the shape comments is a true multiplication sign, not the letter x.)

---

## Slide 6 — Convolutional Autoencoders (cont.)

Inspect the `conv_decoder` model:

```text
>>> conv_decoder.summary()
Model: "sequential_12"
_________________________________________________________________
 Layer (type)                Output Shape              Param #
=================================================================
 dense_12 (Dense)            (None, 144)               4464

 reshape_4 (Reshape)         (None, 3, 3, 16)          0

 conv2d_transpose (Conv2DTra  (None, 7, 7, 32)         4640
 nspose)

 conv2d_transpose_1 (Conv2DT  (None, 14, 14, 16)       4624
 ranspose)

 conv2d_transpose_2 (Conv2DT  (None, 28, 28, 1)        145
 ranspose)

 reshape_5 (Reshape)         (None, 28, 28)            0

=================================================================
Total params: 13,873
Trainable params: 13,873
Non-trainable params: 0

>>> conv_ae.count_params()   # output the total number of parameters (trainable + non-trainable)
54479
```

*[Keras's "Layer (type)" column is a fixed width, so the three `Conv2DTranspose` layer types are cut off and wrapped onto a second line exactly as shown: "(Conv2DTra" / "nspose)" and "(Conv2DT" / "ranspose)" (each reads "Conv2DTranspose" when joined). On those three wrapped rows, the "Output Shape" value starts one column further right than on the other rows; this is reproduced above. The dashed rule under the model name is 65 underscores; the two `=` rules are 65 characters each.]*

The same table, row by row:

| Layer (type) as printed | Output Shape | Param # |
|---|---|---|
| dense_12 (Dense) | (None, 144) | 4464 |
| reshape_4 (Reshape) | (None, 3, 3, 16) | 0 |
| conv2d_transpose (Conv2DTra / nspose) | (None, 7, 7, 32) | 4640 |
| conv2d_transpose_1 (Conv2DT / ranspose) | (None, 14, 14, 16) | 4624 |
| conv2d_transpose_2 (Conv2DT / ranspose) | (None, 28, 28, 1) | 145 |
| reshape_5 (Reshape) | (None, 28, 28) | 0 |

Totals as printed: Total params: 13,873 · Trainable params: 13,873 · Non-trainable params: 0. `conv_ae.count_params()` prints `54479`.

(The whole slide below the first line is one grey code box in a small font.)

---

## Slide 7 — Other Types of Autoencoders

So far we have seen various kinds of autoencoders:
- basic, stacked, and convolutional.

We have looked at how to train them :
- either in one shot or in several phases.

We have also looked at a couple of applications:
- **data visualization** and **unsupervised pretraining**

Up to now, in order to force the autoencoder to learn interesting features, we have limited the size of the coding layer, making it ***undercomplete***.

There are actually many other kinds of constraints that can be used, including ones that allow the coding layer to be just as large as the inputs, or even larger, resulting in an ***overcomplete autoencoder***.

Let's look at ***denoising autoencoders*** and ***variational autoencoders*** in the next few slides.

(The three sub-items are each marked with an en dash "–" on the slide, not a bullet, and sit directly under their lead-in lines with no blank line between. "data visualization" and "unsupervised pretraining" are dark red, upright.)

---

## Slide 8 — Denoising Autoencoders

#### Left — figure

> **Figure 17-8.** Two stacks of rounded boxes of equal width, each drawn **bottom-to-top** and joined by plain vertical black lines (no arrowheads between layers).
> - **Left stack (Gaussian noise):** "Input" (green) → a small white rounded square containing a bold "+" → "Hidden 1" (light blue) → "Hidden 2" (pink) → "Hidden 3" (light blue) → "Output" (green), with a black arrow pointing up out of the top of Output. To the right of the "+" square is a red box with white text "Gaussian noise"; a black arrow points **left** from "Gaussian noise" into the "+" square. So the noise is added to the input between the Input layer and Hidden 1.
> - **Right stack (dropout):** "Input" (green) → "Dropout" (red box, white text) → "Hidden 1" (light blue) → "Hidden 2" (pink) → "Hidden 3" (light blue) → "Output" (green), with a black arrow pointing up out of the top of Output. The Dropout box sits between the Input layer and Hidden 1, in the position of the "+" square on the left.

*Caption:* Figure 17-8. Denoising autoencoders, with Gaussian noise (left) or dropout (right)

#### Right — text

Another way to force the autoencoder to learn useful features is to add noise to its inputs, training it to recover the original, noise-free inputs. In a 2010 paper of Vincent et al.<sup>1</sup>, the authors introduced the ***stacked denoising autoencoders***. The noise can be pure Gaussian noise added to the inputs, or it can be randomly switched-off inputs, just like in ***dropout***.

**Footnotes:**

1. Pascal Vincent et al., "Stacked Denoising Autoencoders: Learning Useful Representations in a Deep Network with a Local Denoising Criterion," Journal of Machine Learning Research 11 (2010): 3371-3408.

---

## Slide 9 — Denoising Autoencoders (cont.)

### An Implementation Example

```python
dropout_encoder = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dropout(0.5),
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(30, activation="relu")
])
dropout_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(28 * 28),
    tf.keras.layers.Reshape([28, 28])
])
dropout_ae = tf.keras.Sequential([dropout_encoder, dropout_decoder])

# compile and fit the model
dropout_ae.compile(loss="mse", optimizer="nadam")
history = dropout_ae.fit(X_train, X_train, epochs=10,
                         validation_data=(X_valid, X_valid))
```

> **Figure 17-9.** Ten small greyscale Fashion-MNIST-style images in **2 rows × 5 columns** (the PDF embeds them as ten separate images). Per the caption, the **top row is the noisy inputs** (roughly half of each item's pixels are switched off to white, giving a broken, speckled look) and the **bottom row is their reconstructions**; each column is one item. Left to right:
> 1. Noisy: a dark long-sleeved top, heavily speckled. Reconstruction: a smooth, blurry dark long-sleeved top.
> 2. Noisy: a dark, roughly square item, heavily speckled. Reconstruction: a blurry dark, roughly square blob with a darker band along the bottom.
> 3. Noisy: a dark T-shirt shape, speckled. Reconstruction: a grey short-sleeved T-shirt with a dark neckline.
> 4. Noisy: a very pale long-sleeved top made of scattered light pixels with a few dark ones. Reconstruction: a light-grey long-sleeved top with darker sleeve edges.
> 5. Noisy: sparse dark dots tracing a high-heeled sandal (toe at the lower left, heel at the right). Reconstruction: a dark high-heeled sandal with an ankle strap and a block heel on the right.

*Caption:* Figure 17-9. (top) Noisy images (with half the pixels turned off) and (bottom) their reconstructions by the dropout-based denoising autoencoder.

(The sub-heading is bold blue. The code box is in a small font. The figure has no plotting code on the slide.)

---

## Slide 10 — Variational Autoencoders

An important category of autoencoders was introduced in 2013 by Diederik Kingma and Max Welling<sup>2</sup> and quickly became one of the most popular variants: ***variational autoencoders*** (**VAEs**).

VAEs are quite different from all the previous autoencoders, in these particular ways:

- They are ***probabilistic autoencoders***, meaning that their outputs are partly determined by chance, even after training (as opposed to denoising autoencoders, which use randomness only during training).
- Most importantly, they are ***generative autoencoders***, meaning that they can generate new instances that look like they were sampled from the training set.

Training a VAE on a given dataset allows us to get a good approximation of the data distribution. Once we have that, we can sample from it to generate new data instances.

**Footnotes:**

2. Diederik Kingma and Max Welling, "Auto-Encoding Variational Bayes", arXiv preprint arXiv:1312.6114 (2013).

("VAEs" in the first paragraph is dark red, upright.)

---

## Slide 11 — Variational Autoencoders (cont.)

#### Left — figure

> **Figure 17-11.** Two panels side by side.
> *Left panel (a variational autoencoder):* rounded boxes drawn **bottom-to-top**. From the bottom: "Input" (green, wide) → "Hidden 1" (light blue) → "Hidden 2" (pink), joined by plain vertical lines. From the top of Hidden 2 two arrows go up into a **dashed rectangle**: one straight up into a pale-yellow box "Codings **μ**", and one diagonally up-right into a pale-yellow box "Codings **σ**" (μ and σ are bold in the labels). Inside the dashed rectangle: an arrow goes up from "Codings μ" into a small white rounded square containing a bold "+"; an arrow goes up from "Codings σ" into a small white rounded square containing a bold "×"; at the right is a dark-grey/black box with white text "Gaussian noise", with an arrow pointing **left** from it into the "×" square; an arrow points **left** from the "×" square into the "+" square. A plain line goes up from the "+" square, out of the dashed rectangle, to "Hidden 4" (pink) → "Hidden 5" (light blue) → "Output" (green, wide), with a black arrow pointing up out of the top of Output.
> **Hidden-layer labels as printed:** encoder side (below the dashed rectangle) = "Hidden 1", "Hidden 2"; decoder side (above the dashed rectangle) = "Hidden 4", "Hidden 5". There is **no box labelled "Hidden 3"** in the figure; the dashed sampling block sits where it would be.
> *Right panel (an instance going through it):* four shapes stacked vertically, joined by a thick black **dashed** path with arrowheads pointing **upward**.
> - Bottom, labelled "Input space" on its left: a mint-green, curled, hook-shaped blob containing blue dots (upper left), white dots (middle) and red dots (lower tail), all black-outlined. One white dot is highlighted with a thick black ring.
> - Above it, a pale-yellow circle (part of the coding space) with blue, white and red dots. Near its centre is a ringed white dot labelled "μ" on its left, surrounded by a translucent grey circle. A label "σ" below-right has a thin black arrow pointing up-left to the edge of the grey circle. The dashed path runs from the ringed dot in input space up to μ (arrowhead at μ).
> - Above that, a second pale-yellow circle with blue, white and red dots and a ringed white dot near its upper right. The label "Coding space" sits to the right, between the two circles. The dashed path runs from the top of the grey σ-circle (a small grey-outlined dot) up to this ringed dot (arrowhead).
> - Top: a mint-green hook-shaped blob like the input one (unlabelled; the output), with blue, white and red dots and one ringed white dot. The dashed path runs from the ringed dot in the upper circle up to it (arrowhead).

*Caption:* Figure 17-11. A variational autoencoder (left) and an instance going through it (right)

#### Right — text

In the diagram, the encoder and decoder have two hidden layers each; however, there is a twist. Instead of learning lower dimensional representations of the inputs to pass on to the decoder, the encoder learns a ***mean coding*** $\boldsymbol{\mu}$ and a ***standard deviation coding*** $\boldsymbol{\sigma}$ of these representations. The decoder then draws samples from this distribution to reconstruct the inputs.

This forces the variational autoencoder to learn the <u>best</u> $\boldsymbol{\mu}$ and $\boldsymbol{\sigma}$ that describes the distribution (assuming Gaussian) of the inputs.

($\boldsymbol{\mu}$ and $\boldsymbol{\sigma}$ are bold blue maths. "best" is underlined. The text column starts level with the top of the slide body, to the right of the figure.)

---

## Slide 12 — Variational Autoencoders (cont.)

- During training, the cost function (see later) pushes the codings to gradually migrate within the coding space (also called the ***latent space***) to end up looking like a cloud of Gaussian points.
- Drawing samples from this latent space thus allows the decoder to reconstruct the inputs (using the two hidden layers *Hidden 3* and *Hidden 4*.
- The ***variational autoencoder's latent loss*** is defined as:

$$
\mathscr{L} = -\frac{1}{2}\sum_{i=1}^{n}\left[1 + \log(\sigma_i^2) - \sigma_i^2 - \mu_i^2\right],
$$

  where $n$ is the codings' dimension; $\mu_i$ and $\sigma_i$ are, respectively, the $i^{\text{th}}$ components of $\boldsymbol{\mu}$ and $\boldsymbol{\sigma}$.
- A common tweak adopted in practice is to make the encoder output $\boldsymbol{\gamma}$ (defined as $\log(\boldsymbol{\sigma}^2)$) rather than $\boldsymbol{\sigma}$, so that the algorithm is more numerically stable and the training is faster. So, the ***variational autoencoder's latent loss*** becomes

$$
\mathscr{L} = -\frac{1}{2}\sum_{i=1}^{n}\left[1 + \gamma_i - \exp\left(\gamma_i\right) - \mu_i^2\right].
$$

(Both formulas are displayed, centred, in blue. The script $\mathscr{L}$ is the RSFS script letter. The square brackets are slightly taller than the text. In the second formula there is a small space between "exp" and its parenthesis, as `\left(` produces. In the first formula $\sigma_i^2$ and $\mu_i^2$ are plain (not bold) maths; in "where … components of $\boldsymbol{\mu}$ and $\boldsymbol{\sigma}$" and in the last bullet, $\boldsymbol{\mu}$, $\boldsymbol{\sigma}$, $\boldsymbol{\gamma}$ and the $\boldsymbol{\sigma}$ inside $\log(\boldsymbol{\sigma}^2)$ are bold. The "th" of $i^{\text{th}}$ is upright sans-serif. *Hidden 3* and *Hidden 4* are black italic. From "where $n$ is …" to the end of the slide the text is in a slightly smaller font. The second bullet's parenthesis is never closed.)

---

## Slide 13 — Variational Autoencoders (cont.)

### The Loss Function

So, the loss (or cost) function in a VAE consists of two parts:

- The first part is the usual ***reconstruction loss*** that pushes the autoencoder to reproduce its inputs.
- The second part is the ***latent loss*** that pushes the autoencoder to have codings that look as though they were sampled from a simple Gaussian distribution: it is the ***Kullback-Leibler divergence*** between the target distribution (i.e., the Gaussian distribution) and the actual distribution of the codings.
  This gives us the formula<sup>3</sup> for $\mathscr{L}$ shown on the previous slide.

We will see later on how we add the ***latent loss*** to the total loss function.

**Footnotes:**

3. For more mathematical details, check out the original paper on *variational autoencoders*, or Carl Doersch's "Tutorial on Variational Autoencoders", arXiv:1606.05908, 2016 (2016).

(The sub-heading is bold blue. "This gives us the formula …" starts on a new line inside the second bullet. In the footnote, "variational autoencoders" is black italic.)

---

## Slide 14 — Variational Autoencoders (cont.)

### Implementation in Keras

**Note:** there are quite a few changes to Géron's code below. Check those lines that have "`# ***`"

```python
# define a customized layer
class Sampling(tf.keras.Layer):
    def call(self, inputs):
        mean, logvar = inputs
        # sum the losses over all the features
        loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)
        # average over instances in the minibatch. 784=28*28 is the output image dimension.
        # *** add the latent loss here ***
        self.add_loss(tf.reduce_mean(loss) / 784.)                             # ***
        return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean

# the encoder part of the VAE
inputs = tf.keras.Input(shape=[28, 28])
Z = tf.keras.layers.Flatten()(inputs)
Z = tf.keras.layers.Dense(150, activation="relu")(Z)
Z = tf.keras.layers.Dense(100, activation="relu")(Z)
codings_mean = tf.keras.layers.Dense(codings_size)(Z)     # mu
codings_log_var = tf.keras.layers.Dense(codings_size)(Z)  # gamma
codings = Sampling()([codings_mean, codings_log_var])
variational_encoder = tf.keras.Model(
    inputs=inputs, outputs=[codings_mean, codings_log_var, codings])           # ***

# the decoder part of the VAE
decoder_inputs = tf.keras.Input(shape=[codings_size])
x = tf.keras.layers.Dense(100, activation="relu")(decoder_inputs)
x = tf.keras.layers.Dense(150, activation="relu")(x)
x = tf.keras.layers.Dense(28 * 28)(x)
outputs = tf.keras.layers.Reshape([28, 28])(x)
variational_decoder = tf.keras.Model(inputs=decoder_inputs, outputs=outputs)   # ***
```

(The sub-heading is bold blue. "Note:" is black bold; the note is in a small font with `# ***` in typewriter inside curly quotes, and has no closing full stop. The code is in a small font. The three `# ***` end-of-line markers are aligned in the same column, on the `self.add_loss(...)` line, the `inputs=inputs, outputs=[...])` line and the `variational_decoder = ...` line; the comment line `# *** add the latent loss here ***` is a fourth marked line. The code box runs to the bottom edge of the slide, and its last line sits level with the "14 / 32" footer.)

---

## Slide 15 — Variational Autoencoders (cont.)

### Implementation in Keras

```python
# now join the encoder and decoder together to form our VAE
_, _, codings = variational_encoder(inputs)
reconstructions = variational_decoder(codings)
variational_ae = tf.keras.Model(inputs=inputs, outputs=reconstructions)

# compile and train our VAE to minimize the total loss (latent loss + reconstruction loss)
variational_ae.compile(loss="mse", optimizer="nadam")
history = variational_ae.fit(X_train, X_train, epochs=25, batch_size=128,
                             validation_data=(X_valid, X_valid))
```

**Exercise:** Run `variational_encoder.summary()` and `variational_decoder.summary()` and inspect the layers in them.

(The sub-heading is bold blue. "Exercise:" is black bold. The rest of the slide is empty.)

---

## Slide 16 — Variational Autoencoders (cont.)

### Implementation in Keras

```python
# after training, we can generate Fashion MNIST images
codings = tf.random.normal(shape=[3 * 7, codings_size])
images = variational_decoder(codings).numpy()  # shape is (21,28,28)
```

> **Figure 17-12.** **21** small, blurry greyscale images in a grid of **3 rows × 7 columns** (embedded as 21 separate images), each a light-grey square with a darker item. No labels. Left to right:
> - Row 1: dark trousers; a wider, blurry long garment (trousers-like); an ankle boot, toe pointing left; a lower ankle boot, toe left; faint light-grey trousers; dark narrow trousers; a smeared, blurry boot/shoe.
> - Row 2: a dark, blurry long garment (dress- or coat-like); an ankle boot, toe left; thin dark trousers; an ankle boot, toe left; very thin, faint trousers with ghosting around them; a dark, wide rectangular blob (bag-like); a dark, blurry top (pullover-like blob).
> - Row 3: a grey short-sleeved T-shirt; a dark long-sleeved pullover; a blurry long-sleeved top that fades out at the bottom; faint trousers overlaid with ghostly shapes; a dark low sneaker, toe left; a smeared shoe with horizontal streaks; a grey long-sleeved top/coat.

*Caption:* Figure 17-12. Fashion MNIST images generated by the variational autoencoder

The majority of these images look fairly convincing, if a bit too fuzzy. The rest are not great, but the codings are only $10$-dimensional and the VAE was trained only for $25$ epochs.

(The sub-heading is bold blue. $10$ and $25$ are blue maths.)

---

## Slide 17 — Variational Autoencoders (cont.)

### Semantic Interpolation Using VAEs

Variational autoencoders make it possible to perform ***semantic interpolation***: instead of interpolating two images at the pixel level (which would look as if the two images were overlaid), we can interpolate at the codings level as follows:

1. run both images through the encoder to get their codings,
2. interpolate the two codings,
3. decode the interpolated codings to get the final image.

We can also replace step 1 by directly drawing random samples from the normal distribution to get the two codings.

(The sub-heading is bold blue. The list numbers are white digits in small blue squares.)

---

## Slide 18 — Variational Autoencoders (cont.)

### Semantic Interpolation Using VAEs

For example, let's interpolate 2 codings in the latent space and decode them. We get a sequence of images that gradually go from `T-shirt` to `Sneaker`:

```python
tf.random.set_seed(123)

# generate 2 codings from the normal distribution
codings = tf.random.normal(shape=[2, codings_size])

# linearly interpolate 10 elements from the 2 codings
inter_codings = np.linspace(codings[0], codings[1], 10)

# decode the 10 codings
images = variational_decoder(inter_codings).numpy()

plot_multiple_images(images, n_cols=10)         # see code for chapter 17
```

> **Figure (slide 18, unnumbered).** One row of **10** small greyscale images (embedded as 10 separate images), left to right: images 1–4 are dark short-sleeved T-shirts, almost identical; image 5 is a T-shirt that is a little lighter with a darker vertical band down the centre; image 6 is a lighter, ghostly T-shirt with a darker vertical stripe; image 7 is a transition blend — a faint sneaker shape overlaid on a vertical ghost of the T-shirt, with streaky noise; images 8–10 are dark low sneakers, toe pointing left, becoming slightly cleaner towards the right.

*Caption:* Semantic interpolation.

(The sub-heading is bold blue. `T-shirt` and `Sneaker` are dark-red typewriter. The "2" in "interpolate 2 codings" is plain text.)

---

## Slide 19 — Generative Adversarial Networks

***Generative adversarial networks*** (**GAN**) were proposed in 2014 by Ian Goodfellow et al.<sup>4</sup>. Although the idea got researchers excited almost instantly, it took a few years to overcome some of the difficulties of training GANs.

#### Left — text

Like many great ideas, it seems simple in hindsight: make neural networks compete against each other in the hope that this competition will push them to excel.

As shown in Figure 17-14, a GAN is composed of two neural networks:
- a ***generator***; and
- a ***discriminator***.

#### Right — figure

> **Figure 17-14.** A diagram drawn **bottom-to-top**:
> - Bottom: a grey box with white text "Noise", joined by a plain vertical line up to a light-blue box with bold dark text "Generator". A curly brace to the right of Generator is labelled "Goal= trick the discriminator".
> - A black arrow points **up** from Generator to a blurry greyscale image of a long-sleeved top, labelled "Fake" above it. To its right is a sharper greyscale image of a short-sleeved T-shirt, labelled "Real" above it.
> - Above each label is a small black dot. A black arrow runs diagonally up-right from the "Fake" dot and another diagonally up-left from the "Real" dot; the two arrowheads meet at a single black dot just below the Discriminator, with the word "Or" between the two arrows. A short line joins that dot to the box above.
> - A red box with bold white text "Discriminator". A curly brace to its right is labelled "Goal= tell fake from real". A black arrow points **up** out of the Discriminator to the label "Fake/real".

*Caption:* Figure 17-14. A generative adversarial network.

**Footnotes:**

4. Ian Goodfellow et al., "Generative Adversarial Nets," Int. Conf. on Neural Information Processing Systems (2014): 2672-2680.

("GAN" in the first sentence is dark red, upright. The first paragraph runs full width; the next two paragraphs sit in a left column beside the figure. The two sub-items are marked with an en dash "–" on the slide, not bullets. The caption wraps after "adversarial".)

---

## Slide 20 — Generative Adversarial Networks (cont.)

A GAN is composed of **two neural networks**:

- **Generator**. It takes a random distribution (typically, a Gaussian) as input and outputs some data (typically, an image). You can think of the random inputs as the ***latent representations*** (i.e., ***codings***) of the image to be generated. So, the generator offers the same functionality as a decoder in a VAE, and it can be used in the same way to generate new images (just feed it some Gaussian noise, and it outputs a new image.
- **Discriminator**. It takes either a fake image from the generator or a real image from the training set as input, and must guess whether the input image is fake or real.

("two neural networks", "Generator" and "Discriminator" are dark red **and** bold-weight; the full stops after "Generator" and "Discriminator" are plain black. The parenthesis opened before "just feed it" is never closed.)

---

## Slide 21 — Generative Adversarial Networks (cont.)

During training, the generator and the discriminator have opposite goals: the discriminator tries to distinguish fake images from real images, while the generator tries to produce images that look real enough to trick the discriminator.

Because the GAN is composed of two networks with different objectives, it cannot be trained like a regular neural network. Each training iteration is divided into **two phases**:

- **Phase 1**: **Training the discriminator**. A batch of real images is sampled from the training set and is completed with an equal number of fake images produced by the generator. The labels are set to $0$ for fake images and $1$ for real images. The discriminator is trained on this labelled batch for one step, using the ***binary cross-entropy loss***. Importantly, backpropagation only optimizes the weights of the discriminator during this phase.

("two phases" and "Training the discriminator" are dark red and bold-weight. "Phase 1" is black bold; the colon after it is plain. $0$ and $1$ are blue maths. The first two paragraphs follow each other on consecutive lines without extra spacing.)

---

## Slide 22 — Generative Adversarial Networks (cont.)

- **Phase 2**: **Training the generator**. We first use the generator to produce another batch of fake images, and once again the discriminator is used to tell whether the images are fake or real. This time we do not add real images in the batch, and all the labels are set to $1$ (real); in other words, we want the generator to produce images that the discriminator will (wrongly) believe to be real! Crucially, the weights of the discriminator are frozen during this step, so backpropagation only affects the weights of the generator.

("Phase 2" is black bold; "Training the generator" is dark red and bold-weight. $1$ is blue maths. The rest of the slide is empty.)

---

## Slide 23 — Generative Adversarial Networks (cont.)

We will build a GAN model on the Fashion MNIST dataset. The generator is similar to an autoencoder's decoder, and the discriminator is a regular binary classifier.

### Implementing a GAN using Keras

- Construct the network

```python
codings_size = 30
from tensorflow.keras.layers import Dense
generator = tf.keras.Sequential([
    Dense(100, activation="relu", kernel_initializer="he_normal"),
    Dense(150, activation="relu", kernel_initializer="he_normal"),
    Dense(28 * 28, activation="sigmoid"),
    tf.keras.layers.Reshape([28, 28])
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    Dense(150, activation="relu", kernel_initializer="he_normal"),
    Dense(100, activation="relu", kernel_initializer="he_normal"),
    Dense(1, activation="sigmoid")
])
gan = tf.keras.Sequential([generator, discriminator])
```

(The sub-heading is bold blue. The bullet is a round dot "•", unlike the square bullets elsewhere. This code box is in a larger font than most other code on the slides.)

---

## Slide 24 — Generative Adversarial Networks (cont.)

### Implementing a GAN using Keras

- Compile the network

```python
discriminator.compile(loss="binary_crossentropy", optimizer="rmsprop")
gan.compile(loss="binary_crossentropy", optimizer="rmsprop")
```

- Create a `tf.data.Dataset` to iterate through the images:

```python
batch_size = 32
dataset = tf.data.Dataset.from_tensor_slices(X_train).shuffle(1000)
dataset = dataset.batch(batch_size, drop_remainder=True).prefetch(1)
```

Since the training loop is unusual, we cannot use the regular `fit()` method. Instead, we will write a custom training loop. **Note that there are two training phases in each iteration in the code on the next slide.**

(The sub-heading is bold blue. Bullets are round dots "•". The last sentence, "Note that … next slide.", is dark red and bold-weight throughout.)

---

## Slide 25 — Generative Adversarial Networks (cont.)

### Implementing a GAN using Keras

- Write our own training loop

```python
def train_gan(gan, dataset, batch_size, codings_size, n_epochs):
    generator, discriminator = gan.layers
    for epoch in tf.range(n_epochs):
        epoch = tf.cast(epoch, tf.int64)
        tf.print(f"Epoch {epoch + 1}/{n_epochs}")  # extra code
        for X_batch in dataset:
            ### phase 1 - training the discriminator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            generated_images = generator(noise)
            X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)
            y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)
            discriminator.trainable = True  # *** this line is missing in the author's code
            discriminator.train_on_batch(X_fake_and_real, y1)
            ### phase 2 - training the generator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            y2 = tf.constant([[1.]] * batch_size)
            # discriminator now needs to be non-trainable so that training gan
            # will result in training the generator only.
            discriminator.trainable = False  # *** this line is missing in the author's code
            gan.train_on_batch(noise, y2)
        # extra code - plot images during training (omit to save time)
train_gan(gan, dataset, batch_size, codings_size, n_epochs=50)
```

**Note:** `train_on_batch` is a method in the `tf.keras.Model` class. It runs a single gradient update on a single batch of data. (For more details, see `https://www.tensorflow.org/api_docs/python/tf/keras/Model#train_on_batch`)

*[The typewriter font draws the apostrophe in both `author's` comments as a curly quote. The URL is blue typewriter and wraps after "https:" onto the next line. The note ends with ")" and no full stop.]*

(The sub-heading is bold blue; the bullet is a round dot "•". The code is in a small font. "Note:" is black bold; `train_on_batch` and `tf.keras.Model` are dark-red typewriter. There is no blank line between the `# extra code - plot images …` comment and the final `train_gan(...)` call.)

---

## Slide 26 — Generative Adversarial Networks (cont.)

### Visualising some generated images

At the end of the first epoch, the generated images already start to look like (very noisy) Fashion MNIST images.

> **Figure 17-15.** **32** small greyscale images in a grid of **4 rows × 8 columns**, all heavily speckled with isolated black and white pixels. No labels. Most items are tops — T-shirts, long-sleeved tops and pullovers in dark, mid-grey and pale tones. Also visible: trousers (row 2 col 5, row 3 col 5, row 4 col 2, row 4 col 8 — the last thin and grey), dress-like shapes (row 2 col 2, row 3 col 8), a dark bag-like shape with a white opening/handle at the top (row 1 col 1), a wide, flat, noisy rectangle (row 1 col 8) and a roundish noisy blob (row 3 col 1). No footwear is clearly visible.

*Caption:* Figure 17-15. Images generated by the GAN after one epoch of training

Unfortunately, the images never really get much better than that, and you may even find epochs where the GAN seems to be forgetting what it learned. Why is that? Well, it turns out that training a GAN can be challenging.

(The sub-heading is bold blue.)

---

## Slide 27 — Generative Adversarial Networks (cont.)

### The Difficulties of Training GANs

- As training advances, the game may end up in a state that game theorists call a ***Nash equilibrium*** – when no player would be better off changing their own strategy, assuming the other players do not change theirs. The authors of the paper demonstrated that a GAN can only reach a single Nash equilibrium; however, nothing guarantees that the equilibrium will ever be reached.
- The biggest difficulty is called ***mode collapse***: this is when the generator's outputs gradually become less diverse, only producing images in a specific class.
- Moreover, because the generator and the discriminator are constantly pushing against each other, their parameters may end up oscillating and becoming unstable.

In short, this is still a very active field of research, and the dynamics of GANs are still not perfectly understood. The good news is that great progress has been made, and some of the results are truly astounding!

(The sub-heading is bold blue. The dash after "Nash equilibrium" is an en dash "–". Only the first "Nash equilibrium" is dark red.)

---

## Slide 28 — Deep Convolutional GANs

In the architecture of ***Deep Convolutional GANs***<sup>5</sup> (**DCGANs**), the authors proposed the following guidelines for building stable convolutional GANs:

- Replace any pooling layers with strided convolutions (in the discriminator) and transposed convolutions (in the generator).
- Use Batch Normalization in both the generator and the discriminator, except in the generator's output layer and the discriminator's input layer.
- Remove fully connected hidden layers for deeper architectures.
- Use ReLU activation in the generator for all layers except the output layer, which should use tanh.
- Use leaky ReLU activation in the discriminator for all layers.

These guidelines will work in many cases, but not always.

**Footnotes:**

5. Alec Radford et al., "Unsupervised Representation Learning with Deep Convolutional Generative Adversarial Networks," arXiv:1511.06434 (2015).

("DCGANs" is dark red, upright. The bullets have no extra spacing between them.)

---

## Slide 29 — Deep Convolutional GANs

### Implementing a DCGAN using Keras

```python
codings_size = 100

generator = tf.keras.Sequential([
    tf.keras.layers.Dense(7 * 7 * 128),
    tf.keras.layers.Reshape([7, 7, 128]),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2,
                                    padding="same", activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2,
                                    padding="same", activation="tanh"),
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.Conv2D(64, kernel_size=5, strides=2, padding="same",
                        activation=tf.keras.layers.LeakyReLU(0.2)),
    tf.keras.layers.Dropout(0.4),
    tf.keras.layers.Conv2D(128, kernel_size=5, strides=2, padding="same",
                        activation=tf.keras.layers.LeakyReLU(0.2)),
    tf.keras.layers.Dropout(0.4),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(1, activation="sigmoid")
])
gan = tf.keras.Sequential([generator, discriminator])

# compilation and training are similar to the code for GANs
```

(The sub-heading is bold blue. The code is in a small font. The slide title has no "(cont.)".)

---

## Slide 30 — Deep Convolutional GANs

### Visualising some generated images

> **Figure 17-16.** **32** small greyscale images in a grid of **4 rows × 8 columns**. Compared with Figure 17-15 they are sharper and higher-contrast, with clear outlines and little speckle, though many have blotchy artefacts. No labels. Left to right:
> - Row 1: a sneaker/athletic shoe, toe left, light with dark details; a dark top with light horizontal stripes; a dark low shoe, toe left; a T-shirt with a light vertical band down the centre; a pale long-sleeved shirt with dark marks; a grey dress/top; a dark jacket; a dark top/dress.
> - Row 2: a patterned item (unclear, top- or bag-like); a dark long-sleeved dress; a dark horizontal rectangle (bag-like); a dark long-sleeved top with lighter patches; a dark rectangle (bag-like); a dark long-sleeved top; a dark, wide pullover/bag shape; a grey T-shirt.
> - Row 3: a dark T-shirt; a dark sleeveless dress; a grey horizontal rectangle (bag-like); a dark top with a collar; a dark long-sleeved pullover; a dark top with a white print; a dark long-sleeved top with patterns; a dark T-shirt with a white printed band across the chest.
> - Row 4: a handbag with a handle, light with dark details; a dark long-sleeved coat; a narrow, dark vertical item; a grey long-sleeved collared shirt; a dark rectangular bag; a grey long-sleeved top/dress; a patterned pullover; a dark long-sleeved pullover.

*Caption:* Figure 17-16. Images generated by the DCGAN after 50 epochs of training

The images generated after $50$ epochs of training still do not look perfect; however, if the architecture is scaled up and trained on a large dataset of faces, one can generate fairly realistic face images.

(The sub-heading is bold blue. $50$ in the body text is blue maths; the "50" in the caption is plain. The slide title has no "(cont.)".)

---

## Slide 31 — Summary

- Understand convolutional autoencoders
- Understand denoising autoencoders
- Understand variational autoencoders
- Understand generative adversarial networks
- Understand deep convolutional generative adversarial networks

---

## Slide 32 — For the next topic...

Read up to Chapter 16 on **Natural Language Processing with RNNs and Attention** (roughly from pages 595 to 629).

And that's all for this lecture.

Have a good week.

("Natural Language Processing with RNNs and Attention" is dark red, upright.)

---

## Quirks

Things on the slides that look wrong, inconsistent or ambiguous. They are recorded here and **not** fixed in the transcript above.

- **Slide 1:** The title writes "Topics 6&7" with no spaces around "&".
- **Slide 2:** "Chapters 17." uses a plural for a single chapter. The slide text writes "Hands-on" (lowercase "on"), while the cover reads "Hands-On".
- **Slide 3:** The chapter title includes "Diffusion Models", but they are neither covered in this deck nor said to be excluded. The topic list capitalises "Generative Adversarial Networks" but not "Deep convolutional generative adversarial networks".
- **Slide 3 vs slide 31:** The five topics map one-to-one onto the five Summary bullets. Semantic interpolation (slides 17–18) is not mentioned in either.
- **Slide 4 vs slide 28:** Slide 4 says "transpose convolutional layers"; slide 28 says "transposed convolutions". Only part of "autoencoder for images" is styled as a term, and it is dark red but upright, unlike the italic terms around it.
- **Slide 5:** The shape comments check out arithmetically. In the encoder, 28 → 14 → 7 → 3 (each `MaxPool2D(pool_size=2)` halves and rounds down 7/2 to 3). `Conv2D(30, …)` keeps 3 × 3 and gives 30 channels, and `GlobalAvgPool2D` gives 30. In the decoder, 3 × 3 × 16 = 144. The unpadded `Conv2DTranspose(32, 3, strides=2)` gives (3 − 1)·2 + 3 = 7, and the two `padding="same"` stride-2 layers give 14 and 28. The `Conv2D` lines before each pooling layer have no shape comment. The decoder's first `Reshape` takes a tuple `((3, 3, 16))`, while the other `Reshape` calls take lists. The comment on the `Conv2DTranspose(32, …)` line has one space before `#`, while the other comments have two or more. `X_train` and `X_valid` are used here and on slides 9, 15 and 24, but they are never defined or loaded on any slide.
- **Slide 6:** pdftotext breaks this table: it splits the wrapped layer names onto separate lines and drops the column alignment. The image shows the layout transcribed above. The layer-type column is cut off by Keras's column width ("Conv2DTra"/"nspose)", "Conv2DT"/"ranspose)"). The auto-generated names (`sequential_12`, `dense_12`, `reshape_4`, `reshape_5`) show that other models were built earlier in the session; slide 5's code names nothing. Re-adding the Param # column gives 4464 + 0 + 4640 + 4624 + 145 + 0 = 13,873, which matches "Total params: 13,873". Each row checks out: 30·144 + 144 = 4464; 3·3·16·32 + 32 = 4640; 3·3·32·16 + 16 = 4624; 3·3·16·1 + 1 = 145. The `count_params()` output, 54479, has no thousands comma, unlike the summary totals. It also checks out: the encoder's Conv2D layers have 160 + 4640 + 18496 + 17310 = 40,606 parameters, and 40,606 + 13,873 = 54,479. Only the decoder's summary is shown; the encoder's is not.
- **Slide 7:** "We have looked at how to train them :" has a space before the colon. The third sub-item, "data visualization and unsupervised pretraining", has no closing full stop; the other two do. "overcomplete autoencoder" is introduced but not illustrated anywhere in the deck.
- **Slides 8–9:** Slide 8 describes two kinds of noise, Gaussian noise and dropout, but slide 9 implements only the dropout version. Slide 9's heading is "An Implementation Example", and no Gaussian-noise code appears. Figure 17-9's caption ("half the pixels turned off") agrees with `Dropout(0.5)`. No code for producing Figure 17-9 is shown.
- **Footnote punctuation:** The comma sits inside the closing quotation mark in footnotes 1 ("…Criterion,"), 4 ("…Nets,") and 5 ("…Networks,"), but outside it in footnotes 2 ("…Bayes",) and 3 ("…Autoencoders",). Page ranges use a hyphen ("3371-3408", "2672-2680").
- **Figure numbering:** The numbered figures are 17-8 (slide 8), 17-9 (slide 9), 17-11 (slide 11), 17-12 (slide 16), 17-14 (slide 19), 17-15 (slide 26) and 17-16 (slide 30). There is no Figure 17-10 or 17-13 in the deck. The interpolation strip on slide 18 is unnumbered (caption "Semantic interpolation."). Caption punctuation varies: 17-9, 17-14 and the slide-18 caption end with a full stop; 17-8, 17-11, 17-12, 17-15 and 17-16 do not.
- **Slide 11:** "the best μ and σ that describes the distribution" has a verb that does not agree with its plural subject ("describe"). "lower dimensional representations" has no hyphen. The text says "the encoder and decoder have two hidden layers each". In Figure 17-11 these are labelled Hidden 1 and Hidden 2 (encoder) and Hidden 4 and Hidden 5 (decoder). No layer in the figure is labelled "Hidden 3".
- **Slide 12:** "(using the two hidden layers *Hidden 3* and *Hidden 4*." never closes its parenthesis. It also names the decoder's hidden layers as Hidden 3 and Hidden 4, while Figure 17-11 (slide 11) labels them **Hidden 4** and **Hidden 5** and has no Hidden 3 at all. pdftotext garbles this slide's maths: it drops 𝓛, σ, μ, γ and the Σ, and splits the fractions. The image shows the formulas transcribed above. The two formulas agree with each other given the slide's definition $\boldsymbol{\gamma} = \log(\boldsymbol{\sigma}^2)$: $\gamma_i$ replaces $\log(\sigma_i^2)$ and $\exp(\gamma_i)$ replaces $\sigma_i^2$. The slide defines $\boldsymbol{\gamma}$ only in vector form; $\gamma_i$ appears only inside the formula. Slide 14's code computes `-0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)`, which matches the second formula term for term.
- **Slide 13:** Footnote 3 gives the year twice: "arXiv:1606.05908, 2016 (2016)." "This gives us the formula³ for 𝓛" refers to the latent-loss formula only, not to the two-part total loss that the slide describes.
- **Slide 14:** The base class is printed as `class Sampling(tf.keras.Layer)`, not `tf.keras.layers.Layer`. `codings_size` is used on slides 14, 16 and 18 but never assigned in the VAE section. Slide 16's text says "the codings are only 10-dimensional". Later, `codings_size = 30` is set on slide 23 (GAN) and `codings_size = 100` on slide 29 (DCGAN). The note "Check those lines that have "# ***"" has no full stop. The note says "Géron's code"; slide 25's comments say "the author's code". The code box runs off the bottom of the slide, and its last line (`variational_decoder = … # ***`) sits on the same baseline as the "14 / 32" footer. pdftotext loses the class's indentation and wrongly attaches that last `# ***` to the `# the decoder part of the VAE` comment; the image shows it on the `variational_decoder = …` line. The text layer writes "Géron" as "G´eron". The sampling line `tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean` matches Figure 17-11's "Gaussian noise × σ, + μ" wiring, since $\exp(\gamma/2) = \sigma$ when $\gamma = \log(\sigma^2)$.
- **Slides 14–18:** The name `codings` is reassigned several times. It holds the `Sampling` output on slide 14, the third encoder output on slide 15, random normals of shape [21, `codings_size`] on slide 16, and random normals of shape [2, `codings_size`] on slide 18.
- **Slide 15:** The fit uses `epochs=25`, which matches slide 16's "trained only for 25 epochs". The compile call passes only `loss="mse"`; the comment says the model minimises "the total loss (latent loss + reconstruction loss)". The latent part comes from the `add_loss` call on slide 14.
- **Slide 16:** The shape comment `# shape is (21,28,28)` agrees with `3 * 7` = 21 and with Figure 17-12's 3 × 7 grid. "10-dimensional" cannot be checked against any code, because `codings_size` is never set for the VAE. No plotting code for Figure 17-12 is shown.
- **Slide 18:** `np` (`np.linspace`) is used, but `import numpy as np` appears nowhere in the deck. `plot_multiple_images` is never defined; the comment says "see code for chapter 17". The text says "interpolate 2 codings", and the strip shows 10 images, which matches `np.linspace(..., 10)`.
- **Imports:** `tf` is used throughout, but `import tensorflow as tf` never appears in this deck. The only import shown is `from tensorflow.keras.layers import Dense` (slide 23), which comes after `codings_size = 30` rather than first.
- **Slide 19:** "Generative adversarial networks (GAN)" abbreviates a plural as a singular. "Goodfellow et al.⁴." puts a full stop after the footnote mark that follows "al.". Figure 17-14's labels read "Goal= trick the discriminator" and "Goal= tell fake from real", with no space before "=" and one after.
- **Slide 20:** "(just feed it some Gaussian noise, and it outputs a new image." never closes its parenthesis.
- **Slides 21 and 25:** The labels agree. Slide 21 sets fake = 0 and real = 1. In the code, `X_fake_and_real` concatenates `generated_images` first, and `y1` puts `[[0.]] * batch_size` first. Slide 22's "all the labels are set to 1" matches `y2 = tf.constant([[1.]] * batch_size)`.
- **Spelling mix:** Slides 26 and 30 use British "Visualising"; slide 7 uses American "visualization". Slide 21 has British "labelled" next to American "optimizes", and slide 14 has "customized". The deck consistently writes "pretraining" (slides 4, 7) and never "pre-training"; "labelled" occurs once (slide 21) and "labeled" never.
- **Slide 23:** The GAN generator ends in `Dense(28 * 28, activation="sigmoid")` followed by `Reshape([28, 28])`. Neither the generator nor the discriminator declares an input shape. The code mixes the imported bare `Dense` with fully qualified `tf.keras.layers.Flatten()`/`Reshape`.
- **Slide 24:** `X_train` is passed to `from_tensor_slices` without being defined, scaled or reshaped on any slide.
- **Slide 25:** The two `discriminator.trainable = True/False` lines each carry the comment `# *** this line is missing in the author's code` (transcribed verbatim; the typewriter apostrophe is curly). The `# extra code - plot images during training (omit to save time)` comment has no code under it, so no slide shows how Figures 17-15/17-16 were produced. `train_gan(..., n_epochs=50)` runs 50 epochs, which matches Figure 17-16's "after 50 epochs". The note's URL is split across two lines after "https:", and the note ends without a full stop.
- **Slide 27:** "The authors of the paper demonstrated…" does not say which paper; the slide has no citation (footnote 4 on slide 19 is the nearest). The "game" metaphor ("the game may end up…", "game theorists") is not introduced on earlier slides.
- **Slide 28 vs slide 29 (DCGAN guidelines vs code):**
  - *Pooling → strided/transposed convolutions:* consistent. The code has no pooling layers, the discriminator uses `Conv2D(…, strides=2)`, and the generator uses `Conv2DTranspose(…, strides=2)`.
  - *Batch Normalization in both networks (except the generator's output layer and the discriminator's input layer):* the generator follows this, with `BatchNormalization()` after the `Reshape` and after the first `Conv2DTranspose` and none after the output layer. **The discriminator has no `BatchNormalization` at all.** It uses `Dropout(0.4)` after each `Conv2D` instead, and dropout is not among the guidelines.
  - *Remove fully connected hidden layers:* the generator **starts with a fully connected `Dense(7 * 7 * 128)` layer** (followed by `Reshape`), and the discriminator **ends with `Dense(1, activation="sigmoid")`**. The guideline qualifies itself with "for deeper architectures".
  - *ReLU in the generator for all layers except a tanh output:* the output `Conv2DTranspose` uses `activation="tanh"` and the middle `Conv2DTranspose` uses `"relu"`, but **the first `Dense(7 * 7 * 128)` has no activation** (linear), so not "all layers" use ReLU.
  - *Leaky ReLU in the discriminator for all layers:* both `Conv2D` layers use `tf.keras.layers.LeakyReLU(0.2)`, but **the final `Dense` uses `sigmoid`**, not leaky ReLU.
- **Slide 29 vs slide 23 (output range and shape):** The DCGAN generator ends in `tanh`; slide 23's GAN generator ends in `sigmoid`. No slide shows any rescaling of the training images to match either range. The DCGAN generator also has no final `Reshape`. Its output works out as 7 × 7 × 128 → 14 × 14 × 64 → 28 × 28 × 1, while slide 23's GAN generator reshapes to [28, 28]. No reshape of `X_train` to add a channel axis is shown for the DCGAN; the slide says only "# compilation and training are similar to the code for GANs". The generator's layer list has a trailing comma after the last `Conv2DTranspose(...)` (valid Python). The continuation lines of the discriminator's `Conv2D` calls (`activation=tf.keras.layers.LeakyReLU(0.2)),`) are indented to a different column from those in the generator.
- **Slides 29–30:** The titles repeat "Deep Convolutional GANs" without "(cont.)", unlike every other continued topic in the deck.
- **Slide 30:** "trained on a large dataset of faces" is not illustrated; no face images appear in the deck.
- **Slide 32:** "Read up to Chapter 16" points back to an earlier chapter than this lecture's Chapter 17. The page range "roughly from pages 595 to 629" cannot be verified from the deck. The title ends with "...".
