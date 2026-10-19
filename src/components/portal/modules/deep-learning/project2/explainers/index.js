/* ============================================================================
   DL PROJECT 2 — EXPLAINER REGISTRY
   ----------------------------------------------------------------------------
   Which plates sit under which notebook section, in order. A section key comes
   from the extractor ('title', 's1' … 's13'); its plates render after the
   section's last cell, before the next heading. This list is the single
   source of each plate's id, number and title: the contents rail reads it and
   every plate component receives its entry as `meta`.
   ========================================================================== */
import * as S00 from './S00Overview';
import * as S01 from './S01Setup';
import * as S02 from './S02Loading';
import * as S03 from './S03Split';
import * as S04 from './S04Visualise';
import * as S05 from './S05Helpers';
import * as S06 from './S06Model1';
import * as S07 from './S07Model2';
import * as S08 from './S08Model3';
import * as S09 from './S09Horizons';
import * as S10 from './S10VaeData';
import * as S11 from './S11Vae';
import * as S12 from './S12Samples';
import * as S13 from './S13Summary';

const KICKER = {
  title: 'Overview',
  s1: 'Setup',
  s2: 'Loading the data',
  s3: 'Splitting',
  s4: 'Visualising',
  s5: 'Shared helpers',
  s6: 'Model 1',
  s7: 'Model 2',
  s8: 'Model 3',
  s9: 'Horizons',
  s10: 'VAE data',
  s11: 'VAE model',
  s12: 'Synthesised sequences',
  s13: 'Summary',
};

export const PLATES = [
  { section: 'title', id: 'project', no: '0·1', title: 'The project in one picture', Component: S00.ProjectPlate },
  { section: 'title', id: 'stations', no: '0·2', title: 'Five stations, three splits', Component: S00.StationsPlate },
  { section: 's1', id: 'seed', no: '1·1', title: 'Same seed, same numbers', Component: S01.SeedPlate },
  { section: 's2', id: 'tensor', no: '2·1', title: 'One block of numbers', Component: S02.TensorPlate },
  { section: 's2', id: 'windows', no: '2·2', title: 'Windows that overlap', Component: S02.WindowsPlate },
  { section: 's2', id: 'climates', no: '2·3', title: 'Three climates', Component: S02.ClimatesPlate },
  { section: 's3', id: 'split', no: '3·1', title: 'Cutting a sequence into input and target', Component: S03.SplitPlate },
  { section: 's4', id: 'panel', no: '4·1', title: 'Reading a display_temperatures panel', Component: S04.PanelPlate },
  { section: 's5', id: 'scaling', no: '5·1', title: 'Scaling inside the model', Component: S05.ScalingPlate },
  { section: 's5', id: 'early-stop', no: '5·2', title: 'Early stopping and the rewind', Component: S05.EarlyStopPlate },
  { section: 's5', id: 'curves', no: '5·3', title: 'Reading a learning curve', Component: S05.CurveReadingPlate },
  { section: 's6', id: 'm1-gru', no: '6·1', title: 'Inside a GRU cell', Component: S06.GruPlate },
  { section: 's6', id: 'm1-unroll', no: '6·2', title: 'Seventy-two steps, two layers, one Dense', Component: S06.UnrollPlate },
  { section: 's7', id: 'm2-lr', no: '7·1', title: 'A faster learning rate for model 2, and its price', Component: S07.LearningRatePlate },
  { section: 's7', id: 'm2-recursion', no: '7·2', title: 'Twelve months, one month at a time', Component: S07.RecursionPlate },
  { section: 's8', id: 'm3-state', no: '8·1', title: 'What a GRU layer hands back', Component: S08.StatePlate },
  { section: 's8', id: 'm3-encdec', no: '8·2', title: 'Teacher forcing against free running', Component: S08.EncDecPlate },
  { section: 's8', id: 'm3-optimism', no: '8·3', title: 'Why the curves flatter model 3', Component: S08.OptimismPlate },
  { section: 's9', id: 'baselines', no: '9·1', title: 'Two baselines from the input alone', Component: S09.BaselinesPlate },
  { section: 's9', id: 'horizons', no: '9·2', title: 'Error against horizon', Component: S09.HorizonsPlate },
  { section: 's9', id: 'lead-months', no: '9·3', title: 'Averages hide the last months', Component: S09.LeadMonthsPlate },
  { section: 's9', id: 'bias', no: '9·4', title: 'Why every model loses at Bickley', Component: S09.BiasPlate },
  { section: 's10', id: 'max-channel', no: '10·1', title: 'One channel, one scale', Component: S10.MaxChannelPlate },
  { section: 's11', id: 'vae-shape', no: '11·1', title: 'Squeezing 84 months into 4 numbers', Component: S11.VaeShapePlate },
  { section: 's11', id: 'vae-reparam', no: '11·2', title: 'The reparameterisation trick', Component: S11.ReparamPlate },
  { section: 's11', id: 'vae-kl', no: '11·3', title: 'The KL pull, and one dead dimension', Component: S11.KlPlate },
  { section: 's12', id: 'samples', no: '12·1', title: 'Six draws from the prior', Component: S12.SamplesPlate },
  { section: 's12', id: 'blur', no: '12·2', title: 'Smooth waves and flat lines', Component: S12.BlurPlate },
  { section: 's13', id: 'transfer', no: '13·1', title: 'Swanbourne to Bickley', Component: S13.TransferPlate },
].map((p) => ({ kicker: KICKER[p.section], ...p }));

export const platesFor = (key) => PLATES.filter((p) => p.section === key);
