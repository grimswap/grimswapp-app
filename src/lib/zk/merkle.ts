/**
 * Merkle tree utilities for GrimSwap ZK proofs
 * Extended from @grimswap/circuits SDK with persistence support
 */

import {
  MERKLE_TREE_HEIGHT as SDK_MERKLE_TREE_HEIGHT,
  ZERO_VALUE as SDK_ZERO_VALUE,
  MerkleTree as SDKMerkleTree,
  formatProofForCircuit as sdkFormatProofForCircuit,
  type MerkleProof,
} from '@grimswap/circuits'

// Re-export SDK constants
export const MERKLE_TREE_HEIGHT = SDK_MERKLE_TREE_HEIGHT
export const ZERO_VALUE = SDK_ZERO_VALUE

// Re-export SDK format function
export const formatProofForCircuit = sdkFormatProofForCircuit

/**
 * Extended MerkleTree class with persistence support
 * Wraps SDK MerkleTree and adds importState/exportState
 */
export class MerkleTree {
  private sdkTree: SDKMerkleTree
  private leavesStore: bigint[] = []

  constructor(height: number = MERKLE_TREE_HEIGHT) {
    this.sdkTree = new SDKMerkleTree(height)
  }

  /**
   * Initialize the tree
   */
  async initialize(): Promise<void> {
    await this.sdkTree.initialize()
  }

  /**
   * Insert a leaf into the tree
   */
  async insert(leaf: bigint): Promise<number> {
    this.leavesStore.push(leaf)
    return this.sdkTree.insert(leaf)
  }

  /**
   * Get current root
   */
  getRoot(): bigint {
    return this.sdkTree.getRoot()
  }

  /**
   * Generate Merkle proof for a leaf
   */
  getProof(leafIndex: number): MerkleProof {
    return this.sdkTree.getProof(leafIndex)
  }

  /**
   * Get number of leaves
   */
  getLeafCount(): number {
    return this.sdkTree.leafCount
  }

  /**
   * Export tree state for persistence
   */
  exportState(): { height: number; leaves: string[] } {
    return {
      height: MERKLE_TREE_HEIGHT,
      leaves: this.leavesStore.map(l => l.toString()),
    }
  }

  /**
   * Import tree state from storage
   */
  async importState(state: { height: number; leaves: string[] }): Promise<void> {
    this.leavesStore = []
    await this.initialize()

    for (const leafStr of state.leaves) {
      const leaf = BigInt(leafStr)
      this.leavesStore.push(leaf)
      await this.sdkTree.insert(leaf)
    }
  }
}

/**
 * Build Merkle tree from list of commitments
 */
export async function buildMerkleTree(commitments: bigint[]): Promise<MerkleTree> {
  const tree = new MerkleTree()
  await tree.initialize()

  for (const commitment of commitments) {
    await tree.insert(commitment)
  }

  return tree
}
