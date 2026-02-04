import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient, useWatchContractEvent } from 'wagmi'
import { type Address, type Hash, parseEventLogs } from 'viem'
import { grimPoolConfig, getERC20Config } from '@/lib/contracts'
import { createDepositNote, formatCommitmentForContract, type DepositNote } from '@/lib/zk'
import { useDepositNotes } from './use-deposit-notes'
import { useToast } from './use-toast'

export type DepositState = 'idle' | 'generating' | 'approving' | 'depositing' | 'confirming' | 'success' | 'error'

interface DepositResult {
  note: DepositNote
  txHash: Hash
  leafIndex: number
}

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
   * Check token allowance
   */
  const checkAllowance = useCallback(
    async (tokenAddress: Address, _amount: bigint): Promise<bigint> => {
      if (!publicClient || !address) return BigInt(0)

      try {
        const allowance = await publicClient.readContract({
          ...getERC20Config(tokenAddress),
          functionName: 'allowance',
          args: [address, grimPoolConfig.address],
        })

        return allowance as bigint
      } catch (err) {
        console.error('Failed to check allowance:', err)
        return BigInt(0)
      }
    },
    [publicClient, address]
  )

  /**
   * Approve token spending
   */
  const approveToken = useCallback(
    async (tokenAddress: Address, amount: bigint): Promise<Hash | null> => {
      if (!walletClient || !address) {
        throw new Error('Wallet not connected')
      }

      try {
        const hash = await walletClient.writeContract({
          ...getERC20Config(tokenAddress),
          functionName: 'approve',
          args: [grimPoolConfig.address, amount],
        })

        return hash
      } catch (err) {
        console.error('Approval failed:', err)
        throw new Error('Token approval failed')
      }
    },
    [walletClient, address]
  )

  /**
   * Deposit ETH to GrimPool
   * Note: GrimPool is ETH-only (payable). Amount is sent as msg.value.
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

      // GrimPool only supports ETH deposits
      const isETH = tokenAddress === '0x0000000000000000000000000000000000000000'
      if (!isETH) {
        setError('GrimPool only supports ETH deposits')
        return null
      }

      try {
        setState('generating')
        setError(null)

        // 1. Generate deposit note
        const note = await createDepositNote(amount)
        setCurrentNote(note)
        const commitment = formatCommitmentForContract(note.commitment)

        // 2. Deposit to GrimPool (ETH is sent as value)
        setState('depositing')
        toast.info('Depositing', 'Submitting ETH deposit to GrimPool...')

        const hash = await walletClient.writeContract({
          ...grimPoolConfig,
          functionName: 'deposit',
          args: [commitment],
          value: amount, // Send ETH as value
        })

        // 4. Wait for confirmation
        setState('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        // 5. Parse logs to get leaf index
        const logs = parseEventLogs({
          abi: grimPoolConfig.abi,
          logs: receipt.logs,
          eventName: 'Deposit',
        })

        const depositLog = logs[0] as unknown as { args: { leafIndex: bigint } } | undefined
        if (!depositLog) {
          throw new Error('Deposit event not found in logs')
        }

        const leafIndex = Number(depositLog.args.leafIndex)

        // 6. Save deposit note with leaf index
        note.leafIndex = leafIndex
        note.depositTxHash = hash

        await saveNote(note, tokenAddress, tokenSymbol)

        setState('success')
        toast.success('Deposit Successful', `Deposited to leaf index ${leafIndex}`)

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
        ...grimPoolConfig,
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
        ...grimPoolConfig,
        functionName: 'getLastRoot',
        args: [],
      })

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
        const spent = await publicClient.readContract({
          ...grimPoolConfig,
          functionName: 'nullifierHashes',
          args: [nullifierHash],
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
 * Hook to watch for new deposits
 */
export function useWatchDeposits(onDeposit?: (data: any) => void) {
  useWatchContractEvent({
    ...grimPoolConfig,
    eventName: 'Deposit',
    onLogs(logs) {
      logs.forEach((log: any) => {
        onDeposit?.(log.args)
      })
    },
  })
}
