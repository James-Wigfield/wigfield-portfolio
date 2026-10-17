import { MachineArt } from '../Machine';
import { M, KEY_TO_BUTTON } from '../geometry';
import { useScene } from '../sceneKit';
import Stage from '../Stage';

/* ============================================================================
   SCENE · BUTTON HOLD — every combo in the guide, at its real hold time
   ----------------------------------------------------------------------------
   The control panel zooms in, a fingertip lands on each button, a ring fills
   over the REAL hold (3 s cleaning cycle / 5 s descale), then the lights do
   what the manual documents. The IB documents descale lights (p.23); it
   doesn't document lights for the cleaning cycle, so that one only says the
   cycle has started.
   ========================================================================== */

const AFTER = {
  descale: {
    leds: { power: 'solid', two: 'solid', clean: 'solid', steam: 'solid' },
    heating: ['power', 'two'],
    ready: ['clean', 'steam'],
    beats: ['Machine off', 'Hold the buttons together', '[POWER] and [2 CUP] flash while it heats', 'All four solid: ready to descale'],
    end: 'READY · ALL FOUR SOLID',
  },
  cycle: {
    leds: {},
    beats: ['[POWER] off', 'Hold all three together', 'The cycle starts: about {5 min}'],
    end: 'CYCLE RUNNING · ~5 MIN',
  },
};

const R = 26;
const CIRC = 2 * Math.PI * R;

export default function ButtonHold({ keys, sec, after = 'cycle' }) {
  const spec = AFTER[after];
  const ids = keys.map((k) => KEY_TO_BUTTON[k]);

  const api = useScene(
    (tl, q, { cue }) => {
      const lit = Object.keys(spec.leds);
      const rings = lit.length ? q(lit.map((id) => `[data-led="${id}"] .bxi-led-ring, [data-led="${id}"] .bxi-led-glow`).join(',')) : [];
      const fingers = q('.bxi-bh-finger');
      const fill = q('.bxi-bh-fill');
      const camera = q('.bxi-bh-cam');
      if (rings.length) tl.set(rings, { opacity: 0 }, 0);
      tl.fromTo(camera, { attr: { viewBox: '180 96 180 124' } }, { attr: { viewBox: '254 116 96 66' }, duration: 0.9, ease: 'power2.inOut', immediateRender: true }, 0);
      cue(0, 0);
      tl.fromTo(fingers, { opacity: 0, scale: 1.8, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.08, immediateRender: true }, 0.9);
      cue(1, 1.1);
      tl.fromTo(q('.bxi-bh-holdlabel'), { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: true }, 1.1);
      tl.fromTo(fill, { strokeDashoffset: CIRC }, { strokeDashoffset: 0, duration: sec, ease: 'none', immediateRender: true }, 1.2);
      const held = 1.2 + sec;
      tl.fromTo(fingers, { opacity: 1 }, { opacity: 0, duration: 0.25 }, held);
      tl.fromTo(q('.bxi-bh-holdlabel'), { opacity: 1 }, { opacity: 0, duration: 0.2 }, held);
      if (after === 'descale') {
        cue(2, held + 0.2);
        const heat = q(spec.heating.map((id) => `[data-led="${id}"] .bxi-led-ring, [data-led="${id}"] .bxi-led-glow`).join(','));
        tl.fromTo(heat, { opacity: 0 }, { opacity: 1, duration: 0.05, repeat: 5, yoyo: true, repeatDelay: 0.32, immediateRender: false }, held + 0.25);
        tl.fromTo(q('.bxi-bh-heat'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, held + 0.25);
        const ready = held + 2.5;
        cue(3, ready);
        tl.fromTo(q('.bxi-bh-heat'), { opacity: 1 }, { opacity: 0, duration: 0.2 }, ready);
        tl.fromTo(rings, { opacity: 0 }, { opacity: 1, duration: 0.25, immediateRender: false }, ready);
        tl.fromTo(q('.bxi-bh-end'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, ready + 0.1);
      } else {
        cue(2, held + 0.2);
        tl.fromTo(q('.bxi-bh-end'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, held + 0.2);
      }
    },
    { name: `hold-${after}` },
  );

  return (
    <Stage
      {...api}
      name={`Hold · ${keys.join(' + ')} · ${sec} s`}
      label={`Hold ${keys.join(' plus ')} together for ${sec} seconds`}
      viewBox="0 0 320 132"
      beats={spec.beats}
      className="bxi-scene--hold"
    >
      <svg className="bxi-bh-cam" x="0" y="0" width="216" height="132" viewBox="254 116 96 66" preserveAspectRatio="xMidYMid meet">
        <MachineArt leds={spec.leds} portafilter="out" />
        {ids.map((id) => (
          <circle key={id} className="bxi-s-finger bxi-bh-finger" cx={M.buttons[id].x} cy={M.buttons[id].y} r="5.5" style={{ opacity: 0 }} />
        ))}
      </svg>
      <line className="bxi-s-faint" x1="220" y1="10" x2="220" y2="122" />
      <g transform="translate(270 56)">
        <circle className="bxi-s-ringtrack" r={R} />
        <circle className="bxi-s-ring bxi-bh-fill" r={R} strokeDasharray={CIRC} strokeDashoffset="0" transform="rotate(-90)" />
        <text className="bxi-s-big" y="5" textAnchor="middle">{sec} s</text>
      </g>
      <text className="bxi-s-label bxi-bh-holdlabel" x="270" y="104" textAnchor="middle" style={{ opacity: 0 }}>HOLD</text>
      <text className="bxi-s-label bxi-s-label--accent bxi-bh-heat" x="270" y="104" textAnchor="middle" style={{ opacity: 0 }}>HEATING · FLASHING</text>
      <text className="bxi-s-label bxi-s-label--strong bxi-bh-end" x="270" y="118" textAnchor="middle">{spec.end}</text>
    </Stage>
  );
}
