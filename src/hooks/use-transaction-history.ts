import { useState, useEffect, useCallback } from 'react'
import { type Address, type Hash } from 'viem'

export type TransactionType = 'swap' | 'approve' | 'addLiquidity' | 'removeLiquidity' | 'withdraw'
export type TransactionStatus = 'pending' | 'confirmed' | 'failed'

export interface Transaction {
  id: string
  hash: Hash
  type: TransactionType
  status: TransactionStatus
  timestamp: number
  chainId: number
  from: Address
  summary: string
  details?: {
    fromToken?: string
    toToken?: string
    fromAmount?: string
    toAmount?: string
    ringSize?: number
    stealthAddress?: Address
  }
}

const STORAGE_KEY = 'grimswap-transactions'
const MAX_TRANSACTIONS = 50

function loadTransactions(): Transaction[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load transactions:', e)
  }

  return []
}

function saveTransactions(transactions: Transaction[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
  } catch (e) {
    console.error('Failed to save transactions:', e)
  }
}

export function useTransactionHistory(address?: Address) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load transactions on mount
  useEffect(() => {
    const loaded = loadTransactions()
    // Filter by address if provided
    const filtered = address
      ? loaded.filter((tx) => tx.from.toLowerCase() === address.toLowerCase())
      : loaded
    setTransactions(filtered)
    setIsLoaded(true)
  }, [address])

  // Save transactions when they change
  useEffect(() => {
    if (isLoaded) {
      saveTransactions(transactions)
    }
  }, [transactions, isLoaded])

  const addTransaction = useCallback((
    tx: Omit<Transaction, 'id' | 'timestamp'>
  ): Transaction => {
    const newTx: Transaction = {
      ...tx,
      id: `${tx.hash}-${Date.now()}`,
      timestamp: Date.now(),
    }

    setTransactions((prev) => {
      const updated = [newTx, ...prev].slice(0, MAX_TRANSACTIONS)
      return updated
    })

    return newTx
  }, [])

  const updateTransaction = useCallback((
    hash: Hash,
    updates: Partial<Pick<Transaction, 'status' | 'summary' | 'details'>>
  ) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.hash === hash ? { ...tx, ...updates } : tx
      )
    )
  }, [])

  const removeTransaction = useCallback((hash: Hash) => {
    setTransactions((prev) => prev.filter((tx) => tx.hash !== hash))
  }, [])

  const clearTransactions = useCallback(() => {
    setTransactions([])
  }, [])

  const pendingTransactions = transactions.filter((tx) => tx.status === 'pending')
  const confirmedTransactions = transactions.filter((tx) => tx.status === 'confirmed')
  const failedTransactions = transactions.filter((tx) => tx.status === 'failed')

  return {
    transactions,
    pendingTransactions,
    confirmedTransactions,
    failedTransactions,
    isLoaded,
    addTransaction,
    updateTransaction,
    removeTransaction,
    clearTransactions,
    hasPending: pendingTransactions.length > 0,
  }
}
