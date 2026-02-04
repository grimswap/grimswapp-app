import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address, type Hash, encodeAbiParameters, parseAbiParameters } from 'viem'
import {
  poolHelperConfig,
  grimPoolConfig,
  DEFAULT_POOL_KEY,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  type PoolKey,
} from '@/lib/contracts'
import { type SwapParams as ZKSwapParams } from '@/lib/zk'
import { useZKProof } from './use-zk-proof'
import { useMerkleTree } from './use-merkle-tree'
import { useDepositNotes } from './use-deposit-notes'
import { useToast } from './use-toast'

export type SwapState =
  | 'idle'
  | 'selecting-note'
  | 'syncing-tree'
  | 'adding-root'
  | 'generating-proof'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'error'

interface SwapParams {
  toToken: Address
  minAmountOut: bigint
  recipient: Address // Stealth address
  depositNoteId: number // ID of the deposit note to use
  poolKey?: PoolKey // Optional custom pool key
}

interface SwapResult {
  hash: Hash
  stealthAddress: Address
  nullifierHash: bigint
  gasUsed: bigint
}

/**
 * Format ZK proof for contract (matching test implementation)
 */
function formatProofForContract(proof: any, publicSignals: string[]) {
  return {
    pA: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as [bigint, bigint],
    pB: [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ] as [[bigint, bigint], [bigint, bigint]],
    pC: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as [bigint, bigint],
    pubSignals: publicSignals.map((s) => BigInt(s)) as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint
    ],
  }
}

/**
 * Encode proof as hook data (matching test implementation)
 */
function encodeHookData(contractProof: ReturnType<typeof formatProofForContract>): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters('uint256[2], uint256[2][2], uint256[2], uint256[8]'),
    [contractProof.pA, contractProof.pB, contractProof.pC, contractProof.pubSignals]
  )
}

/**
 * Convert bigint to bytes32 hex
 */
function toBytes32(n: bigint): `0x${string}` {
  return `0x${n.toString(16).padStart(64, '0')}`
}

