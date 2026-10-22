import { createContext, useContext } from 'react';

/* The study shell shares its state with the labs and notebook pages:
     stats        { per: { [id]: { done, total, complete } }, lines, pages }
     jumpTo(id, { nb })   scroll to a section (or its notebook page)
     outcomes / toggleOutcome   the slide-50 self-check (persisted)
     printing     true while Export PDF is printing: labs show a finished,
                  meaningful state (e.g. the trained model, not epoch 0)      */
export const StudyCtx = createContext({
  stats: { per: {}, lines: 0, pages: 0 },
  jumpTo: () => {},
  outcomes: [],
  toggleOutcome: () => {},
  printing: false,
});

export const useStudy = () => useContext(StudyCtx);
