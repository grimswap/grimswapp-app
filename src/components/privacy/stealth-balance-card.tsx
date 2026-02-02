import { useState, useRef } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Scan, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface StealthBalance {
  token: string
  symbol: string
  amount: string
  usdValue: string
}

interface StealthBalanceCardProps {
  balances: StealthBalance[]
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
}

export function StealthBalanceCard({
  balances,
  isLoading,
  onRefresh,
  className,
}: StealthBalanceCardProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scanlineRef = useRef<HTMLDivElement>(null)
  const balancesRef = useRef<HTMLDivElement>(null)

  const handleReveal = async () => {
    if (isScanning) return
    setIsScanning(true)

    // Scanline animation
    if (scanlineRef.current) {
      await gsap.fromTo(
        scanlineRef.current,
        { y: '-100%', opacity: 1 },
        {
          y: '100%',
          duration: 1.5,
          ease: 'power2.inOut',
        }
      )
    }

    setIsScanning(false)
    setIsRevealed(true)

    // Reveal animation for balances
    if (balancesRef.current) {
      gsap.fromTo(
        balancesRef.current.children,
        { opacity: 0, y: 10, filter: 'blur(10px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.4,
          stagger: 0.1,
          ease: 'power2.out',
        }
      )
    }
  }

  const handleHide = () => {
    if (balancesRef.current) {
      gsap.to(balancesRef.current.children, {
        opacity: 0,
        filter: 'blur(10px)',
        duration: 0.2,
        onComplete: () => setIsRevealed(false),
      })
    }
  }

  const totalUsdValue = balances.reduce((sum, b) => {
    const value = parseFloat(b.usdValue.replace(/[$,]/g, '')) || 0
    return sum + value
  }, 0)

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-2xl overflow-hidden',
        'bg-charcoal/50 border border-arcane-purple/20',
        className
      )}
    >
      {/* Scanline effect */}
      <div
        ref={scanlineRef}
        className={cn(
          'absolute inset-x-0 h-1 z-20 opacity-0',
          'bg-gradient-to-r from-transparent via-spectral-green to-transparent',
          'shadow-[0_0_20px_rgba(0,255,136,0.8)]'
        )}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-arcane-purple/10">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-arcane-purple" />
          <h3 className="font-display text-lg text-ghost-white">
            Stealth Balances
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-white/5 text-mist-gray hover:text-ghost-white',
                isLoading && 'animate-spin'
              )}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={isRevealed ? handleHide : handleReveal}
            disabled={isScanning}
            className={cn(
              'p-2 rounded-lg transition-all',
              'hover:bg-white/5',
              isRevealed ? 'text-spectral-green' : 'text-mist-gray'
            )}
          >
            {isRevealed ? (
              <Eye className="w-5 h-5" />
            ) : (
              <EyeOff className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Total Value */}
      <div className="p-4 border-b border-arcane-purple/10 bg-obsidian/30">
        <p className="text-sm text-mist-gray mb-1">Total Hidden Value</p>
        <p
          className={cn(
            'text-2xl font-mono text-ghost-white transition-all',
            !isRevealed && 'blur-md select-none'
          )}
        >
          ${totalUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Balances */}
      <div ref={balancesRef} className="p-4 space-y-3">
        {isLoading ? (
          <>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </>
        ) : balances.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-mist-gray">No stealth balances found</p>
          </div>
        ) : (
          balances.map((balance, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl',
                'bg-obsidian/50 transition-all',
                !isRevealed && 'blur-md select-none'
              )}
            >
              {/* Token icon */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-arcane-purple to-ethereal-cyan flex items-center justify-center">
                <span className="text-xs font-bold text-ghost-white">
                  {balance.symbol.slice(0, 2)}
                </span>
              </div>

              {/* Token info */}
              <div className="flex-1">
                <p className="font-medium text-ghost-white">{balance.symbol}</p>
                <p className="text-sm text-mist-gray">{balance.token}</p>
              </div>

              {/* Balance */}
              <div className="text-right">
                <p className="font-mono text-ghost-white">{balance.amount}</p>
                <p className="text-sm text-mist-gray">{balance.usdValue}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reveal overlay */}
      {!isRevealed && !isScanning && balances.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-charcoal/60 backdrop-blur-sm z-10">
          <button
            onClick={handleReveal}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl',
              'bg-arcane-purple/20 border border-arcane-purple/50',
              'text-arcane-purple font-medium',
              'hover:bg-arcane-purple/30 hover:border-arcane-purple/70',
              'transition-all duration-200',
              'shadow-[0_0_20px_rgba(139,92,246,0.2)]'
            )}
          >
            <Scan className="w-5 h-5" />
            Activate Grim Lens
          </button>
        </div>
      )}

      {/* Scanning overlay */}
      {isScanning && (
        <div className="absolute inset-0 flex items-center justify-center bg-charcoal/60 z-10">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 border-2 border-spectral-green border-t-transparent rounded-full animate-spin" />
            <p className="text-spectral-green font-medium">Scanning blockchain...</p>
          </div>
        </div>
      )}
    </div>
  )
}