export function useGrimSwap() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { generateProof, progress: proofProgress } = useZKProof()
  const { getProof: getMerkleProof, syncTree, getRoot, isSyncing } = useMerkleTree()
  const { notes, spendNote } = useDepositNotes()
  const { showToast } = useToast()

  const [state, setState] = useState<SwapState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [proofStage, setProofStage] = useState<string>('')

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
    setTxHash(null)
    setProofStage('')
  }, [])

  /**
   * Execute private swap using ZK proof (matching test implementation)
   */
  const executeSwap = useCallback(
    async (params: SwapParams): Promise<SwapResult | null> => {
      if (!address || !walletClient || !publicClient) {
        setError('Wallet not connected')
        return null
      }

      try {
        reset()

        // Step 1: Get deposit note
        setState('selecting-note')
        const depositNote = notes.find((n) => n.id === params.depositNoteId)

        if (!depositNote) {
          throw new Error('Deposit note not found')
        }

        if (depositNote.spent) {
          throw new Error('Deposit note already spent')
        }

        if (depositNote.leafIndex === undefined) {
          throw new Error('Deposit note has no leaf index')
        }

        // Step 2: Sync Merkle tree
        setState('syncing-tree')
        showToast({
          type: 'info',
          title: 'Syncing',
          message: 'Synchronizing Merkle tree...',
        })

        await syncTree()

        // Step 3: Get Merkle proof
        const merkleProof = await getMerkleProof(depositNote.leafIndex)

        if (!merkleProof) {
          throw new Error('Failed to generate Merkle proof')
        }

        // Step 4: Add root to GrimPool (testnet only)
        setState('adding-root')
        showToast({
          type: 'info',
          title: 'Adding Root',
          message: 'Adding Merkle root to GrimPool...',
        })

        const rootBytes = toBytes32(merkleProof.root)

        // Check if root is already known
        const isKnown = await publicClient.readContract({
          ...grimPoolConfig,
          functionName: 'isKnownRoot',
          args: [rootBytes],
        })

        if (!isKnown) {
          const addRootTx = await walletClient.writeContract({
            ...grimPoolConfig,
            functionName: 'addKnownRoot',
            args: [rootBytes],
          })

          await publicClient.waitForTransactionReceipt({ hash: addRootTx })
        }

        // Step 5: Generate ZK proof
        setState('generating-proof')
        showToast({
          type: 'info',
          title: 'Generating Proof',
          message: 'Creating ZK-SNARK proof (~1-2 seconds)...',
        })

        const zkSwapParams: ZKSwapParams = {
          recipient: params.recipient,
          relayer: address, // Use sender as relayer for now
          relayerFee: 0, // No relayer fee
          amountIn: depositNote.amount,
          minAmountOut: params.minAmountOut,
          poolKey: BigInt(0), // Not used in current circuit
        }

        const proofResult = await generateProof(
          depositNote,
          merkleProof,
          zkSwapParams,
          (stage, progress) => {
            setProofStage(`${stage} (${Math.round(progress * 100)}%)`)
          }
        )

        if (!proofResult) {
          throw new Error('Failed to generate ZK proof')
        }

        // Step 6: Format and encode proof
        const contractProof = formatProofForContract(
          proofResult.proof,
          proofResult.publicSignals
        )
        const hookData = encodeHookData(contractProof)

        // Step 7: Execute swap through PoolHelper
        setState('submitting')
        showToast({
          type: 'info',
          title: 'Submitting',
          message: 'Executing private swap...',
        })

        const poolKey = params.poolKey || DEFAULT_POOL_KEY

        const hash = await walletClient.writeContract({
          ...poolHelperConfig,
          functionName: 'swap',
          args: [
            poolKey,
            true, // zeroForOne (assuming Token A -> Token B)
            -BigInt(depositNote.amount), // exact input (negative for exact in)
            MIN_SQRT_PRICE, // sqrtPriceLimitX96
            hookData,
            address,
          ],
        })

        // Step 8: Wait for confirmation
        setState('confirming')
        showToast({
          type: 'info',
          title: 'Confirming',
          message: 'Waiting for transaction confirmation...',
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted')
        }

        // Step 9: Mark note as spent
        if (depositNote.id) {
          await spendNote(depositNote.id)
        }

        setState('success')
        setTxHash(hash)

        showToast({
          type: 'success',
          title: 'Swap Successful',
          message: 'Your private swap completed successfully!',
        })

        return {
          hash,
          stealthAddress: params.recipient,
          nullifierHash: depositNote.nullifierHash,
          gasUsed: receipt.gasUsed,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Swap failed'
        setError(message)
        setState('error')

        showToast({
          type: 'error',
          title: 'Swap Failed',
          message,
        })

        return null
      }
    },
    [
      address,
      walletClient,
      publicClient,
      notes,
      syncTree,
      getMerkleProof,
      getRoot,
      generateProof,
      spendNote,
      showToast,
      reset,
    ]
  )

  /**
   * Get available deposit notes for swapping
   */
  const getAvailableNotes = useCallback(() => {
    return notes.filter((n) => !n.spent && n.leafIndex !== undefined)
  }, [notes])

  /**
   * Estimate gas for swap
   */
  const estimateGas = useCallback(async (): Promise<bigint | null> => {
    // Based on test: ~828,010 gas for full ZK swap
    return BigInt(850000)
  }, [])

  return {
    // State
    state,
    error,
    txHash,
    proofStage,
    isConnected,
    address,

    // Actions
    executeSwap,
    getAvailableNotes,
    estimateGas,
    reset,

    // Helpers
    isLoading: [
      'selecting-note',
      'syncing-tree',
      'adding-root',
      'generating-proof',
      'submitting',
      'confirming',
    ].includes(state),
    isGeneratingProof: state === 'generating-proof',
    isSyncingTree: state === 'syncing-tree' || isSyncing,
    isSuccess: state === 'success',
    isError: state === 'error',
  }
}
