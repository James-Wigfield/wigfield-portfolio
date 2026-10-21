// §7 · Preparing the data: windows & batches (slides 19–22)
export default {
  big: 'input data usually does not come in a form that can be used directly → {g|data preparation}',
  blocks: [
    {
      id: 'toy',
      h: 'Windows & targets',
      at: '19',
      fig: { key: 'windows', hl: ['w0'], cap: 'slide 19 · the first window and its target in green', place: 'side' },
      items: [
        '`timeseries_dataset_from_array` cuts a series into {g|windows} of `sequence_length` values, pairs each with a {g|target} & groups them into batches',
        { code: 'timeseries_dataset_from_array(\n    series,\n    targets=series[L:],\n    sequence_length=L,\n    batch_size=B)', tag: 'this page’s general form of slides 19–20', read: 'window $p$ = series[$p$ … $p+L-1$], its target = series[$p+L$]' },
        '`[0, 1, 2, 3, 4, 5]`, `sequence_length=3`, `targets=my_series[3:]`',
        'every window needs a target: `my_series[3:]` = [3, 4, 5] → 3 windows: [0, 1, 2] → 3, [1, 2, 3] → 4, [2, 3, 4] → 5',
        '`batch_size=2` → (2, 3) with targets (2,), then (1, 3) with target (1,)',
      ],
      margin: [
        { q: 'In slide 19, what is the target of the window [1, 2, 3]?', a: '4 — the value right after the window.' },
      ],
    },
    {
      id: 'rail',
      h: 'The rail series',
      at: '20–22',
      items: [
        {
          table: {
            head: ['split by date', 'period'],
            rows: [
              ['training', '2016-01 → 2018-12'],
              ['validation', '2019-01 → 2019-05'],
              ['test', '2019-06 →'],
            ],
          },
        },
        {
          steps: [
            'rail counts ÷ `1e6`',
            'windows of `seq_length = 56` days',
            'target = the {g|next day}: the series shifted by 56 (`rail_train[seq_length:]`)',
            'batches of 32 → inputs (32, 56), targets (32,)',
            'shuffle the {g|training set only} (seed 42)',
          ],
        },
        {
          title: 'this page’s count from the data',
          worked: ['1,096 training days − 56 = 1,040 windows → 32 full batches of 32 + one of 16 = 33 batches'],
        },
        'slide 22 plots days 0 to 55 of a window as a line, day 56 as the star to predict',
      ],
      margin: [
        { q: 'What shapes does a `train_ds` minibatch have?', a: 'Inputs (32, 56) — 32 windows of 56 days — and targets (32,).' },
        { sc: 'slide 22’s code says `sharey=True`; its panels’ y-ranges differ.' },
      ],
    },
  ],
};
