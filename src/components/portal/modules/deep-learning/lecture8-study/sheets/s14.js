// §14 · Implementing the transformer in Keras (slide 43)
export default {
  blocks: [
    {
      id: 'keras',
      h: 'Transformer in Keras',
      at: '43',
      items: [
        { code: 'tf.keras.layers.MultiHeadAttention(\n    num_heads=num_heads, key_dim=embed_size, dropout=dropout_rate)', read: 'slide 43: `N = 2`, `num_heads = 8`, `dropout_rate = 0.1`' },
        '`attn_layer(Z, value=Z, attention_mask=encoder_pad_mask)` is the encoder’s {g|self-attention}: queries and values (so keys too) are all `Z`.',
        '`encoder_pad_mask` masks out the padding tokens (ID 0).',
      ],
      margin: [
        { sc: '`key_dim=embed_size` makes each head full width, not a split (slide 39).' },
      ],
    },
  ],
  skip: 'the rest of the listing (a partial sketch) and this page’s toy transformer.',
};
