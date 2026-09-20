/* The colonnade's plaques (slides 36–47): eight networks in year order. Every
   line is the deck's own; `depth` only where a slide states a layer count. */
export const ARCHITECTURES = [
  { name: 'LeNet-5', year: 1998, slide: '37', depth: 7,
    fact: 'Yann LeCun, 1998, for handwritten digits (MNIST): conv, average pool, conv, average pool, conv, dense, out — and tanh everywhere; today it would be ReLU and softmax.' },
  { name: 'AlexNet', year: 2012, slide: '38–39', depth: 10,
    fact: 'Won ILSVRC 2012 with 17% top-5 error against the runner-up’s 26%. The first to stack convolutional layers directly on each other; 50% dropout and data augmentation kept it from overfitting.' },
  { name: 'GoogLeNet', year: 2014, slide: '41–43', depth: null,
    fact: 'Inception modules took the top-5 error below 7% with ten times fewer parameters than AlexNet — about 6 million instead of 60 million. Nine inception modules deep.' },
  { name: 'VGGNet', year: 2014, slide: '44', depth: 19,
    fact: 'Runner-up in 2014 from Oxford’s Visual Geometry Group: a simple, classical stack of 16 or 19 convolutional layers.' },
  { name: 'ResNet', year: 2015, slide: '45–46', depth: 152,
    fact: 'Won 2015 with top-5 error under 3.6% using 152 layers (other variants 34, 50 and 101). Skip connections make each block learn the residual f(x) = h(x) − x.' },
  { name: 'Xception', year: 2016, slide: '47', depth: null,
    fact: 'A GoogLeNet variant built on depthwise separable convolutions; it outperformed Inception-v3 on a 350-million-image task.' },
  { name: 'SENet', year: 2017, slide: '47', depth: null,
    fact: 'Squeeze-and-Excitation Network, the ILSVRC 2017 winner: an addition that boosts inception networks and ResNets alike.' },
  { name: 'EfficientNet', year: 2019, slide: '47', depth: null,
    fact: 'One of the noteworthy successors the deck lists alongside ResNeXt, DenseNet, MobileNet and CSPNet.' },
];
