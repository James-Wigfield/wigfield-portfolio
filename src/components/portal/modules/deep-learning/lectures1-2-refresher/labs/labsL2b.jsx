import { Stage } from '../stage';

/* Placeholders for the six Lecture 2 labs (being built). */
function Stub({ title, slides }) {
  return <Stage title={title} slides={slides} tryThis="This lab is being built." own={null}><p className="dl12r-mnote">Coming soon.</p></Stage>;
}

export function ShootoutLab() { return <Stub title="Activation shoot-out" slides="L2 · slides 10–22" />; }
export function BatchNormLab() { return <Stub title="Batch normalization" slides="L2 · slides 23–24" />; }
export function ClipLab() { return <Stub title="Gradient clipping" slides="L2 · slide 29" />; }
export function SchedulesLab() { return <Stub title="Learning-rate schedules" slides="L2 · slides 50–59" />; }
export function PenaltiesLab() { return <Stub title="ℓ1 vs ℓ2" slides="L2 · slides 60–61" />; }
export function DropoutLab() { return <Stub title="Dropout" slides="L2 · slides 62–64" />; }
