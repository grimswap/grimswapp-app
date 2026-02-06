import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { useAccount, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { useDepositNotes, useGrimPool, useStealthAddresses, useStateView, type StealthAddress } from '@/hooks'
import { DEFAULT_POOL_KEY } from '@/lib/contracts'
import { useNativeBalance, useTokenBalance } from '@/hooks/use-token-balance'
import { unichainSepolia } from '@/lib/wagmi'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { TransactionSuccessModal } from '@/components/ui/transaction-success-modal'
import { cn } from '@/lib/utils'
import { ETH, formatTokenAmount } from '@/lib/tokens'
import {
  Wallet,
  Shield,
  Activity,
  Plus,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  FileKey,
  Clock,
  Lock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  Ghost,
  Key,
  Loader2,
} from 'lucide-react'
import { USDC } from '@/lib/tokens'
import type { StoredDepositNote } from '@/lib/storage/deposit-notes'

export function WalletPage() {
  const { address, isConnected } = useAccount()
  const pageRef = useRef<HTMLDivElement>(null)

  // Deposit notes management
  const {
    notes,
    unspentNotes,
    loading: notesLoading,
    count,
    deleteNote,
    exportNotes,
    importNotes,
    clearNotes,
    refresh: refreshNotes,
  } = useDepositNotes()

  // GrimPool deposit
  const {
    deposit,
    state: depositState,
    error: depositError,
    isLoading: isDepositing,
    reset: resetDeposit,
  } = useGrimPool()

  // Balances
  const { formatted: ethBalance } = useNativeBalance()
  const { formatted: usdcWalletBalance } = useTokenBalance(USDC.address)

  // Public client for balance checking
  const publicClient = usePublicClient()

  // Stealth addresses
  const {
    stealthAddresses,
    unclaimedAddresses,
    isLoading: stealthLoading,
    updateBalances,
    markAsClaimed,
    deleteStealthAddress,
  } = useStealthAddresses()

  // Get current ETH price for USD valuations
  const { currentPrice: ethPrice } = useStateView(DEFAULT_POOL_KEY)

  // UI State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [importJson, setImportJson] = useState('')

  // Deposit modal state
  const [depositAmount, setDepositAmount] = useState('')
  const [depositToken, setDepositToken] = useState<'ETH' | 'USDC'>('ETH')

  // Copy state
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [copiedStealthId, setCopiedStealthId] = useState<string | null>(null)

  // Stealth claim modal state
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [selectedStealth, setSelectedStealth] = useState<StealthAddress | null>(null)
  const [claimDestination, setClaimDestination] = useState('')
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false)

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successDetails, setSuccessDetails] = useState<{
    type: 'deposit' | 'claim'
    txHash: string
    amount: string
    tokenSymbol: string
    tokenLogo?: string
    destination?: string
  } | null>(null)

  // Refresh stealth balances on mount and when addresses change
  useEffect(() => {
    if (isConnected && unclaimedAddresses.length > 0) {
      refreshStealthBalances()
    }
  }, [isConnected, unclaimedAddresses.length])

  // Animation on mount
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.wallet-element', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
      })
    }, pageRef)

    return () => ctx.revert()
  }, [])

  // Calculate total value from unspent notes - separate by token
  const ethNoteValue = unspentNotes
    .filter(note => note.tokenSymbol === 'ETH' || !note.tokenSymbol)
    .reduce((sum, note) => {
      const amount = Number(formatUnits(BigInt(note.amount), 18))
      return sum + amount
    }, 0)

  const usdcNoteValue = unspentNotes
    .filter(note => note.tokenSymbol === 'USDC')
    .reduce((sum, note) => {
      const amount = Number(formatUnits(BigInt(note.amount), 6))
      return sum + amount
    }, 0)

  // Handle deposit (ETH or USDC)
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return

    const token = depositToken === 'ETH' ? ETH : USDC
    const amount = parseUnits(depositAmount, token.decimals)
    const result = await deposit(token.address, token.symbol, amount)

    if (result) {
      // Show success modal
      setSuccessDetails({
        type: 'deposit',
        txHash: result.txHash,
        amount: depositAmount,
        tokenSymbol: token.symbol,
        tokenLogo: token.logoURI,
      })
      setShowSuccessModal(true)

      setIsDepositModalOpen(false)
      setDepositAmount('')
      setDepositToken('ETH')
      refreshNotes()
    }
  }

  // Handle export
  const handleExport = async () => {
    try {
      const json = await exportNotes()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grimswap-notes-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Handle import
  const handleImport = async () => {
    if (!importJson.trim()) return

    try {
      const imported = await importNotes(importJson)
      setIsImportModalOpen(false)
      setImportJson('')
      alert(`Successfully imported ${imported} notes`)
    } catch (error) {
      alert('Failed to import notes. Check the JSON format.')
    }
  }

  // Handle clear all
  const handleClear = async () => {
    await clearNotes()
    setIsClearModalOpen(false)
  }

  // Copy note secret
  const copyNoteSecret = async (note: StoredDepositNote) => {
    const secretData = JSON.stringify({
      secret: note.secret.toString(),
      nullifier: note.nullifier.toString(),
      commitment: note.commitment.toString(),
      amount: note.amount.toString(),
    })
    await navigator.clipboard.writeText(secretData)
    setCopiedId(note.id!)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Refresh stealth address balances
  const refreshStealthBalances = useCallback(async () => {
    if (!publicClient || unclaimedAddresses.length === 0) return

    setIsRefreshingBalances(true)
    try {
      for (const stealth of unclaimedAddresses) {
        // Get ETH balance
        const ethBal = await publicClient.getBalance({ address: stealth.address })

        // Get USDC balance
        const usdcBal = await publicClient.readContract({
          address: USDC.address,
          abi: [
            {
              type: 'function',
              name: 'balanceOf',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'balanceOf',
          args: [stealth.address],
        }) as bigint

        await updateBalances(stealth.address, {
          eth: ethBal.toString(),
          usdc: usdcBal.toString(),
        })
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error)
    } finally {
      setIsRefreshingBalances(false)
    }
  }, [publicClient, unclaimedAddresses, updateBalances])

  // Claim token type state
  const [claimTokenType, setClaimTokenType] = useState<'USDC' | 'ETH' | 'BOTH'>('USDC')

  // Claim from stealth address (send tokens to destination)
  const handleClaim = useCallback(async () => {
    if (!selectedStealth || !claimDestination || !publicClient) return

    setIsClaiming(true)
    setClaimError(null)

    try {
      // Create wallet client from stealth private key
      const stealthAccount = privateKeyToAccount(selectedStealth.privateKey)
      const stealthWallet = createWalletClient({
        account: stealthAccount,
        chain: unichainSepolia,
        transport: http(),
      })

      // Get balances
      const ethBalance = await publicClient.getBalance({ address: selectedStealth.address })
      const usdcBalance = await publicClient.readContract({
        address: USDC.address,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'balanceOf',
        args: [selectedStealth.address],
      }) as bigint

      let txHash: `0x${string}` | null = null

      // Transfer based on selected token type
      if (claimTokenType === 'USDC' || claimTokenType === 'BOTH') {
        if (usdcBalance > 0n) {
          txHash = await stealthWallet.writeContract({
            address: USDC.address,
            abi: [
              {
                type: 'function',
                name: 'transfer',
                inputs: [
                  { name: 'to', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                ],
                outputs: [{ name: '', type: 'bool' }],
                stateMutability: 'nonpayable',
              },
            ],
            functionName: 'transfer',
            args: [claimDestination as `0x${string}`, usdcBalance],
          })
          await publicClient.waitForTransactionReceipt({ hash: txHash })
        }
      }

      if (claimTokenType === 'ETH' || claimTokenType === 'BOTH') {
        // Reserve some ETH for gas if also claiming USDC
        const gasReserve = claimTokenType === 'BOTH' ? parseUnits('0.0002', 18) : 0n
        const ethToSend = ethBalance > gasReserve ? ethBalance - gasReserve : 0n

        if (ethToSend > 0n) {
          txHash = await stealthWallet.sendTransaction({
            to: claimDestination as `0x${string}`,
            value: ethToSend,
          })
          await publicClient.waitForTransactionReceipt({ hash: txHash })
        }
      }

      if (!txHash) {
        throw new Error('No tokens to claim')
      }

      // Mark as claimed
      await markAsClaimed(selectedStealth.address, txHash, claimDestination as `0x${string}`)

      // Calculate claimed amount for success modal
      const claimedAmount = claimTokenType === 'USDC' || claimTokenType === 'BOTH'
        ? formatUnits(usdcBalance, 6)
        : formatUnits(ethBalance, 18)
      const claimedToken = claimTokenType === 'USDC' ? USDC : ETH

      // Show success modal
      setSuccessDetails({
        type: 'claim',
        txHash: txHash,
        amount: claimedAmount,
        tokenSymbol: claimTokenType === 'BOTH' ? 'USDC + ETH' : claimedToken.symbol,
        tokenLogo: claimedToken.logoURI,
        destination: claimDestination,
      })
      setShowSuccessModal(true)

      // Close modal
      setIsClaimModalOpen(false)
      setSelectedStealth(null)
      setClaimDestination('')
      setClaimTokenType('USDC')

    } catch (error) {
      console.error('Claim failed:', error)
      setClaimError(error instanceof Error ? error.message : 'Failed to claim')
    } finally {
      setIsClaiming(false)
    }
  }, [selectedStealth, claimDestination, publicClient, markAsClaimed, claimTokenType])

  // Open claim modal
  const openClaimModal = (stealth: StealthAddress) => {
    setSelectedStealth(stealth)
    setClaimDestination(address || '')
    setClaimError(null)
    setIsClaimModalOpen(true)
  }

  if (!isConnected) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <Wallet className="w-16 h-16 text-ethereal-cyan/50 mx-auto mb-4" />
          <h2 className="font-display text-2xl text-ghost-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-mist-gray">
            Connect your wallet to access your Grimoire
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={pageRef} className="min-h-[calc(100vh-5rem)] py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="wallet-element flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ghost-white mb-2">
              Your Grimoire
            </h1>
            <p className="text-mist-gray">
              Manage your private deposits and hidden assets
            </p>
          </div>
          <Button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Deposit
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="wallet-element grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Unspent Notes */}
          <Card glow="green">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-spectral-green/20">
                  <FileKey className="w-5 h-5 text-spectral-green" />
                </div>
                <div>
                  <p className="text-xs text-mist-gray mb-0.5">Active Notes</p>
                  <p className="text-xl font-mono text-ghost-white">
                    {count.unspent}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Deposited - ETH */}
          <Card glow="cyan">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={ETH.logoURI} alt="ETH" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <p className="text-xs text-mist-gray mb-0.5">ETH in Pool</p>
                  <p className="text-xl font-mono text-ghost-white">
                    {ethNoteValue.toFixed(4)} ETH
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Deposited - USDC */}
          <Card glow="purple">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={USDC.logoURI} alt="USDC" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <p className="text-xs text-mist-gray mb-0.5">USDC in Pool</p>
                  <p className="text-xl font-mono text-ghost-white">
                    {usdcNoteValue.toFixed(2)} USDC
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stealth Addresses */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-spectral-green/20">
                  <Ghost className="w-5 h-5 text-spectral-green" />
                </div>
                <div>
                  <p className="text-xs text-mist-gray mb-0.5">Stealth Addresses</p>
                  <p className="text-xl font-mono text-ghost-white">
                    {unclaimedAddresses.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deposit Notes Section */}
        <div className="wallet-element">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-ethereal-cyan" />
                <h2 className="font-display text-lg text-ghost-white">
                  Deposit Notes
                </h2>
                <span className="text-xs text-mist-gray bg-charcoal px-2 py-0.5 rounded-full">
                  {count.total} total
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    'hover:bg-white/5',
                    showSecrets ? 'text-spectral-green' : 'text-mist-gray'
                  )}
                  title={showSecrets ? 'Hide secrets' : 'Show secrets'}
                >
                  {showSecrets ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={refreshNotes}
                  disabled={notesLoading}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    'hover:bg-white/5 text-mist-gray hover:text-ghost-white',
                    notesLoading && 'animate-spin'
                  )}
                  title="Refresh notes"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {notesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-arcane-purple border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-12">
                  <FileKey className="w-12 h-12 text-mist-gray/30 mx-auto mb-3" />
                  <p className="text-mist-gray mb-4">No deposit notes yet</p>
                  <Button
                    variant="outline"
                    onClick={() => setIsDepositModalOpen(true)}
                    className="mx-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Make Your First Deposit
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all',
                        note.spent
                          ? 'bg-charcoal/30 border-mist-gray/10 opacity-60'
                          : 'bg-charcoal/50 border-arcane-purple/20 hover:border-arcane-purple/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Token Info */}
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center overflow-hidden',
                              note.spent ? 'bg-mist-gray/20' : 'bg-charcoal'
                            )}
                          >
                            {note.tokenSymbol === 'ETH' ? (
                              <img src={ETH.logoURI} alt="ETH" className="w-10 h-10 object-contain" />
                            ) : note.tokenSymbol === 'USDC' ? (
                              <img src={USDC.logoURI} alt="USDC" className="w-10 h-10 object-contain" />
                            ) : (
                              <span className="text-sm font-bold">
                                {note.tokenSymbol?.slice(0, 2) || '??'}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ghost-white">
                                {formatTokenAmount(
                                  BigInt(note.amount),
                                  note.tokenSymbol === 'ETH' ? 18 : 6,
                                  4
                                )}{' '}
                                {note.tokenSymbol}
                              </span>
                              {note.spent ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-mist-gray/20 text-mist-gray">
                                  Spent
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-spectral-green/20 text-spectral-green">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-mist-gray">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(note.createdAt)}</span>
                              {note.leafIndex !== undefined && (
                                <>
                                  <span className="text-ethereal-cyan/50">•</span>
                                  <span>Leaf #{note.leafIndex}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                          {note.depositTxHash && (
                            <a
                              href={`https://unichain-sepolia.blockscout.com/tx/${note.depositTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-white/5 text-mist-gray hover:text-ghost-white transition-colors"
                              title="View transaction"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => copyNoteSecret(note)}
                            className="p-2 rounded-lg hover:bg-white/5 text-mist-gray hover:text-ghost-white transition-colors"
                            title="Copy note secret"
                          >
                            {copiedId === note.id ? (
                              <Check className="w-4 h-4 text-spectral-green" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteNote(note.id!)}
                            className="p-2 rounded-lg hover:bg-blood-crimson/10 text-mist-gray hover:text-blood-crimson transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Secret Preview (when revealed) */}
                      {showSecrets && !note.spent && (
                        <div className="mt-3 pt-3 border-t border-arcane-purple/10">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-mist-gray">Commitment:</span>
                              <p className="font-mono text-ghost-white truncate">
                                {note.commitment.toString().slice(0, 20)}...
                              </p>
                            </div>
                            <div>
                              <span className="text-mist-gray">Nullifier Hash:</span>
                              <p className="font-mono text-ghost-white truncate">
                                {note.nullifierHash.toString().slice(0, 20)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Bar */}
              {notes.length > 0 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-arcane-purple/10">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsImportModalOpen(true)}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsClearModalOpen(true)}
                    className="text-blood-crimson hover:text-blood-crimson hover:bg-blood-crimson/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stealth Addresses Section */}
        <div className="wallet-element">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className="w-5 h-5 text-spectral-green" />
                <h2 className="font-display text-lg text-ghost-white">
                  Stealth Addresses
                </h2>
                <span className="text-xs text-mist-gray bg-charcoal px-2 py-0.5 rounded-full">
                  {unclaimedAddresses.length} unclaimed
                </span>
              </div>
              <button
                onClick={refreshStealthBalances}
                disabled={isRefreshingBalances}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'hover:bg-white/5 text-mist-gray hover:text-ghost-white',
                  isRefreshingBalances && 'animate-spin'
                )}
                title="Refresh balances"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent>
              {stealthLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-spectral-green border-t-transparent rounded-full animate-spin" />
                </div>
              ) : stealthAddresses.length === 0 ? (
                <div className="text-center py-12">
                  <Ghost className="w-12 h-12 text-mist-gray/30 mx-auto mb-3" />
                  <p className="text-mist-gray mb-2">No stealth addresses yet</p>
                  <p className="text-xs text-mist-gray/70">
                    Stealth addresses are created when you perform private swaps
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stealthAddresses.map((stealth) => {
                    const ethBal = stealth.balances?.eth
                      ? formatUnits(BigInt(stealth.balances.eth), 18)
                      : '0'
                    const usdcBal = stealth.balances?.usdc
                      ? formatUnits(BigInt(stealth.balances.usdc), 6)
                      : '0'
                    // Check if there's meaningful balance (ETH > 0.001 for gas buffer, or any USDC)
                    const hasEthBalance = parseFloat(ethBal) > 0.001 // More than just gas funding
                    const hasUsdcBalance = parseFloat(usdcBal) > 0
                    const hasBalance = hasEthBalance || hasUsdcBalance
                    // Calculate USD equivalent values
                    const ethUsdValue = ethPrice ? parseFloat(ethBal) * ethPrice : 0
                    const totalUsdValue = ethUsdValue + parseFloat(usdcBal)

                    return (
                      <div
                        key={stealth.id}
                        className={cn(
                          'p-4 rounded-xl border transition-all',
                          stealth.claimed
                            ? 'bg-charcoal/30 border-mist-gray/10 opacity-60'
                            : hasBalance
                            ? 'bg-spectral-green/5 border-spectral-green/30 hover:border-spectral-green/50'
                            : 'bg-charcoal/50 border-arcane-purple/20 hover:border-arcane-purple/40'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: Address Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                                stealth.claimed
                                  ? 'bg-mist-gray/20'
                                  : hasBalance
                                  ? 'bg-spectral-green/20'
                                  : 'bg-arcane-purple/20'
                              )}
                            >
                              {stealth.claimed ? (
                                <CheckCircle className="w-5 h-5 text-mist-gray" />
                              ) : (
                                <Ghost className="w-5 h-5 text-spectral-green" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(stealth.address)
                                    setCopiedStealthId(stealth.id)
                                    setTimeout(() => setCopiedStealthId(null), 2000)
                                  }}
                                  className="font-mono text-sm text-ghost-white truncate hover:text-ethereal-cyan transition-colors flex items-center gap-1"
                                  title={`Click to copy: ${stealth.address}`}
                                >
                                  {stealth.address.slice(0, 8)}...{stealth.address.slice(-6)}
                                  {copiedStealthId === stealth.id ? (
                                    <Check className="w-3 h-3 text-spectral-green" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-mist-gray" />
                                  )}
                                </button>
                                {stealth.claimed ? (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-mist-gray/20 text-mist-gray flex-shrink-0">
                                    Claimed
                                  </span>
                                ) : hasBalance ? (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-spectral-green/20 text-spectral-green flex-shrink-0">
                                    Ready to Claim
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-ethereal-cyan/20 text-ethereal-cyan flex-shrink-0">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-mist-gray">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(stealth.createdAt)}
                                </span>
                                {!stealth.claimed && (
                                  <>
                                    <span className="text-ethereal-cyan/50">•</span>
                                    <span className="flex items-center gap-1 font-mono">
                                      <img src={ETH.logoURI} alt="ETH" className="w-3 h-3" />
                                      {parseFloat(ethBal).toFixed(5)} ETH
                                    </span>
                                    <span className="text-ethereal-cyan/50">•</span>
                                    <span className="flex items-center gap-1 font-mono text-spectral-green">
                                      <img src={USDC.logoURI} alt="USDC" className="w-3 h-3" />
                                      {parseFloat(usdcBal).toFixed(2)} USDC
                                    </span>
                                    {totalUsdValue > 0 && (
                                      <>
                                        <span className="text-ethereal-cyan/50">•</span>
                                        <span className="font-mono text-ethereal-cyan">≈ ${totalUsdValue.toFixed(2)}</span>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!stealth.claimed && hasBalance && (
                              <Button
                                size="sm"
                                onClick={() => openClaimModal(stealth)}
                                className="bg-spectral-green hover:bg-spectral-green/80"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Claim
                              </Button>
                            )}
                            {stealth.swapTxHash && (
                              <a
                                href={`https://sepolia.uniscan.xyz/tx/${stealth.swapTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg hover:bg-white/5 text-mist-gray hover:text-ghost-white transition-colors"
                                title="View swap transaction"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {stealth.claimed && (
                              <button
                                onClick={() => deleteStealthAddress(stealth.id)}
                                className="p-2 rounded-lg hover:bg-blood-crimson/10 text-mist-gray hover:text-blood-crimson transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Claimed destination */}
                        {stealth.claimed && stealth.claimDestination && (
                          <div className="mt-3 pt-3 border-t border-mist-gray/10">
                            <div className="flex items-center gap-2 text-xs text-mist-gray">
                              <Send className="w-3 h-3" />
                              <span>Claimed to:</span>
                              <span className="font-mono text-ghost-white">
                                {stealth.claimDestination.slice(0, 10)}...{stealth.claimDestination.slice(-8)}
                              </span>
                              {stealth.claimTxHash && (
                                <a
                                  href={`https://sepolia.uniscan.xyz/tx/${stealth.claimTxHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-ethereal-cyan hover:underline flex items-center gap-1"
                                >
                                  View
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Info about stealth addresses */}
              {stealthAddresses.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-spectral-green/5 border border-spectral-green/20">
                  <div className="flex items-start gap-2">
                    <Key className="w-4 h-4 text-spectral-green flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-mist-gray">
                      Stealth addresses hold tokens from private swaps. The private keys are stored
                      securely in your browser. Claim sends tokens to your chosen destination.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <div className="wallet-element">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-ethereal-cyan" />
                <h2 className="font-display text-lg text-ghost-white">
                  Transaction History
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-mist-gray/30 mx-auto mb-3" />
                  <p className="text-mist-gray">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes
                    .slice()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, 10)
                    .map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-charcoal/30 hover:bg-charcoal/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              note.spent
                                ? 'bg-blood-crimson/20'
                                : 'bg-spectral-green/20'
                            )}
                          >
                            {note.spent ? (
                              <XCircle className="w-4 h-4 text-blood-crimson" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-spectral-green" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-ghost-white">
                              {note.spent ? 'Withdrawn' : 'Deposited'}{' '}
                              {formatTokenAmount(
                                BigInt(note.amount),
                                note.tokenSymbol === 'ETH' ? 18 : 6,
                                4
                              )}{' '}
                              {note.tokenSymbol}
                            </p>
                            <p className="text-xs text-mist-gray">
                              {formatDate(note.spent ? note.spentAt! : note.createdAt)}
                            </p>
                          </div>
                        </div>
                        {note.depositTxHash && (
                          <a
                            href={`https://unichain-sepolia.blockscout.com/tx/${note.depositTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-ethereal-cyan hover:underline flex items-center gap-1"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Important Warning */}
        <div className="wallet-element">
          <Card className="border-blood-crimson/30 bg-blood-crimson/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blood-crimson flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blood-crimson mb-1">
                    Backup Your Notes
                  </h3>
                  <p className="text-sm text-mist-gray">
                    Your deposit notes are stored locally in your browser. If you clear your
                    browser data or use a different device, you will lose access to your
                    deposits. Always export and securely backup your notes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deposit Modal */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => {
          setIsDepositModalOpen(false)
          resetDeposit()
          setDepositAmount('')
          setDepositToken('ETH')
        }}
        title="Deposit to Privacy Pool"
      >
        <div className="p-4 space-y-4">
          {/* Token Selection */}
          <div>
            <label className="block text-sm text-mist-gray mb-2">Select Token</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setDepositToken('ETH')
                  setDepositAmount('')
                }}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all',
                  depositToken === 'ETH'
                    ? 'bg-arcane-purple/20 border-arcane-purple/50'
                    : 'bg-obsidian border-arcane-purple/20 hover:border-arcane-purple/40'
                )}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={ETH.logoURI} alt="ETH" className="w-8 h-8 object-contain" />
                </div>
                <div className="text-left">
                  <p className="text-ghost-white font-medium text-sm">ETH</p>
                  <p className="text-xs text-mist-gray">{parseFloat(ethBalance).toFixed(4)}</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setDepositToken('USDC')
                  setDepositAmount('')
                }}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all',
                  depositToken === 'USDC'
                    ? 'bg-arcane-purple/20 border-arcane-purple/50'
                    : 'bg-obsidian border-arcane-purple/20 hover:border-arcane-purple/40'
                )}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={USDC.logoURI} alt="USDC" className="w-8 h-8 object-contain" />
                </div>
                <div className="text-left">
                  <p className="text-ghost-white font-medium text-sm">USDC</p>
                  <p className="text-xs text-mist-gray">{parseFloat(usdcWalletBalance).toFixed(2)}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm text-mist-gray mb-2">Amount</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="pr-20"
              />
              <button
                onClick={() => setDepositAmount(depositToken === 'ETH' ? ethBalance : usdcWalletBalance)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ethereal-cyan hover:text-ethereal-cyan/80"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-arcane-purple/10 border border-arcane-purple/20">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-ethereal-cyan flex-shrink-0 mt-0.5" />
              <div className="text-xs text-mist-gray">
                <p className="text-ethereal-cyan font-medium mb-1">How it works</p>
                <p>
                  Your deposit creates a cryptographic commitment stored on-chain. A secret
                  note is saved locally that proves your ownership. Keep this note safe!
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {depositError && (
            <div className="p-3 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
              <p className="text-sm text-blood-crimson">{depositError}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleDeposit}
            disabled={
              !depositAmount ||
              parseFloat(depositAmount) <= 0 ||
              isDepositing ||
              depositState === 'success'
            }
            className="w-full"
          >
            {isDepositing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-ghost-white border-t-transparent rounded-full animate-spin" />
                {depositState === 'generating' && 'Generating Note...'}
                {depositState === 'approving' && 'Approving...'}
                {depositState === 'depositing' && 'Depositing...'}
                {depositState === 'confirming' && 'Confirming...'}
              </div>
            ) : depositState === 'success' ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Deposit Successful!
              </div>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Deposit to Privacy Pool
              </>
            )}
          </Button>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
          setImportJson('')
        }}
        title="Import Deposit Notes"
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-mist-gray">
            Paste the JSON backup of your deposit notes below.
          </p>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"secret": "...", "nullifier": "...", ...}]'
            className={cn(
              'w-full h-40 p-3 rounded-xl resize-none',
              'bg-obsidian border border-arcane-purple/20',
              'text-ghost-white placeholder:text-mist-gray/50',
              'focus:outline-none focus:border-arcane-purple/50',
              'font-mono text-sm'
            )}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importJson.trim()} className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear All Notes?"
      >
        <div className="p-4 space-y-4">
          <div className="p-4 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blood-crimson flex-shrink-0" />
              <div>
                <p className="text-blood-crimson font-medium mb-1">This action is irreversible</p>
                <p className="text-sm text-mist-gray">
                  Clearing all notes will permanently delete your deposit records. You will lose
                  access to any unspent deposits. Make sure you have exported a backup first.
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsClearModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClear}
              className="flex-1 bg-blood-crimson hover:bg-blood-crimson/80 border-blood-crimson"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Claim Modal */}
      <Modal
        isOpen={isClaimModalOpen}
        onClose={() => {
          setIsClaimModalOpen(false)
          setSelectedStealth(null)
          setClaimError(null)
        }}
        title="Claim from Stealth Address"
      >
        <div className="p-4 space-y-4">
          {selectedStealth && (
            <>
              {/* Stealth Address Info */}
              <div className="p-3 rounded-xl bg-obsidian border border-spectral-green/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-spectral-green/20 flex items-center justify-center">
                    <Ghost className="w-5 h-5 text-spectral-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-mist-gray mb-1">From Stealth Address</p>
                    <p className="font-mono text-sm text-ghost-white truncate">
                      {selectedStealth.address}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-spectral-green/10 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-mist-gray mb-1 flex items-center gap-1">
                      <img src={ETH.logoURI} alt="ETH" className="w-3 h-3" />
                      ETH Balance (for gas)
                    </p>
                    <p className="font-mono text-ghost-white">
                      {selectedStealth.balances?.eth
                        ? parseFloat(formatUnits(BigInt(selectedStealth.balances.eth), 18)).toFixed(5)
                        : '0'}{' '}
                      ETH
                    </p>
                    {ethPrice && selectedStealth.balances?.eth && (
                      <p className="text-xs text-mist-gray mt-0.5">
                        ≈ ${(parseFloat(formatUnits(BigInt(selectedStealth.balances.eth), 18)) * ethPrice).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-mist-gray mb-1 flex items-center gap-1">
                      <img src={USDC.logoURI} alt="USDC" className="w-3 h-3" />
                      USDC Balance
                    </p>
                    <p className="font-mono text-spectral-green">
                      {selectedStealth.balances?.usdc
                        ? parseFloat(formatUnits(BigInt(selectedStealth.balances.usdc), 6)).toFixed(2)
                        : '0'}{' '}
                      USDC
                    </p>
                    <p className="text-xs text-mist-gray mt-0.5">
                      ≈ ${selectedStealth.balances?.usdc
                        ? parseFloat(formatUnits(BigInt(selectedStealth.balances.usdc), 6)).toFixed(2)
                        : '0'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Token Type Selection */}
              <div>
                <label className="block text-sm text-mist-gray mb-2">What to Claim</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setClaimTokenType('USDC')}
                    className={cn(
                      'p-2 rounded-lg border text-sm transition-all',
                      claimTokenType === 'USDC'
                        ? 'bg-spectral-green/20 border-spectral-green/50 text-spectral-green'
                        : 'bg-obsidian border-arcane-purple/20 text-mist-gray hover:border-arcane-purple/40'
                    )}
                  >
                    USDC Only
                  </button>
                  <button
                    onClick={() => setClaimTokenType('ETH')}
                    className={cn(
                      'p-2 rounded-lg border text-sm transition-all',
                      claimTokenType === 'ETH'
                        ? 'bg-ethereal-cyan/20 border-ethereal-cyan/50 text-ethereal-cyan'
                        : 'bg-obsidian border-arcane-purple/20 text-mist-gray hover:border-arcane-purple/40'
                    )}
                  >
                    ETH Only
                  </button>
                  <button
                    onClick={() => setClaimTokenType('BOTH')}
                    className={cn(
                      'p-2 rounded-lg border text-sm transition-all',
                      claimTokenType === 'BOTH'
                        ? 'bg-arcane-purple/20 border-arcane-purple/50 text-ghost-white'
                        : 'bg-obsidian border-arcane-purple/20 text-mist-gray hover:border-arcane-purple/40'
                    )}
                  >
                    Both
                  </button>
                </div>
              </div>

              {/* Destination Address */}
              <div>
                <label className="block text-sm text-mist-gray mb-2">Send To</label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={claimDestination}
                  onChange={(e) => setClaimDestination(e.target.value)}
                />
                <p className="text-xs text-mist-gray mt-1">
                  Enter the address where you want to receive your tokens
                </p>
              </div>

              {/* Privacy Note */}
              <div className="p-3 rounded-xl bg-arcane-purple/10 border border-arcane-purple/20">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-ethereal-cyan flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-mist-gray">
                    <p className="text-ethereal-cyan font-medium mb-1">Privacy Note</p>
                    <p>
                      This transaction will transfer USDC from the stealth address to your destination.
                      The stealth address has been funded with ETH for gas by the relayer.
                    </p>
                  </div>
                </div>
              </div>

              {/* Error */}
              {claimError && (
                <div className="p-3 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
                  <p className="text-sm text-blood-crimson">{claimError}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleClaim}
                disabled={!claimDestination || isClaiming}
                className="w-full bg-spectral-green hover:bg-spectral-green/80"
              >
                {isClaiming ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Claiming...
                  </div>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Claim {claimTokenType === 'BOTH' ? 'All Tokens' : claimTokenType}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Success Modal */}
      {successDetails && (
        <TransactionSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false)
            setSuccessDetails(null)
          }}
          details={{
            type: successDetails.type,
            txHash: successDetails.txHash,
            fromToken: successDetails.tokenSymbol,
            fromAmount: successDetails.amount,
            fromLogo: successDetails.tokenLogo,
            recipient: successDetails.destination,
          }}
          explorerBaseUrl="https://unichain-sepolia.blockscout.com"
        />
      )}
    </div>
  )
}
