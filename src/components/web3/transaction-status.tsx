import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, XCircle, ExternalLink, Clock } from 'lucide-react'

export type TransactionState = 'idle' | 'pending' | 'confirming' | 'success' | 'error'

interface TransactionStatusProps {
  state: TransactionState
  hash?: string
  message?: string
  explorerUrl?: string
  onClose?: () => void
}

export function TransactionStatus({
  state,
  hash,
  message,
  explorerUrl = 'https://unichain-sepolia.blockscout.com',
  onClose,
}: TransactionStatusProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state === 'confirming' && runeRef.current) {
      gsap.to(runeRef.current, {
        rotation: 360,
        duration: 2,
        repeat: -1,
        ease: 'linear',
      })
    } else if (runeRef.current) {
      gsap.killTweensOf(runeRef.current)
    }

    if (state === 'success' && containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { scale: 0.95 },
        { scale: 1, duration: 0.3, ease: 'back.out(1.7)' }
      )
    }
  }, [state])

  if (state === 'idle') return null

  const config = {
    pending: {
      icon: <Clock className="w-6 h-6" />,
      color: 'text-ethereal-cyan',
      borderColor: 'border-ethereal-cyan/30',
      label: 'Awaiting signature...',
      description: 'Please confirm the transaction in your wallet',
    },
    confirming: {
      icon: (
        <div
          ref={runeRef}
          className="w-8 h-8 border-2 border-arcane-purple border-t-transparent rounded-full"
        />
      ),
      color: 'text-arcane-purple',
      borderColor: 'border-arcane-purple/30 shadow-glow-purple',
      label: 'Casting spell...',
      description: 'Your transaction is being confirmed',
    },
    success: {
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'text-spectral-green',
      borderColor: 'border-spectral-green/30 shadow-glow-green',
      label: 'Spell complete!',
      description: 'Your transaction has been confirmed',
    },
    error: {
      icon: <XCircle className="w-6 h-6" />,
      color: 'text-blood-crimson',
      borderColor: 'border-blood-crimson/30',
      label: 'Spell failed',
      description: message || 'Something went wrong',
    },
  }[state]

  return (
    <div
      ref={containerRef}
      className={cn(
        'rounded-xl p-4',
        'bg-charcoal/80 backdrop-blur-sm border',
        config.borderColor
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn('flex-shrink-0', config.color)}>{config.icon}</div>

        <div className="flex-1 min-w-0">
          <p className={cn('font-medium', config.color)}>{config.label}</p>
          <p className="text-sm text-mist-gray mt-1">{config.description}</p>

          {hash && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-mono text-shadow-gray truncate">
                {hash.slice(0, 10)}...{hash.slice(-8)}
              </span>
              <a
                href={`${explorerUrl}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-arcane-purple hover:text-arcane-purple/80 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {onClose && state !== 'confirming' && state !== 'pending' && (
          <button
            onClick={onClose}
            className="text-mist-gray hover:text-ghost-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

// Transaction timeline for multi-step transactions
interface TimelineStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete' | 'error'
}

interface TransactionTimelineProps {
  steps: TimelineStep[]
}

export function TransactionTimeline({ steps }: TransactionTimelineProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => (
        <div key={step.id} className="relative">
          <div className="flex items-center gap-3 py-2">
            {/* Step indicator */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                'border-2 transition-all duration-300',
                step.status === 'complete' &&
                  'bg-spectral-green border-spectral-green',
                step.status === 'active' &&
                  'border-arcane-purple bg-arcane-purple/20',
                step.status === 'pending' &&
                  'border-mist-gray/30 bg-transparent',
                step.status === 'error' &&
                  'border-blood-crimson bg-blood-crimson/20'
              )}
            >
              {step.status === 'complete' && (
                <CheckCircle className="w-4 h-4 text-void-black" />
              )}
              {step.status === 'active' && (
                <Loader2 className="w-4 h-4 text-arcane-purple animate-spin" />
              )}
              {step.status === 'pending' && (
                <span className="text-xs text-mist-gray">{index + 1}</span>
              )}
              {step.status === 'error' && (
                <XCircle className="w-4 h-4 text-blood-crimson" />
              )}
            </div>

            {/* Step label */}
            <span
              className={cn(
                'text-sm transition-colors',
                step.status === 'complete' && 'text-spectral-green',
                step.status === 'active' && 'text-ghost-white font-medium',
                step.status === 'pending' && 'text-mist-gray/50',
                step.status === 'error' && 'text-blood-crimson'
              )}
            >
              {step.label}
            </span>
          </div>

          {/* Connector line */}
          {index < steps.length - 1 && (
            <div
              className={cn(
                'absolute left-4 top-10 w-0.5 h-4 -translate-x-1/2',
                step.status === 'complete'
                  ? 'bg-spectral-green'
                  : 'bg-mist-gray/20'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
