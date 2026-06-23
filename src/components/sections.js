// Single source of truth for the home page's chapter list.
// Used by Navbar (links) and ChapterRail (the scroll-progress spine) so the
// two can never drift out of sync. Order here === render order in App.jsx.
export const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'work', label: 'Work' },
  { id: 'skills', label: 'Toolkit' },
  { id: 'projects', label: 'Projects' },
  { id: 'research', label: 'Research' },
  { id: 'contact', label: 'Contact' },
];
