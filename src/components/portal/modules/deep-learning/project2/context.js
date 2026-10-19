import { createContext, useContext } from 'react';

/* The notebook view hands explainers a way to scroll to a cell or heading
   without each one knowing about the sticky header. */
export const NbCtx = createContext({ jumpTo: () => {} });
export const useNb = () => useContext(NbCtx);

export const cellDomId = (i) => `dlp2-cell-${i}`;
export const plateDomId = (id) => `dlp2-plate-${id}`;
