import { useJson } from '../engine/hooks';
import { DotLog } from './charts';
import { REFS } from './refs';

/* Components used by the shared backup slides (kept apart from backups.jsx so
   that file exports data only). Reference entries are bibliographic text
   (volumes, pages, arXiv ids), marked data-tick so gate G1 skips them. */

export function FairDots({ collapse = 0, bands = true, width = 1180, height = 560 }) {
  const d = useJson('data/fair-per-case.json');
  return <DotLog data={d?.cases ?? []} width={width} height={height} yMin={-60} yMax={60} bands={bands} collapse={collapse} />;
}

export function RefList({ ctx }) {
  const keys = ctx.info.refOrder;
  return (
    <ol className="sd-bk-refs" data-req="references">
      {keys.map((k) => (
        <li key={k} data-role="foot" data-tick=""><span className="sd-bk-refs__n">[{ctx.refNum(k)}]</span> {REFS[k]?.ieee}</li>
      ))}
    </ol>
  );
}
