import { useRemoteScreen } from './useRemoteScreen';
import './remote.css';

/* ============================================================================
   SEMINAR DECKS — PHONE REMOTE, LAPTOP SIDE: the component that holds the hook
   ----------------------------------------------------------------------------
   Present mode renders it with no chip (it draws nothing, and sits outside the
   present overlay); the presenter view renders it with `chip`, a small plain
   status in its own top bar on the laptop screen. Always inside a
   RemoteBoundary, so a remote bug can never take the slides down with it.
   ========================================================================== */

const CHIP = {
  linked: ['good', 'Phone linked'],
  waiting: ['idle', 'Phone not linked'],
  connecting: ['idle', 'Remote connecting'],
  offline: ['warn', 'Remote offline: the keys still work'],
  ended: ['idle', 'Remote ended'],
};

export default function RemoteScreen({ slug, seq, ctl, chip = false }) {
  const info = useRemoteScreen({ slug, seq, ctl });
  if (!chip || !info || !CHIP[info.status]) return null;
  const [tone, text] = CHIP[info.status];
  return (
    <span className={`sd-remote-chip is-${tone}`} role="status" data-remote={info.status}>
      <i aria-hidden="true" />
      {info.status === 'linked' && info.phones > 1 ? `${info.phones} phones linked` : text}
    </span>
  );
}
