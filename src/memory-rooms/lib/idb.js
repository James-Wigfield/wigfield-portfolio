/* A very small IndexedDB layer for Memory Rooms (database `memory-rooms`).

   Stores
     outbox       keyPath id   one row per saved capture (small: spot fields + per-file flags)
     outboxFiles  keyPath key  `${spotId}|${type}|${n}` → { blob, width, height, contentType } (immutable)
     draft        keyPath key  'current' → the capture being filled in (fields + photo order)
     draftPhotos  keyPath id   one processed photo (photo + thumb blobs) or the 'scan' file

   If IndexedDB can't open at all (some private modes), everything falls back to
   in-memory maps so the app still works while the tab stays open. */

const NAME = 'memory-rooms';
const VERSION = 1;
const STORES = { outbox: 'id', outboxFiles: 'key', draft: 'key', draftPhotos: 'id' };

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
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      r.onerror = () => resolve(null);
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

/** Every row whose key starts with `prefix` (string keys). */
export async function getByPrefix(store, prefix) {
  const db = await open();
  if (!db) return Array.from(memory.get(store).entries()).filter(([k]) => String(k).startsWith(prefix)).map(([, v]) => v);
  return done(db.transaction(store).objectStore(store).getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)));
}

/**
 * One atomic write across several stores. `fn(w)` issues writes synchronously:
 * w.put(store, value), w.del(store, key), w.delPrefix(store, prefix), w.clear(store).
 * Resolves when the transaction commits (the data is on disk).
 */
export async function write(storeNames, fn) {
  const names = [].concat(storeNames);
  const db = await open();
  if (!db) {
    fn({
      put: (s, v) => memory.get(s).set(v[STORES[s]], v),
      del: (s, k) => memory.get(s).delete(k),
      delPrefix: (s, p) => {
        for (const k of memory.get(s).keys()) if (String(k).startsWith(p)) memory.get(s).delete(k);
      },
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
        delPrefix: (s, p) => t.objectStore(s).delete(IDBKeyRange.bound(p, `${p}￿`)),
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
