import { useState, useCallback } from 'react'
import { type Address } from 'viem'
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '@/lib/constants'
import { type PoolKey, erc20ABI, poolHelperConfig } from '@/lib/contracts'
import PoolModifyLiquidityTestABI from '@/lib/PoolModifyLiquidityTest_ABI.json'

// Tick math constants
export const MIN_TICK = -887272
export const MAX_TICK = 887272

// Full range ticks (aligned to tick spacing of 60)
export const FULL_RANGE_TICK_LOWER = Math.ceil(MIN_TICK / 60) * 60 // -887220
export const FULL_RANGE_TICK_UPPER = Math.floor(MAX_TICK / 60) * 60 // 887220

export interface ModifyLiquidityParams {
  tickLower: number
  tickUpper: number
  liquidityDelta: bigint
  salt: `0x${string}`
}

export interface AddLiquidityConfig {
  poolKey: PoolKey
  amount0: bigint // Amount of token0 (ETH)
  amount1: bigint // Amount of token1 (USDC)
  sqrtPriceX96?: bigint // Current pool price (for liquidity calculation)
  tickLower?: number
  tickUpper?: number
  hookData?: `0x${string}`
}

export interface LiquidityState {
  isInitializing: boolean
  isApproving: boolean
  isAddingLiquidity: boolean
  isRemovingLiquidity: boolean
  error: string | null
  txHash: `0x${string}` | null
}

/**
 * Calculate liquidity from token amounts for a full-range position
 *
 * For Uniswap v4 with full range positions, the relationship between
 * liquidity and token amounts is complex. We use a very conservative
 * approach to ensure the transaction succeeds.
 *
 * Based on testing: liquidity of 10^10 requires approximately:
 * - 0.0001 ETH
 * - 0.25 USDC
 * So for 1 ETH, we can safely use liquidity of 10^12 to 10^13
 */
export function calculateLiquidityFromAmounts(
  amount0: bigint, // ETH amount (18 decimals)
  _amount1: bigint, // USDC amount (6 decimals) - unused, we base on ETH
  sqrtPriceX96: bigint
): bigint {
  if (sqrtPriceX96 === 0n || amount0 === 0n) return BigInt(10 ** 10)

  // Ultra-conservative liquidity calculation
  // For 1 ETH (10^18), use liquidity of 10^12
  // This means: liquidity = amount0 / 10^6

  const liquidity = amount0 / BigInt(10 ** 6)

  console.log('Liquidity calculation (ultra-conservative):', {
    amount0: amount0.toString(),
    sqrtPriceX96: sqrtPriceX96.toString(),
    calculatedLiquidity: liquidity.toString(),
    // For 1 ETH: 10^18 / 10^6 = 10^12
  })

  // Ensure minimum liquidity of 10^10
  return liquidity > BigInt(10 ** 10) ? liquidity : BigInt(10 ** 10)
}

/**
 * Hook for managing Uniswap v4 liquidity positions
 */
