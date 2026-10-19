import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell, outLabel } from '../nbutil';
import PanelAnatomyScene from './scenes/PanelAnatomy';
import fig20 from '../figures/cell20_0.png';
import { FIG_CAPTIONS } from '../figcaps';

/* ============================================================================
   PLATE 4·1 — reading a display_temperatures panel  (§4 Visualising)
   The scene builds one panel from the real test sequence 95; predictions are
   never drawn by the page, only shown in the notebook's own figure (Out [10]).
   ========================================================================== */

export function PanelPlate({ meta }) {
  const fn = codeCell('s4', 0); // In [5] display_temperatures
  const calls = codeCell('s4', 1); // In [6] the three section-4 figures
  const helpers = codeCell('s5', 0); // In [7] … SHOW
  return (
    <Plate meta={meta} cells={sectionRange('s4')}>
      <Row label="Task">
        <p className="dlp2-task">
          Write one plotting function that shows three sequences with their input and target months, and draws a model’s predictions
          over the targets when it is given them.
        </p>
      </Row>
      <Row label="How it works" wide>
        <PanelAnatomyScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>display_temperatures(X, y, y_pred=None, indices=None, title=None)</code> makes a row of three panels that share one
          temperature axis (<code>sharey=True</code>), so a cool sequence looks cool next to a warm one. Every panel uses the same code:
          the input months solid, the target months dashed with a dot each, predictions dotted with a cross each, and{' '}
          <code>axvline(n_in + 0.5)</code> for the grey line. <R c={fn} code />
        </P>
        <P>
          The month positions come from the shapes, <code>t_out = arange(n_in + 1, n_in + n_out + 1)</code>, so the same function draws a
          12-month target and model 2’s 1-month target without any change. The markers are there for the 1-month case: one month has no
          line to dash. <R c={mdCell('s4', 0)} />
        </P>
        <P>
          The title “sequence 95” is a row number in <code>X_test</code>, not a date, and month 1 is the first month of that window, which
          can fall anywhere in the year. Without <code>indices</code> the function draws three rows with <code>np.random.choice</code>, which
          the seed in section 1 fixes: section 4’s three calls picked training rows 566, 1101 and 1474, validation rows 182, 56 and 86, and
          test rows 240, 257 and 220 <R c={calls} />. In [7] then draws <code>SHOW</code> once and every model’s test plot passes{' '}
          <code>indices=SHOW</code> <R c={helpers} code />; the titles of model 1’s figure below show the rows it drew, 95, 259 and 140{' '}
          <R c={codeCell('s6', 2)} />.
        </P>
      </Row>
      <Row label="What came out">
        <P>
          The section-4 plots show the annual cycle doing most of the work: six full cycles in the 72 input months, summer maximums of 30
          to 35 °C and minimums of 15 to 20, winter maximums of 15 to 19 and minimums of 5 to 10. The Bickley test windows sit lower on
          both channels, with winter maximums close to 15, and Swanbourne’s minimums rarely drop below 8. <R c={mdCell('s4', 1)} />
        </P>
        <figure className="dlp2-fig" style={{ margin: '0.2rem 0 0.6rem' }}>
          <img src={fig20} width={1390} height={425} alt="The notebook's figure: model 1's 12-month predictions on test sequences 95, 259 and 140, input solid, target dashed with dots, predictions dotted with crosses" />
          <figcaption className="dlp2-fig__print">
            <b>Figure · {outLabel(codeCell('s6', 2))}, repeated from section 6</b> · {FIG_CAPTIONS['cell20_0.png']}
          </figcaption>
        </figure>
        <P>
          Model 1’s figure above, borrowed from section 6 ahead of time, is the first of the four that use <code>SHOW</code>; the dotted
          crosses are its forecasts.{' '}
          <R c={codeCell('s6', 2)} /> Holding the rows fixed is what lets the text compare models on the same months, as plate 6·2 does
          with sequence 95’s winter.
        </P>
      </Row>
    </Plate>
  );
}
