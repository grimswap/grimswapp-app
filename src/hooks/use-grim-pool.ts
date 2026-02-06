import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient, useWatchContractEvent } from 'wagmi'
import { type Address, type Hash, parseEventLogs } from 'viem'
import { grimPoolConfig, getERC20Config, isNativeToken } from '@/lib/contracts'
import { CONTRACTS } from '@/lib/constants'
import { createDepositNote, formatCommitmentForContract, type DepositNote } from '@/lib/zk'
import { useDepositNotes } from './use-deposit-notes'
import { useToast } from './use-toast'

export type DepositState = 'idle' | 'generating' | 'approving' | 'depositing' | 'confirming' | 'success' | 'error'

interface DepositResult {
  note: DepositNote
  txHash: Hash
  leafIndex: number
}

// GrimPoolMultiToken ABI for V3 multi-token deposits
const GRIM_POOL_MULTI_TOKEN_ABI = [
  // ETH deposit
  {
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  // ERC20 deposit
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'commitment', type: 'bytes32' },
    ],
    name: 'depositToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'commitment', type: 'bytes32' },
      { indexed: false, name: 'leafIndex', type: 'uint32' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'Deposit',
    type: 'event',
  },
  // View functions
  {
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    name: 'isSpent',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getDepositCount',
    outputs: [{ name: '', type: 'uint32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getLastRoot',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
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
] as const

// V3 GrimPool config
const grimPoolMultiTokenConfig = {
  address: CONTRACTS.grimPoolMultiToken,
  abi: GRIM_POOL_MULTI_TOKEN_ABI,
} as const

/**
 * Hook for depositing to GrimPool
 */
export function useGrimPool() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { saveNote } = useDepositNotes()
  const { toast } = useToast()

  const [state, setState] = useState<DepositState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [currentNote, setCurrentNote] = useState<DepositNote | null>(null)

  /**
   * Check token allowance for GrimPoolMultiToken
   */
  const checkAllowance = useCallback(
    async (tokenAddress: Address, _amount: bigint): Promise<bigint> => {
      if (!publicClient || !address) {
        console.log('checkAllowance: publicClient or address not available')
        return BigInt(0)
      }

      const spenderAddress = CONTRACTS.grimPoolMultiToken
      console.log('checkAllowance: Checking allowance for spender:', spenderAddress)

      try {
        const allowance = await publicClient.readContract({
          ...getERC20Config(tokenAddress),
          functionName: 'allowance',
          args: [address, spenderAddress],
        })

        console.log('Allowance check result:', {
          token: tokenAddress,
          owner: address,
          spender: spenderAddress,
          allowance: allowance?.toString() ?? 'undefined',
          allowanceType: typeof allowance,
        })

        // Ensure we return a valid bigint
        if (allowance === undefined || allowance === null) {
          console.warn('Allowance returned undefined/null, treating as 0')
          return BigInt(0)
        }

        return BigInt(allowance.toString())
      } catch (err) {
        console.error('Failed to check allowance:', err)
        return BigInt(0)
      }
    },
    [publicClient, address]
  )

  /**
   * Approve token spending for GrimPoolMultiToken
   */
  const approveToken = useCallback(
    async (tokenAddress: Address, amount: bigint): Promise<Hash | null> => {
      if (!walletClient || !address) {
        throw new Error('Wallet not connected')
      }

      const spenderAddress = CONTRACTS.grimPoolMultiToken

      try {
        console.log('Approving token:', {
          token: tokenAddress,
          spender: spenderAddress,
          amount: amount.toString(),
        })

        const hash = await walletClient.writeContract({
          ...getERC20Config(tokenAddress),
          functionName: 'approve',
          args: [spenderAddress, amount],
        })

        console.log('Approval transaction submitted:', hash)
        return hash
      } catch (err: any) {
        console.error('Approval failed:', err)
        if (err.message?.includes('user rejected') || err.message?.includes('User rejected')) {
          throw new Error('Approval was rejected by user')
        }
        throw new Error('Token approval failed: ' + (err.message || 'Unknown error'))
      }
    },
    [walletClient, address]
  )

  /**
   * Deposit to GrimPoolMultiToken (V3 - supports ETH and ERC20)
   * - ETH: Uses deposit(commitment) with value
   * - ERC20: Uses depositToken(token, amount, commitment) after approval
   */
  const deposit = useCallback(
    async (
      tokenAddress: Address,
      tokenSymbol: string,
      amount: bigint
    ): Promise<DepositResult | null> => {
      if (!address || !walletClient || !publicClient) {
        setError('Wallet not connected')
        return null
      }

      const isETH = isNativeToken(tokenAddress)

      try {
        setState('generating')
        setError(null)

        // 1. Generate deposit note
        const note = await createDepositNote(amount)
        setCurrentNote(note)
        const commitment = formatCommitmentForContract(note.commitment)

        // 2. For ERC20, always request fresh approval to ensure correct spender
        if (!isETH) {
          const spenderAddress = CONTRACTS.grimPoolMultiToken
          console.log('ERC20 deposit - requesting approval for GrimPoolMultiToken:', spenderAddress)

          // Check current allowance
          const currentAllowance = await checkAllowance(tokenAddress, amount)
          console.log('Current allowance:', currentAllowance.toString(), 'Required:', amount.toString())

          // Always request approval to ensure it's for the correct contract
          // (User may have approved a different contract previously)
          if (currentAllowance < amount) {
            setState('approving')
            toast.info('Approving', `Approving ${tokenSymbol} for deposit...`)

            const approveTxHash = await approveToken(tokenAddress, amount)
            if (!approveTxHash) {
              throw new Error('Approval transaction was not submitted')
            }

            toast.info('Confirming', 'Waiting for approval confirmation...')
            const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash })

            if (approvalReceipt.status === 'reverted') {
              throw new Error('Approval transaction reverted')
            }

            console.log('Approval confirmed:', approveTxHash)

            // Verify the allowance was actually set
            const newAllowance = await checkAllowance(tokenAddress, amount)
            console.log('New allowance after approval:', newAllowance.toString())

            if (newAllowance < amount) {
              throw new Error(`Approval failed: allowance is ${newAllowance.toString()} but need ${amount.toString()}`)
            }
          } else {
            console.log('Already approved, skipping approval step. Allowance:', currentAllowance.toString())
          }
        }

        // 3. Execute deposit
        setState('depositing')
        toast.info('Depositing', `Submitting ${tokenSymbol} deposit to GrimPool...`)

        const poolAddress = CONTRACTS.grimPoolMultiToken
        console.log('Depositing to GrimPoolMultiToken:', {
          poolAddress,
          tokenAddress,
          tokenSymbol,
          amount: amount.toString(),
          commitment,
          isETH,
        })

        let hash: Hash

        try {
          if (isETH) {
            // ETH deposit: deposit(commitment) with value
            hash = await walletClient.writeContract({
              address: poolAddress,
              abi: GRIM_POOL_MULTI_TOKEN_ABI,
              functionName: 'deposit',
              args: [commitment as `0x${string}`],
              value: amount,
            })
          } else {
            // ERC20 deposit: depositToken(token, amount, commitment)
            hash = await walletClient.writeContract({
              address: poolAddress,
              abi: GRIM_POOL_MULTI_TOKEN_ABI,
              functionName: 'depositToken',
              args: [tokenAddress, amount, commitment as `0x${string}`],
            })
          }
        } catch (depositErr: any) {
          console.error('Deposit transaction failed:', depositErr)
          // Check for common errors
          if (depositErr.message?.includes('insufficient allowance') ||
              depositErr.message?.includes('ERC20: transfer amount exceeds allowance')) {
            throw new Error('Token approval failed. Please try again.')
          }
          if (depositErr.message?.includes('user rejected')) {
            throw new Error('Transaction was rejected')
          }
          throw depositErr
        }

        // 4. Wait for confirmation
        setState('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        // 5. Parse logs to get leaf index
        const logs = parseEventLogs({
          abi: grimPoolMultiTokenConfig.abi,
          logs: receipt.logs,
          eventName: 'Deposit',
        })

        const depositLog = logs[0] as unknown as { args: { leafIndex: bigint } } | undefined
        if (!depositLog) {
          throw new Error('Deposit event not found in logs')
        }

        const leafIndex = Number(depositLog.args.leafIndex)

        // 6. Save deposit note with leaf index and token info
        note.leafIndex = leafIndex

        // Save note with tx hash as metadata
        await saveNote(note, tokenAddress, tokenSymbol, hash)

        setState('success')
        toast.success('Deposit Successful', `Deposited ${tokenSymbol} to leaf index ${leafIndex}`)

        return {
          note,
          txHash: hash,
          leafIndex,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Deposit failed'
        setError(message)
        setState('error')
        toast.error('Deposit Failed', message)
        return null
      }
    },
    [address, walletClient, publicClient, checkAllowance, approveToken, saveNote, toast]
  )

  /**
   * Get deposit count (total deposits in pool)
   */
  const getDepositCount = useCallback(async (): Promise<number> => {
    if (!publicClient) return 0

    try {
      const count = await publicClient.readContract({
        ...grimPoolMultiTokenConfig,
        functionName: 'getDepositCount',
        args: [],
      })

      return Number(count)
    } catch (err) {
      console.error('Failed to get deposit count:', err)
      return 0
    }
  }, [publicClient])

  /**
   * Get Merkle root
   */
  const getMerkleRoot = useCallback(async (): Promise<bigint | null> => {
    if (!publicClient) return null

    try {
      const root = await publicClient.readContract({
        ...grimPoolMultiTokenConfig,
        functionName: 'getLastRoot',
        args: [],
      })

      // Convert bytes32 to bigint
      if (typeof root === 'string') {
        return BigInt(root)
      }
      return root as bigint
    } catch (err) {
      console.error('Failed to get Merkle root:', err)
      return null
    }
  }, [publicClient])

  /**
   * Check if nullifier is spent
   */
  const isNullifierSpent = useCallback(
    async (nullifierHash: bigint): Promise<boolean> => {
      if (!publicClient) return false

      try {
        // Format nullifier hash as bytes32
        const nullifierHashHex = `0x${nullifierHash.toString(16).padStart(64, '0')}` as `0x${string}`

        const spent = await publicClient.readContract({
          ...grimPoolMultiTokenConfig,
          functionName: 'isSpent',
          args: [nullifierHashHex],
        })

        return spent as boolean
      } catch (err) {
        console.error('Failed to check nullifier:', err)
        return false
      }
    },
    [publicClient]
  )

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
    setCurrentNote(null)
  }, [])

  return {
    // State
    state,
    error,
    currentNote,
    isConnected,
    address,

    // Actions
    deposit,
    getDepositCount,
    getMerkleRoot,
    isNullifierSpent,
    reset,

    // Helpers
    isLoading: state === 'generating' || state === 'approving' || state === 'depositing' || state === 'confirming',
    isSuccess: state === 'success',
    isError: state === 'error',
  }
}

/**
 * Hook to watch for new deposits (V3 - GrimPoolMultiToken)
 */
export function useWatchDeposits(onDeposit?: (data: any) => void) {
  useWatchContractEvent({
    ...grimPoolMultiTokenConfig,
    eventName: 'Deposit',
    onLogs(logs) {
      logs.forEach((log: any) => {
        onDeposit?.(log.args)
      })
    },
  })
}
