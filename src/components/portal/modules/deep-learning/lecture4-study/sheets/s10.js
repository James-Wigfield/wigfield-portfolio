// §10 · Multivariate input & multiple outputs (slides 30–33)
export default {
  big: 'neural nets handle {g|multivariate} time series with almost no change to their architecture',
  blocks: [
    {
      id: 'input',
      h: 'Multivariate input',
      at: '30–31',
      items: [
        { code: 'df_mulvar["next_day_type"] = df["day_type"].shift(-1)\ndf_mulvar = pd.get_dummies(df_mulvar)', read: 'tomorrow’s day type moved onto today’s row, then one-hot → three 0/1 columns' },
        '`df_mulvar`: bus & rail (÷ 1e6) + `next_day_type_A`, `_U`, `_W` = 5 columns',
        'inputs: all 5 columns → input shape `[None, 5]` · targets: {g|rail only}',
      ],
      margin: [
        { q: 'What are `mulvar_model`’s 5 input columns?', a: 'bus, rail, next_day_type_A, next_day_type_U and next_day_type_W.' },
      ],
    },
    {
      id: 'outputs',
      h: 'One input row, two output layers',
      at: '31–33',
      fig: { key: 'mulvar', hl: ['d2'], place: 'above', cap: 'the multitask output layer in green' },
      items: [
        'multitask RNN: bus & rail together → 2 targets per day + a {g|`Dense(2)`} output layer',
        { code: 'InputLayer(shape=[None, 5]) … Dense(2)', read: 'any number of days of 5 features in; two numbers (bus, rail) out' },
        {
          table: {
            head: ['val MAE', 'total', 'bus', 'rail'],
            cols: 'minmax(0, max-content) max-content max-content max-content',
            rows: [
              ['`mulvar_model` (best so far)', '—', '—', '{g|22,062}'],
              ['`multask_model`', '27,855', '26,812', '28,896'],
              ['… a 2024 run of it', '24,421', '25,162', '23,680'],
            ],
          },
        },
        'different runs → slightly different results',
      ],
      margin: [
        { q: 'What changes to make the model predict bus and rail?', a: 'Two targets per day (`mulvar_train[["bus", "rail"]][seq_length:]`) and a `Dense(2)` output layer.' },
        { ne: '27,855 & 24,421 cover both outputs → not like-for-like with a rail-only MAE' },      ],
    },
    {
      id: 'params',
      h: 'Parameter counts',
      at: '31–32',
      items: [
        {
          title: 'the slides don’t print these (computed here)',
          worked: [
            '`mulvar_model`: SimpleRNN(32) on 5 inputs $= 5 \\times 32 + 32 \\times 32 + 32 = 1{,}216$, + Dense(1) $33$ → $1{,}249$',
            '`multask_model`: the same RNN + Dense(2) $= 32 \\times 2 + 2 = 66$ → $1{,}282$',
          ],
        },
      ],
    },
  ],
};
