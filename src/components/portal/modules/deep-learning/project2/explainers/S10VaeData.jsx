import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import MaxChannelScene from './scenes/MaxChannel';

/* ============================================================================
   PLATE 10·1 — one channel, one scale  (§10 VAE data preparation, In [20])
   ========================================================================== */

export function MaxChannelPlate({ meta }) {
  const prep = codeCell('s10', 0); // In [20]
  const notes = mdCell('s10', 0); // cell 41
  return (
    <Plate meta={meta} cells={sectionRange('s10')}>
      <Row label="Task">
        <p className="dlp2-task">Prepare the 84-month maximum temperature sequences for the VAE, with a training and a validation set.</p>
      </Row>
      <Row label="How it works" wide>
        <MaxChannelScene />
      </Row>
      <Row label="What the notebook did">
        <P>
          In [20] slices channel 1 out of the raw sequences, <code>train_seq[:, :, 1]</code> and <code>val_seq[:, :, 1]</code>, then takes one
          mean and one standard deviation over every training value and standardises both sets with them:{' '}
          <code>z_train = (x_train_max − MAX_MEAN) / MAX_STD</code>. <R c={prep} code />
        </P>
        <P>
          Part (ii) asks for maximum temperatures only, so the minimum channel is dropped <R c={40} />. The sequences stay whole at
          84 months because there is nothing to forecast: the VAE is trained to give back its own input,{' '}
          <code>train_model(vae, z_train, z_train, z_val, z_val, …)</code>. <R c={codeCell('s11', 1)} code />
        </P>
        <P>
          This time the scaling sits outside the model. The decoder’s output is linear and in z-score units, so the reconstruction MSE is on
          a scale the KL term (the VAE’s second loss term, plate 11·3) can be weighed against, and decoded sequences are multiplied back, <code>× MAX_STD + MAX_MEAN</code>, for the
          plots and the statistics in section 12 <R c={notes} />. Section 11 then sets the KL weight, 0.5/84, against that per-month MSE{' '}
          <R c={mdCell('s11', 0)} />. In part (i) the opposite choice kept every loss in °C².
        </P>
      </Row>
      <Row label="What came out">
        <div className="dlp2-figs">
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">(1522, 84)</span><span className="dlp2-fignum__k">training set <R c={prep} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">(313, 84)</span><span className="dlp2-fignum__k">validation set <R c={prep} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">24.70</span><span className="dlp2-fignum__k">mean °C <R c={prep} /></span></div>
          <div className="dlp2-fignum"><span className="dlp2-fignum__v">5.11</span><span className="dlp2-fignum__k">std °C <R c={prep} /></span></div>
        </div>
        <P>
          Part (i)’s maximum channel had mean 24.69 and standard deviation 5.1 <R c={codeCell('s5', 0)} />, which is 5.10 to two places;
          NumPy drops the trailing zero <R src="handover" />. The second decimal moves because a different set of months is pooled: part (i)
          used <code>X_train</code>, months 1–72 of each window, and this cell uses all 84. Section 2’s summary over all 84 months, 24.7 and
          5.1, agrees with this one <R c={codeCell('s2', 1)} />.
        </P>
        <P>
          The notebook states the assumptions behind the setup: an 84-month window of maximums from any of the three training stations is
          a sample from one shared process, a handful of numbers can describe it, and a standard normal prior is a fair distribution for
          those numbers. <R c={notes} />
        </P>
      </Row>
    </Plate>
  );
}
