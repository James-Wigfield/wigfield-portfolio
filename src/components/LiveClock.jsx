import { useState, useEffect } from 'react';

/* A small "instrument readout" detail: the current time in Perth (AWST, UTC+8,
   no daylight saving). Updates every 15s — enough for a minute display. */
function perthTime() {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export default function LiveClock() {
  const [t, setT] = useState(perthTime);

  useEffect(() => {
    const id = setInterval(() => setT(perthTime()), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="hp-hero__meta-clock">
      <b>Perth</b> {t} <span className="hp-hero__meta-tz">AWST</span>
    </span>
  );
}
