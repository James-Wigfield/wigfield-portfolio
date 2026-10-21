import { createContext, useContext } from 'react';

/* The study shell shares its state with the labs and notebook pages:
     stats        { per: { [id]: { done, total, complete } }, lines, pages }
     jumpTo(id, { nb })   scroll to a section (or its notebook page)
     outcomes / toggleOutcome   the slide-51 self-check (persisted)
     printing     true while the Read + Play PDF is being printed: a lab that
                  steps shows its finished (or most telling) step instead of
                  its own, without touching its state (print.js)            */
export const StudyCtx = createContext({
  stats: { per: {}, lines: 0, pages: 0 },
  jumpTo: () => {},
  outcomes: [],
  toggleOutcome: () => {},
  printing: false,
});

export const useStudy = () => useContext(StudyCtx);
