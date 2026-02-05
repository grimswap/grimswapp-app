/**
 * GrimSwap ZK library
 *
 * Re-exports from @grimswap/circuits SDK with app-specific extensions
 */

// Import from SDK (types and functions that don't use Node.js crypto)
import {
  formatProofForContract as sdkFormatProofForContract,
  type DepositNote,
  type MerkleProof,
  type Groth16Proof,
  type ContractProof,
} from '@grimswap/circuits'

// Import browser-compatible implementations from local commitment.ts
import {
  initPoseidon as localInitPoseidon,
  poseidonHash as localPoseidonHash,
  randomBigInt as localRandomBigInt,
  createDepositNote as localCreateDepositNote,
  computeCommitment as localComputeCommitment,
  computeNullifierHash as localComputeNullifierHash,
  formatCommitmentForContract as localFormatCommitmentForContract,
  serializeNote as localSerializeNote,
  deserializeNote as localDeserializeNote,
  reconstructDepositNote as localReconstructDepositNote,
} from './commitment'

// Re-export browser-compatible functions
export const initPoseidon = localInitPoseidon
export const poseidonHash = localPoseidonHash
export const randomBigInt = localRandomBigInt
export const createDepositNote = localCreateDepositNote
export const computeCommitment = localComputeCommitment
export const computeNullifierHash = localComputeNullifierHash
export const formatCommitmentForContract = localFormatCommitmentForContract
export const serializeNote = localSerializeNote
export const deserializeNote = localDeserializeNote
export const reconstructDepositNote = localReconstructDepositNote

// Proof formatting re-export
export const formatProofForContract = sdkFormatProofForContract

// Re-export types
export type { DepositNote, MerkleProof, Groth16Proof, ContractProof }

// Local Merkle tree with persistence support (wraps SDK)
export {
  MerkleTree,
  MERKLE_TREE_HEIGHT,
  ZERO_VALUE,
  buildMerkleTree,
  formatProofForCircuit,
} from './merkle'

// Proof generation with Web Worker support (app-specific)
export {
  generateProof,
  encodeProofAsHookData,
  verifyProofLocally,
  generateProofForRelayer,
  estimateProofTime,
  supportsWebWorkers,
  type PublicSignals,
  type SwapParams,
} from './proof'
