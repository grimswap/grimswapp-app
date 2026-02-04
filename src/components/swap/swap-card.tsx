import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'
import { Settings, ArrowDown, Info, Shield, Clock, Percent } from 'lucide-react'
import { TokenInput } from './token-input'
import { TokenSelectorModal, type Token } from './token-selector-modal'
import { RingSelector } from './ring-selector'
import { SettingsPanel } from './settings-panel'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { TransactionStatus } from '@/components/web3/transaction-status'
import { useAccount } from 'wagmi'
import { useSettings } from '@/hooks/use-settings'
import { useToast } from '@/hooks/use-toast'

// Default tokens
const DEFAULT_FROM_TOKEN: Token = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  balance: '1.234',
}

const DEFAULT_TO_TOKEN: Token = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  balance: '1,250.00',
}

type SwapState = 'idle' | 'confirming' | 'pending' | 'success' | 'error'

export function SwapCard() {
  const { isConnected, address } = useAccount()
  const { settings } = useSettings()
  const { toast } = useToast()

  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [fromToken, setFromToken] = useState<Token>(DEFAULT_FROM_TOKEN)
  const [toToken, setToToken] = useState<Token>(DEFAULT_TO_TOKEN)
  const [ringSize, setRingSize] = useState(5)
  const [showSettings, setShowSettings] = useState(false)
  const [swapState, setSwapState] = useState<SwapState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)

  // Token selector modal state
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [selectingFor, setSelectingFor] = useState<'from' | 'to'>('from')

  const cardRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  // Mock exchange rate
  const exchangeRate = fromToken.symbol === 'ETH' ? 2450 : 1 / 2450

  // Calculate output amount
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0) {
      const output = parseFloat(fromAmount) * exchangeRate
      setToAmount(output.toFixed(toToken.decimals > 6 ? 6 : 2))
    } else {
      setToAmount('')
    }
  }, [fromAmount, fromToken, toToken, exchangeRate])

  // Animate glow on swap
  useEffect(() => {
    const isSwapping = swapState === 'pending' || swapState === 'confirming'

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

  const handleSwap = async () => {
    if (!isConnected || !address) return

    try {
      // Step 1: Confirm in wallet
      setSwapState('confirming')

      // Simulate wallet confirmation
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Step 2: Transaction pending
      setSwapState('pending')
      const mockHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')
      setTxHash(mockHash)

      // Simulate transaction confirmation
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Step 3: Success
      setSwapState('success')
      toast.success('Swap Complete', `Swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`)

      // Reset after delay
      setTimeout(() => {
        setSwapState('idle')
        setFromAmount('')
        setToAmount('')
        setTxHash(null)
      }, 3000)
    } catch (error) {
      setSwapState('error')
      toast.error('Swap Failed', error instanceof Error ? error.message : 'Unknown error occurred')

      setTimeout(() => {
        setSwapState('idle')
        setTxHash(null)
      }, 3000)
    }
  }

  const handleFlipTokens = () => {
    // Animation for flip
    if (cardRef.current) {
      const arrow = cardRef.current.querySelector('.swap-arrow')
      if (arrow) {
        gsap.to(arrow, {
          rotation: '+=180',
          duration: 0.3,
          ease: 'power2.out',
        })
      }
    }

    // Swap tokens
    const tempToken = fromToken
    setFromToken(toToken)
    setToToken(tempToken)

    // Swap amounts
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
      if (token.address === toToken.address) {
        setToToken(fromToken)
      }
      setFromToken(token)
    } else {
      if (token.address === fromToken.address) {
        setFromToken(toToken)
      }
      setToToken(token)
    }
  }

  const canSwap = isConnected && fromAmount && parseFloat(fromAmount) > 0 && swapState === 'idle'
  const isSwapping = swapState !== 'idle'

  // Calculate minimum received
  const minReceived = toAmount
    ? (parseFloat(toAmount) * (1 - settings.swap.slippageTolerance / 100)).toFixed(
        toToken.decimals > 6 ? 6 : 2
      )
    : '0'

  // Calculate price impact (mock)
  const priceImpact = fromAmount && parseFloat(fromAmount) > 10 ? 0.3 : 0.1

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
            <h2 className="font-display text-xl text-ghost-white">
              Cast Spell
            </h2>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'p-2 rounded-lg transition-all',
                'hover:bg-white/5',
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

          {/* Transaction Status */}
          {swapState !== 'idle' && (
            <div className="mb-5">
              <TransactionStatus
                state={swapState === 'confirming' ? 'pending' : swapState}
                hash={txHash || undefined}
                onClose={() => {
                  setSwapState('idle')
                  setTxHash(null)
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
            balance={fromToken.balance}
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
                'active:scale-95',
                'transition-all duration-200',
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
            balance={toToken.balance}
            disabled
            className="mt-2 mb-4"
          />

          {/* Ring Selector */}
          <RingSelector
            ringSize={ringSize}
            onRingSizeChange={setRingSize}
            disabled={isSwapping}
            className="mb-5"
          />

          {/* Price Info */}
          {fromAmount && !isSwapping && (
            <div className="mb-5 p-3 rounded-xl bg-obsidian/30 border border-arcane-purple/10 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Rate
                </span>
                <span className="text-ghost-white font-mono text-xs sm:text-sm">
                  1 {fromToken.symbol} = {exchangeRate.toLocaleString()} {toToken.symbol}
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

              <div className="flex items-center justify-between text-sm">
                <span className="text-mist-gray flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Privacy Level
                </span>
                <span className="text-spectral-green font-mono text-xs sm:text-sm">
                  {ringSize} addresses
                </span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <ShimmerButton
            onClick={handleSwap}
            disabled={!canSwap}
          >
            {!isConnected
              ? 'Connect Wallet'
              : swapState === 'confirming'
                ? 'Confirm in Wallet...'
                : swapState === 'pending'
                  ? 'Casting Spell...'
                  : swapState === 'success'
                    ? 'Spell Complete!'
                    : swapState === 'error'
                      ? 'Spell Failed'
                      : !fromAmount
                        ? 'Enter Amount'
                        : 'Transmute'}
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
