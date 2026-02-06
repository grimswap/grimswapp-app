/**
 * Hook for tracking user's liquidity positions
 *
 * Stores positions in localStorage since Uniswap v4 positions
 * are identified by (owner, tickLower, tickUpper, salt) hash
 */

import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { type Address, parseAbiItem } from 'viem'
import { CONTRACTS } from '@/lib/constants'
import { type PoolKey } from '@/lib/contracts'
import { FULL_RANGE_TICK_LOWER, FULL_RANGE_TICK_UPPER } from './use-liquidity'

export interface LiquidityPosition {
  id: string
  poolId: string
  poolKey: PoolKey
  tickLower: number
  tickUpper: number
  liquidity: string // Store as string for localStorage
  salt: `0x${string}`
  createdAt: number
  txHash: string
}

const STORAGE_KEY = 'grimswap-liquidity-positions'

/**
 * Get positions from localStorage
 */
function getStoredPositions(): LiquidityPosition[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Save positions to localStorage
 */
function savePositions(positions: LiquidityPosition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
}

/**
 * Hook to manage user's liquidity positions
 */
// ModifyLiquidity event ABI
const modifyLiquidityEventAbi = parseAbiItem(
  'event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)'
)

export function useLiquidityPositions(poolId?: string) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [positions, setPositions] = useState<LiquidityPosition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [onChainLiquidity, setOnChainLiquidity] = useState<bigint>(0n)

  // Fetch positions from on-chain events
  const fetchOnChainPositions = useCallback(async () => {
    if (!publicClient || !address || !poolId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      console.log('Fetching on-chain liquidity positions for:', address, 'pool:', poolId)

      // Get current block
      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = currentBlock > 100000n ? currentBlock - 100000n : 0n

      // Fetch ALL ModifyLiquidity events for this pool
      // (sender is PoolModifyLiquidityTest, not user)
      const logs = await publicClient.getLogs({
        address: CONTRACTS.poolManager as Address,
        event: modifyLiquidityEventAbi,
        args: {
          id: poolId as `0x${string}`,
        },
        fromBlock,
        toBlock: 'latest',
      })

      console.log(`Found ${logs.length} ModifyLiquidity events for pool`)

      // Filter by transaction sender (the actual user)
      const userLogs = []
      for (const log of logs) {
        try {
          const tx = await publicClient.getTransaction({ hash: log.transactionHash })
          if (tx.from.toLowerCase() === address.toLowerCase()) {
            userLogs.push(log)
          }
        } catch (err) {
          console.warn('Failed to get transaction:', log.transactionHash)
        }
      }

      console.log(`Found ${userLogs.length} ModifyLiquidity events from user`)

      // Calculate net liquidity from events
      let netLiquidity = 0n
      const positionMap = new Map<string, {
        tickLower: number
        tickUpper: number
        salt: `0x${string}`
        liquidity: bigint
        txHash: string
      }>()

      for (const log of userLogs) {
        const { tickLower, tickUpper, liquidityDelta, salt } = log.args
        if (tickLower === undefined || tickUpper === undefined || liquidityDelta === undefined || salt === undefined) continue

        const posKey = `${tickLower}-${tickUpper}-${salt}`
        const existing = positionMap.get(posKey)

        if (existing) {
          existing.liquidity += liquidityDelta
          if (existing.liquidity <= 0n) {
            positionMap.delete(posKey)
          }
        } else if (liquidityDelta > 0n) {
          positionMap.set(posKey, {
            tickLower,
            tickUpper,
            salt: salt as `0x${string}`,
            liquidity: liquidityDelta,
            txHash: log.transactionHash,
          })
        }

        netLiquidity += liquidityDelta
      }

      // Also check localStorage for any manually tracked positions
      const storedPositions = getStoredPositions().filter(p => p.poolId === poolId)

      // Merge on-chain and stored positions
      const allPositions: LiquidityPosition[] = []

      // Add on-chain positions
      for (const [key, pos] of positionMap) {
        if (pos.liquidity > 0n) {
          allPositions.push({
            id: `onchain-${key}`,
            poolId: poolId,
            poolKey: {} as PoolKey, // Will be filled by caller
            tickLower: pos.tickLower,
            tickUpper: pos.tickUpper,
            liquidity: pos.liquidity.toString(),
            salt: pos.salt,
            createdAt: Date.now(),
            txHash: pos.txHash,
          })
        }
      }

      // Add stored positions that aren't already tracked
      for (const stored of storedPositions) {
        const existsOnChain = allPositions.some(
          p => p.tickLower === stored.tickLower &&
               p.tickUpper === stored.tickUpper &&
               p.salt === stored.salt
        )
        if (!existsOnChain && BigInt(stored.liquidity) > 0n) {
          allPositions.push(stored)
        }
      }

      console.log('Total positions found:', allPositions.length, 'Net liquidity:', netLiquidity.toString())

      setPositions(allPositions)
      setOnChainLiquidity(netLiquidity > 0n ? netLiquidity : 0n)
    } catch (err) {
      console.error('Failed to fetch on-chain positions:', err)
      // Fallback to stored positions
      const storedPositions = getStoredPositions().filter(p => !poolId || p.poolId === poolId)
      setPositions(storedPositions)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, address, poolId])

  // Load positions on mount and when address/poolId changes
  useEffect(() => {
    if (address && poolId) {
      fetchOnChainPositions()
    } else if (address) {
      // No poolId - just load from storage
      const allPositions = getStoredPositions()
      setPositions(allPositions)
      setIsLoading(false)
    } else {
      setPositions([])
      setIsLoading(false)
    }
  }, [address, poolId, fetchOnChainPositions])

  /**
   * Add a new position after successful liquidity add
   */
  const addPosition = useCallback((
    poolId: string,
    poolKey: PoolKey,
    liquidity: bigint,
    salt: `0x${string}`,
    txHash: string,
    tickLower: number = FULL_RANGE_TICK_LOWER,
    tickUpper: number = FULL_RANGE_TICK_UPPER
  ) => {
    const position: LiquidityPosition = {
      id: `${poolId}-${salt}-${Date.now()}`,
      poolId,
      poolKey,
      tickLower,
      tickUpper,
      liquidity: liquidity.toString(),
      salt,
      createdAt: Date.now(),
      txHash,
    }

    const allPositions = getStoredPositions()
    const updated = [...allPositions, position]
    savePositions(updated)

    // Update state if this pool
    if (!poolId || position.poolId === poolId) {
      setPositions(prev => [...prev, position])
    }

    console.log('Position saved:', position)
    return position
  }, [poolId])

  /**
   * Update position liquidity (after partial removal)
   */
  const updatePositionLiquidity = useCallback((
    positionId: string,
    newLiquidity: bigint
  ) => {
    const allPositions = getStoredPositions()
    const updated = allPositions.map(p =>
      p.id === positionId
        ? { ...p, liquidity: newLiquidity.toString() }
        : p
    ).filter(p => BigInt(p.liquidity) > 0n) // Remove if fully withdrawn

    savePositions(updated)
    setPositions(updated.filter(p => !poolId || p.poolId === poolId))
  }, [poolId])

  /**
   * Remove a position (after full withdrawal)
   */
  const removePosition = useCallback((positionId: string) => {
    const allPositions = getStoredPositions()
    const updated = allPositions.filter(p => p.id !== positionId)
    savePositions(updated)
    setPositions(updated.filter(p => !poolId || p.poolId === poolId))
  }, [poolId])

  /**
   * Get total liquidity for the pool
   * Use on-chain liquidity if available, otherwise sum from positions
   */
  const totalLiquidity = onChainLiquidity > 0n
    ? onChainLiquidity
    : positions.reduce((sum, p) => sum + BigInt(p.liquidity), 0n)

  /**
   * Calculate estimated token amounts from liquidity
   */
  const calculateTokenAmounts = useCallback((
    liquidity: bigint,
    currentPrice: number
  ): { ethAmount: number; usdcAmount: number } => {
    if (liquidity === 0n || currentPrice <= 0) {
      return { ethAmount: 0, usdcAmount: 0 }
    }

    const liqNum = Number(liquidity)

    // Convert price to raw ratio
    const rawPrice = currentPrice / 1e12
    const sqrtRawPrice = Math.sqrt(rawPrice)

    // Calculate reserves
    const ethReserveWei = liqNum / sqrtRawPrice
    const usdcReserveUnits = liqNum * sqrtRawPrice

    const ethAmount = ethReserveWei / 1e18
    const usdcAmount = usdcReserveUnits / 1e6

    return { ethAmount, usdcAmount }
  }, [])

  return {
    positions,
    totalLiquidity,
    isLoading,
    isConnected,
    addPosition,
    updatePositionLiquidity,
    removePosition,
    calculateTokenAmounts,
    refresh: fetchOnChainPositions,
  }
}

export default useLiquidityPositions
