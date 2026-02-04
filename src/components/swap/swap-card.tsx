import { useState, useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'
import { Settings, ArrowDown, Info, Clock, Percent, ExternalLink, Lock, Wallet, AlertTriangle } from 'lucide-react'
import { TokenInput } from './token-input'
import { TokenSelectorModal, type Token } from './token-selector-modal'
import { SettingsPanel } from './settings-panel'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { TransactionStatus } from '@/components/web3/transaction-status'
import { useAccount } from 'wagmi'
import { useSettings } from '@/hooks/use-settings'
import { useToast } from '@/hooks/use-toast'
import { useStateView, KNOWN_POOL_IDS, useDepositNotes } from '@/hooks'
import { useQuoter, formatQuoteOutput } from '@/hooks/use-quoter'
import { useNativeBalance, useTokenBalance } from '@/hooks/use-token-balance'
import { DEFAULT_FROM_TOKEN, DEFAULT_TO_TOKEN, USDC } from '@/lib/tokens'
import { DEFAULT_POOL_KEY, MIN_SQRT_PRICE, MAX_SQRT_PRICE } from '@/lib/contracts'
import { getRelayerInfo, submitToRelayer, formatProofForRelayer, createSwapParams, type RelayerInfo } from '@/lib/relayer'
import { parseUnits } from 'viem'

type SwapState = 'idle' | 'selecting-note' | 'generating-proof' | 'submitting' | 'confirming' | 'success' | 'error'

// Format large liquidity values for display
function formatLiquidity(liquidity: bigint): string {
  const num = Number(liquidity)
  if (num >= 1e18) return `${(num / 1e18).toFixed(2)}E`
  if (num >= 1e15) return `${(num / 1e15).toFixed(2)}P`
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toFixed(2)
}

export function SwapCard() {
  const { isConnected, address } = useAccount()
  const { settings } = useSettings()
  const { toast } = useToast()

  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [fromToken, setFromToken] = useState<Token>(DEFAULT_FROM_TOKEN)
  const [toToken, setToToken] = useState<Token>(DEFAULT_TO_TOKEN)
  const [showSettings, setShowSettings] = useState(false)
  const [swapState, setSwapState] = useState<SwapState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null)

  // Token selector modal state
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [selectingFor, setSelectingFor] = useState<'from' | 'to'>('from')

  const cardRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  // Get deposit notes for ZK swap
  const { notes } = useDepositNotes()
  const availableNotes = notes.filter(n => !n.spent && n.leafIndex !== undefined)

  // Fetch real pool state from StateView
  const {
    poolState,
    isInitialized,
    isLoading: poolLoading,
    currentPrice,
    inversePrice,
    poolId,
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
        console.log('Relayer info:', info)
      }
    })
  }, [])

  // Get balance for current token
  const getBalance = (symbol: string): string => {
    if (!isConnected) return '0'
    if (symbol === 'ETH') return parseFloat(ethBalance).toFixed(4)
    if (symbol === 'USDC') return parseFloat(usdcBalance).toFixed(2)
    return '0'
  }

  // Determine if we're swapping token0 -> token1 or token1 -> token0
  const zeroForOne =
    fromToken.address.toLowerCase() === DEFAULT_POOL_KEY.currency0.toLowerCase()

  // Calculate exchange rate from pool price
  const exchangeRate = currentPrice
    ? zeroForOne
      ? currentPrice
      : inversePrice || 0
    : 0

  // Check if using GrimSwap Privacy Pool
  const isPrivacyPool = DEFAULT_POOL_KEY.hooks !== '0x0000000000000000000000000000000000000000'

  // Log pool info for debugging
  useEffect(() => {
    console.log('Pool Info (via StateView):', {
      calculatedPoolId: poolId,
      expectedPoolId: isPrivacyPool ? KNOWN_POOL_IDS.ETH_USDC_GRIMSWAP : KNOWN_POOL_IDS.ETH_USDC_0_3,
      isPrivacyPool,
      hookAddress: DEFAULT_POOL_KEY.hooks,
      isInitialized,
      currentPrice,
      availableNotes: availableNotes.length,
    })
  }, [poolId, isInitialized, currentPrice, isPrivacyPool, availableNotes.length])

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
    const isSwapping = ['generating-proof', 'submitting', 'confirming'].includes(swapState)

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

  /**
   * Execute ZK private swap through relayer
   * This is the production flow:
   * 1. Find a suitable deposit note
   * 2. Generate ZK proof locally
   * 3. Send proof to relayer
   * 4. Relayer submits transaction on-chain
   */
  const handleSwap = useCallback(async () => {
    if (!isConnected || !address || !relayerInfo) {
      setSwapError('Wallet not connected or relayer unavailable')
      return
    }

    // For privacy swaps, we need deposit notes
    if (isPrivacyPool && availableNotes.length === 0) {
      setSwapError('No deposit notes available. Please deposit to GrimPool first.')
      toast.error('No Deposit Notes', 'You need to deposit tokens to GrimPool before swapping privately.')
      return
    }

    try {
      setSwapState('selecting-note')
      setSwapError(null)
      setTxHash(null)

      const inputAmount = parseUnits(fromAmount, fromToken.decimals)

      // Find a note with sufficient balance
      const suitableNote = availableNotes.find(note => BigInt(note.amount) >= inputAmount)

      if (!suitableNote) {
        throw new Error(`No deposit note with sufficient balance. Need ${fromAmount} ${fromToken.symbol}`)
      }

      console.log('Using deposit note:', {
        id: suitableNote.id,
        amount: suitableNote.amount,
        leafIndex: suitableNote.leafIndex,
      })

      // Step 2: Generate ZK proof
      setSwapState('generating-proof')
      toast.info('Generating Proof', 'Creating ZK-SNARK proof (~1-2 seconds)...')

      // Import ZK proof generation dynamically
      const { generateProof } = await import('@/lib/zk/proof')
      const { buildMerkleTree } = await import('@/lib/zk/merkle')

      // Build Merkle tree and get proof
      // In production, this would sync with on-chain data
      const tree = await buildMerkleTree([BigInt(suitableNote.commitment)])
      const merkleProof = await tree.getProof(0)

      // Generate stealth address for receiving tokens
      const stealthPrivateKey = BigInt(Math.floor(Math.random() * 1e18))
      const stealthAddress = `0x${stealthPrivateKey.toString(16).slice(0, 40).padStart(40, '0')}`

      // Prepare note for proof generation
      const noteForProof = {
        secret: BigInt(suitableNote.secret),
        nullifier: BigInt(suitableNote.nullifier),
        amount: BigInt(suitableNote.amount),
        commitment: BigInt(suitableNote.commitment),
        nullifierHash: BigInt(suitableNote.nullifierHash),
        leafIndex: suitableNote.leafIndex,
      }

      // Generate ZK proof
      const expectedOutput = parseUnits(toAmount || '0', toToken.decimals)
      const proofResult = await generateProof(
        noteForProof,
        merkleProof,
        {
          recipient: stealthAddress as `0x${string}`,
          relayer: relayerInfo.address as `0x${string}`,
          relayerFee: relayerInfo.feeBps,
          swapAmountOut: expectedOutput, // Expected output from swap
        }
      )

      if (!proofResult) {
        throw new Error('Failed to generate ZK proof')
      }

      console.log('ZK proof generated:', {
        publicSignals: proofResult.publicSignals,
      })

      // Step 3: Submit to relayer
      setSwapState('submitting')
      toast.info('Submitting', 'Sending to relayer...')

      const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE

      const relayResponse = await submitToRelayer({
        proof: formatProofForRelayer(proofResult.proof),
        publicSignals: proofResult.publicSignals,
        swapParams: createSwapParams(
          DEFAULT_POOL_KEY,
          zeroForOne,
          -inputAmount, // Negative for exact input
          sqrtPriceLimitX96
        ),
      })

      if (!relayResponse.success) {
        throw new Error(relayResponse.error || 'Relayer submission failed')
      }

      // Step 4: Success
      setSwapState('success')
      setTxHash(relayResponse.txHash || null)

      toast.success('Swap Complete', `Swapped ${fromAmount} ${fromToken.symbol} privately!`)

      // Reset after delay
      setTimeout(() => {
        setSwapState('idle')
        setFromAmount('')
        setToAmount('')
        setTxHash(null)
      }, 5000)

    } catch (error) {
      console.error('Swap failed:', error)
      setSwapState('error')
      setSwapError(error instanceof Error ? error.message : 'Unknown error')
      toast.error('Swap Failed', error instanceof Error ? error.message : 'Unknown error occurred')

      setTimeout(() => {
        setSwapState('idle')
        setSwapError(null)
      }, 5000)
    }
  }, [isConnected, address, relayerInfo, isPrivacyPool, availableNotes, fromAmount, fromToken, toToken, zeroForOne, toast])

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

  const isSwapping = swapState !== 'idle' && swapState !== 'success' && swapState !== 'error'

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

  // Get swap button text
  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet'
    if (poolLoading) return 'Loading Pool...'
    if (!isInitialized) return 'Pool Not Initialized'
    if (!relayerInfo) return 'Connecting to Relayer...'
    if (isPrivacyPool && availableNotes.length === 0) return 'Deposit Required'
    if (isQuoting) return 'Getting Quote...'
    if (swapState === 'selecting-note') return 'Selecting Note...'
    if (swapState === 'generating-proof') return 'Generating ZK Proof...'
    if (swapState === 'submitting') return 'Submitting to Relayer...'
    if (swapState === 'confirming') return 'Confirming...'
    if (swapState === 'success') return 'Swap Complete!'
    if (swapState === 'error') return 'Swap Failed'
    if (!fromAmount) return 'Enter Amount'
    return 'Transmute'
  }

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          'relative w-full',
          'rounded-2xl p-[1px]',
          'bg-gradient-to-br from-arcane-purple/50 via-transparent to-spectral-green/50'
        )}
      >
        {/* Animated glow ring */}
        <div
          ref={glowRef}
          className={cn(
            'absolute inset-0 rounded-2xl opacity-0',
            'bg-gradient-conic from-arcane-purple via-spectral-green via-ethereal-cyan to-arcane-purple',
            'blur-xl pointer-events-none'
          )}
        />

        <div className="relative rounded-2xl bg-charcoal/95 backdrop-blur-xl p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl text-ghost-white">Cast Spell</h2>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'p-2 rounded-lg transition-all hover:bg-white/5',
                showSettings && 'bg-arcane-purple/10 text-arcane-purple'
              )}
            >
              <Settings className={cn('w-5 h-5', showSettings ? 'text-arcane-purple' : 'text-mist-gray')} />
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
                <div className="w-4 h-4 border-2 border-ethereal-cyan border-t-transparent rounded-full animate-spin" />
                <span>Loading pool data...</span>
              </div>
            </div>
          )}

          {!poolLoading && isInitialized && poolState && (
            <div className={cn(
              "mb-5 p-3 rounded-xl border",
              isPrivacyPool ? "bg-arcane-purple/10 border-arcane-purple/30" : "bg-spectral-green/10 border-spectral-green/30"
            )}>
              <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-2 text-sm", isPrivacyPool ? "text-arcane-purple" : "text-spectral-green")}>
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", isPrivacyPool ? "bg-arcane-purple" : "bg-spectral-green")} />
                  {isPrivacyPool ? (
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      GrimSwap Privacy Pool
                    </span>
                  ) : (
                    <span>Pool Active</span>
                  )}
                </div>
                <a
                  href={`https://app.uniswap.org/explore/pools/unichain_sepolia/${poolId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-arcane-purple hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Uniswap
                </a>
              </div>
              {isPrivacyPool && (
                <p className="text-xs text-mist-gray mt-2">
                  Your swaps are protected by ZK-SNARK proofs via relayer
                </p>
              )}
            </div>
          )}

          {/* Relayer Status */}
          {relayerInfo && (
            <div className="mb-5 p-3 rounded-xl bg-spectral-green/5 border border-spectral-green/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-spectral-green animate-pulse" />
                  Relayer Online
                </span>
                <span className="text-mist-gray">
                  Fee: {relayerInfo.feeBps / 100}%
                </span>
              </div>
            </div>
          )}

          {/* Deposit Notes Warning */}
          {isPrivacyPool && availableNotes.length === 0 && isConnected && (
            <div className="mb-5 p-3 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blood-crimson flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blood-crimson font-medium">No Deposit Notes</p>
                  <p className="text-xs text-mist-gray mt-1">
                    Privacy swaps require a deposit to GrimPool first.
                    Go to the <a href="/wallet" className="text-arcane-purple hover:underline">Grimoire</a> to deposit.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Available Notes */}
          {isPrivacyPool && availableNotes.length > 0 && (
            <div className="mb-5 p-3 rounded-xl bg-arcane-purple/5 border border-arcane-purple/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  Available Notes
                </span>
                <span className="text-arcane-purple font-mono">{availableNotes.length}</span>
              </div>
            </div>
          )}

          {/* Transaction Status */}
          {(swapState !== 'idle' || swapError) && (
            <div className="mb-5">
              <TransactionStatus
                state={swapState === 'success' ? 'success' : swapState === 'error' ? 'error' : 'pending'}
                hash={txHash || undefined}
                message={swapError || undefined}
                onClose={() => {
                  setSwapState('idle')
                  setTxHash(null)
                  setSwapError(null)
                }}
              />
            </div>
          )}

          {/* From Token */}
          <TokenInput
            label="You sacrifice"
            amount={fromAmount}
            onAmountChange={setFromAmount}
            token={fromToken}
            onTokenSelect={() => openTokenSelector('from')}
            balance={getBalance(fromToken.symbol)}
            disabled={isSwapping}
            className="mb-2"
          />

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleFlipTokens}
              disabled={isSwapping}
              className={cn(
                'swap-arrow p-3 rounded-xl',
                'bg-obsidian border border-arcane-purple/30',
                'hover:border-arcane-purple/60 hover:scale-110',
                'active:scale-95 transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              <ArrowDown className="w-5 h-5 text-arcane-purple" />
            </button>
          </div>

          {/* To Token */}
          <TokenInput
            label="You receive"
            amount={toAmount}
            onAmountChange={setToAmount}
            token={toToken}
            onTokenSelect={() => openTokenSelector('to')}
            balance={getBalance(toToken.symbol)}
            disabled
            className="mt-2 mb-4"
          />

          {/* Price Info */}
          {fromAmount && !isSwapping && isInitialized && (
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

              {poolState && poolState.liquidity > 0n && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-mist-gray flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Pool Liquidity
                  </span>
                  <span className="text-ghost-white font-mono text-xs sm:text-sm">
                    {formatLiquidity(poolState.liquidity)}
                  </span>
                </div>
              )}

              {isQuoting && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-mist-gray flex items-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-arcane-purple border-t-transparent rounded-full animate-spin" />
                    Getting quote...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Swap Button */}
          <ShimmerButton onClick={handleSwap} disabled={!canSwap}>
            {getButtonText()}
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
    </>
  )
}
