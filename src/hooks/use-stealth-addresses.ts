/**
 * Stealth Address Management Hook
 *
 * Handles generation, storage, and retrieval of stealth keypairs
 * for receiving private swap outputs.
 */

import { useState, useEffect, useCallback } from 'react'
import { openDB, type IDBPDatabase } from 'idb'
import { privateKeyToAccount } from 'viem/accounts'
import { type Address, type Hex } from 'viem'

const DB_NAME = 'grimswap-stealth'
const DB_VERSION = 1
const STORE_NAME = 'stealth-addresses'

export interface StealthAddress {
  id: string
  privateKey: Hex
  address: Address
  createdAt: number
  swapTxHash?: string
  fundingTxHash?: string
  claimed: boolean
  claimTxHash?: string
  claimDestination?: Address
  // Balances (updated by scanning)
  balances?: {
    eth: string
    usdc: string
    lastUpdated: number
  }
}

interface StealthDB {
  [STORE_NAME]: StealthAddress
}

let dbPromise: Promise<IDBPDatabase<StealthDB>> | null = null

function getDB(): Promise<IDBPDatabase<StealthDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StealthDB>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<StealthDB>) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('address', 'address', { unique: true })
          store.createIndex('claimed', 'claimed')
          store.createIndex('createdAt', 'createdAt')
        }
      },
    })
  }
  return dbPromise!
}

/**
 * Generate a new stealth keypair
 */
export function generateStealthKeypair(): { privateKey: Hex; address: Address } {
  // Generate 32 random bytes for private key
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)

  // Convert to hex private key
  const privateKey = `0x${Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}` as Hex

  // Derive address from private key
  const account = privateKeyToAccount(privateKey)

  return {
    privateKey,
    address: account.address,
  }
}

/**
 * Hook for managing stealth addresses
 */
export function useStealthAddresses() {
  const [stealthAddresses, setStealthAddresses] = useState<StealthAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load all stealth addresses from IndexedDB
  const loadStealthAddresses = useCallback(async () => {
    try {
      const db = await getDB()
      const addresses = await db.getAll(STORE_NAME)
      // Sort by creation date, newest first
      addresses.sort((a: StealthAddress, b: StealthAddress) => b.createdAt - a.createdAt)
      setStealthAddresses(addresses)
    } catch (error) {
      console.error('Failed to load stealth addresses:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load on mount
  useEffect(() => {
    loadStealthAddresses()
  }, [loadStealthAddresses])

  /**
   * Generate a stealth keypair WITHOUT saving (for use before swap confirmation)
   */
  const generateStealthKeypairOnly = useCallback((): StealthAddress => {
    const { privateKey, address } = generateStealthKeypair()

    return {
      id: `stealth-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      privateKey,
      address,
      createdAt: Date.now(),
      claimed: false,
    }
  }, [])

  /**
   * Save a stealth address (call after swap succeeds)
   */
  const saveStealthAddress = useCallback(async (stealthAddress: StealthAddress): Promise<void> => {
    const db = await getDB()
    await db.put(STORE_NAME, stealthAddress)

    // Update state
    setStealthAddresses(prev => [stealthAddress, ...prev])

    console.log('Saved stealth address:', stealthAddress.address)
  }, [])

  /**
   * Create and save a new stealth address (legacy - saves immediately)
   */
  const createStealthAddress = useCallback(async (): Promise<StealthAddress> => {
    const stealthAddress = generateStealthKeypairOnly()
    await saveStealthAddress(stealthAddress)
    return stealthAddress
  }, [generateStealthKeypairOnly, saveStealthAddress])

  /**
   * Update stealth address with swap transaction hash
   */
  const updateSwapTxHash = useCallback(async (
    address: Address,
    swapTxHash: string,
    fundingTxHash?: string
  ) => {
    const db = await getDB()
    const index = db.transaction(STORE_NAME).store.index('address')
    const existing = await index.get(address)

    if (existing) {
      const updated = {
        ...existing,
        swapTxHash,
        fundingTxHash,
      }
      await db.put(STORE_NAME, updated)
      setStealthAddresses(prev =>
        prev.map(sa => sa.address === address ? updated : sa)
      )
    }
  }, [])

  /**
   * Update stealth address balances
   */
  const updateBalances = useCallback(async (
    address: Address,
    balances: { eth: string; usdc: string }
  ) => {
    const db = await getDB()
    const index = db.transaction(STORE_NAME).store.index('address')
    const existing = await index.get(address)

    if (existing) {
      const updated = {
        ...existing,
        balances: {
          ...balances,
          lastUpdated: Date.now(),
        },
      }
      await db.put(STORE_NAME, updated)
      setStealthAddresses(prev =>
        prev.map(sa => sa.address === address ? updated : sa)
      )
    }
  }, [])

  /**
   * Mark stealth address as claimed
   */
  const markAsClaimed = useCallback(async (
    address: Address,
    claimTxHash: string,
    claimDestination: Address
  ) => {
    const db = await getDB()
    const index = db.transaction(STORE_NAME).store.index('address')
    const existing = await index.get(address)

    if (existing) {
      const updated = {
        ...existing,
        claimed: true,
        claimTxHash,
        claimDestination,
      }
      await db.put(STORE_NAME, updated)
      setStealthAddresses(prev =>
        prev.map(sa => sa.address === address ? updated : sa)
      )
    }
  }, [])

  /**
   * Get stealth address by address
   */
  const getStealthByAddress = useCallback(async (
    address: Address
  ): Promise<StealthAddress | undefined> => {
    const db = await getDB()
    const index = db.transaction(STORE_NAME).store.index('address')
    return index.get(address)
  }, [])

  /**
   * Get private key for a stealth address
   */
  const getPrivateKey = useCallback(async (
    address: Address
  ): Promise<Hex | undefined> => {
    const stealth = await getStealthByAddress(address)
    return stealth?.privateKey
  }, [getStealthByAddress])

  /**
   * Delete a stealth address (use with caution!)
   */
  const deleteStealthAddress = useCallback(async (id: string) => {
    const db = await getDB()
    await db.delete(STORE_NAME, id)
    setStealthAddresses(prev => prev.filter(sa => sa.id !== id))
  }, [])

  /**
   * Get unclaimed stealth addresses with balances
   */
  const unclaimedAddresses = stealthAddresses.filter(sa => !sa.claimed)

  /**
   * Get claimed stealth addresses
   */
  const claimedAddresses = stealthAddresses.filter(sa => sa.claimed)

  return {
    stealthAddresses,
    unclaimedAddresses,
    claimedAddresses,
    isLoading,
    createStealthAddress,
    generateStealthKeypairOnly,
    saveStealthAddress,
    updateSwapTxHash,
    updateBalances,
    markAsClaimed,
    getStealthByAddress,
    getPrivateKey,
    deleteStealthAddress,
    refresh: loadStealthAddresses,
  }
}

export default useStealthAddresses
