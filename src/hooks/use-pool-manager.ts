import { useState, useEffect, useCallback } from 'react'
import { type Address, encodeAbiParameters, parseAbiParameters, keccak256, parseAbiItem } from 'viem'
import { usePublicClient } from 'wagmi'
import { poolManagerConfig, type PoolKey } from '@/lib/contracts'

/**
 * Pool state structure from Uniswap v4
 */
export interface PoolState {
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
  protocolFee: number
}

/**
 * Calculate pool ID from pool key (matches Uniswap v4 PoolId.toId())
 * Uses abi.encode, NOT encodePacked
 */
export function calculatePoolId(key: PoolKey): `0x${string}` {
  // Uniswap v4 uses abi.encode(PoolKey) then keccak256
  const encoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [
      key.currency0 as Address,
      key.currency1 as Address,
      key.fee,
      key.tickSpacing,
      key.hooks as Address,
    ]
  )
  return keccak256(encoded)
}

// Event ABIs for Uniswap v4 PoolManager
const swapEventAbi = parseAbiItem(
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
)

const initializeEventAbi = parseAbiItem(
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)'
)

/**
 * Calculate token price from sqrtPriceX96
 * Price of token1 in terms of token0
 * Adjusted for decimal differences between tokens
 */
export function calculatePrice(
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
  // If token0 has 18 decimals and token1 has 6 decimals
  // We need to multiply by 10^(token0Decimals - token1Decimals)
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals)
  return rawPrice * decimalAdjustment
}

/**
 * Calculate inverse price (token0 in terms of token1)
 */
export function calculateInversePrice(
  sqrtPriceX96: bigint,
  token0Decimals: number = 18,
  token1Decimals: number = 6
): number {
  const price = calculatePrice(sqrtPriceX96, token0Decimals, token1Decimals)
  return price > 0 ? 1 / price : 0
}

/**
 * Hook to fetch pool state from PoolManager using events
 * @param poolKey - The pool key configuration
 * @param useKnownPoolId - If true, use the known pool ID instead of calculating
 */
