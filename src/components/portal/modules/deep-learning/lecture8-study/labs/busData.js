import { useEffect, useState } from 'react';

/* The page's own bus/rail runs (../data/busrail.js, ~20 KB), loaded once on
   demand and shared by the §3–§5 labs. Print waits for the same import
   (print.js), so the PDF shows the trained state. */
let cache = null;
let pending = null;

export function loadBusRail() {
  if (!pending) pending = import('../data/busrail.js').then((m) => { cache = m; return m; });
  return pending;
}

export function useBusRail() {
  const [data, setData] = useState(cache);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (cache) return undefined;
    let live = true;
    loadBusRail().then((m) => { if (live) setData(m); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  return { data, failed };
}

const DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// the date `n` days after an ISO day, as "26 Feb"
export function dayLabel(iso, n = 0) {
  const d = new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const SERIES = ['bus', 'rail'];
export const thousands = (x) => `${Math.round(x / 1000)}k`;
