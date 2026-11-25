/* A very small IndexedDB layer for Dream Rooms (database `dream-rooms`), trimmed from
   Memory Rooms' (no files here, so no Blob packing).

   Stores
     draft   keyPath key  'current' → the dream being typed: { key, id, text, dreamt_on, chosen, at }
     outbox  keyPath id   one saved dream waiting to upload: { id, row, state, attempts, createdAt, error }
     known   keyPath id   rows this phone knows about, numbers only: { id, dreamt_on, night_order, at }
                          (no words: it's only there to number the next dream of a night)

   If IndexedDB can't open at all (some private modes), everything falls back to in-memory
   maps so capture still works while the tab stays open (the page says so). */

const NAME = 'dream-rooms';
const VERSION = 1;
const STORES = { draft: 'key', outbox: 'id', known: 'id' };

let dbPromise = null;
const memory = new Map(Object.keys(STORES).map((s) => [s, new Map()]));

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let r;
      try {
        r = window.indexedDB.open(NAME, VERSION);
      } catch {
        resolve(null);
        return;
      }
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      // An older tab holding the database open can block an upgrade: never hang capture on it.
      const stuck = setTimeout(() => resolve(null), 5000);
      r.onsuccess = () => {
        clearTimeout(stuck);
        const db = r.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      r.onerror = () => {
        clearTimeout(stuck);
        resolve(null);
      };
    });
  }
  return dbPromise;
}

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** True when we're on the in-memory fallback (nothing survives a reload). */
export async function isVolatile() {
  return !(await open());
}

export async function getAll(store) {
  const db = await open();
  if (!db) return Array.from(memory.get(store).values());
  return done(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await open();
  if (!db) return memory.get(store).get(key) ?? null;
  return (await done(db.transaction(store).objectStore(store).get(key))) ?? null;
}

/**
 * One atomic write across several stores. `fn(w)` issues writes synchronously:
 * w.put(store, value), w.del(store, key), w.clear(store). Resolves when the transaction
 * commits (the data is on disk).
 */
export async function write(storeNames, fn) {
  const names = [].concat(storeNames);
  const db = await open();
  if (!db) {
    fn({
      put: (s, v) => memory.get(s).set(v[STORES[s]], v),
      del: (s, k) => memory.get(s).delete(k),
      clear: (s) => memory.get(s).clear(),
    });
    return;
  }
  await new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(names, 'readwrite');
      fn({
        put: (s, v) => t.objectStore(s).put(v),
        del: (s, k) => t.objectStore(s).delete(k),
        clear: (s) => t.objectStore(s).clear(),
      });
    } catch (err) {
      try {
        t?.abort();
      } catch {
        /* already finished */
      }
      reject(err);
      return;
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
  });
}

export const put = (store, value) => write(store, (w) => w.put(store, value));
export const del = (store, key) => write(store, (w) => w.del(store, key));
