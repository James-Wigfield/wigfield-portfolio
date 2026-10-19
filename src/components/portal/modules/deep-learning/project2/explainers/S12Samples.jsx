import { Plate, Row, R, P } from '../scene/Plate';
import { sectionRange, codeCell, mdCell } from '../nbutil';
import PriorScene from './scenes/Prior';
import BlurScene from './scenes/Blur';

/* ============================================================================
   PLATES 12·1–12·2 — synthesised sequences  (§12)
   12·1 six draws from the prior, the notebook's figure, the 500-sample table
   12·2 why the samples are smooth (MSE averaging) and why some are flat (the
        notebook's untested phase-ring hypothesis)
   ========================================================================== */

export function SamplesPlate({ meta }) {
  const code = codeCell('s12', 0);
  const intro = mdCell('s12', 0);
  const disc = mdCell('s12', 1);
  return (
    <Plate meta={meta} cells={sectionRange('s12')}>
      <Row label="Task">
        <p className="dlp2-task">
          Illustrate 6 synthesised temperature sequences in 2 × 3 subplots by randomly sampling 6 codings vectors. <R src="brief" />
        </p>
      </Row>
      <Row label="How it works" wide>
        <PriorScene id="samples" />
      </Row>
      <Row label="What the notebook did">
        <P>
          <code>keras.random.normal(shape=(6, CODINGS_SIZE))</code> draws six codes from the prior N(0, I). The decoder turns each into
          84 z-scores, and <code>* MAX_STD + MAX_MEAN</code> (5.11 and 24.70 <R c={codeCell('s10', 0)} />) puts them back in °C.{' '}
          <code>plot_sequences</code> draws any batch in a three-column grid with shared axes; it is used for the six samples and then
          for six real training sequences picked with <code>np.random.choice</code>. <R c={code} code />
        </P>
        <P>
          Beyond the six, 500 more codes are decoded and compared with all 1522 real training
          sequences on five statistics: the mean level, the spread of the sequence means, the peak-to-trough range, the share with a
          range under 10 °C and the average month-to-month change. <R c={intro} />
        </P>
        <P>
          “sequence k” in both figures is the panel’s place in the grid. The samples have no data row, and the six real ones are random
          rows.
        </P>
      </Row>
      <Row label="What came out">
        <P>
          The six have the right basic shape: seven annual cycles, peaks about 12 months apart, maximums between about 16 and 35 °C.
          They differ in phase (sequence 1 starts near a summer peak, sequence 5 in a winter trough), in level and in amplitude
          (sequence 2 swings between 16 and 35, sequence 6 between 19 and 29). <R c={disc} />
        </P>
        <P>
          Over 500 samples the mean level is 24.5 against 24.7 for the real sequences, and the spread of sequence means is 0.62 against
          0.56: slightly more spread than the real data, not less. The ranges are where they part, 12.6 °C on average against 17.2,
          with 21% under 10 °C against none, and month-to-month steps of 2.03 against 2.48. <R c={code} />
        </P>
        <P>
          The flattest sample, a range of 1.8, is in the statistics but not among the six plotted. Of the six, sequences 3 and 6 swing
          only about 10 to 11 °C, already below the smallest real range of 14.4. <R c={code} /> <R c={disc} />
        </P>
      </Row>
    </Plate>
  );
}

export function BlurPlate({ meta }) {
  const disc = mdCell('s12', 1);
  return (
    <Plate meta={meta} cells={sectionRange('s12')}>
      <Row label="Task">
        <p className="dlp2-task">
          Do the synthesised temperature sequences look realistic? Give a brief explanation of the results. <R src="brief" />
        </p>
      </Row>
      <Row label="How it works" wide>
        <BlurScene id="blur" />
      </Row>
      <Row label="What the notebook did">
        <P>
          Its answer is “partly”. The levels are right, so the mix of warmer and cooler windows is about what the stations produce, but
          two things give the samples away. <R c={disc} />
        </P>
        <P>
          They are too smooth. Real sequences have jagged peaks and single hot months; the samples are clean waves, with a range 4.6 °C
          smaller than the real average and smaller steps from month to month. The notebook calls this the usual VAE blur: with an MSE
          reconstruction loss the decoder learns the average sequence for a given code, and the month-to-month noise averages out{' '}
          <R c={disc} />. The tuning log adds that the samples’ range stayed about 12 to 13 °C at every KL weight tried, so the blur
          comes from the decoder, not the weight <R src="log" />.
        </P>
        <P>
          Some are degenerate: one in five has a range under 10 °C. The notebook’s explanation is that the phase is circular. If the
          encoder maps the start month onto a ring in two codings, codes near the middle of the ring, which the prior produces often,
          decode to the average over all phases, which is a flat line. It says plainly that it has not checked this by plotting the codes.
          A weaker KL weight made flat samples more common and a stronger one collapsed the level coding, so it reads the flat samples as
          a limit of this setup rather than something tuning would fix. <R c={disc} />
        </P>
        <P>
          On this explainer’s reading, if the ring is real this is where the KL pull falls short: it pulls each sequence’s
          distribution towards N(0, I), but the real codes would still sit on a ring, and the prior’s densest region would be the
          ring’s empty middle.
        </P>
        <P>
          Why a weaker weight gives more flat samples has one reading, offered in the tuning log and not tested: a weaker pull
          sharpens the ring <R src="log" />. This explainer’s gloss on that: more of the prior’s draws would then land inside the
          ring, away from every real code.
        </P>
      </Row>
      <Row label="What came out">
        <P>
          The VAE has learned the climatology of a Perth maximum-temperature series, with a believable spread of levels and phases and a
          somewhat squashed spread of amplitudes, but not the weather on top of it. To synthesise rough-looking data the notebook would
          add noise around the decoded mean or give the decoder more capacity near the output. <R c={disc} /> The summary puts about a
          fifth of the prior samples as too flat to pass for real. <R c={mdCell('s13', 0)} />
        </P>
        <P>
          A check made during review, not part of the submitted notebook, used a CPU re-run whose VAE differs slightly from the saved
          one. It found one active coding tracking the sequence level (r = 0.99) and the other two forming the phase ring (r = 0.93
          and 0.92 with the sine and cosine of the start month), with the flat samples near the centre of the ring. <R src="handover" />
        </P>
      </Row>
    </Plate>
  );
}
