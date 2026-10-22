// §8 · Attention in Keras; keys, values and queries (slides 26–28)
export default {
  blocks: [
    {
      id: 'keras',
      h: 'Attention in Keras',
      at: '26',
      items: [
        '`Attention` is Luong’s (dot product by default, `score_mode="concat"` for concat); `AdditiveAttention` is Bahdanau’s.',
        'The encoder needs {g|`return_sequences=True`} so all its outputs reach the attention layer; for simplicity, pass the decoder’s outputs instead of its states (it works well too).',
      ],
    },
    {
      id: 'qkv',
      h: 'Queries, keys and values',
      at: '27–28',
      items: [
        'Like a dictionary lookup: the decoder’s {g|query} is matched against the encoder’s {g|keys}, and their {g|values} are fetched.',
        { code: 'attention_layer([decoder_outputs, encoder_outputs])', read: '= `attention_layer([queries, keys])`; the values default to the keys' },
      ],
      margin: [
        { q: 'With two inputs, what are the keys and the values?', a: 'Both are the encoder’s outputs; the queries are the decoder’s outputs.' },
        { sc: 'Keras documents the inputs as [query, value, key]: the same effect here.' },
      ],
    },
  ],
  skip: 'slide 27’s mismatched dictionary example.',
};
