/* PROJECTOR LIFE — the few stage-toolbar glyphs the portal's icon set lacks
   (reseed, clear, camera, reset, copy). Single-colour line icons drawn to the
   same 24-unit grid and stroke as src/components/portal/icons.jsx. */

const PATHS = {
  // a sprout: reseed
  reseed: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6Z" />
      <path d="M12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z" />
    </>
  ),
  // an eraser: clear
  clear: (
    <>
      <path d="m7 21-4-4 10-10 7 7-7 7Z" />
      <path d="M9 21h12" />
      <path d="m8.5 11.5 7 7" />
    </>
  ),
  // a camera: save PNG
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  // anticlockwise arrow: reset
  reset: (
    <>
      <path d="M4 5v5h5" />
      <path d="M5.5 15a7 7 0 1 0 1.2-7.4L4 10" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5 15V5a1 1 0 0 1 1-1h9" />
    </>
  ),
  step: (
    <>
      <path d="M6 5v14l9-7Z" />
      <path d="M18 5v14" />
    </>
  ),
  chevL: <path d="m15 6-6 6 6 6" />,
  chevR: <path d="m9 6 6 6-6 6" />,
};

export default function Glyph({ name, size = 16, strokeWidth = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
