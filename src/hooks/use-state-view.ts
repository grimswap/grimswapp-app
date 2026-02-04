import { useState, useEffect, useCallback } from 'react'
import { type Address } from 'viem'
import { usePublicClient } from 'wagmi'
import { stateViewConfig, type PoolKey } from '@/lib/contracts'
import { calculatePoolId, KNOWN_POOL_IDS } from './use-pool-manager'

/**
 * Pool slot0 state from StateView
 */
export interface Slot0State {
  sqrtPriceX96: bigint
  tick: number
  protocolFee: number
  lpFee: number
}

/**
 * Full pool state from StateView
 */
export interface PoolStateFromView {
  slot0: Slot0State
  liquidity: bigint
}

/**
 * Calculate token price from sqrtPriceX96
 * Returns price of token1 in terms of token0 (e.g., USDC per ETH)
 */
export function calculatePriceFromSqrt(
  sqrtPriceX96: bigint,
  token0Decimals: number = 18,
  token1Decimals: number = 6
): number {
  if (sqrtPriceX96 === 0n) return 0

  // sqrtPriceX96 = sqrt(price) * 2^96
  // price = (sqrtPriceX96 / 2^96)^2
  const Q96 = BigInt(2) ** BigInt(96)
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96)
  const rawPrice = sqrtPrice * sqrtPrice

  // Adjust for decimal difference
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals)
  return rawPrice * decimalAdjustment
}

/**
 * Hook to fetch pool state using StateView contract
 * This is the recommended way to read Uniswap v4 pool state
 */
export function useStateView(poolKey: PoolKey, useKnownPoolId: boolean = true) {
  const [poolState, setPoolState] = useState<PoolStateFromView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const publicClient = usePublicClient()

  // Calculate pool ID or use known one
  const calculatedPoolId = calculatePoolId(poolKey)

  // Determine which known pool ID to use based on whether the pool has hooks
  const hasGrimSwapHook = poolKey.hooks !== '0x0000000000000000000000000000000000000000'
  const knownPoolId = hasGrimSwapHook
    ? KNOWN_POOL_IDS.ETH_USDC_GRIMSWAP as `0x${string}`
    : KNOWN_POOL_IDS.ETH_USDC_0_3 as `0x${string}`

  const poolId = useKnownPoolId ? knownPoolId : calculatedPoolId

  // Token decimals for price calculation
  const token0Decimals = 18 // ETH
  const token1Decimals = 6  // USDC

  const fetchPoolState = useCallback(async () => {
    if (!publicClient) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log('Fetching pool state via StateView:', {
        stateViewAddress: stateViewConfig.address,
        poolId,
        calculatedPoolId,
        poolIdMatch: poolId === calculatedPoolId,
      })

      // Call getSlot0 to get price and tick
      const slot0Result = await publicClient.readContract({
        address: stateViewConfig.address as Address,
        abi: stateViewConfig.abi,
        functionName: 'getSlot0',
        args: [poolId],
      }) as [bigint, number, number, number]

      const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0Result

      console.log('StateView getSlot0 result:', {
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick,
        protocolFee,
        lpFee,
      })

      // Call getLiquidity to get pool liquidity
      const liquidity = await publicClient.readContract({
        address: stateViewConfig.address as Address,
        abi: stateViewConfig.abi,
        functionName: 'getLiquidity',
        args: [poolId],
      }) as bigint

      console.log('StateView getLiquidity result:', liquidity.toString())

      // Calculate and log price
      const price = calculatePriceFromSqrt(sqrtPriceX96, token0Decimals, token1Decimals)
      console.log('Calculated price:', price.toFixed(2), 'USDC per ETH')

      setPoolState({
        slot0: {
          sqrtPriceX96,
          tick,
          protocolFee,
          lpFee,
        },
        liquidity,
      })

    } catch (err) {
      console.error('Failed to fetch pool state via StateView:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch pool state')
      setPoolState(null)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, poolId, calculatedPoolId, token0Decimals, token1Decimals])

  useEffect(() => {
    fetchPoolState()
  }, [fetchPoolState, fetchCount])

  // Calculate prices
  const currentPrice = poolState
    ? calculatePriceFromSqrt(poolState.slot0.sqrtPriceX96, token0Decimals, token1Decimals)
    : null

  const inversePrice = currentPrice && currentPrice > 0
    ? 1 / currentPrice
    : null

  const isInitialized = poolState !== null && poolState.slot0.sqrtPriceX96 > 0n

  return {
    poolState,
    isInitialized,
    isLoading,
    error,
    poolId,
    calculatedPoolId,
    currentPrice,
    inversePrice,
    refetch: () => setFetchCount(c => c + 1),
  }
}
