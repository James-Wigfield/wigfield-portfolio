# CITS5017 Deep Learning

Topic 3: Deep Computer Vision Using Convolutional Neural Networks — Associate Professor Du Huynh (Unit Coordinator and Lecturer) — Semester 2, 2026

---

## Slide 1 — CITS5017 Deep Learning / Topic 3: Deep Computer Vision Using Convolutional Neural Networks

Associate Professor Du Huynh
(Unit Coordinator and Lecturer)

Semester 2, 2026

![Figure 1: The University of Western Australia crest and wordmark](figure-1.png)

> **Figure 1.** The UWA coat of arms: a shield with a gold/yellow upper band containing four small blue-and-white book emblems, each bearing a two-line Latin motto — reading left to right "VIT AM", "EXC OLU", "ERE PER", "AR TES" (i.e. *Vitam excolueré per artes*). The lower portion of the shield is blue with a gold field on which a black swan is displayed. Beneath the shield is a blue ribbon banner with the white text "SEEK WISDOM". Below the crest is the wordmark "THE UNIVERSITY OF WESTERN AUSTRALIA" in blue.

---

## Slide 2 — Today

Chapters 14.

### Hands-on Machine Learning with Scikit-Learn, Keras & TensorFlow

![Figure 2: Book cover of Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow](figure-2.png)

> **Figure 2.** Book cover, O'REILLY. Top-left corner shows the O'REILLY logo in red. A diagonal banner in the top-right corner reads "Third Edition". Title text: "Hands-On Machine Learning with Scikit-Learn, Keras & TensorFlow". Subtitle in orange: "Concepts, Tools, and Techniques to Build Intelligent Systems". Below that, small text "powered by" followed by a logo. The cover illustration is a black-and-yellow spotted salamander. Author name at the bottom: "Aurélien Géron".

---

## Slide 3 — Chapter Fourteen

### Deep Computer Vision Using Convolutional Neural Networks (CNNs)

Here are the main topics we will cover:

- Convolutional layers
  - Filters and feature maps
  - Stacking multiple feature maps
- Pooling layers
- TensorFlow implementation for CNNs
- Memory requirements of CNNs
- CNN architectures
- Using pretrained models and transfer learning

---

## Slide 4 — Convolutional Neural Networks (CNNs)

Convolutional neural networks (CNNs) emerged from the study<sup>1,2</sup> of the brain's visual cortex.

> **Figure 14-1.** A schematic line illustration of visual processing. On the far left is a column of simple black outline drawings arranged in three rows: top row — a shark/fish outline and a house outline; middle row — a triangle, an "X"-like crossing shape, a "⊢" shape, and another "✕" shape; bottom row — a curved stroke ")", a horizontal dash "—", a diagonal stroke "\", and a vertical stroke "|". To the right of these is a fully connected network of small peach/cream-coloured circles arranged in roughly four columns of five or six neurons each, with many crossing edges between adjacent columns. Lines from the lower neurons converge to the right into a drawing of an eye shown as an oval with a green iris ring and a black pupil, drawn in cross-section with rays spreading outward. To the right of the eye, further lines fan out onto a blue silhouette of a house (a two-storey building with a chimney, a door, and a window), on which several dashed ellipses of increasing size are overlaid, indicating receptive fields covering progressively larger portions of the image — a small dashed ellipse over the roof edge, a larger dashed ellipse over the door area, and a large dashed ellipse over the upper part of the house.

*Caption:* Figure 14-1. Biological neurons in the visual cortex respond to specific patterns in small regions of the visual field called *receptive fields*; as the visual signal makes its way through consecutive brain modules, neurons respond to more complex patterns in larger receptive fields.

**Footnotes:**

1. David H. Hubel, "Single Unit Activity in Striate Cortex of Unrestrained Cats," *The Journal of Physiology* 147 (1959): 226-238.
2. David H. Hubel and Torsten N. Wiesel, "Receptive Fields of Single Neurons in the Cat's Striate Cortex," *The Journal of Physiology* 148 (1959): 574-591.

---

## Slide 5 — Convolutional Neural Networks (CNNs)

- These studies of the visual cortex inspired the *neocognition*³ (introduced in 1980), which gradually evolved into what we now call convolutional neural networks.
- In the last few years, thanks to the increase in computational power, the amount of available training data, and the tricks presented in Chapter 11 for training deep nets, CNNs have managed to achieve superhuman performance on some complex visual tasks.
- CNNs are not restricted to visual perception: they are also successful at other tasks, such as voice recognition or natural language processing (NLP).

**Footnotes:**

3. Kunihiko Fukushima, "Neocognitron: A Self-Organizing Neural Network Model for a Mechanism of Pattern Recognition Unaffected by Shift in Position," *Biological Cybernetics* 36 (1980): 193-202.

---

