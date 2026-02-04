/**
 * IndexedDB storage for deposit notes
 *
 * Stores deposit notes locally so users can prove ownership later
 */

import { type DepositNote, serializeNote, deserializeNote } from '@/lib/zk'

const DB_NAME = 'grimswap-db'
const DB_VERSION = 1
const STORE_NAME = 'deposit-notes'

/**
 * Stored deposit note with metadata
 */
export interface StoredDepositNote extends DepositNote {
  id?: number // Auto-incremented by IndexedDB
  createdAt: number
  spentAt?: number // Timestamp when withdrawn
  spent: boolean
  tokenAddress: string
  tokenSymbol: string
}

/**
 * Initialize IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create deposit notes store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })

        // Indexes for querying
        store.createIndex('commitment', 'commitment', { unique: true })
        store.createIndex('nullifierHash', 'nullifierHash', { unique: true })
        store.createIndex('spent', 'spent', { unique: false })
        store.createIndex('tokenAddress', 'tokenAddress', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

/**
 * Save deposit note to IndexedDB
 */
export async function saveDepositNote(
  note: DepositNote,
  tokenAddress: string,
  tokenSymbol: string
): Promise<number> {
  const db = await openDB()

  const storedNote: Omit<StoredDepositNote, 'id'> = {
    ...note,
    createdAt: Date.now(),
    spent: false,
    tokenAddress,
    tokenSymbol,
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(storedNote)

    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}

/**
 * Get all deposit notes
 */
export async function getAllDepositNotes(): Promise<StoredDepositNote[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}

/**
 * Get unspent deposit notes
 */
export async function getUnspentNotes(): Promise<StoredDepositNote[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('spent')
    const request = index.getAll(false)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}

/**
 * Get deposit note by commitment
 */
export async function getNoteByCommitment(commitment: bigint): Promise<StoredDepositNote | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('commitment')
    const request = index.get(commitment)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}

/**
 * Get deposit note by nullifier hash
 */
export async function getNoteByNullifierHash(
  nullifierHash: bigint
): Promise<StoredDepositNote | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('nullifierHash')
    const request = index.get(nullifierHash)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}

/**
 * Mark deposit note as spent
 */
export async function markNoteAsSpent(id: number): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const note = getRequest.result
      if (!note) {
        reject(new Error('Note not found'))
        return
      }

      note.spent = true
      note.spentAt = Date.now()

      const putRequest = store.put(note)
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }

    getRequest.onerror = () => reject(getRequest.error)
    transaction.oncomplete = () => db.close()
  })
}

/**
 * Delete deposit note
 */
export async function deleteDepositNote(id: number): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}

/**
 * Export all deposit notes as JSON (for backup)
 */
export async function exportDepositNotes(): Promise<string> {
  const notes = await getAllDepositNotes()
  const exportData = notes.map(note => ({
    ...note,
    // Convert bigints to strings for JSON
    nullifier: note.nullifier.toString(),
    secret: note.secret.toString(),
    amount: note.amount.toString(),
    commitment: note.commitment.toString(),
    nullifierHash: note.nullifierHash.toString(),
  }))

  return JSON.stringify(exportData, null, 2)
}

/**
 * Import deposit notes from JSON backup
 */
export async function importDepositNotes(jsonString: string): Promise<number> {
  const data = JSON.parse(jsonString)

  if (!Array.isArray(data)) {
    throw new Error('Invalid backup format')
  }

  let imported = 0

  for (const item of data) {
    try {
      const note: Omit<StoredDepositNote, 'id'> = {
        nullifier: BigInt(item.nullifier),
        secret: BigInt(item.secret),
        amount: BigInt(item.amount),
        commitment: BigInt(item.commitment),
        nullifierHash: BigInt(item.nullifierHash),
        leafIndex: item.leafIndex,
        depositTxHash: item.depositTxHash,
        createdAt: item.createdAt || Date.now(),
        spent: item.spent || false,
        spentAt: item.spentAt,
        tokenAddress: item.tokenAddress,
        tokenSymbol: item.tokenSymbol,
      }

      await saveDepositNote(note, note.tokenAddress, note.tokenSymbol)
      imported++
    } catch (error) {
      console.error('Failed to import note:', error)
    }
  }

  return imported
}

/**
 * Clear all deposit notes (dangerous!)
 */
export async function clearAllNotes(): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)

    transaction.oncomplete = () => db.close()
  })
}

/**
 * Get deposit notes count
 */
export async function getNotesCount(): Promise<{ total: number; unspent: number }> {
  const all = await getAllDepositNotes()
  const unspent = all.filter(n => !n.spent)

  return {
    total: all.length,
    unspent: unspent.length,
  }
}
