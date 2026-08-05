import { useState, useEffect } from 'react';
import { SECTIONS } from './sections';

const LINKS = SECTIONS;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [overCover, setOverCover] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      // Light-on-dark treatment while the bar sits over the hero cover
      setOverCover(window.scrollY < window.innerHeight - 90);
      let current = '';
      for (const { id } of LINKS) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 160) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <>
      <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}${overCover ? ' hp-nav--cover' : ''}`}>
        <div className="hp-nav__inner">
          <button
            className="hp-nav__brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
          >
            <span className="hp-nav__brand-mark">JW</span>
            <span className="hp-nav__brand-sub">James Wigfield</span>
          </button>

          <div className="hp-nav__links">
            {LINKS.map((l) => (
              <button
                key={l.id}
                className={`hp-nav__link${active === l.id ? ' hp-nav__link--active' : ''}`}
                onClick={() => go(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            className={`hp-nav__burger${menuOpen ? ' hp-nav__burger--open' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`hp-menu${menuOpen ? ' hp-menu--open' : ''}`} aria-hidden={!menuOpen}>
        <div className="hp-menu__inner">
          {LINKS.map((l, i) => (
            <button key={l.id} className="hp-menu__link" onClick={() => go(l.id)}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
