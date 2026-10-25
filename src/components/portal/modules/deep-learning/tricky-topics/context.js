import { createContext, useContext } from 'react';

/* The topic shell shares its state with the labs, drills and notebook pages:
     topicId      the topic on show (labs never need it, links do)
     jumpTo(id, { nb })   scroll to a step (or a notebook page) of this topic
     goTopic(id, stepId?) open another topic's tab (cross-topic links go
                  through the shell by id; a topic never imports another)
     printing     true while Export PDF is printing: labs show a finished,
                  meaningful state, drills show their worked set           */
export const StudyCtx = createContext({
  topicId: '',
  jumpTo: () => {},
  goTopic: () => {},
  printing: false,
});

export const useStudy = () => useContext(StudyCtx);

/* The topic's line-art figures for its notebook pages and Read beats:
   { [key]: Component } from topics/<id>/figs.jsx, provided by the shell so
   Diagram.jsx can draw `{ fig: 'key' }` without importing the topic. */
export const FigsCtx = createContext({});
export const useFigs = () => useContext(FigsCtx);
