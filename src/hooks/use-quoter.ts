import { useState, useCallback } from 'react'
import { type Address, encodeFunctionData } from 'viem'
import { usePublicClient } from 'wagmi'
import { quoterConfig, type PoolKey } from '@/lib/contracts'

/**
 * Quote result from Quoter contract
 */
export interface QuoteResult {
  amountOut: bigint
  gasEstimate: bigint
}

/**
 * Quote params for exactInputSingle
 */
export interface QuoteExactInputSingleParams {
  poolKey: PoolKey
  zeroForOne: boolean
  exactAmount: bigint
  hookData?: `0x${string}`
}

/**
 * Hook to get swap quotes from Uniswap v4 Quoter
 * Uses quoteExactInputSingle for single-pool swaps
 */
export function useQuoter() {
  const [isQuoting, setIsQuoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publicClient = usePublicClient()

  /**
   * Get a quote for an exact input swap
   * @param params - The quote parameters
   * @returns The expected output amount and gas estimate
   */
  const quoteExactInputSingle = useCallback(async (
    params: QuoteExactInputSingleParams
  ): Promise<QuoteResult | null> => {
    if (!publicClient) {
      setError('No public client available')
      return null
    }

    if (params.exactAmount === 0n) {
      return { amountOut: 0n, gasEstimate: 0n }
    }

    try {
      setIsQuoting(true)
      setError(null)

      console.log('Requesting quote from Quoter:', {
        quoterAddress: quoterConfig.address,
        poolKey: {
          currency0: params.poolKey.currency0,
          currency1: params.poolKey.currency1,
          fee: params.poolKey.fee,
          tickSpacing: params.poolKey.tickSpacing,
          hooks: params.poolKey.hooks,
        },
        zeroForOne: params.zeroForOne,
        exactAmount: params.exactAmount.toString(),
      })

      // The Quoter contract uses a special pattern - it reverts with the quote data
      // We need to use eth_call and catch the revert
      const quoteParams = {
        poolKey: {
          currency0: params.poolKey.currency0 as Address,
          currency1: params.poolKey.currency1 as Address,
          fee: params.poolKey.fee,
          tickSpacing: params.poolKey.tickSpacing,
          hooks: params.poolKey.hooks as Address,
        },
        zeroForOne: params.zeroForOne,
        exactAmount: params.exactAmount,
        hookData: params.hookData || '0x' as `0x${string}`,
      }

      // Encode the function call
      const callData = encodeFunctionData({
        abi: quoterConfig.abi,
        functionName: 'quoteExactInputSingle',
        args: [quoteParams],
      })

      // Use eth_call to simulate the transaction
      // The quoter reverts with the result encoded in the revert data
      try {
        const result = await publicClient.call({
          to: quoterConfig.address as Address,
          data: callData,
        })

        // If we get here without error, decode the result
        // This shouldn't happen with standard quoter, but handle it
        if (result.data) {
          // Try to decode as tuple (uint256, uint256)
          const amountOut = BigInt('0x' + result.data.slice(2, 66))
          const gasEstimate = BigInt('0x' + result.data.slice(66, 130))

          console.log('Quote result:', {
            amountOut: amountOut.toString(),
            gasEstimate: gasEstimate.toString(),
          })

          return { amountOut, gasEstimate }
        }
      } catch (callError: unknown) {
        // The quoter reverts with the result - this is expected behavior
        // Parse the revert data to get the actual quote
        console.log('Quote call reverted (expected):', callError)

        // Check if the error contains revert data
        const errorData = (callError as { data?: string })?.data
        if (errorData && typeof errorData === 'string' && errorData.length >= 130) {
          // Decode the revert data
          // Format: 0x + amountOut (32 bytes) + gasEstimate (32 bytes)
          try {
            const amountOut = BigInt('0x' + errorData.slice(2, 66))
            const gasEstimate = BigInt('0x' + errorData.slice(66, 130))

            console.log('Quote result from revert:', {
              amountOut: amountOut.toString(),
              gasEstimate: gasEstimate.toString(),
            })

            return { amountOut, gasEstimate }
          } catch (decodeError) {
            console.error('Failed to decode revert data:', decodeError)
          }
        }

        // If we can't parse the revert, try a different approach
        // Use simulateContract which may handle reverts differently
        throw callError
      }

      return null
    } catch (err) {
      console.error('Failed to get quote:', err)
      setError(err instanceof Error ? err.message : 'Failed to get quote')
      return null
    } finally {
      setIsQuoting(false)
    }
  }, [publicClient])

  /**
   * Get a quote for exact output swap (how much input needed for desired output)
   */
  const quoteExactOutputSingle = useCallback(async (
    params: QuoteExactInputSingleParams
  ): Promise<{ amountIn: bigint; gasEstimate: bigint } | null> => {
    if (!publicClient) {
      setError('No public client available')
      return null
    }

    if (params.exactAmount === 0n) {
      return { amountIn: 0n, gasEstimate: 0n }
    }

    try {
      setIsQuoting(true)
      setError(null)

      const quoteParams = {
        poolKey: {
          currency0: params.poolKey.currency0 as Address,
          currency1: params.poolKey.currency1 as Address,
          fee: params.poolKey.fee,
          tickSpacing: params.poolKey.tickSpacing,
          hooks: params.poolKey.hooks as Address,
        },
        zeroForOne: params.zeroForOne,
        exactAmount: params.exactAmount,
        hookData: params.hookData || '0x' as `0x${string}`,
      }

      const callData = encodeFunctionData({
        abi: quoterConfig.abi,
        functionName: 'quoteExactOutputSingle',
        args: [quoteParams],
      })

      try {
        const result = await publicClient.call({
          to: quoterConfig.address as Address,
          data: callData,
        })

        if (result.data) {
          const amountIn = BigInt('0x' + result.data.slice(2, 66))
          const gasEstimate = BigInt('0x' + result.data.slice(66, 130))
          return { amountIn, gasEstimate }
        }
      } catch (callError: unknown) {
        const errorData = (callError as { data?: string })?.data
        if (errorData && typeof errorData === 'string' && errorData.length >= 130) {
          try {
            const amountIn = BigInt('0x' + errorData.slice(2, 66))
            const gasEstimate = BigInt('0x' + errorData.slice(66, 130))
            return { amountIn, gasEstimate }
          } catch {
            // Fall through to error handling
          }
        }
        throw callError
      }

      return null
    } catch (err) {
      console.error('Failed to get output quote:', err)
      setError(err instanceof Error ? err.message : 'Failed to get quote')
      return null
    } finally {
      setIsQuoting(false)
    }
  }, [publicClient])

  return {
    quoteExactInputSingle,
    quoteExactOutputSingle,
    isQuoting,
    error,
  }
}

/**
 * Calculate output amount from quote result with token decimals
 */
export function formatQuoteOutput(
  amountOut: bigint,
  decimals: number = 6
): string {
  const divisor = BigInt(10 ** decimals)
  const integerPart = amountOut / divisor
  const fractionalPart = amountOut % divisor

  const fractionStr = fractionalPart.toString().padStart(decimals, '0')
  const trimmedFraction = fractionStr.slice(0, Math.min(decimals, 6)).replace(/0+$/, '')

  if (trimmedFraction) {
    return `${integerPart}.${trimmedFraction}`
  }
  return integerPart.toString()
}
