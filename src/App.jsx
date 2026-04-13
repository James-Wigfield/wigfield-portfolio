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
import UniversityModule from './components/UniversityModule';
import CITS4404 from './components/modules/CITS4404';
import CITS5508 from './components/modules/CITS5508';
import Honours from './components/modules/HONOURS';

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
    </Routes>
  );
}
