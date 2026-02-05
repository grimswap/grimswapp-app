/**
 * Commitment utilities for GrimSwap ZK proofs
 *
 * Browser-compatible implementations that use Web Crypto API
 * instead of Node.js crypto module
 */

import {
  initPoseidon,
  poseidonHash,
  computeCommitment,
  computeNullifierHash,
  formatCommitmentForContract,
  serializeNote,
  deserializeNote,
  reconstructDepositNote,
  type DepositNote,
} from '@grimswap/circuits'

// Re-export SDK functions that don't use Node crypto
export {
  initPoseidon,
  poseidonHash,
  computeCommitment,
  computeNullifierHash,
  formatCommitmentForContract,
  serializeNote,
  deserializeNote,
  reconstructDepositNote,
  type DepositNote,
}

/**
 * Generate random 256-bit value using Web Crypto API (browser-compatible)
 */
export function randomBigInt(): bigint {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''))
}

/**
 * Create a new deposit note (browser-compatible version)
 * Uses Web Crypto API instead of Node.js crypto
 */
export async function createDepositNote(amount: bigint): Promise<DepositNote> {
  // Generate random values using browser's crypto API
  const nullifier = randomBigInt()
  const secret = randomBigInt()

  // Use SDK's Poseidon hash functions for commitment and nullifier hash
  const commitment = await computeCommitment(nullifier, secret, amount)
  const nullifierHash = await computeNullifierHash(nullifier)

  return {
    nullifier,
    secret,
    amount,
    commitment,
    nullifierHash,
  }
}
