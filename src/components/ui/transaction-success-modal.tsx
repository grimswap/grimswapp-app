import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'
import { CheckCircle, ExternalLink, ArrowRight, Copy, Check, Sparkles } from 'lucide-react'
import { useState } from 'react'

export type TransactionType = 'swap' | 'add-liquidity' | 'remove-liquidity' | 'deposit' | 'withdraw' | 'claim'

interface TransactionDetails {
  type: TransactionType
  txHash: string
  fromToken?: string
  toToken?: string
  fromAmount?: string
  toAmount?: string
  fromLogo?: string
  toLogo?: string
  recipient?: string
  poolName?: string
  // For stealth addresses
  stealthAddress?: string
}

interface TransactionSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  details: TransactionDetails
  explorerBaseUrl?: string
}

function CopyableAddress({ address, label }: { address: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-obsidian/50 border border-arcane-purple/10">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-mist-gray mb-0.5">{label}</p>
        <p className="text-xs font-mono text-ghost-white truncate">
          {address.slice(0, 12)}...{address.slice(-10)}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-md hover:bg-arcane-purple/20 transition-colors"
      >
        {copied ? (
          <Check className="w-4 h-4 text-spectral-green" />
        ) : (
          <Copy className="w-4 h-4 text-mist-gray" />
        )}
      </button>
    </div>
  )
}

