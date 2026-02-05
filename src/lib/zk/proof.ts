/**
 * ZK proof generation using snarkjs
 * Uses Web Worker for non-blocking proof generation
 *
 * Core types from @grimswap/circuits SDK
 */

import { groth16 } from 'snarkjs'
import type { Address } from 'viem'
import type { DepositNote, MerkleProof } from '@grimswap/circuits'
import { formatProofForCircuit } from './merkle'
import type { WorkerResponse } from './proof.worker'

// Circuit files paths (in public directory)
const WASM_PATH = '/circuits/privateSwap.wasm'
const ZKEY_PATH = '/circuits/privateSwap_final.zkey'

// Worker instance (singleton)
let proofWorker: Worker | null = null
let workerPromises: Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; onProgress?: (stage: string, progress: number) => void }> = new Map()

/**
 * Initialize the proof worker
 */
function getProofWorker(): Worker | null {
  if (typeof Worker === 'undefined') {
    return null
  }

  if (!proofWorker) {
    try {
      // Vite worker import
      proofWorker = new Worker(
        new URL('./proof.worker.ts', import.meta.url),
        { type: 'module' }
      )

      proofWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, id, data, error, stage, progress } = event.data
        const pending = workerPromises.get(id)

        if (!pending) return

        if (type === 'progress' && stage && progress !== undefined) {
          pending.onProgress?.(stage, progress)
        } else if (type === 'result') {
          workerPromises.delete(id)
          pending.resolve(data)
        } else if (type === 'error') {
          workerPromises.delete(id)
          pending.reject(new Error(error || 'Worker error'))
        }
      }

      proofWorker.onerror = (error) => {
        console.error('Proof worker error:', error)
        // Reject all pending promises
        workerPromises.forEach((pending, id) => {
          pending.reject(new Error('Worker crashed'))
          workerPromises.delete(id)
        })
      }
    } catch (e) {
      console.warn('Failed to create proof worker, falling back to main thread:', e)
      return null
    }
  }

  return proofWorker
}

/**
 * Generate a unique ID for worker messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Re-use SDK types for Groth16Proof and ContractProof
import type {
  Groth16Proof as SDKGroth16Proof,
  ContractProof as SDKContractProof,
} from '@grimswap/circuits'

// Alias SDK types (snarkjs output format is compatible)
export type Groth16Proof = SDKGroth16Proof
export type ContractProof = SDKContractProof

/**
 * Public signals for the circuit
 */
export interface PublicSignals {
  merkleRoot: bigint
  nullifierHash: bigint
  recipient: Address
  relayer: Address
  relayerFee: bigint
  swapAmountOut: bigint
}

/**
 * Swap parameters for proof generation
 */
export interface SwapParams {
  recipient: Address
  relayer: Address
  relayerFee: number // Basis points (100 = 1%)
  swapAmountOut: bigint // Expected output amount from swap
}

/**
 * Yield to the event loop to allow UI updates
 */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => {
    // Use requestAnimationFrame for smoother UI updates
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => setTimeout(resolve, 0))
    } else {
      setTimeout(resolve, 0)
    }
  })
}

/**
 * Generate proof using Web Worker (non-blocking)
 */
async function generateProofInWorker(
  circuitInputs: Record<string, any>,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
  const worker = getProofWorker()

  if (!worker) {
    // Fallback to main thread with UI yielding
    onProgress?.('Loading circuit...', 0.2)

    // Yield to let UI update before heavy computation
    await yieldToUI()

    onProgress?.('Generating proof...', 0.4)

    // Another yield point
    await yieldToUI()

    try {
      const result = await groth16.fullProve(
        circuitInputs,
        WASM_PATH,
        ZKEY_PATH
      )

      onProgress?.('Proof generated', 1.0)
      // Cast to SDK Groth16Proof type (snarkjs returns compatible structure)
      return {
        proof: result.proof as unknown as Groth16Proof,
        publicSignals: result.publicSignals as string[],
      }
    } catch (error) {
      console.error('groth16.fullProve failed:', error)
      throw error
    }
  }

  const id = generateId()

  return new Promise((resolve, reject) => {
    workerPromises.set(id, { resolve, reject, onProgress })

    worker.postMessage({
      type: 'generate',
      id,
      data: { circuitInputs }
    })

    // Timeout after 60 seconds
    setTimeout(() => {
      if (workerPromises.has(id)) {
        workerPromises.delete(id)
        reject(new Error('Proof generation timed out'))
      }
    }, 60000)
  })
}

