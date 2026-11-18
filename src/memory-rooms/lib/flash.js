/* One-shot notes carried across an in-app navigation, in memory only: the edit page
   sets `saved:<id>` before going back, and the spot page shows "Saved" once. */

let note = null;

export function setFlash(key) {
  note = key;
}

export const peekFlash = (key) => note === key;

export function clearFlash(key) {
  if (note === key) note = null;
}
