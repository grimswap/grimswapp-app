import { useState, useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'
import { Settings, ArrowDown, Info, Clock, Percent, ExternalLink, Lock, Wallet, AlertTriangle, Loader2 } from 'lucide-react'
import { TokenInput } from './token-input'
import { TokenSelectorModal, type Token } from './token-selector-modal'
import { SettingsPanel } from './settings-panel'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { TransactionSuccessModal } from '@/components/ui/transaction-success-modal'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { useSettings } from '@/hooks/use-settings'
import { useToast } from '@/hooks/use-toast'
import { useStateView, useDepositNotes, useMerkleTree, useStealthAddresses } from '@/hooks'
import { useQuoter, formatQuoteOutput } from '@/hooks/use-quoter'
import { useNativeBalance, useTokenBalance } from '@/hooks/use-token-balance'
import { DEFAULT_FROM_TOKEN, DEFAULT_TO_TOKEN, USDC } from '@/lib/tokens'
import { DEFAULT_POOL_KEY, MIN_SQRT_PRICE, MAX_SQRT_PRICE, isNativeToken } from '@/lib/contracts'
import { getRelayerInfo, submitToRelayer, formatProofForRelayer, createSwapParams, type RelayerInfo } from '@/lib/relayer'
import { parseUnits, formatUnits, type Address } from 'viem'

type SwapState = 'idle' | 'preparing' | 'generating-proof' | 'submitting' | 'success' | 'error'

export function SwapCard() {
  const { isConnected, address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { settings } = useSettings()
  const { toast } = useToast()

  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [fromToken, setFromToken] = useState<Token>(DEFAULT_FROM_TOKEN)
  const [toToken, setToToken] = useState<Token>(DEFAULT_TO_TOKEN)
  const [showSettings, setShowSettings] = useState(false)
  const [swapState, setSwapState] = useState<SwapState>('idle')
  const [swapStep, setSwapStep] = useState('')
  const [swapError, setSwapError] = useState<string | null>(null)
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)

  // Token selector modal state
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [selectingFor, setSelectingFor] = useState<'from' | 'to'>('from')

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successDetails, setSuccessDetails] = useState<{
    txHash: string
    fromAmount: string
    toAmount: string
    stealthAddress?: string
  } | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  // Get deposit notes for ZK swap - filter by selected fromToken
  const { notes, spendNote } = useDepositNotes()
  const availableNotes = notes.filter(n =>
    !n.spent &&
    n.leafIndex !== undefined &&
    // Filter by token if tokenAddress is stored in note
    (!n.tokenAddress || n.tokenAddress.toLowerCase() === fromToken.address.toLowerCase())
  )

  // Merkle tree sync with on-chain data
  const { getProof: getMerkleProof } = useMerkleTree()

  // Stealth address management for receiving private swap outputs
  const { generateStealthKeypairOnly, saveStealthAddress, updateSwapTxHash } = useStealthAddresses()

  // Fetch real pool state from StateView
  const {
    poolState,
    isInitialized,
    isLoading: poolLoading,
    currentPrice,
    inversePrice,
  } = useStateView(DEFAULT_POOL_KEY)

  // Get accurate swap quotes from Quoter
  const { quoteExactInputSingle, isQuoting } = useQuoter()

  // Fetch real balances
  const { formatted: ethBalance } = useNativeBalance()
  const { formatted: usdcBalance } = useTokenBalance(USDC.address)

  // Fetch relayer info on mount
  useEffect(() => {
    getRelayerInfo().then(info => {
      if (info) {
        setRelayerInfo(info)
      }
    })
  }, [])

  // Get wallet balance for current token
  const getWalletBalance = (symbol: string): string => {
    if (!isConnected) return '0'
    if (symbol === 'ETH') return parseFloat(ethBalance).toFixed(4)
    if (symbol === 'USDC') return parseFloat(usdcBalance).toFixed(2)
    return '0'
  }

  // Get the first available note (what will actually be swapped)
  const firstAvailableNote = availableNotes[0]
  const firstNoteAmount = firstAvailableNote
    ? Number(formatUnits(BigInt(firstAvailableNote.amount), fromToken.decimals))
    : 0

  // Calculate total deposit notes balance
  const totalNotesBalance = availableNotes.reduce((acc, note) => {
    return acc + Number(formatUnits(BigInt(note.amount), fromToken.decimals))
  }, 0)

  // Check if using GrimSwap Privacy Pool
  const isPrivacyPool = DEFAULT_POOL_KEY.hooks !== '0x0000000000000000000000000000000000000000'

  // Get balance to display - for privacy pools, show total notes balance
  const getBalance = (symbol: string): string => {
    if (!isConnected) return '0'
    if (isPrivacyPool && symbol === fromToken.symbol && availableNotes.length > 0) {
      return `${totalNotesBalance.toFixed(4)} (${availableNotes.length} note${availableNotes.length > 1 ? 's' : ''})`
    }
    return getWalletBalance(symbol)
  }

  // Determine if we're swapping token0 -> token1 or token1 -> token0
  const zeroForOne = fromToken.address.toLowerCase() === DEFAULT_POOL_KEY.currency0.toLowerCase()

  // Calculate exchange rate from pool price
  const exchangeRate = currentPrice
    ? zeroForOne ? currentPrice : inversePrice || 0
    : 0

  // Auto-fill amount from deposit note for privacy swaps
  useEffect(() => {
    if (isPrivacyPool && availableNotes.length > 0 && isConnected && swapState === 'idle') {
      const note = availableNotes[0]
      const noteAmountFormatted = formatUnits(BigInt(note.amount), fromToken.decimals)
      setFromAmount(noteAmountFormatted)
    }
  }, [isPrivacyPool, availableNotes, isConnected, fromToken.decimals, swapState])

  // Calculate output amount using Quoter
  useEffect(() => {
    const getQuote = async () => {
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        setToAmount('')
        return
      }

      if (isInitialized) {
        try {
          const inputAmount = parseUnits(fromAmount, fromToken.decimals)
          const quote = await quoteExactInputSingle({
            poolKey: DEFAULT_POOL_KEY,
            zeroForOne,
            exactAmount: inputAmount,
          })

          if (quote && quote.amountOut > 0n) {
            const formattedOutput = formatQuoteOutput(quote.amountOut, toToken.decimals)
            setToAmount(formattedOutput)
          } else if (poolState && currentPrice && currentPrice > 0) {
            const inputFloat = parseFloat(fromAmount)
            const outputFloat = zeroForOne
              ? inputFloat * currentPrice * 0.997
              : inputFloat / currentPrice * 0.997
            setToAmount(outputFloat.toFixed(toToken.decimals > 6 ? 6 : 2))
          }
        } catch (err) {
          console.error('Failed to get quote:', err)
          if (currentPrice && currentPrice > 0) {
            const inputFloat = parseFloat(fromAmount)
            const outputFloat = zeroForOne
              ? inputFloat * currentPrice * 0.997
              : inputFloat / currentPrice * 0.997
            setToAmount(outputFloat.toFixed(toToken.decimals > 6 ? 6 : 2))
          }
        }
      }
    }

    const timeoutId = setTimeout(getQuote, 300)
    return () => clearTimeout(timeoutId)
  }, [fromAmount, fromToken, toToken, poolState, isInitialized, zeroForOne, quoteExactInputSingle, currentPrice])

  // Animate glow on swap
  useEffect(() => {
    const isSwapping = ['preparing', 'generating-proof', 'submitting'].includes(swapState)

    if (isSwapping && glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 0.5,
        scale: 1.1,
        duration: 0.5,
        ease: 'power2.out',
      })
      gsap.to(glowRef.current, {
        rotation: 360,
        duration: 2,
        ease: 'none',
        repeat: -1,
      })
    } else if (glowRef.current) {
      gsap.killTweensOf(glowRef.current)
      gsap.to(glowRef.current, {
        opacity: 0,
        scale: 1,
        rotation: 0,
        duration: 0.3,
      })
    }
  }, [swapState])

  // Reset state helper
  const resetSwapState = useCallback(() => {
    setSwapState('idle')
    setSwapStep('')
    setSwapError(null)
  }, [])

  /**
   * Execute ZK private swap through relayer
   */
  const handleSwap = useCallback(async () => {
    if (!isConnected || !address || !relayerInfo) {
      toast.error('Error', 'Wallet not connected or relayer unavailable')
      return
    }

    if (isPrivacyPool && availableNotes.length === 0) {
      toast.error('No Deposit Notes', 'You need to deposit to GrimPool first.')
      return
    }

    try {
      // Reset and start
      setSwapError(null)
      setSwapState('preparing')
      setSwapStep('Preparing swap...')

      const suitableNote = availableNotes[0]
      if (!suitableNote) {
        throw new Error('No deposit notes available')
      }

      const noteAmount = BigInt(suitableNote.amount)

      // Step 1: Generate ZK proof
      setSwapState('generating-proof')
      setSwapStep('Generating ZK proof...')

      const { generateProof } = await import('@/lib/zk/proof')
      const { buildMerkleTree } = await import('@/lib/zk/merkle')

      let merkleProof = await getMerkleProof(suitableNote.leafIndex!)

      if (!merkleProof) {
        setSwapStep('Building Merkle tree...')
        const tree = await buildMerkleTree([BigInt(suitableNote.commitment)])
        merkleProof = await tree.getProof(0)
      }

      setSwapStep('Creating stealth address...')
      // Generate keypair but don't save until swap succeeds
      const stealthRecord = generateStealthKeypairOnly()
      const stealthAddress = stealthRecord.address

      setSwapStep('Computing ZK-SNARK proof...')
      const noteForProof = {
        secret: BigInt(suitableNote.secret),
        nullifier: BigInt(suitableNote.nullifier),
        amount: BigInt(suitableNote.amount),
        commitment: BigInt(suitableNote.commitment),
        nullifierHash: BigInt(suitableNote.nullifierHash),
        leafIndex: suitableNote.leafIndex!, // Use note's leafIndex, not proof's
      }

      // Calculate expected output based on swap direction
      // currentPrice is USDC per ETH (e.g., 2500 means 1 ETH = 2500 USDC)
      const noteAmountFormatted = Number(noteAmount) / Math.pow(10, fromToken.decimals)
      let expectedOutputAmount: number

      if (zeroForOne) {
        // ETH → USDC: multiply by price
        expectedOutputAmount = noteAmountFormatted * (currentPrice ?? 0) * 0.99
      } else {
        // USDC → ETH: divide by price
        expectedOutputAmount = currentPrice && currentPrice > 0
          ? (noteAmountFormatted / currentPrice) * 0.99
          : 0
      }

      const expectedOutput = currentPrice && currentPrice > 0
        ? BigInt(Math.floor(expectedOutputAmount * Math.pow(10, toToken.decimals)))
        : parseUnits(toAmount || '0', toToken.decimals)

      const proofResult = await generateProof(
        noteForProof,
        merkleProof,
        {
          recipient: stealthAddress as `0x${string}`,
          relayer: relayerInfo.address as `0x${string}`,
          relayerFee: relayerInfo.feeBps,
          swapAmountOut: expectedOutput,
        }
      )

      if (!proofResult) {
        throw new Error('Failed to generate ZK proof')
      }

      // Step 2: Verify Merkle root is known on-chain
      setSwapStep('Verifying Merkle root...')
      const { grimPoolConfig } = await import('@/lib/contracts')
      const rootBytes32 = `0x${merkleProof.root.toString(16).padStart(64, '0')}` as `0x${string}`

      if (publicClient) {
        try {
          // Check if the root is known
          const isKnown = await publicClient.readContract({
            ...grimPoolConfig,
            functionName: 'isKnownRoot',
            args: [rootBytes32],
          })

          if (!isKnown) {
            // Get the current on-chain root for comparison
            const onChainRoot = await publicClient.readContract({
              ...grimPoolConfig,
              functionName: 'getLastRoot',
              args: [],
            })
            console.warn('Merkle root mismatch:', {
              computed: rootBytes32,
              onChain: onChainRoot,
            })
            // The relayer may still accept if it can verify against a historical root
          }
        } catch (err) {
          console.warn('Could not verify Merkle root:', err)
        }
      }

      // Step 3: Submit to relayer
      setSwapState('submitting')
      setSwapStep('Submitting to relayer...')

      const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE

      const formattedProof = formatProofForRelayer(proofResult.proof, proofResult.publicSignals)

      // V3: Pass inputToken for ERC20 swaps (not needed for ETH)
      const inputToken = isNativeToken(fromToken.address as Address)
        ? undefined
        : fromToken.address as Address

      const relayResponse = await submitToRelayer({
        proof: formattedProof.proof,
        publicSignals: formattedProof.publicSignals,
        swapParams: createSwapParams(
          DEFAULT_POOL_KEY,
          zeroForOne,
          -noteAmount,
          sqrtPriceLimitX96,
          inputToken
        ),
      })

      if (!relayResponse.success) {
        throw new Error(relayResponse.error || 'Relayer submission failed')
      }

      // Success!
      setSwapState('success')
      setSwapStep('')

      // NOW save the stealth address since swap succeeded
      await saveStealthAddress(stealthRecord)

      // Update stealth address with swap tx hash
      if (relayResponse.txHash) {
        await updateSwapTxHash(stealthAddress, relayResponse.txHash)
      }

      // Mark note as spent
      if (suitableNote.id) {
        await spendNote(suitableNote.id)
      }

      const swappedAmount = formatUnits(noteAmount, fromToken.decimals)

      // Show success modal
      setSuccessDetails({
        txHash: relayResponse.txHash || '',
        fromAmount: swappedAmount,
        toAmount: toAmount,
        stealthAddress: stealthAddress,
      })
      setShowSuccessModal(true)

      // Reset form after delay
      setTimeout(() => {
        setFromAmount('')
        setToAmount('')
        resetSwapState()
      }, 3000)

    } catch (error) {
      console.error('Swap failed:', error)
      setSwapState('error')
      setSwapStep('')
      setSwapError(error instanceof Error ? error.message : 'Unknown error')
      toast.error('Swap Failed', error instanceof Error ? error.message : 'Unknown error')
    }
  }, [isConnected, address, relayerInfo, isPrivacyPool, availableNotes, fromToken, toToken, toAmount, zeroForOne, toast, generateStealthKeypairOnly, saveStealthAddress, updateSwapTxHash, getMerkleProof, publicClient, walletClient, currentPrice, spendNote, resetSwapState])

  const handleFlipTokens = () => {
    if (cardRef.current) {
      const arrow = cardRef.current.querySelector('.swap-arrow')
      if (arrow) {
        gsap.to(arrow, { rotation: '+=180', duration: 0.3, ease: 'power2.out' })
      }
    }
    const tempToken = fromToken
    setFromToken(toToken)
    setToToken(tempToken)
    const tempAmount = fromAmount
    setFromAmount(toAmount)
    setToAmount(tempAmount)
  }

  const openTokenSelector = (type: 'from' | 'to') => {
    setSelectingFor(type)
    setTokenModalOpen(true)
  }

  const handleTokenSelect = (token: Token) => {
    if (selectingFor === 'from') {
      if (token.address === toToken.address) setToToken(fromToken)
      setFromToken(token)
    } else {
      if (token.address === fromToken.address) setFromToken(toToken)
      setToToken(token)
    }
  }

  const isSwapping = !['idle', 'success', 'error'].includes(swapState)

  const canSwap =
    isConnected &&
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    toAmount &&
    parseFloat(toAmount) > 0 &&
    swapState === 'idle' &&
    isInitialized &&
    !poolLoading &&
    !isQuoting &&
    relayerInfo !== null &&
    (isPrivacyPool ? availableNotes.length > 0 : true)

  // Calculate minimum received
  const minReceived = toAmount
    ? (parseFloat(toAmount) * (1 - settings.swap.slippageTolerance / 100)).toFixed(
        toToken.decimals > 6 ? 6 : 2
      )
    : '0'

  // Calculate real price impact
  const priceImpact = (() => {
    if (!fromAmount || !poolState || poolState.liquidity === 0n || !currentPrice) return 0
    const inputAmount = parseFloat(fromAmount)
    if (inputAmount <= 0) return 0
    const tradeValueUsd = zeroForOne ? inputAmount * currentPrice : inputAmount
    const ethInPool = Number(poolState.liquidity) / 1e12
    const poolValueUsd = ethInPool * currentPrice * 2
    const impact = (tradeValueUsd / poolValueUsd) * 100
    return Math.min(impact, 99.99)
  })()

  // Get swap button content
  const getButtonContent = () => {
    if (!isConnected) return 'Connect Wallet'
    if (poolLoading) return 'Loading Pool...'
    if (!isInitialized) return 'Pool Not Initialized'
    if (!relayerInfo) return 'Connecting to Relayer...'
    if (isPrivacyPool && availableNotes.length === 0) return 'Deposit Required'
    if (isQuoting) return 'Getting Quote...'

    if (isSwapping) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {swapStep || 'Processing...'}
        </span>
      )
    }

    if (swapState === 'success') return 'Swap Complete!'
    if (swapState === 'error') return 'Try Again'
    if (!fromAmount || parseFloat(fromAmount) <= 0) return 'Enter Amount'

    return 'Swap'
  }

  return (
    <>
      <div
        ref={cardRef}
        className="relative w-full rounded-2xl p-[1px]"
        style={{
          background: 'linear-gradient(135deg, rgba(164, 35, 139, 0.5) 0%, transparent 50%, rgba(0, 237, 218, 0.5) 100%)',
        }}
      >
        {/* Animated glow ring */}
        <div
          ref={glowRef}
          className="absolute inset-0 rounded-2xl opacity-0 blur-xl pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, #A4238B, #00EDDA, #00EDDA, #A4238B)',
          }}
        />

        <div
          className="relative rounded-2xl backdrop-blur-xl p-5 sm:p-6"
          style={{ background: 'rgba(42, 20, 40, 0.95)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl text-ghost-white">Swap</h2>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'p-2 rounded-lg transition-all hover:bg-white/5',
                showSettings && 'bg-arcane-purple/10 text-ethereal-cyan'
              )}
            >
              <Settings className={cn('w-5 h-5', showSettings ? 'text-ethereal-cyan' : 'text-mist-gray')} />
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mb-5">
              <SettingsPanel />
            </div>
          )}

          {/* Pool Status */}
          {poolLoading && (
            <div className="mb-5 p-3 rounded-xl bg-ethereal-cyan/10 border border-ethereal-cyan/30">
              <div className="flex items-center gap-2 text-ethereal-cyan text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading pool...</span>
              </div>
            </div>
          )}

          {!poolLoading && isInitialized && poolState && (
            <div className={cn(
              "mb-5 p-3 rounded-xl border",
              isPrivacyPool ? "bg-arcane-purple/10 border-arcane-purple/30" : "bg-spectral-green/10 border-spectral-green/30"
            )}>
              <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-2 text-sm", isPrivacyPool ? "text-ethereal-cyan" : "text-spectral-green")}>
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", isPrivacyPool ? "bg-arcane-purple" : "bg-spectral-green")} />
                  {isPrivacyPool ? (
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Privacy Pool ({fromToken.symbol} → {toToken.symbol})
                    </span>
                  ) : (
                    <span>Pool Active</span>
                  )}
                </div>
                <a
                  href={`https://sepolia.uniscan.xyz/address/${DEFAULT_POOL_KEY.hooks}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-mist-gray hover:text-ethereal-cyan"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Relayer Status */}
          {relayerInfo && !poolLoading && (
            <div className="mb-5 p-3 rounded-xl bg-spectral-green/5 border border-spectral-green/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-spectral-green" />
                  Relayer Online
                </span>
                <span className="text-mist-gray">Fee: {relayerInfo.feeBps / 100}%</span>
              </div>
            </div>
          )}

          {/* Deposit Notes Warning */}
          {isPrivacyPool && availableNotes.length === 0 && isConnected && !poolLoading && (
            <div className="mb-5 p-3 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blood-crimson flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blood-crimson font-medium">No {fromToken.symbol} Deposit Notes</p>
                  <p className="text-xs text-mist-gray mt-1">
                    Go to <a href="/wallet" className="text-ethereal-cyan hover:underline">Grimoire</a> to deposit {fromToken.symbol} first.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Available Notes */}
          {isPrivacyPool && availableNotes.length > 0 && !poolLoading && (
            <div className="mb-5 p-3 rounded-xl bg-arcane-purple/5 border border-arcane-purple/20">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  {fromToken.symbol} Deposit Notes
                </span>
                <span className="text-ethereal-cyan font-mono font-medium">
                  {totalNotesBalance.toFixed(fromToken.decimals > 6 ? 4 : 2)} {fromToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-mist-gray">
                  {availableNotes.length} note{availableNotes.length > 1 ? 's' : ''} available
                </span>
                <span className="text-mist-gray">
                  Swapping: <span className="text-spectral-green font-mono">{firstNoteAmount.toFixed(fromToken.decimals > 6 ? 4 : 2)} {fromToken.symbol}</span>
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {swapState === 'error' && swapError && (
            <div className="mb-5 p-3 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blood-crimson flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blood-crimson font-medium">Swap Failed</p>
                  <p className="text-xs text-mist-gray mt-1">{swapError}</p>
                </div>
              </div>
            </div>
          )}


          {/* From Token */}
          <TokenInput
            label={isPrivacyPool && availableNotes.length > 0 ? "You send (full note)" : "You send"}
            amount={fromAmount}
            onAmountChange={setFromAmount}
            token={fromToken}
            onTokenSelect={() => openTokenSelector('from')}
            balance={getBalance(fromToken.symbol)}
            disabled={isSwapping || (isPrivacyPool && availableNotes.length > 0)}
            className="mb-2"
          />

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleFlipTokens}
              disabled={isSwapping}
              title="Swap direction"
              className={cn(
                'swap-arrow p-3 rounded-xl',
                'bg-obsidian border border-arcane-purple/30',
                'hover:border-arcane-purple/60 hover:scale-110',
                'active:scale-95 transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              <ArrowDown className="w-5 h-5 text-ethereal-cyan" />
            </button>
          </div>

          {/* To Token */}
          <TokenInput
            label={isPrivacyPool ? "You receive (stealth)" : "You receive"}
            amount={toAmount}
            onAmountChange={setToAmount}
            token={toToken}
            onTokenSelect={() => openTokenSelector('to')}
            balance={getBalance(toToken.symbol)}
            disabled
            className="mt-2 mb-4"
          />

          {/* Price Info */}
          {fromAmount && parseFloat(fromAmount) > 0 && !isSwapping && isInitialized && (
            <div className="mb-5 p-3 rounded-xl bg-obsidian/30 border border-arcane-purple/10 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Rate
                </span>
                <span className="text-ghost-white font-mono text-xs sm:text-sm">
                  1 {fromToken.symbol} ≈ {exchangeRate > 0
                    ? exchangeRate >= 1
                      ? exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : exchangeRate.toFixed(6)
                    : '—'} {toToken.symbol}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" />
                  Price Impact
                </span>
                <span className={cn(
                  'font-mono text-xs sm:text-sm',
                  priceImpact < 1 ? 'text-spectral-green' : priceImpact < 3 ? 'text-ethereal-cyan' : 'text-blood-crimson'
                )}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Min. Received
                </span>
                <span className="text-ghost-white font-mono text-xs sm:text-sm">
                  {minReceived} {toToken.symbol}
                </span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <ShimmerButton
            onClick={swapState === 'error' ? resetSwapState : handleSwap}
            disabled={swapState === 'error' ? false : !canSwap}
          >
            {getButtonContent()}
          </ShimmerButton>
        </div>
      </div>

      {/* Token Selector Modal */}
      <TokenSelectorModal
        isOpen={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        onSelect={handleTokenSelect}
        selectedToken={selectingFor === 'from' ? fromToken : toToken}
      />

      {/* Success Modal */}
      {successDetails && (
        <TransactionSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false)
            setSuccessDetails(null)
          }}
          details={{
            type: 'swap',
            txHash: successDetails.txHash,
            fromToken: fromToken.symbol,
            toToken: toToken.symbol,
            fromAmount: successDetails.fromAmount,
            toAmount: successDetails.toAmount,
            fromLogo: fromToken.logoURI,
            toLogo: toToken.logoURI,
            stealthAddress: successDetails.stealthAddress,
          }}
          explorerBaseUrl="https://unichain-sepolia.blockscout.com"
        />
      )}
    </>
  )
}
