// §11 · Forecasting several steps ahead (slides 34–39)
export default {
  big: '14 days ahead: {g|loop} a one-step model, or output all 14 at once',
  blocks: [
    {
      id: 'loop',
      h: 'One step at a time',
      at: '34',
      fig: { key: 'loop', hl: ['append'], place: 'side', cap: 'slide 34’s loop (shapes worked out from its code)' },
      items: [
        {
          steps: [
            'X = the first 56 days of `rail_valid`',
            '`univar_model` predicts the next day',
            'append it to X: the prediction for $t - 1$ = the last input for $t$',
            'repeat 14 times',
          ],
        },
        'works only when inputs & outputs have the {g|same features}',
      ],
      margin: [
        { nb: '`univar_model` was trained to predict one step ahead only' },
        { q: 'How does slide 34 get 14 days from a one-step model?', a: 'It predicts one day, appends the prediction to the input X, and repeats 14 times.' },
      ],
    },
    {
      id: 'ahead',
      h: '14 days at once',
      at: '35–38',
      fig: { key: 'aheadSplit', hl: ['tgt'], place: 'above', cap: 'one 70-day window; the targets in green' },
      items: [
        'window = `seq_length + 14` = 70 days, then split it',
        '`ahead_model` ends in `Dense(14)`: one output per day ahead',
        { code: 'return mulvar_series[:, :-ahead], mulvar_series[:, -ahead:, target_col]', read: 'inputs: all but the last 14 days · targets: the {g|last 14 days} of column `target_col` (1 = rail)' },
        { formula: '(32,\\ 70,\\ 5) \\;\\longrightarrow\\; (32,\\ 56,\\ 5) \\;+\\; (32,\\ 14)', read: 'a batch of 70-day windows → inputs + 14-day rail targets', tag: '70-day batch: this page’s; the split: slide 36' },
        {
          title: 'slide 36’s 33 batches (this page’s count)',
          worked: ['training set 2016-01-01 to 2018-12-31 = 1,096 days → ${1{,}096 - 70 + 1 = 1{,}027}$ windows → ${\\lceil 1{,}027 / 32 \\rceil = 33}$ (32 full & one of 3)'],
        },
      ],
      margin: [
        { q: 'What shapes does an `ahead_train_ds` batch have?', a: 'Inputs (32, 56, 5) and targets (32, 14): 56 days of 5 features in, 14 rail values out.' },
      ],
    },
    {
      id: 'vs',
      h: 'Loop vs all at once',
      at: '34, 38',
      items: [
        {
          table: {
            head: ['', 'input features', 'val MAE (rail)'],
            rows: [
              ['loop `univar_model` ×14', '1', '{g|30,734}'],
              ['`ahead_model`, 14 at once', '5', '33,887'],
            ],
          },
        },
        'slide 38: `ahead_model` slightly worse than looping `univar_model`, even with 5 features',
      ],
    },
    {
      id: 's2s',
      h: 'Sequence-to-sequence (a preview)',
      at: '39',
      items: [
        'forecast at {g|every} time step, not just the last: e.g. days 0–9 → days 10–19, then days 1–10 → days 11–20, …',
        'can be done using the encoder–decoder architecture → lecture topic 8 (Transformers)',
      ],
      margin: [
        { sc: 'slide 39: “forest” = forecast; a 10-day example; titled seq-to-seq, yet “can be done using” the encoder–decoder.' },
      ],
    },
  ],
};
