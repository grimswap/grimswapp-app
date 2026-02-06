import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address, type Hash, encodeAbiParameters, parseAbiParameters } from 'viem'
import {
  poolHelperConfig,
  DEFAULT_POOL_KEY,
  getSwapDirection,
  type PoolKey,
} from '@/lib/contracts'
import { CONTRACTS } from '@/lib/constants'
import { type SwapParams as ZKSwapParams } from '@/lib/zk'
import { useZKProof } from './use-zk-proof'
import { useMerkleTree } from './use-merkle-tree'
import { useDepositNotes } from './use-deposit-notes'
import { useToast } from './use-toast'

// V3 GrimPoolMultiToken config
const grimPoolMultiTokenConfig = {
  address: CONTRACTS.grimPoolMultiToken,
  abi: [
    {
      inputs: [{ name: 'root', type: 'bytes32' }],
      name: 'isKnownRoot',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ name: 'root', type: 'bytes32' }],
      name: 'addKnownRoot',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const,
}

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
  fromToken: Address     // Token being sold (V3: supports ETH and ERC20)
  toToken: Address       // Token being bought
  minAmountOut: bigint
  recipient: Address     // Stealth address
  depositNoteId: number  // ID of the deposit note to use
  poolKey?: PoolKey      // Optional custom pool key
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
  const { generateProof } = useZKProof()
  const { getProof: getMerkleProof, syncTree, getRoot, isSyncing } = useMerkleTree()
  const { notes, spendNote } = useDepositNotes()
  const { toast } = useToast()

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
        toast.info('Syncing', 'Synchronizing Merkle tree...')

        await syncTree()

        // Step 3: Get Merkle proof
        const merkleProof = await getMerkleProof(depositNote.leafIndex)

        if (!merkleProof) {
          throw new Error('Failed to generate Merkle proof')
        }

        // Step 4: Add root to GrimPoolMultiToken (testnet only)
        setState('adding-root')
        toast.info('Adding Root', 'Adding Merkle root to GrimPool...')

        const rootBytes = toBytes32(merkleProof.root)

        // Check if root is already known
        const isKnown = await publicClient.readContract({
          ...grimPoolMultiTokenConfig,
          functionName: 'isKnownRoot',
          args: [rootBytes],
        })

        if (!isKnown) {
          const addRootTx = await walletClient.writeContract({
            ...grimPoolMultiTokenConfig,
            functionName: 'addKnownRoot',
            args: [rootBytes],
          })

          await publicClient.waitForTransactionReceipt({ hash: addRootTx })
        }

        // Step 5: Generate ZK proof
        setState('generating-proof')
        toast.info('Generating Proof', 'Creating ZK-SNARK proof (~1-2 seconds)...')

        const zkSwapParams: ZKSwapParams = {
          recipient: params.recipient,
          relayer: address, // Use sender as relayer for now
          relayerFee: 0, // No relayer fee
          swapAmountOut: params.minAmountOut, // Expected output amount
        }

        const proofResult = await generateProof(
          depositNote,
          merkleProof,
          zkSwapParams
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

        // Step 7: Execute swap through PoolHelper (V3 - dynamic direction)
        setState('submitting')
        toast.info('Submitting', 'Executing private swap...')

        const poolKey = params.poolKey || DEFAULT_POOL_KEY

        // V3: Determine swap direction based on token addresses
        const { zeroForOne, sqrtPriceLimitX96 } = getSwapDirection(
          params.fromToken,
          params.toToken,
          poolKey
        )

        // Log swap details for debugging
        console.log('V3 Private Swap:', {
          fromToken: params.fromToken,
          toToken: params.toToken,
          zeroForOne,
          sqrtPriceLimitX96: sqrtPriceLimitX96.toString(),
          amount: depositNote.amount.toString(),
          poolKey,
        })

        const hash = await walletClient.writeContract({
          ...poolHelperConfig,
          functionName: 'swap',
          args: [
            poolKey,
            zeroForOne, // V3: Dynamic direction based on tokens
            -BigInt(depositNote.amount), // exact input (negative for exact in)
            sqrtPriceLimitX96, // V3: Dynamic price limit based on direction
            hookData, // hookData contains recipient info for ZK swap
          ],
        })

        // Step 8: Wait for confirmation
        setState('confirming')
        toast.info('Confirming', 'Waiting for transaction confirmation...')

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

        toast.success('Swap Successful', 'Your private swap completed successfully!')

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

        toast.error('Swap Failed', message)

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
      toast,
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
