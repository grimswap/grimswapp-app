import { useState, useEffect, useCallback, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { useStateView } from './use-state-view'
import { grimPoolConfig, DEFAULT_POOL_KEY } from '@/lib/contracts'
import { UNICHAIN_SEPOLIA } from '@/lib/constants'

export interface ProtocolStats {
  poolLiquidity: string
  depositCount: number
  ethPrice: number
  network: string
}

// Default/fallback values when data can't be loaded
const DEFAULT_STATS: ProtocolStats = {
  poolLiquidity: '—',
  depositCount: 0,
  ethPrice: 0,
  network: UNICHAIN_SEPOLIA.name,
}

// Timeout for loading state (5 seconds)
const LOADING_TIMEOUT = 5000

/**
 * Hook to fetch and aggregate live protocol statistics
 * Used for the landing page stats section
 *
 * Features:
 * - Graceful fallback to default values on error
 * - Timeout to prevent indefinite loading
 * - Works without wallet connection (uses public RPC)
 */
export function useProtocolStats() {
  const [stats, setStats] = useState<ProtocolStats>(DEFAULT_STATS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const publicClient = usePublicClient()

  // Get pool state for liquidity and price
  const {
    poolState,
    currentPrice,
    isLoading: poolLoading,
    error: poolError,
    isInitialized
  } = useStateView(DEFAULT_POOL_KEY)

  // Fetch deposit count from GrimPool
  const fetchDepositCount = useCallback(async (): Promise<number> => {
    if (!publicClient) return 0

    try {
      const count = await publicClient.readContract({
        ...grimPoolConfig,
        functionName: 'getDepositCount',
        args: [],
      })
      return Number(count)
    } catch (err) {
      console.warn('Failed to get deposit count:', err)
      return 0
    }
  }, [publicClient])

  // Format liquidity value for display
  const formatLiquidity = useCallback((liquidity: bigint | undefined): string => {
    if (!liquidity || liquidity === 0n) return '—'

    const liquidityNum = Number(liquidity)
    if (liquidityNum > 1e18) {
      return (liquidityNum / 1e18).toFixed(2) + 'e18'
    } else if (liquidityNum > 1e9) {
      return (liquidityNum / 1e9).toFixed(2) + 'B'
    } else if (liquidityNum > 1e6) {
      return (liquidityNum / 1e6).toFixed(2) + 'M'
    } else if (liquidityNum > 0) {
      return liquidityNum.toLocaleString()
    }
    return '—'
  }, [])

  // Aggregate all stats
  const fetchStats = useCallback(async () => {
    // Don't re-fetch if we've already successfully fetched
    if (hasFetched && stats !== DEFAULT_STATS) return

    try {
      setError(null)

      // Fetch deposit count (independent of pool state)
      const depositCount = await fetchDepositCount()

      // Build stats object with available data
      const newStats: ProtocolStats = {
        poolLiquidity: formatLiquidity(poolState?.liquidity),
        depositCount,
        ethPrice: currentPrice || 0,
        network: UNICHAIN_SEPOLIA.name,
      }

      setStats(newStats)
      setHasFetched(true)
    } catch (err) {
      console.warn('Failed to fetch protocol stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
      // Keep default stats on error
    } finally {
      setIsLoading(false)
    }
  }, [poolState, currentPrice, fetchDepositCount, formatLiquidity, hasFetched, stats])

  // Effect to trigger fetch when pool data is ready or after timeout
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // If pool finished loading (success or error), fetch stats
    if (!poolLoading) {
      fetchStats()
      return
    }

    // Set a timeout to stop loading even if pool data never arrives
    timeoutRef.current = setTimeout(() => {
      console.warn('Protocol stats loading timeout - using fallback values')
      setIsLoading(false)
      setError('Connection timeout')
      setHasFetched(true)
    }, LOADING_TIMEOUT)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [poolLoading, fetchStats])

  // Update stats when pool data changes (after initial fetch)
  useEffect(() => {
    if (hasFetched && !poolLoading && isInitialized) {
      setStats(prev => ({
        ...prev,
        poolLiquidity: formatLiquidity(poolState?.liquidity),
        ethPrice: currentPrice || prev.ethPrice,
      }))
    }
  }, [poolState, currentPrice, hasFetched, poolLoading, isInitialized, formatLiquidity])

  // Manual refetch function
  const refetch = useCallback(() => {
    setHasFetched(false)
    setIsLoading(true)
    setError(null)
  }, [])

  return {
    stats,
    isLoading: isLoading && !hasFetched,
    error: error || poolError,
    refetch,
  }
}