export function usePoolState(poolKey: PoolKey, useKnownPoolId: boolean = true) {
  const [poolState, setPoolState] = useState<PoolState | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
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

      console.log('Fetching pool state from events:', {
        usingKnownPoolId: useKnownPoolId,
        calculatedPoolId,
        actualPoolId: poolId,
        poolIdMatch: calculatedPoolId === KNOWN_POOL_IDS.ETH_USDC_0_3,
      })

      // Get current block number for range calculation
      const currentBlock = await publicClient.getBlockNumber()
      console.log('Current block:', currentBlock.toString())

      // First, check Initialize event (search from a reasonable starting block)
      // Unichain Sepolia started around block 0, but pools may have been created later
      console.log('Checking Initialize events...')
      const initLogs = await publicClient.getLogs({
        address: poolManagerConfig.address as Address,
        event: initializeEventAbi,
        args: {
          id: poolId,
        },
        fromBlock: 0n,
        toBlock: 'latest',
      })

      console.log(`Found ${initLogs.length} Initialize events for pool ID: ${poolId}`)

      let sqrtPriceFromInit: bigint | undefined
      let tickFromInit: number | undefined

      if (initLogs.length > 0) {
        const initEvent = initLogs[0]
        sqrtPriceFromInit = initEvent.args.sqrtPriceX96
        tickFromInit = initEvent.args.tick

        console.log('Initialize event data:', {
          sqrtPriceX96: sqrtPriceFromInit?.toString(),
          tick: tickFromInit,
          blockNumber: initEvent.blockNumber?.toString(),
          currency0: initEvent.args.currency0,
          currency1: initEvent.args.currency1,
        })
      }

      // Now check for more recent Swap events to get current price
      // Search last 50000 blocks for more coverage on testnet
      const swapFromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n

      const swapLogs = await publicClient.getLogs({
        address: poolManagerConfig.address as Address,
        event: swapEventAbi,
        args: {
          id: poolId,
        },
        fromBlock: swapFromBlock,
        toBlock: 'latest',
      })

      console.log(`Found ${swapLogs.length} Swap events for pool`)

      if (swapLogs.length > 0) {
        // Get the most recent swap event for the latest price
        const latestSwap = swapLogs[swapLogs.length - 1]
        const { sqrtPriceX96, liquidity, tick, fee } = latestSwap.args

        console.log('Latest Swap event data:', {
          sqrtPriceX96: sqrtPriceX96?.toString(),
          liquidity: liquidity?.toString(),
          tick,
          fee,
          blockNumber: latestSwap.blockNumber?.toString(),
        })

        if (sqrtPriceX96 && sqrtPriceX96 > 0n) {
          // Calculate and log the price for debugging
          const calculatedPrice = calculatePrice(sqrtPriceX96, token0Decimals, token1Decimals)
          console.log('Calculated price from swap event:', calculatedPrice, 'USDC/ETH')

          setPoolState({
            sqrtPriceX96,
            tick: tick ?? 0,
            liquidity: liquidity ?? 0n,
            protocolFee: fee ?? 0,
          })
          setIsInitialized(true)
          setIsLoading(false)
          return
        }
      }

      // Use Initialize event data if no swap events
      if (sqrtPriceFromInit && sqrtPriceFromInit > 0n) {
        const calculatedPrice = calculatePrice(sqrtPriceFromInit, token0Decimals, token1Decimals)
        console.log('Calculated price from init event:', calculatedPrice, 'USDC/ETH')

        setPoolState({
          sqrtPriceX96: sqrtPriceFromInit,
          tick: tickFromInit ?? 0,
          liquidity: 0n,
          protocolFee: 0,
        })
        setIsInitialized(true)
        setIsLoading(false)
        return
      }

      // If we still don't have data, try extsload as fallback
      console.log('No events found, trying extsload fallback...')

      // Try different slot numbers (Uniswap v4 uses slot 6 or 10 depending on version)
      for (const POOLS_SLOT of [6n, 10n]) {
        const stateSlot = keccak256(
          encodeAbiParameters(
            parseAbiParameters('bytes32, uint256'),
            [poolId, POOLS_SLOT]
          )
        )

        try {
          const stateData = await publicClient.readContract({
            address: poolManagerConfig.address as Address,
            abi: poolManagerConfig.abi,
            functionName: 'extsload',
            args: [stateSlot],
          }) as `0x${string}`

          if (stateData && stateData !== '0x' && BigInt(stateData) !== 0n) {
            // Decode packed state data
            const packedData = BigInt(stateData)
            const sqrtPriceX96 = packedData & ((BigInt(1) << BigInt(160)) - BigInt(1))

            if (sqrtPriceX96 > 0n) {
              // tick is signed 24-bit, handle sign extension
              let tick = Number((packedData >> BigInt(160)) & BigInt(0xffffff))
              if (tick > 0x7fffff) {
                tick = tick - 0x1000000
              }

              const protocolFee = Number((packedData >> BigInt(184)) & BigInt(0xffffff))

              console.log(`Found pool state via extsload (slot ${POOLS_SLOT}):`, {
                sqrtPriceX96: sqrtPriceX96.toString(),
                tick,
                protocolFee,
              })

              const calculatedPrice = calculatePrice(sqrtPriceX96, token0Decimals, token1Decimals)
              console.log('Calculated price from extsload:', calculatedPrice, 'USDC/ETH')

              // Read liquidity from next slot
              const liquiditySlotBigInt = BigInt(stateSlot) + 1n
              const liquiditySlot = `0x${liquiditySlotBigInt.toString(16).padStart(64, '0')}` as `0x${string}`

              let liquidity = 0n
              try {
                const liquidityData = await publicClient.readContract({
                  address: poolManagerConfig.address as Address,
                  abi: poolManagerConfig.abi,
                  functionName: 'extsload',
                  args: [liquiditySlot],
                }) as `0x${string}`
                liquidity = liquidityData ? BigInt(liquidityData) : 0n
              } catch (e) {
                console.warn('Could not read liquidity:', e)
              }

              setPoolState({
                sqrtPriceX96,
                tick,
                liquidity,
                protocolFee,
              })
              setIsInitialized(true)
              setIsLoading(false)
              return
            }
          }
        } catch (e) {
          console.log(`extsload failed for slot ${POOLS_SLOT}:`, e)
        }
      }

      // Last resort: check if any Initialize events exist at all
      console.log('No data found via extsload, checking for any Initialize events...')
      const anyInitLogs = await publicClient.getLogs({
        address: poolManagerConfig.address as Address,
        event: initializeEventAbi,
        fromBlock: currentBlock > 10000n ? currentBlock - 10000n : 0n,
        toBlock: 'latest',
      })

      if (anyInitLogs.length > 0) {
        console.log('Recent Initialize events found (different pools):')
        anyInitLogs.slice(0, 3).forEach((log, i) => {
          console.log(`  Pool ${i + 1}:`, {
            id: log.args.id,
            currency0: log.args.currency0,
            currency1: log.args.currency1,
            sqrtPriceX96: log.args.sqrtPriceX96?.toString(),
          })
        })
      }

      // Pool not found
      console.log('Pool not initialized or no data found for target pool')
      setIsInitialized(false)
      setPoolState(null)

    } catch (err) {
      console.error('Failed to fetch pool state:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch pool state')
      setIsInitialized(false)
      setPoolState(null)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, poolId, calculatedPoolId, useKnownPoolId, token0Decimals, token1Decimals])

  useEffect(() => {
    fetchPoolState()
  }, [fetchPoolState, fetchCount])

  // Calculate current price (token1 per token0, i.e., USDC per ETH)
  const currentPrice = poolState
    ? calculatePrice(poolState.sqrtPriceX96, token0Decimals, token1Decimals)
    : null

  // Inverse price (token0 per token1, i.e., ETH per USDC)
  const inversePrice = poolState
    ? calculateInversePrice(poolState.sqrtPriceX96, token0Decimals, token1Decimals)
    : null

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

