import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'
import { Shield, Zap, Lock, CheckCircle } from 'lucide-react'

// Simulated anonymous orders in the matching pool
const ANONYMOUS_ORDERS = [
  { id: 1, type: 'buy', amount: '0.5', token: 'ETH', proof: '0x7a2f...' },
  { id: 2, type: 'sell', amount: '750', token: 'USDC', proof: '0x3b1c...' },
  { id: 3, type: 'buy', amount: '1.2', token: 'ETH', proof: '0x9e4d...' },
  { id: 4, type: 'sell', amount: '1500', token: 'USDC', proof: '0x5f8a...' },
  { id: 5, type: 'buy', amount: '0.8', token: 'ETH', proof: '0x2c7e...' },
  { id: 6, type: 'sell', amount: '1000', token: 'USDC', proof: '0x6d3b...' },
]

type MatchState = 'idle' | 'scanning' | 'proving' | 'matched' | 'executing'

export function RingVisualization() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [matchState, setMatchState] = useState<MatchState>('idle')
  const [matchedPair, setMatchedPair] = useState<number[]>([])
  const [proofProgress, setProofProgress] = useState(0)
  const pulseRef = useRef<HTMLDivElement>(null)

  // Continuous pulse animation for the center
  useEffect(() => {
    if (pulseRef.current && matchState === 'idle') {
      gsap.to(pulseRef.current, {
        scale: 1.2,
        opacity: 0.3,
        duration: 2,
        ease: 'power1.inOut',
        repeat: -1,
        yoyo: true,
      })
    }

    return () => {
      if (pulseRef.current) {
        gsap.killTweensOf(pulseRef.current)
      }
    }
  }, [matchState])

  // Simulate ZK matchmaking process
  const triggerMatch = async () => {
    setMatchState('scanning')
    setMatchedPair([])
    setProofProgress(0)

    // Phase 1: Scanning pool for matches
    await new Promise((r) => setTimeout(r, 1500))

    // Phase 2: Found match, generating ZK proof
    setMatchState('proving')
    setMatchedPair([0, 3]) // Match order 1 (buy) with order 4 (sell)

    // Animate proof generation
    for (let i = 0; i <= 100; i += 5) {
      setProofProgress(i)
      await new Promise((r) => setTimeout(r, 50))
    }

    // Phase 3: Match verified
    setMatchState('matched')
    await new Promise((r) => setTimeout(r, 1000))

    // Phase 4: Executing swap
    setMatchState('executing')
    await new Promise((r) => setTimeout(r, 1500))

    // Reset
    setMatchState('idle')
    setMatchedPair([])
  }

  const getStatusText = () => {
    switch (matchState) {
      case 'scanning':
        return 'Scanning anonymous order pool...'
      case 'proving':
        return `Generating ZK proof... ${proofProgress}%`
      case 'matched':
        return 'Match verified without revealing identities!'
      case 'executing':
        return 'Executing private swap...'
      default:
        return 'ZK Matchmaking Ready'
    }
  }

  const getStatusIcon = () => {
    switch (matchState) {
      case 'scanning':
        return <Zap className="w-4 h-4 animate-pulse" />
      case 'proving':
        return <Lock className="w-4 h-4 animate-spin" />
      case 'matched':
        return <CheckCircle className="w-4 h-4 text-spectral-green" />
      case 'executing':
        return <Shield className="w-4 h-4 animate-pulse text-ethereal-cyan" />
      default:
        return <Shield className="w-4 h-4" />
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-72 h-72 xl:w-80 xl:h-80',
        'rounded-2xl p-4 xl:p-6',
        'bg-charcoal/30 border border-arcane-purple/10',
        'overflow-hidden'
      )}
    >
      {/* Title */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <h3 className="text-sm font-medium text-mist-gray">ZK Matchmaking</h3>
        <button
          onClick={triggerMatch}
          disabled={matchState !== 'idle'}
          className={cn(
            'px-3 py-1 rounded-lg text-xs',
            'bg-arcane-purple/20 text-arcane-purple',
            'hover:bg-arcane-purple/30 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {matchState === 'idle' ? 'Match' : 'Matching...'}
        </button>
      </div>

      {/* Main visualization area */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Background pulse */}
        <div
          ref={pulseRef}
          className={cn(
            'absolute w-32 h-32 rounded-full',
            'bg-arcane-purple/10',
            matchState !== 'idle' && 'hidden'
          )}
        />

        {/* Anonymous orders floating around */}
        <div className="relative w-56 h-56">
          {ANONYMOUS_ORDERS.map((order, i) => {
            const angle = (i / ANONYMOUS_ORDERS.length) * 360
            const radius = 90
            const isMatched = matchedPair.includes(i)
            const isBuy = order.type === 'buy'

            return (
              <div
                key={order.id}
                className={cn(
                  'absolute w-12 h-12 rounded-lg',
                  'flex flex-col items-center justify-center',
                  'transition-all duration-500',
                  'border backdrop-blur-sm',
                  isBuy
                    ? 'bg-spectral-green/10 border-spectral-green/30'
                    : 'bg-blood-crimson/10 border-blood-crimson/30',
                  isMatched && matchState === 'proving' && 'animate-pulse scale-110',
                  isMatched && matchState === 'matched' && 'border-ethereal-cyan shadow-[0_0_20px_rgba(0,212,255,0.5)]',
                  isMatched && matchState === 'executing' && 'opacity-50 scale-90'
                )}
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `
                    translate(-50%, -50%)
                    rotate(${angle}deg)
                    translateY(-${radius}px)
                    rotate(-${angle}deg)
                    ${isMatched && (matchState === 'matched' || matchState === 'executing') ? 'translateY(0)' : ''}
                  `,
                }}
              >
                <span className={cn(
                  'text-[9px] font-bold',
                  isBuy ? 'text-spectral-green' : 'text-blood-crimson'
                )}>
                  {isBuy ? 'BUY' : 'SELL'}
                </span>
                <span className="text-[8px] font-mono text-mist-gray">
                  {order.proof}
                </span>
              </div>
            )
          })}
        </div>

        {/* Center - ZK Engine */}
        <div
          className={cn(
            'absolute w-24 h-24 rounded-full',
            'flex flex-col items-center justify-center',
            'transition-all duration-500',
            matchState === 'idle' && 'bg-charcoal/80 border-2 border-arcane-purple/50',
            matchState === 'scanning' && 'bg-ethereal-cyan/20 border-2 border-ethereal-cyan animate-pulse',
            matchState === 'proving' && 'bg-arcane-purple/30 border-2 border-arcane-purple',
            matchState === 'matched' && 'bg-spectral-green/20 border-2 border-spectral-green shadow-[0_0_30px_rgba(0,255,136,0.3)]',
            matchState === 'executing' && 'bg-ethereal-cyan/30 border-2 border-ethereal-cyan'
          )}
        >
          {matchState === 'proving' ? (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-arcane-purple border-t-transparent animate-spin" />
              <span className="text-xs font-mono text-arcane-purple mt-1">{proofProgress}%</span>
            </>
          ) : (
            <>
              <span className="text-lg">
                {matchState === 'matched' ? '✓' : matchState === 'executing' ? '⚡' : '🔐'}
              </span>
              <span className="text-[10px] text-mist-gray mt-1">
                {matchState === 'idle' ? 'ZK Engine' :
                 matchState === 'scanning' ? 'Scanning' :
                 matchState === 'matched' ? 'Verified' : 'Swapping'}
              </span>
            </>
          )}
        </div>

        {/* Connection lines when matched */}
        {matchedPair.length === 2 && (matchState === 'matched' || matchState === 'executing') && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line
              x1="50%"
              y1="25%"
              x2="50%"
              y2="50%"
              stroke="rgba(0, 212, 255, 0.5)"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
            <line
              x1="50%"
              y1="75%"
              x2="50%"
              y2="50%"
              stroke="rgba(0, 212, 255, 0.5)"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          </svg>
        )}
      </div>

      {/* Status bar */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className={cn(
          'flex items-center justify-center gap-2 px-3 py-2 rounded-lg',
          'bg-obsidian/50 border border-arcane-purple/10'
        )}>
          {getStatusIcon()}
          <p className="text-xs text-mist-gray">
            {getStatusText()}
          </p>
        </div>
      </div>
    </div>
  )
}