export function TransactionSuccessModal({
  isOpen,
  onClose,
  details,
  explorerBaseUrl = 'https://unichain-sepolia.blockscout.com',
}: TransactionSuccessModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const checkRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'

      // Animate overlay
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3 }
      )

      // Animate content with bounce
      gsap.fromTo(
        contentRef.current,
        { scale: 0.8, opacity: 0, y: 30 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' }
      )

      // Animate checkmark
      gsap.fromTo(
        checkRef.current,
        { scale: 0, rotation: -180 },
        { scale: 1, rotation: 0, duration: 0.5, delay: 0.2, ease: 'back.out(2)' }
      )

      // Animate particles
      if (particlesRef.current) {
        const particles = particlesRef.current.querySelectorAll('.particle')
        particles.forEach((particle, i) => {
          const angle = (i / particles.length) * 360
          const distance = 60 + Math.random() * 40
          const x = Math.cos((angle * Math.PI) / 180) * distance
          const y = Math.sin((angle * Math.PI) / 180) * distance

          gsap.fromTo(
            particle,
            { x: 0, y: 0, opacity: 1, scale: 1 },
            {
              x,
              y,
              opacity: 0,
              scale: 0,
              duration: 0.8,
              delay: 0.3 + i * 0.05,
              ease: 'power2.out',
            }
          )
        })
      }
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleClose = () => {
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 })
    gsap.to(contentRef.current, {
      scale: 0.9,
      opacity: 0,
      y: 20,
      duration: 0.2,
      onComplete: onClose,
    })
  }

  if (!isOpen) return null

  // Get title based on transaction type
  const getTitle = () => {
    switch (details.type) {
      case 'swap':
        return 'Swap Successful'
      case 'add-liquidity':
        return 'Liquidity Added'
      case 'remove-liquidity':
        return 'Liquidity Removed'
      case 'deposit':
        return 'Deposit Successful'
      case 'withdraw':
        return 'Withdrawal Complete'
      case 'claim':
        return 'Claim Successful'
      default:
        return 'Transaction Complete'
    }
  }

  // Get subtitle based on transaction type
  const getSubtitle = () => {
    switch (details.type) {
      case 'swap':
        return 'Your swap has been executed successfully'
      case 'add-liquidity':
        return 'Your liquidity position has been created'
      case 'remove-liquidity':
        return 'Your liquidity has been withdrawn'
      case 'deposit':
        return 'Your funds are now in the privacy pool'
      case 'withdraw':
        return 'Your funds have been withdrawn'
      case 'claim':
        return 'Your stealth funds have been claimed'
      default:
        return 'Transaction confirmed on-chain'
    }
  }

  // Get gradient colors based on type
  const getGradient = () => {
    switch (details.type) {
      case 'swap':
        return 'from-ethereal-cyan/20 to-arcane-purple/20'
      case 'add-liquidity':
        return 'from-spectral-green/20 to-ethereal-cyan/20'
      case 'remove-liquidity':
        return 'from-arcane-purple/20 to-blood-crimson/20'
      case 'deposit':
        return 'from-arcane-purple/20 to-spectral-green/20'
      default:
        return 'from-ethereal-cyan/20 to-spectral-green/20'
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-void-black/90 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Content */}
      <div
        ref={contentRef}
        className={cn(
          'relative w-full max-w-md overflow-hidden',
          'rounded-2xl p-[1px]',
          'bg-gradient-to-br from-spectral-green/50 via-ethereal-cyan/30 to-arcane-purple/50'
        )}
      >
        <div className="rounded-2xl bg-charcoal overflow-hidden">
          {/* Success Header */}
          <div className={cn('relative p-8 text-center bg-gradient-to-b', getGradient())}>
            {/* Particle effects container */}
            <div ref={particlesRef} className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="particle absolute w-2 h-2 rounded-full"
                  style={{
                    background: i % 2 === 0 ? '#00EDDA' : '#4ADE80',
                  }}
                />
              ))}
            </div>

            {/* Success Icon */}
            <div ref={checkRef} className="relative inline-flex items-center justify-center mb-4">
              <div className="absolute inset-0 rounded-full bg-spectral-green/20 blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-spectral-green to-ethereal-cyan flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-void-black" />
              </div>
            </div>

            {/* Title */}
            <h2 className="font-display text-2xl text-ghost-white mb-2 flex items-center justify-center gap-2">
              {getTitle()}
              <Sparkles className="w-5 h-5 text-ethereal-cyan" />
            </h2>
            <p className="text-sm text-mist-gray">{getSubtitle()}</p>
          </div>

          {/* Transaction Details */}
          <div className="p-6 space-y-4">
            {/* Token Transfer Display */}
            {details.fromToken && details.toToken && (
              <div className="p-4 rounded-xl bg-obsidian/50 border border-arcane-purple/20">
                <div className="flex items-center justify-center gap-4">
                  {/* From */}
                  <div className="flex items-center gap-2">
                    {details.fromLogo && (
                      <img src={details.fromLogo} alt={details.fromToken} className="w-8 h-8 rounded-full" />
                    )}
                    <div className="text-right">
                      <p className="text-sm font-mono text-ghost-white">{details.fromAmount}</p>
                      <p className="text-xs text-mist-gray">{details.fromToken}</p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="p-2 rounded-lg bg-arcane-purple/20">
                    <ArrowRight className="w-4 h-4 text-ethereal-cyan" />
                  </div>

                  {/* To */}
                  <div className="flex items-center gap-2">
                    {details.toLogo && (
                      <img src={details.toLogo} alt={details.toToken} className="w-8 h-8 rounded-full" />
                    )}
                    <div>
                      <p className="text-sm font-mono text-ghost-white">{details.toAmount}</p>
                      <p className="text-xs text-mist-gray">{details.toToken}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Single Token Display (for deposits/withdrawals) */}
            {details.fromToken && !details.toToken && (
              <div className="p-4 rounded-xl bg-obsidian/50 border border-arcane-purple/20">
                <div className="flex items-center justify-center gap-3">
                  {details.fromLogo && (
                    <img src={details.fromLogo} alt={details.fromToken} className="w-10 h-10 rounded-full" />
                  )}
                  <div>
                    <p className="text-lg font-mono text-ghost-white">{details.fromAmount}</p>
                    <p className="text-xs text-mist-gray">{details.fromToken}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pool Name (for liquidity) */}
            {details.poolName && (
              <div className="text-center">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-arcane-purple/20 text-sm text-ethereal-cyan">
                  Pool: {details.poolName}
                </span>
              </div>
            )}

            {/* Stealth Address (for swaps to stealth) */}
            {details.stealthAddress && (
              <CopyableAddress address={details.stealthAddress} label="Funds sent to stealth address" />
            )}

            {/* Transaction Hash */}
            <div className="p-4 rounded-xl bg-obsidian/30 border border-arcane-purple/10">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-mist-gray mb-1">Transaction Hash</p>
                  <p className="text-sm font-mono text-ghost-white truncate">
                    {details.txHash.slice(0, 14)}...{details.txHash.slice(-12)}
                  </p>
                </div>
                <a
                  href={`${explorerBaseUrl}/tx/${details.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ethereal-cyan/10 text-ethereal-cyan text-sm hover:bg-ethereal-cyan/20 transition-colors"
                >
                  View
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Privacy Note (for swaps) */}
            {details.type === 'swap' && details.stealthAddress && (
              <div className="p-3 rounded-lg bg-spectral-green/10 border border-spectral-green/20">
                <p className="text-xs text-mist-gray">
                  <span className="text-spectral-green font-medium">Privacy preserved.</span>{' '}
                  Your output tokens were sent to a stealth address. Visit the{' '}
                  <a href="/wallet" className="text-ethereal-cyan hover:underline">
                    Grimoire
                  </a>{' '}
                  to claim them.
                </p>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={handleClose}
              className={cn(
                'w-full py-3 px-6 rounded-xl font-medium transition-all',
                'bg-[#00EDDA] hover:bg-[#00EDDA]/90',
                'text-void-black',
                'shadow-lg shadow-ethereal-cyan/25'
              )}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
