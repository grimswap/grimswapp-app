import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useChainId } from 'wagmi'
import { MerkleTree, type MerkleProof } from '@/lib/zk'
import { grimPoolConfig } from '@/lib/contracts'
import { GRIMPOOL_DEPLOYMENT_BLOCK } from '@/lib/constants'
import {
  saveMerkleTreeState,
  loadMerkleTreeState,
  type StoredMerkleTree,
} from '@/lib/storage/merkle-tree'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

// Type for MerkleTree instance
type MerkleTreeInstance = InstanceType<typeof MerkleTree>

/**
 * Hook for managing and syncing Merkle tree
 */
export function useMerkleTree() {
  const publicClient = usePublicClient()
  const chainId = useChainId()

  const [tree, setTree] = useState<MerkleTreeInstance | null>(null)
  const [state, setState] = useState<SyncState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedBlock, setLastSyncedBlock] = useState<number>(0)
  const [leafCount, setLeafCount] = useState<number>(0)

  const treeId = `${chainId}-${grimPoolConfig.address}`

  /**
   * Load tree from IndexedDB
   */
  const loadTree = useCallback(async (): Promise<MerkleTreeInstance | null> => {
    try {
      const stored = await loadMerkleTreeState(treeId)

      if (!stored) {
        // Initialize new tree
        const newTree = new MerkleTree()
        await newTree.initialize()
        return newTree
      }

      // Restore tree from stored state
      const restoredTree = new MerkleTree()
      await restoredTree.importState({
        height: stored.height,
        leaves: stored.leaves,
      })

      setLastSyncedBlock(stored.lastSyncedBlock)
      setLeafCount(stored.leaves.length)

      return restoredTree
    } catch (err) {
      console.error('Failed to load tree:', err)
      return null
    }
  }, [treeId])

  /**
   * Save tree to IndexedDB
   */
  const saveTree = useCallback(
    async (merkleTree: MerkleTreeInstance, lastBlock: number): Promise<void> => {
      try {
        const state = merkleTree.exportState()
        const root = await merkleTree.getRoot()

        const stored: StoredMerkleTree = {
          id: treeId,
          height: state.height,
          leaves: state.leaves,
          lastSyncedBlock: lastBlock,
          lastUpdated: Date.now(),
          root: root.toString(),
        }

        await saveMerkleTreeState(stored)
        setLastSyncedBlock(lastBlock)
        setLeafCount(state.leaves.length)
      } catch (err) {
        console.error('Failed to save tree:', err)
      }
    },
    [treeId]
  )

  /**
   * Fetch deposits from contract events
   */
  const fetchDeposits = useCallback(
    async (fromBlock: bigint, toBlock: bigint): Promise<bigint[]> => {
      if (!publicClient) return []

      try {
        // Use the correct Deposit event schema from GrimPool
        const logs = await publicClient.getLogs({
          address: grimPoolConfig.address,
          event: {
            type: 'event',
            name: 'Deposit',
            inputs: [
              { type: 'bytes32', name: 'commitment', indexed: true },
              { type: 'uint32', name: 'leafIndex', indexed: false },
              { type: 'uint256', name: 'timestamp', indexed: false },
            ],
          },
          fromBlock,
          toBlock,
        })

        // Sort by leafIndex to ensure correct order
        const sortedLogs = [...logs].sort((a: any, b: any) => {
          const indexA = Number(a.args.leafIndex)
          const indexB = Number(b.args.leafIndex)
          return indexA - indexB
        })

        // Extract commitments from logs in correct order
        const commitments = sortedLogs.map((log: any) => {
          return BigInt(log.args.commitment)
        })

        return commitments
      } catch (err) {
        console.error('Failed to fetch deposits:', err)
        return []
      }
    },
    [publicClient]
  )

  /**
   * Sync tree with blockchain
   */
  const syncTree = useCallback(async (): Promise<void> => {
    if (!publicClient) {
      setError('Public client not available')
      return
    }

    setState('syncing')
    setError(null)

    try {
      // Load existing tree or create new one
      let merkleTree = tree || (await loadTree())

      if (!merkleTree) {
        merkleTree = new MerkleTree()
        await merkleTree.initialize()
      }

      // Get current block number
      const currentBlock = await publicClient.getBlockNumber()

      // Determine from block (use deployment block if first sync)
      const fromBlock = lastSyncedBlock > 0
        ? BigInt(lastSyncedBlock + 1)
        : GRIMPOOL_DEPLOYMENT_BLOCK

      // Fetch new deposits
      const newCommitments = await fetchDeposits(fromBlock, currentBlock)

      // Insert new commitments into tree
      for (const commitment of newCommitments) {
        await merkleTree.insert(commitment)
      }

      // Verify our tree root matches on-chain root
      const computedRoot = merkleTree.getRoot()
      try {
        const onChainRoot = await publicClient.readContract({
          ...grimPoolConfig,
          functionName: 'getLastRoot',
          args: [],
        }) as `0x${string}`

        const onChainRootBigInt = BigInt(onChainRoot)
        const computedRootHex = `0x${computedRoot.toString(16).padStart(64, '0')}`

        if (computedRoot !== onChainRootBigInt) {
          console.warn('Merkle root mismatch!', {
            computed: computedRootHex,
            onChain: onChainRoot,
            computedBigInt: computedRoot.toString(),
            onChainBigInt: onChainRootBigInt.toString(),
          })
        } else {
          console.log('Merkle tree synced successfully, root matches on-chain:', computedRootHex)
        }
      } catch (verifyErr) {
        console.warn('Could not verify root against on-chain:', verifyErr)
      }

      // Save tree state
      await saveTree(merkleTree, Number(currentBlock))

      setTree(merkleTree)
      setState('synced')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      setError(message)
      setState('error')
      console.error('Tree sync failed:', err)
    }
  }, [publicClient, tree, lastSyncedBlock, loadTree, fetchDeposits, saveTree])

  /**
   * Get Merkle proof for a leaf
   */
  const getProof = useCallback(
    async (leafIndex: number): Promise<MerkleProof | null> => {
      if (!tree) {
        setError('Tree not initialized')
        return null
      }

      try {
        const proof = await tree.getProof(leafIndex)
        return proof
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate proof'
        setError(message)
        return null
      }
    },
    [tree]
  )

  /**
   * Get current root
   */
  const getRoot = useCallback(async (): Promise<bigint | null> => {
    if (!tree) return null

    try {
      return await tree.getRoot()
    } catch (err) {
      console.error('Failed to get root:', err)
      return null
    }
  }, [tree])

  /**
   * Check if tree needs sync
   */
  const needsSync = useCallback(async (): Promise<boolean> => {
    if (!publicClient) return false

    try {
      const currentBlock = await publicClient.getBlockNumber()
      return Number(currentBlock) > lastSyncedBlock
    } catch (err) {
      return false
    }
  }, [publicClient, lastSyncedBlock])

  /**
   * Force refresh (clear cache and resync)
   */
  const forceRefresh = useCallback(async (): Promise<void> => {
    setLastSyncedBlock(0)
    setTree(null)
    await syncTree()
  }, [syncTree])

  // Auto-load tree on mount
  useEffect(() => {
    loadTree().then((loadedTree) => {
      if (loadedTree) {
        setTree(loadedTree)
        setState('synced')
      }
    })
  }, [loadTree])

  // Auto-sync periodically (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      needsSync().then((needs) => {
        if (needs && state !== 'syncing') {
          syncTree()
        }
      })
    }, 30000)

    return () => clearInterval(interval)
  }, [syncTree, needsSync, state])

  return {
    tree,
    state,
    error,
    lastSyncedBlock,
    leafCount,
    syncTree,
    getProof,
    getRoot,
    needsSync,
    forceRefresh,
    isSyncing: state === 'syncing',
    isSynced: state === 'synced',
    isError: state === 'error',
  }
}
