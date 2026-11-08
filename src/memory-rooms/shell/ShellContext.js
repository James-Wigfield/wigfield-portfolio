import { createContext, useContext } from 'react';

/** What the shell gives every page: the device's person and a way to change it. */
export const ShellContext = createContext({ who: null, changeWho: () => {} });

export const useShell = () => useContext(ShellContext);
