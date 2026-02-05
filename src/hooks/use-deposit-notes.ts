import { useState, useEffect, useCallback } from 'react'
import {
  getAllDepositNotes,
  getUnspentNotes,
  saveDepositNote,
  markNoteAsSpent,
  deleteDepositNote,
  exportDepositNotes,
  importDepositNotes,
  clearAllNotes,
  getNotesCount,
  type StoredDepositNote,
} from '@/lib/storage/deposit-notes'
import type { DepositNote } from '@/lib/zk'

/**
 * Hook for managing deposit notes
 */
export function useDepositNotes() {
  const [notes, setNotes] = useState<StoredDepositNote[]>([])
  const [unspentNotes, setUnspentNotes] = useState<StoredDepositNote[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState({ total: 0, unspent: 0 })

  // Load notes from IndexedDB
  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const [allNotes, unspent, counts] = await Promise.all([
        getAllDepositNotes(),
        getUnspentNotes(),
        getNotesCount(),
      ])

      setNotes(allNotes)
      setUnspentNotes(unspent)
      setCount(counts)
    } catch (error) {
      console.error('Failed to load notes:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save new deposit note
  const saveNote = useCallback(
    async (
      note: DepositNote,
      tokenAddress: string,
      tokenSymbol: string,
      depositTxHash?: string
    ): Promise<number> => {
      const id = await saveDepositNote(note, tokenAddress, tokenSymbol, depositTxHash)
      await loadNotes()
      return id
    },
    [loadNotes]
  )

  // Mark note as spent
  const spendNote = useCallback(
    async (id: number): Promise<void> => {
      await markNoteAsSpent(id)
      await loadNotes()
    },
    [loadNotes]
  )

  // Delete note
  const deleteNote = useCallback(
    async (id: number): Promise<void> => {
      await deleteDepositNote(id)
      await loadNotes()
    },
    [loadNotes]
  )

  // Export notes as JSON
  const exportNotes = useCallback(async (): Promise<string> => {
    return exportDepositNotes()
  }, [])

  // Import notes from JSON
  const importNotes = useCallback(
    async (jsonString: string): Promise<number> => {
      const imported = await importDepositNotes(jsonString)
      await loadNotes()
      return imported
    },
    [loadNotes]
  )

  // Clear all notes
  const clearNotes = useCallback(async (): Promise<void> => {
    await clearAllNotes()
    await loadNotes()
  }, [loadNotes])

  // Load notes on mount
  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  return {
    notes,
    unspentNotes,
    loading,
    count,
    saveNote,
    spendNote,
    deleteNote,
    exportNotes,
    importNotes,
    clearNotes,
    refresh: loadNotes,
  }
}
