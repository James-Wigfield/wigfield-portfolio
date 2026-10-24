/* Helpers shared by the why cards and the games (kept out of WhyCard.jsx so
   Fast Refresh sees a components-only file). */
export function receipt(src) {
  if (!src) return '';
  const slides = (src.slides ?? []).slice().sort((a, b) => a - b);
  const lec = src.lecture === 6 ? 'Lectures 6–7' : `Lecture ${src.lecture}`;
  if (!slides.length) return lec;
  return `${lec} · slide${slides.length > 1 ? 's' : ''} ${slides.join(', ')}`;
}

export function fmtAnswer(item, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof item?.format === 'function') return item.format(v);
  if (item?.kind === 'choice') return item.choices?.find((c) => c.value === v)?.label ?? String(v);
  if (Array.isArray(v)) return v.map((x) => (x === null ? 'None' : x)).join(' × ');
  if (typeof v === 'number') return v.toLocaleString('en-AU');
  return String(v);
}

