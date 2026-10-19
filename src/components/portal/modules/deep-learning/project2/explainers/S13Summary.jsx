import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import TransferScene from './scenes/Transfer';

/* ============================================================================
   PLATE 13·1 — Swanbourne to Bickley  (§13 Summary)
   The summary table as a slope chart (Out [19] for 12 months on validation
   and test, Out [18] for 24 months), then the closing ledger: what worked,
   what didn't, what limited it, in the notebook's own terms (cells 39, 50).
   ========================================================================== */

const C_BASE = codeCell('s9', 0); // Out [18]
const C_LEAD = codeCell('s9', 1); // Out [19]
const M_DISC = mdCell('s9', 1); // cell 39
const M_SUM = mdCell('s13', 0); // cell 50
const M_DATA = mdCell('s2', 1); // cell 6: windows are not independent
const M_M3 = mdCell('s8', 1); // cell 33: teacher-forced curves are optimistic

const TH = { verticalAlign: 'top', paddingTop: '0.5rem', whiteSpace: 'nowrap' };

export function TransferPlate({ meta }) {
  return (
    <Plate meta={meta} cells={sectionRange('s13')}>
      <Row label="Task">
        <p className="dlp2-task">
          Pull the project together: how each model did on the validation station, on the test station and at 24 months, and what
          held the results back.
        </p>
      </Row>
      <Row label="How it works" wide>
        <TransferScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          Section 13’s table, just above this plate, sets the 12-month validation and test MAEs printed by section 9’s second cell{' '}
          <R c={C_LEAD} /> beside the 24-month test MAEs from its first <R c={C_BASE} />, with the two baselines as the scale; the
          diagram plots it. The section closes with one paragraph covering both parts. <R c={M_SUM} />
        </P>
        <P>
          Every model choice was made on Swanbourne <R src="log" />, so the two test columns are the first time each model met
          Bickley.
        </P>
      </Row>
      <Row label="What came out">
        <table className="dlp2-tbl">
          <tbody>
            <tr>
              <th scope="row" style={TH}>worked</th>
              <td>
                All three GRU models learn the annual cycle. <R c={M_SUM} /> Models 1 and 2 forecast Swanbourne about as well as the
                average of its own past six years (within 0.03 °C: 0.988 and 0.982 against climatology’s 0.967); model 3 is 0.2
                behind. <R c={C_LEAD} /> <R c={M_DISC} /> Model 1 was the best of the three on the test set, and model 3 beat model 2 at
                every horizon. The VAE produces smooth, plausibly varied annual cycles at the right level. <R c={M_SUM} />
              </td>
            </tr>
            <tr>
              <th scope="row" style={TH}>didn’t</th>
              <td>
                On Bickley every model over-predicts the maximums by about a degree and finishes behind both parameter-free
                baselines. Model 3 deteriorates faster once pushed past the 12 steps it was trained for, worse than model 2 month by
                month from lead month 19. The VAE misses the month-to-month roughness of real data, and about a fifth of its prior
                samples are too flat to pass for real. <R c={M_SUM} /> <R c={M_DISC} />
              </td>
            </tr>
            <tr>
              <th scope="row" style={TH}>limited it</th>
              <td>
                The models see absolute temperatures and have to infer a station’s level from 72 months, while the three training
                stations cover a narrow band of levels, so a cooler station is extrapolation. Predicting deviations from each window’s own
                average year would make the models level-invariant; the notebook names it as the first thing to try next and leaves
                it untried (plate 9·4). <R c={M_DISC} /> The test MAE is the error
                over one station’s overlapping windows rather than 297 separate cases <R c={M_DATA} />, model 3’s training curves
                are teacher-forced and optimistic by about 0.2 °C <R c={M_M3} />, and model 3 was the noisiest model across seeds in
                tuning: its free-running validation MAE ran from 1.09 to 1.25 over five seeds (mean 1.185). <R src="log" />
              </td>
            </tr>
          </tbody>
        </table>
      </Row>
    </Plate>
  );
}
