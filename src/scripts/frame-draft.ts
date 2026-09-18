/** Studio draft persistence: one record in IndexedDB so an accidental reload or closed tab keeps the work-in-progress. */

const DB_NAME = 'loggoo-frame-studio'
const STORE = 'draft'
const KEY = 'current'

// ponytail: IndexedDB rather than localStorage only because overlays are Files; one store, one key, no versioning beyond v1.
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = op(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => db.close()
      }),
  )
}

export function loadDraft<T>(): Promise<T | undefined> {
  return run<T | undefined>('readonly', (store) => store.get(KEY)).catch(() => undefined)
}

export function saveDraft<T>(draft: T): Promise<void> {
  return run('readwrite', (store) => store.put(draft, KEY)).then(
    () => undefined,
    () => undefined,
  )
}

export function clearDraft(): Promise<void> {
  return run('readwrite', (store) => store.delete(KEY)).then(
    () => undefined,
    () => undefined,
  )
}