export function useLiquidity() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [state, setState] = useState<LiquidityState>({
    isInitializing: false,
    isApproving: false,
    isAddingLiquidity: false,
    isRemovingLiquidity: false,
    error: null,
    txHash: null,
  })

  const { writeContractAsync } = useWriteContract()
  const { data: txReceipt } = useWaitForTransactionReceipt({
    hash: state.txHash ?? undefined,
  })

  /**
   * Initialize a new pool with the given sqrtPriceX96
   * This is required before adding liquidity to a new pool
   */
  const initializePool = useCallback(async (
    poolKey: PoolKey,
    sqrtPriceX96: bigint
  ): Promise<`0x${string}` | null> => {
    if (!address || !isConnected) {
      setState(s => ({ ...s, error: 'Wallet not connected' }))
      return null
    }

    try {
      setState(s => ({ ...s, isInitializing: true, error: null, txHash: null }))

      console.log('Initializing pool with params:', {
        poolKey,
        sqrtPriceX96: sqrtPriceX96.toString(),
      })

      const txHash = await writeContractAsync({
        address: poolHelperConfig.address,
        abi: poolHelperConfig.abi,
        functionName: 'initializePool',
        args: [poolKey, sqrtPriceX96],
      })

      setState(s => ({ ...s, txHash, isInitializing: false }))
      console.log('Initialize pool tx submitted:', txHash)

      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash })
      }

      return txHash
    } catch (err) {
      console.error('Initialize pool failed:', err)
      setState(s => ({
        ...s,
        isInitializing: false,
        error: err instanceof Error ? err.message : 'Failed to initialize pool',
      }))
      return null
    }
  }, [address, isConnected, publicClient, writeContractAsync])

  /**
   * Approve token spending for the PoolModifyLiquidityTest contract
   */
  const approveToken = useCallback(async (
    tokenAddress: Address,
    amount: bigint
  ): Promise<boolean> => {
    if (!address || tokenAddress === CONTRACTS.nativeEth) return true

    try {
      setState(s => ({ ...s, isApproving: true, error: null }))

      // Check current allowance
      const allowance = await publicClient?.readContract({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [address, CONTRACTS.poolModifyLiquidityTest],
      }) as bigint

      if (allowance >= amount) {
        setState(s => ({ ...s, isApproving: false }))
        return true
      }

      // Approve max uint256 for convenience
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: 'approve',
        args: [CONTRACTS.poolModifyLiquidityTest, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
      })

      setState(s => ({ ...s, txHash }))

      // Wait for approval transaction
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash })
      }

      setState(s => ({ ...s, isApproving: false }))
      return true
    } catch (err) {
      console.error('Approval failed:', err)
      setState(s => ({
        ...s,
        isApproving: false,
        error: err instanceof Error ? err.message : 'Approval failed',
      }))
      return false
    }
  }, [address, publicClient, writeContractAsync])

  /**
   * Add liquidity to a pool
   */
  const addLiquidity = useCallback(async (config: AddLiquidityConfig): Promise<`0x${string}` | null> => {
    if (!address || !isConnected) {
      setState(s => ({ ...s, error: 'Wallet not connected' }))
      return null
    }

    const {
      poolKey,
      amount0,
      amount1,
      sqrtPriceX96 = BigInt('3961408125713216879677197516800'), // ~$2500 ETH default
      tickLower = FULL_RANGE_TICK_LOWER,
      tickUpper = FULL_RANGE_TICK_UPPER,
      hookData = '0x' as `0x${string}`,
    } = config

    try {
      setState(s => ({ ...s, isAddingLiquidity: true, error: null, txHash: null }))

      // Approve token1 (USDC) if needed
      if (poolKey.currency1 !== CONTRACTS.nativeEth && amount1 > 0n) {
        const approved = await approveToken(poolKey.currency1, amount1)
        if (!approved) {
          setState(s => ({ ...s, isAddingLiquidity: false }))
          return null
        }
      }

      // Calculate liquidity delta using proper math
      const liquidityDelta = calculateLiquidityFromAmounts(amount0, amount1, sqrtPriceX96)

      if (liquidityDelta === 0n) {
        setState(s => ({
          ...s,
          isAddingLiquidity: false,
          error: 'Invalid liquidity amount calculated',
        }))
        return null
      }

      // Generate a unique salt for this position
      const salt = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`

      const params: ModifyLiquidityParams = {
        tickLower,
        tickUpper,
        liquidityDelta,
        salt,
      }

      console.log('Adding liquidity with params:', {
        poolKey: {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks,
        },
        params: {
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          liquidityDelta: params.liquidityDelta.toString(),
          salt: params.salt,
        },
        hookData,
        ethValue: amount0.toString(),
        usdcValue: amount1.toString(),
        sqrtPriceX96: sqrtPriceX96.toString(),
        calculatedLiquidity: liquidityDelta.toString(),
      })

      // Validate the pool key
      if (poolKey.currency0.toLowerCase() >= poolKey.currency1.toLowerCase()) {
        console.error('Invalid pool key: currency0 must be less than currency1')
        setState(s => ({
          ...s,
          isAddingLiquidity: false,
          error: 'Invalid pool key: currency0 must be less than currency1',
        }))
        return null
      }

      // Validate tick range
      if (params.tickLower >= params.tickUpper) {
        console.error('Invalid tick range: tickLower must be less than tickUpper')
        setState(s => ({
          ...s,
          isAddingLiquidity: false,
          error: 'Invalid tick range',
        }))
        return null
      }

      // Validate ticks are multiples of tick spacing
      if (params.tickLower % poolKey.tickSpacing !== 0 || params.tickUpper % poolKey.tickSpacing !== 0) {
        console.error('Invalid ticks: must be multiples of tick spacing', {
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          tickSpacing: poolKey.tickSpacing,
        })
        setState(s => ({
          ...s,
          isAddingLiquidity: false,
          error: `Ticks must be multiples of ${poolKey.tickSpacing}`,
        }))
        return null
      }

      // Call modifyLiquidity with ETH value for currency0
      const txHash = await writeContractAsync({
        address: CONTRACTS.poolModifyLiquidityTest,
        abi: PoolModifyLiquidityTestABI,
        functionName: 'modifyLiquidity',
        args: [
          poolKey,
          params,
          hookData,
          false, // settleUsingBurn
          false, // takeClaims
        ],
        value: amount0, // Send ETH for currency0
      })

      setState(s => ({ ...s, txHash, isAddingLiquidity: false }))
      console.log('Add liquidity tx submitted:', txHash)

      return txHash
    } catch (err) {
      console.error('Add liquidity failed:', err)
      setState(s => ({
        ...s,
        isAddingLiquidity: false,
        error: err instanceof Error ? err.message : 'Failed to add liquidity',
      }))
      return null
    }
  }, [address, isConnected, approveToken, writeContractAsync])

  /**
   * Remove liquidity from a pool
   */
  const removeLiquidity = useCallback(async (
    poolKey: PoolKey,
    liquidityAmount: bigint,
    tickLower: number = FULL_RANGE_TICK_LOWER,
    tickUpper: number = FULL_RANGE_TICK_UPPER,
    salt: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000',
    hookData: `0x${string}` = '0x'
  ): Promise<`0x${string}` | null> => {
    if (!address || !isConnected) {
      setState(s => ({ ...s, error: 'Wallet not connected' }))
      return null
    }

    try {
      setState(s => ({ ...s, isRemovingLiquidity: true, error: null, txHash: null }))

      const params: ModifyLiquidityParams = {
        tickLower,
        tickUpper,
        liquidityDelta: -liquidityAmount, // Negative for removing
        salt,
      }

      console.log('Removing liquidity with params:', {
        poolKey,
        params: {
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          liquidityDelta: params.liquidityDelta.toString(),
          salt: params.salt,
        },
        hookData,
      })

      const txHash = await writeContractAsync({
        address: CONTRACTS.poolModifyLiquidityTest,
        abi: PoolModifyLiquidityTestABI,
        functionName: 'modifyLiquidity',
        args: [
          poolKey,
          params,
          hookData,
          false, // settleUsingBurn
          false, // takeClaims
        ],
      })

      setState(s => ({ ...s, txHash, isRemovingLiquidity: false }))
      console.log('Remove liquidity tx submitted:', txHash)

      return txHash
    } catch (err) {
      console.error('Remove liquidity failed:', err)
      setState(s => ({
        ...s,
        isRemovingLiquidity: false,
        error: err instanceof Error ? err.message : 'Failed to remove liquidity',
      }))
      return null
    }
  }, [address, isConnected, writeContractAsync])

  /**
   * Reset error state
   */
  const resetError = useCallback(() => {
    setState(s => ({ ...s, error: null }))
  }, [])

  return {
    ...state,
    txReceipt,
    initializePool,
    addLiquidity,
    removeLiquidity,
    approveToken,
    resetError,
  }
}

/**
 * Hook to create a GrimSwapZK pool key
 */
export function useGrimSwapPoolKey() {
  // ETH/USDC pool with GrimSwapZK hook
  // NOTE: Using fee=500, tickSpacing=10 which is compatible with the deployed hook
  const poolKey: PoolKey = {
    currency0: CONTRACTS.nativeEth,
    currency1: CONTRACTS.usdc,
    fee: 500, // 0.05%
    tickSpacing: 10,
    hooks: CONTRACTS.grimSwapZK,
  }

  return poolKey
}

/**
 * Hook to create a vanilla (no hook) pool key
 */
export function useVanillaPoolKey() {
  const poolKey: PoolKey = {
    currency0: CONTRACTS.nativeEth,
    currency1: CONTRACTS.usdc,
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000' as Address,
  }

  return poolKey
}