/**
 * Hook to check if a pool is initialized
 */
export function useIsPoolInitialized(poolKey: PoolKey) {
  const { poolState, isLoading, error, poolId, refetch } = usePoolState(poolKey)

  return {
    isInitialized: poolState !== null && poolState.sqrtPriceX96 > 0n,
    isLoading,
    error,
    poolId,
    refetch,
  }
}

/**
 * Format tick to human-readable price range
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick)
}

/**
 * Calculate output amount for a given input amount using current price
 */
export function calculateSwapOutput(
  inputAmount: bigint,
  sqrtPriceX96: bigint,
  zeroForOne: boolean,
  inputDecimals: number = 18,
  outputDecimals: number = 6
): bigint {
  if (sqrtPriceX96 === 0n || inputAmount === 0n) return 0n

  // Calculate price with decimal adjustment
  const price = calculatePrice(sqrtPriceX96, 18, 6) // ETH(18) / USDC(6)

  // Convert input to number
  const inputFloat = Number(inputAmount) / Math.pow(10, inputDecimals)

  // Calculate output based on direction
  // zeroForOne = true: selling token0 (ETH) for token1 (USDC)
  // zeroForOne = false: selling token1 (USDC) for token0 (ETH)
  let outputFloat: number
  if (zeroForOne) {
    // ETH -> USDC: multiply by price (USDC per ETH)
    outputFloat = inputFloat * price
  } else {
    // USDC -> ETH: divide by price
    outputFloat = inputFloat / price
  }

  // Apply 0.3% fee
  outputFloat = outputFloat * 0.997

  // Convert back to bigint with output decimals
  return BigInt(Math.floor(outputFloat * Math.pow(10, outputDecimals)))
}

/**
 * Known pool IDs for verification
 */
export const KNOWN_POOL_IDS = {
  // ETH/USDC 0.3% vanilla pool on Unichain Sepolia (no hooks)
  ETH_USDC_0_3: '0x1927686e9757bb312fc499e480536d466c788dcdc86a1b62c82643157f05b603',

  // ETH/USDC 0.3% GrimSwap Privacy Pool (with GrimSwapZK hook)
  // Initialized Feb 5, 2026 with sqrtPriceX96: 5024959440117567030793766, tick: -193324
  ETH_USDC_GRIMSWAP: '0x3d98c88f49a4ec2fd2b87dcc793500f0721e0162c70c6021b2205a453b0145fe',
}
