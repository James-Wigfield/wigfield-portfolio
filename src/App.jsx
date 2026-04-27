import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Experience from './components/Experience';
import Projects from './components/Projects';
import Skills from './components/Skills';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Hub from './components/Hub';
import Games from './components/Games';
import UniversityModule from './components/UniversityModule';
import CITS4404 from './components/modules/CITS4404';
import CITS5508 from './components/modules/CITS5508';
import Honours from './components/modules/HONOURS';
import ImposterGame from './components/games/ImposterGame';
import CampfireGame from './components/games/CampfireGame';
import Artemis2 from './components/games/Artemis2';

function Portfolio() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Experience />
        <Projects />
        <Skills />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portfolio />} />
      <Route path="/hub" element={<Hub />} />
      <Route path="/hub/cits4404" element={<CITS4404 />} />
      <Route path="/hub/cits5508" element={<CITS5508 />} />
      <Route path="/hub/honours" element={<Honours />} />
      <Route path="/hub/:moduleId" element={<UniversityModule />} />
      <Route path="/games" element={<Games />} />
      <Route path="/games/imposter" element={<ImposterGame />} />
      <Route path="/games/campfire" element={<CampfireGame />} />
      <Route path="/games/artemis2" element={<Artemis2 />} />
    </Routes>
  );
}