/**
 * Generate ZK proof for private swap
 */
export async function generateProof(
  note: DepositNote,
  merkleProof: MerkleProof,
  swapParams: SwapParams,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ proof: Groth16Proof; publicSignals: string[] }> {
  if (!note.leafIndex && note.leafIndex !== 0) {
    throw new Error('Deposit note must have leafIndex set')
  }

  onProgress?.('Preparing inputs', 0.1)

  // Format Merkle proof for circuit
  const { pathElements, pathIndices } = formatProofForCircuit(merkleProof)

  // Prepare circuit inputs
  const circuitInputs = {
    // Private inputs
    secret: note.secret.toString(),
    nullifier: note.nullifier.toString(),
    depositAmount: note.amount.toString(),
    pathElements,
    pathIndices,

    // Public inputs
    merkleRoot: merkleProof.root.toString(),
    nullifierHash: note.nullifierHash.toString(),
    recipient: BigInt(swapParams.recipient).toString(),
    relayer: BigInt(swapParams.relayer).toString(),
    relayerFee: swapParams.relayerFee.toString(),
    swapAmountOut: swapParams.swapAmountOut.toString(),
  }

  try {
    // Use worker for non-blocking proof generation
    const result = await generateProofInWorker(circuitInputs, onProgress)
    return result
  } catch (error) {
    console.error('Proof generation failed:', error)
    throw new Error(`Failed to generate proof: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Format proof for smart contract
 * Returns SDK ContractProof format (pA, pB, pC, pubSignals)
 */
export function formatProofForContract(
  proof: Groth16Proof,
  publicSignals: string[]
): ContractProof {
  // Format as strings for SDK ContractProof type
  const pA: [string, string] = [
    proof.pi_a[0],
    proof.pi_a[1],
  ]

  const pB: [[string, string], [string, string]] = [
    [proof.pi_b[0][1], proof.pi_b[0][0]], // Note: reversed for Solidity
    [proof.pi_b[1][1], proof.pi_b[1][0]],
  ]

  const pC: [string, string] = [
    proof.pi_c[0],
    proof.pi_c[1],
  ]

  return { pA, pB, pC, pubSignals: publicSignals }
}

/**
 * Encode proof as hook data for Uniswap v4
 */
export function encodeProofAsHookData(contractProof: ContractProof): `0x${string}` {
  // This would use ABI encoding - simplified for now
  // In production, use viem's encodeAbiParameters
  const encoded = JSON.stringify(contractProof)
  return `0x${Buffer.from(encoded).toString('hex')}`
}

/**
 * Verify proof locally (before submitting)
 */
export async function verifyProofLocally(
  proof: Groth16Proof,
  publicSignals: string[]
): Promise<boolean> {
  try {
    // Verification key should be loaded from file
    const vKeyResponse = await fetch('/circuits/verification_key.json')
    const vKey = await vKeyResponse.json()

    const isValid = await groth16.verify(vKey, publicSignals, proof)
    return isValid
  } catch (error) {
    console.error('Local verification failed:', error)
    return false
  }
}

/**
 * Generate proof for relayer submission
 */
export async function generateProofForRelayer(
  note: DepositNote,
  merkleProof: MerkleProof,
  swapParams: SwapParams,
  onProgress?: (stage: string, progress: number) => void
): Promise<{
  proof: Groth16Proof
  publicSignals: string[]
  contractProof: ContractProof
  isValid: boolean
}> {
  // Generate proof
  const { proof, publicSignals } = await generateProof(
    note,
    merkleProof,
    swapParams,
    onProgress
  )

  // Verify locally
  onProgress?.('Verifying proof', 0.9)
  const isValid = await verifyProofLocally(proof, publicSignals)

  if (!isValid) {
    throw new Error('Generated proof is invalid')
  }

  // Format for contract
  const contractProof = formatProofForContract(proof, publicSignals)

  return {
    proof,
    publicSignals,
    contractProof,
    isValid,
  }
}

/**
 * Estimate proof generation time
 */
export function estimateProofTime(): number {
  // Typical browser proof generation: ~5-15 seconds
  // With worker: same time but non-blocking
  return 10000 // milliseconds
}

/**
 * Check if Web Workers are available for proof generation
 */
export function supportsWebWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

/**
 * Terminate the proof worker (cleanup)
 */
export function terminateProofWorker(): void {
  if (proofWorker) {
    proofWorker.terminate()
    proofWorker = null
    workerPromises.clear()
  }
}
