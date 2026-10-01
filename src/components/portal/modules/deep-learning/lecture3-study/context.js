import { createContext, useContext } from 'react';

/* The study shell shares its state with the labs and notebook pages:
     stats        { per: { [id]: { done, total, complete } }, lines, pages }
     jumpTo(id, { nb })   scroll to a section (or its notebook page)
     outcomes / toggleOutcome   the slide-52 self-check (persisted)            */
export const StudyCtx = createContext({
  stats: { per: {}, lines: 0, pages: 0 },
  jumpTo: () => {},
  outcomes: [],
  toggleOutcome: () => {},
});

export const useStudy = () => useContext(StudyCtx);
