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
        <div className="hp-footer__end">
          <p className="hp-footer__meta">
            © {new Date().getFullYear()}
          </p>
          {/* Management portal entrance — subtle, but discoverable in the
              footer row (reveals its label on hover/focus). */}
          <button
            className="hp-footer__portal"
            onClick={() => navigate('/portal')}
            aria-label="Open management portal"
          >
            <span className="hp-footer__portal-dot" aria-hidden="true" />
            <span className="hp-footer__portal-label">Portal</span>
          </button>
        </div>
      </div>

      {/* Hidden hub gate — intentionally low-contrast easter-egg entrance to /hub */}
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
