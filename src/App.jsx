import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/home.css';
import Navbar from './components/Navbar';
import ChapterRail from './components/ChapterRail';
import Hero from './components/Hero';
import Research from './components/Research';
import About from './components/About';
import Experience from './components/Experience';
import Projects from './components/Projects';
import Skills from './components/Skills';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Hub from './components/Hub';
import Games from './components/Games';
import Olympics from './components/Olympics';
import UniversityModule from './components/UniversityModule';
import CITS4404 from './components/modules/CITS4404';
import CITS5508 from './components/modules/CITS5508';
import Honours from './components/modules/HONOURS';
import ImposterGame from './components/games/ImposterGame';
import PartyImposter from './components/games/PartyImposter';
import CampfireGame from './components/games/CampfireGame';
import Artemis2 from './components/games/Artemis2';
import RapGame from './components/games/RapGame';
import ChaosReactor from './components/games/ChaosReactor';
import TwinFlames from './components/games/TwinFlames';
import Overmind from './components/games/Overmind';
import Portal from './components/portal/Portal';

// Portara landing-page sandbox (src/portara-test/README.md). Lazy so three.js
// and the landing stylesheets never load for the rest of the site.
const PortaraTest = lazy(() => import('./portara-test/index.tsx'));

function Portfolio() {
  // Tag <html> while the home route is mounted so home.css can override the
  // global cyberpunk scrollbar (index.css) for the Reading Room only.
  useEffect(() => {
    document.documentElement.classList.add('hp-active');
    return () => document.documentElement.classList.remove('hp-active');
  }, []);

  return (
    <div className="hp">
      <Navbar />
      <ChapterRail />
      <main>
        <Hero />
        <About />
        <Experience />
        <Skills />
        <Projects />
        <Research />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portfolio />} />
      {/* Public party page — intentionally NOT behind the PinGate that protects /hub and /games */}
      <Route path="/olympics" element={<Olympics />} />
      <Route path="/hub" element={<Hub />} />
      <Route path="/hub/cits4404" element={<CITS4404 />} />
      <Route path="/hub/cits5508" element={<CITS5508 />} />
      <Route path="/hub/honours" element={<Honours />} />
      <Route path="/hub/:moduleId" element={<UniversityModule />} />
      <Route path="/games" element={<Games />} />
      <Route path="/games/imposter" element={<ImposterGame />} />
      <Route path="/games/party-imposter" element={<PartyImposter />} />
      <Route path="/games/campfire" element={<CampfireGame />} />
      <Route path="/games/artemis2" element={<Artemis2 />} />
      <Route path="/games/freestyle" element={<RapGame />} />
      <Route path="/games/chaos" element={<ChaosReactor />} />
      <Route path="/games/twin-flames" element={<TwinFlames />} />
      <Route path="/games/overmind" element={<Overmind />} />
      {/* Private management portal — gated client-side (placeholder for Supabase Auth) */}
      <Route path="/portal" element={<Portal />} />
      {/* Portara home page sandbox - a mirror of portara-repo's landing page, see src/portara-test.
          The fallback paints the landing page's ground while the lazy chunk loads, so the
          first frames are its light grey rather than the portfolio's navy. */}
      <Route
        path="/portara-test"
        element={
          <Suspense fallback={<div style={{ minHeight: '100vh', background: '#e8edf0' }} />}>
            <PortaraTest />
          </Suspense>
        }
      />
    </Routes>
  );
}
