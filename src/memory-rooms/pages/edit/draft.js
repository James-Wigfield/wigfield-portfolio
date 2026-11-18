/* What's typed on the edit page, kept per spot in sessionStorage until it's saved or
   discarded: a reload, iOS dropping the tab, or the phone's back gesture loses nothing.
   It holds the base too (the spot as the form opened), so the page opens offline from
   it and a stale base still meets the Worker's 409. Never throws (private mode). */

const KEY = (id) => `mr:edit:${id}`;

export function readDraft(id) {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(KEY(id)) || 'null');
    return v?.v === 1 && v.base && v.form ? v : null;
  } catch {
    return null;
  }
}

export function writeDraft(id, base, form) {
  try {
    window.sessionStorage.setItem(KEY(id), JSON.stringify({ v: 1, base, form }));
  } catch {
    /* storage full or blocked: the form still works while the page stays open */
  }
}

export function clearDraft(id) {
  try {
    window.sessionStorage.removeItem(KEY(id));
  } catch {
    /* nothing stored */
  }
}
