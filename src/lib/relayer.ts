/**
 * Relayer client - uses @grimswap/circuits SDK
 */

import {
  submitToRelayer as sdkSubmitToRelayer,
  getRelayerInfo as sdkGetRelayerInfo,
  checkRelayerHealth as sdkCheckRelayerHealth,
  formatProofForContract as sdkFormatProofForContract,
  type RelayerResponse,
  type ContractProof,
  type Groth16Proof,
  type PoolKey as SDKPoolKey,
} from '@grimswap/circuits'
import { RELAYER_URL } from './constants'
import { type PoolKey } from './contracts'
import { type Address } from 'viem'

// Re-export types
export type { RelayerResponse, ContractProof }

/**
 * Relayer info response
 */
export interface RelayerInfo {
  address: string
  chain: string
  chainId: number
  feeBps: number
  balance: string
}

/**
 * Relay request payload (V3 - supports multi-token)
 */
export interface RelayRequest {
  proof: {
    a: [string, string]
    b: [[string, string], [string, string]]
    c: [string, string]
  }
  publicSignals: string[]
  swapParams: {
    poolKey: {
      currency0: string
      currency1: string
      fee: number
      tickSpacing: number
      hooks: string
    }
    zeroForOne: boolean
    amountSpecified: string
    sqrtPriceLimitX96: string
    // V3: inputToken is required for ERC20 swaps, omit for ETH
    inputToken?: string
  }
}

/**
 * Check relayer health
 */
export async function checkRelayerHealth(): Promise<boolean> {
  return sdkCheckRelayerHealth(RELAYER_URL)
}

/**
 * Get relayer info (address, fee, balance)
 */
export async function getRelayerInfo(): Promise<RelayerInfo | null> {
  try {
    const info = await sdkGetRelayerInfo(RELAYER_URL)
    return {
      address: info.address,
      chain: 'Unichain Sepolia',
      chainId: 1301,
      feeBps: info.fee || 10,
      balance: '0',
    }
  } catch (error) {
    console.error('Failed to get relayer info:', error)
    return null
  }
}

/**
 * Submit a private swap through the relayer using SDK (V3 - multi-token support)
 */
export async function submitToRelayer(request: RelayRequest): Promise<RelayerResponse> {
  try {
    const isERC20Swap = !!request.swapParams.inputToken

    console.log('Submitting to relayer via SDK:', {
      url: RELAYER_URL,
      publicSignals: request.publicSignals,
      swapParams: request.swapParams,
      swapType: isERC20Swap ? 'ERC20' : 'ETH',
    })

    // Convert pool key to SDK format with Address types
    const sdkSwapParams: Record<string, unknown> = {
      poolKey: {
        currency0: request.swapParams.poolKey.currency0 as Address,
        currency1: request.swapParams.poolKey.currency1 as Address,
        fee: request.swapParams.poolKey.fee,
        tickSpacing: request.swapParams.poolKey.tickSpacing,
        hooks: request.swapParams.poolKey.hooks as Address,
      } as SDKPoolKey,
      zeroForOne: request.swapParams.zeroForOne,
      amountSpecified: request.swapParams.amountSpecified,
      sqrtPriceLimitX96: request.swapParams.sqrtPriceLimitX96,
    }

    // V3: Add inputToken for ERC20 swaps
    if (request.swapParams.inputToken) {
      sdkSwapParams.inputToken = request.swapParams.inputToken
    }

    const result = await sdkSubmitToRelayer(
      RELAYER_URL,
      request.proof,
      request.publicSignals,
      sdkSwapParams as Parameters<typeof sdkSubmitToRelayer>[3]
    )

    return result
  } catch (error) {
    console.error('Relayer submission failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Format proof from snarkjs output to relayer format
 */
export function formatProofForRelayer(
  proof: {
    pi_a: string[]
    pi_b: string[][]
    pi_c: string[]
  },
  publicSignals: string[]
): { proof: RelayRequest['proof']; publicSignals: string[] } {
  // Create a Groth16Proof compatible object for SDK
  const groth16Proof: Groth16Proof = {
    pi_a: proof.pi_a as [string, string, string],
    pi_b: proof.pi_b as [[string, string], [string, string], [string, string]],
    pi_c: proof.pi_c as [string, string, string],
    protocol: 'groth16',
    curve: 'bn128',
  }

  const formatted = sdkFormatProofForContract(groth16Proof, publicSignals)
  return {
    proof: {
      a: formatted.pA as [string, string],
      b: formatted.pB as [[string, string], [string, string]],
      c: formatted.pC as [string, string],
    },
    publicSignals: formatted.pubSignals,
  }
}

/**
 * Create swap params for relayer (V3 - multi-token support)
 * @param poolKey - Pool key for the swap
 * @param zeroForOne - true if swapping currency0 for currency1
 * @param amountSpecified - Amount to swap (negative for exact input)
 * @param sqrtPriceLimitX96 - Price limit for the swap
 * @param inputToken - (V3) Token address for ERC20 swaps, omit for ETH
 */
export function createSwapParams(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountSpecified: bigint,
  sqrtPriceLimitX96: bigint,
  inputToken?: Address
): RelayRequest['swapParams'] {
  const params: RelayRequest['swapParams'] = {
    poolKey: {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks,
    },
    zeroForOne,
    amountSpecified: amountSpecified.toString(),
    sqrtPriceLimitX96: sqrtPriceLimitX96.toString(),
  }

  // V3: Add inputToken for ERC20 swaps
  if (inputToken && inputToken !== '0x0000000000000000000000000000000000000000') {
    params.inputToken = inputToken
  }

  return params
}
