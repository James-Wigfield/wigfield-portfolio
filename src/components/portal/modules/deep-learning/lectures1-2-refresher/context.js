import { createContext, useContext } from 'react';

/* The study shell shares its state with the labs and notebook pages:
     stats        { per: { [pageId]: { done, total, complete } }, lines, pages }
     jumpTo(id)   scroll to a section or notebook page
     printing     true while Export PDF is printing: labs show a finished,
                  meaningful state (e.g. the trained perceptron, not step 0)  */
export const StudyCtx = createContext({
  stats: { per: {}, lines: 0, pages: 0 },
  jumpTo: () => {},
  printing: false,
});

export const useStudy = () => useContext(StudyCtx);
