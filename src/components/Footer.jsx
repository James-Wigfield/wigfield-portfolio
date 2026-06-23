import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="hp-footer">
      <div className="hp-footer__inner">
        <button
          className="hp-footer__brand"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          <span>/</span> James Wigfield
        </button>
        <p className="hp-footer__meta">
          © {new Date().getFullYear()} · Built in Perth with React + Vite<br />
          Set in Fraunces &amp; IBM Plex Mono
        </p>
      </div>

      {/* Hidden hub gate — intentionally low-contrast entrance to /hub */}
      <button
        className="hp-footer__gate"
        onClick={() => navigate('/hub')}
        aria-label="hub"
        tabIndex={-1}
      >
        ·
      </button>
    </footer>
  );
}
