// §6 · Ridership, seasonality & the naive forecast (slides 15–18)
export default {
  big: 'naive forecasting is often a good {g|baseline}, and in some cases even tricky to beat',
  blocks: [
    {
      id: 'data',
      h: 'The data',
      at: '15–16',
      items: [
        'Chicago’s daily ridership; after slide 15’s cleaning `df` = `day_type`, `bus`, `rail`, indexed by date',
        'a similar pattern repeats each week (Figure 15-6) = {g|weekly seasonality}',
      ],
    },
    {
      id: 'naive',
      h: 'Naive forecasting',
      at: '16–17',
      fig: { key: 'naive', hl: ['lag'], cap: 'last week’s copy (dotted) in green; $e_{(t)}$ = the error', place: 'side' },
      items: [
        'naive forecast = copy a {g|past value} as the forecast',
        { arrow: ['strong weekly seasonality', 'copying {g|last week’s} value works better'] },
        '`diff_7` = each day − the same day a week before',
      ],
      margin: [
        { q: 'What is naive forecasting?', a: 'Copying a past value as the forecast — here, the value from the same day last week.' },
      ],
    },
    {
      id: 'error',
      h: 'Measuring the error',
      at: '18',
      items: [
        { formula: '\\text{MAE} = \\frac{1}{n}\\sum_{t} \\left| y_{(t)} - y_{(t-7)} \\right|', tag: 'slide 18’s diff_7.abs().mean()', read: 'avg size of the error when the forecast is last week’s value' },
        { formula: '\\text{MAPE} = \\frac{1}{n}\\sum_{t} \\left| \\frac{y_{(t)} - y_{(t-7)}}{y_{(t)}} \\right|', tag: 'slide 18’s (diff_7 / targets).abs().mean()', read: 'the same errors as fractions of the true value' },
        { sub: 'slide 18 · March–May 2019' },
        {
          table: {
            head: ['', 'MAE (riders a day)', 'MAPE'],
            rows: [
              ['rail', '42,143.27', '0.089948 ≈ 9.0 %'],
              ['bus', '43,915.61', '0.082938 ≈ 8.3 %'],
            ],
          },
        },
        { line: 'bus: higher MAE but {g|lower MAPE}' },
        { arrow: ['bus counts are larger', 'a similar error is a smaller fraction'] },
        'this 7-days’ shift = the baseline for the RNNs',
      ],
      margin: [
        { nb: 'MAE = mean absolute error, also called MAD (mean absolute deviation)' },
        { nb: 'MAPE = mean absolute percentage error' },
        { q: 'Bus has the higher MAE but the lower MAPE. How can that be?', a: 'MAPE divides each error by the true value; bus counts are larger, so similar errors are smaller fractions.' },
      ],
    },
  ],
};