## Slide 6 — Convolution: A Brief Introduction

Given an image $I$ and a $3 \times 3$ filter $f$, the convolution output of the input image $I$ by $f$ at pixel $(x, y)$ is given by

$$
I'(x, y) = \sum_{i=-1}^{1}\sum_{j=-1}^{1} I(x + i,\, y + j)\, f(i, j),
$$

where $I'$ is the output image.

It is easier to understand the convolution operation through an animation, e.g.

- `https://www.youtube.com/watch?v=ulKbLD6BRJA` (1D convolution)
- `https://commons.wikimedia.org/wiki/File:2D_Convolution_Animation.gif`

Some common $3 \times 3$ filters used in Computer Vision:

$$
\begin{bmatrix} -1 & 0 & 1 \\ -2 & 0 & 2 \\ -1 & 0 & 1 \end{bmatrix}
\quad
\begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ 1 & 2 & 1 \end{bmatrix}
\quad
\frac{1}{9}\begin{bmatrix} 1 & 1 & 1 \\ 1 & 1 & 1 \\ 1 & 1 & 1 \end{bmatrix}
\quad
\begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}
$$

(From left to right: Sobel-x (for detecting vertical edges); Sobel-y (for detecting horizontal edges); uniform averaging filter (for smoothing); Laplacian operator (2nd derivative filter).

Larger filters can also be defined. Odd size filters ($5 \times 5$, $7 \times 7$, $\cdots$) are usually preferred.

---

## Slide 7 — Convolutional Layers

The most important building block of a CNN is the *convolutional layer*.

#### Left column — bullets

- Neurons in the first convolutional layer are <u>not</u> connected to every single pixel in the input image, but only to pixels in their *receptive fields*.
- In turn, each neuron in the second convolutional layer is connected only to neurons located within a small rectangle in the first layer.

#### Right column — figure

> **Figure 14-2.** A schematic of three stacked parallelogram planes drawn in perspective, one above the other. The bottom plane is labelled "Input layer" and contains a blue silhouette of an aeroplane seen from below/front. The middle plane is labelled "Convolutional layer 1" and is shaded grey. The top plane is labelled "Convolutional layer 2" and is also shaded grey. Dashed lines rise from a small rectangular patch on the input layer and converge to a single small ellipse (neuron) on convolutional layer 1; from a small rectangular patch on convolutional layer 1, dashed lines converge upward to a single small ellipse on convolutional layer 2, illustrating rectangular local receptive fields at each level.

*Caption:* Figure 14-2. CNN layers with rectangular local receptive fields.

#### Below the columns

This architecture allows the network to concentrate on low-level features in the first hidden layer, then assemble them into higher-level features in the next hidden layer, and so on.

---

## Slide 8 — Convolutional Layers (cont.)

> **Figure (slide 8).** A schematic of two large parallelogram planes outlined in blue, drawn in perspective one above the other. The lower plane is annotated on its right with the blue bold label "A feature map at layer $i$"; the upper plane is annotated on its right with the blue bold label "A feature map at layer $i$+1". Thin blue arrows point from each label to the corresponding plane's edge.
>
> On the lower plane sit two small $3 \times 3$ grids of cells, each drawn with dots at the cell centres: one outlined in purple (left) and one outlined in green (right). On the upper plane sit two larger $3 \times 3$ grids: one outlined in purple (left) and one outlined in green (right). From the purple $3 \times 3$ patch on the lower plane, five purple lines fan upward and converge on the centre cell of the purple grid on the upper plane. Likewise, from the green $3 \times 3$ patch on the lower plane, five green lines fan upward and converge on the centre cell of the green grid on the upper plane.
>
> Two black annotation arrows point to the diagram from text blocks. The left-hand text block reads: "All the 9 pixels in the feature map at layer $i$ are connected to 1 pixel in the feature map at layer $i$+1 (only 5 connections are shown here). These 9 connections weights form a 3 x 3 filter **W** that the training process needs to learn." The right-hand text block reads: "All the 9 pixels in the feature map at layer $i$ are connected to 1 pixel in the feature map at layer $i$+1 (only 5 connections are shown here). These 9 connections weights are the same weights in the 3 x 3 filter **W** for the purple patch."

If only one $3 \times 3$ filter $\mathbf{W}$ is used for the convolution in layer $i$, then only $9$ parameters from $\mathbf{W}$ plus a bias parameter need to be estimated, regardless of the numbers of rows and columns of the feature map in layer $i$.

---

## Slide 9 — Connections Between Layers

It is also possible to connect a large input layer to a much smaller layer by spacing out the receptive fields. The distance between two consecutive receptive fields is called the *stride*.

#### Left column — text

In the diagram, a $5 \times 7$ input layer (plus zero padding) is connected to a $3 \times 4$ layer, using $3 \times 3$ receptive fields and a stride of $2$ in both directions, but it does not have to be so. A neuron located in row $i$, column $j$ in the upper layer is connected to the outputs of the neurons in the previous layer located in rows $i\,s_h$ to $i\,s_h + f_h - 1$, columns $j\,s_w$ to $j\,s_w + f_w - 1$, where $s_h$ and $s_w$ are the vertical and horizontal strides.

#### Right column — figure

> **Figure 14-4.** A perspective schematic of two grid planes. The lower, larger plane is a grey-shaded grid representing the input layer with zero padding around it (the padding cells are drawn as the outer band with diagonal hatching). The upper, smaller plane is a $3 \times 4$ grid of white cells; three of its cells are highlighted — one in salmon/pink (top-left area), one in blue next to it, and one in purple (top-right). From each highlighted upper cell, coloured lines fan down to a corresponding $3 \times 3$ receptive-field region on the lower plane: salmon lines to a salmon-outlined $3 \times 3$ region, blue dashed lines to a blue dashed $3 \times 3$ region offset two cells to the right, and purple lines to a purple $3 \times 3$ region at the right-hand end. Two black dashed arrows with labels indicate the stride spacing: "S$_h$=2" on the left edge (vertical stride) and "S$_w$=2" along the bottom edge (horizontal stride).

*Caption:* Figure 14-4. Reducing dimensionality using a stride of 2 in both directions ($s_w = s_h = 2$).

---

## Slide 10 — Filters

A neuron's weights can be represented as a small image having the same size as the receptive field. For example, consider the two *filters* (or *convolution kernels*) shown below:

#### Left column — bullets

- The first one is represented as a black square with a vertical white line in the middle (it is a $7 \times 7$ matrix full of $0$s except for the central column, which is full of $1$s); neurons using these weights will ignore everything in their receptive field except for the central vertical line (since all inputs will get multiplied by $0$, except for the ones located in the central vertical line).
- The second filter is a black square with a horizontal white line in the middle. Once again, neurons using these weights will ignore everything in their receptive field except for the central horizontal line.

#### Right column — figures

![Figure 3: Vertical line filter](figure-3.png)

> **Figure 3.** A square black image with a single narrow white vertical stripe running top to bottom through its centre, splitting the black square into two equal black halves. This is the $7 \times 7$ vertical-line filter described above.

![Figure 4: Horizontal line filter](figure-4.png)

> **Figure 4.** A square black image with a single narrow white horizontal stripe running left to right through its centre, splitting the black square into two equal black halves. This is the horizontal-line filter described above.

---

## Slide 11 — Filters (cont.)

> **Figure 14-5.** A three-part diagram showing one input image and two resulting feature maps. At the bottom centre is a greyscale photograph labelled "Input" (white label text in the upper-left corner of the image): a traditional Chinese temple/palace building photographed from a low angle, showing a tiled sloping roof with an upturned eave, decorated bracket work beneath the eaves, and a row of vertical latticed doors/panels below.
>
> From the input image, two grey arrows point upward and outward. The left arrow is annotated "Vertical filter" beside a small black square icon containing a white vertical stripe; the right arrow is annotated "Horizontal filter" beside a small black square icon containing a white horizontal stripe.
>
> The left arrow leads to the upper-left greyscale image labelled "Feature Map 1", in which vertical structures dominate: the door lattices and vertical edges appear as bright vertical streaks while horizontal roof lines are suppressed. The right arrow leads to the upper-right greyscale image labelled "Feature Map 2", in which horizontal structures dominate: the roof line, eaves and horizontal bands appear as bright horizontal streaks while vertical edges are suppressed.

*Caption:* Figure 14-5. Applying two different filters to get two feature maps.

---

## Slide 12 — Stacking Multiple Feature Maps

#### Left column — text

So far, we have represented each convolutional layer as a *thin 2D layer*, but in reality it is composed of *several feature maps* stacked together, so it is more accurately represented in *3D*.

#### Right column — figure

> **Figure 14-6.** A perspective schematic of a CNN drawn as three stacked 3D slabs. The bottom slab is labelled "Input layer" on the right; its top face is red and its side shows three coloured sheets, annotated on the left with "Channels" and, with small arrows, the labels "Red" (in red text), "Green" (in green text), and "Blue" (in blue text).
>
> Above it is a grey slab of many thin stacked sheets labelled "Convolutional layer 1" on the right. To its left, two small parallelogram icons are labelled "Map 1" (a plain pale blue parallelogram) and "Map 2" (a pink parallelogram with a dark vertical stripe), followed by a vertical ellipsis, indicating a stack of further maps.
>
> Above that is another grey slab of thin stacked sheets labelled "Convolutional layer 2" on the right. To its left, two small parallelogram icons are labelled "Feature Map 1" (pale blue parallelogram containing a pink inner rectangle) and "Map 2" (a parallelogram split into a green portion and a pink portion), followed by a vertical ellipsis. The word "Filters" labels this group of icons.
>
> White and black dashed lines rise from a small receptive-field region spanning all three channels of the input layer and converge on a small circle (neuron) within convolutional layer 1; further dashed lines rise from a region of convolutional layer 1 and converge on a small circle within convolutional layer 2, showing that each neuron's receptive field extends across all feature maps of the previous layer.

*Caption:* Figure 14-6. Convolution layers with multiple feature maps, and images with three channels

---

## Slide 13 — Stacking Multiple Feature Maps (cont.)

- Within one feature map, all neurons share the same parameters (the weights and the bias term of the filter).
- Neurons in different feature maps use different parameters. In fact, each feature map in a specific layer is generated by convolving a filter with the input of that layer.
- A neuron's receptive field is the same as described earlier, but it extends across all the previous layers' feature maps. In short, a convolutional layer simultaneously applies multiple filters to its inputs, making it capable of detecting multiple features anywhere in its inputs.
- Specifically, if a convolutional layer has $n$ filters, then there are $n$ feature maps generated for that layer. i.e., the output of that layer has $n$ channels.

---

## Slide 14 — Stacking Multiple Feature Maps (cont.)

#### Left column — bullets

- A neuron located in row $i$, column $j$ of the feature map $k$ in a given convolutional layer $\ell$ is connected to the outputs of the neurons in the previous layer $\ell - 1$, located in rows $i\,s_h$ to $i\,s_h + f_h - 1$ and columns $j\,s_w$ to $j\,s_w + f_w - 1$, across all feature maps (in layer $\ell - 1$).
- Note that all neurons located in the same row $i$ and column $j$ but in different feature maps are connected to the outputs of the exact same neurons in the previous layer.

#### Right column — figure

> **Figure (slide 14).** A smaller reproduction of Figure 14-6 from slide 12: three stacked 3D slabs in perspective. The bottom slab has a red top face and is labelled "Input layer" on the right, with "Channels" on the left and the labelled sheets "Red" (red text), "Green" (green text) and "Blue" (blue text). The middle grey slab of stacked sheets is labelled "Convolutional layer 1" on the right, with the icons "Map 1" (pale blue parallelogram) and "Map 2" (pink parallelogram with a dark stripe) and a vertical ellipsis on its left. The top grey slab is labelled "Convolutional layer 2" on the right, with the icons "Feature Map 1" (pale blue parallelogram with a pink inner rectangle) and "Map 2" (green-and-pink parallelogram), a vertical ellipsis, and the group label "Filters" on its left. White/black dashed lines connect a receptive-field region spanning all input channels to a neuron in convolutional layer 1, and a region of layer 1 to a neuron in convolutional layer 2.

---

## Slide 15 — Stacking Multiple Feature Maps (cont.)

### How the convolution is done...

Suppose that the dimension of the input image $\mathbf{x}$ is $N_{\text{height}} \times N_{\text{width}} \times N_{\text{channels}}$ and that there are $K$ $n_h \times n_w$ filters altogether. Each filter $f_k$ (for $k = 1, \cdots, K$) must have $N_{\text{channels}}$ channels in order for the convolution to be legal. That is, the dimension of each $f_k$ is $n_h \times n_w \times N_{\text{channels}}$. These filters stack together to form a $n_h \times n_w \times N_{\text{channels}} \times K$ tensor.

The $k^{\text{th}}$ output channel, denoted by $z_k$, is produced as follows:

$$
z_k = b_k + \sum_{c=0}^{N_{\text{channels}}-1} x_c * f_{c,k}
$$

where $*$ denotes the convolution operation;

- $x_c$ (whose dimension is $N_{\text{height}} \times N_{\text{width}}$) denotes channel $c$ of $\mathbf{x}$;
- $f_{c,k}$ (an $n_h \times n_w$ matrix) denotes channel $c$ of the filter $f_k$;
- $b_k$ is the bias term for the filter $f_k$.

So each filter produces one output channel (or one output feature map).

---

## Slide 16 — Implementing Convolutional Layers with Keras

In Keras,

- Each input image is typically represented as a 3D tensor of shape [height, width, channels].
- A mini-batch is represented as a 4D tensor of shape [minibatch size, height, width, channels].
- The weights of a convolutional layer (i.e., all the filters) are represented as a 4D tensor of shape $[f_h, f_w, f_c, f_n]$, where $f_h$ and $f_w$ are the height of width of the filters, $f_c$ is the number of channels (must be the same as the input image) of the filters, $f_n$ is the total number of filters.
- The bias terms⁴ of a convolutional layer are simply represented as a 1D tensor of shape $[f_n]$.

**Footnotes:**

4. One bias term per filter in the convolution layer.