import { cn } from '@/lib/utils'
import { Shield, ShieldCheck, ShieldAlert, Info } from 'lucide-react'

interface PrivacyMeterProps {
  ringSize: number
  maxRingSize?: number
  showDetails?: boolean
  className?: string
}

export function PrivacyMeter({
  ringSize,
  maxRingSize = 11,
  showDetails = true,
  className,
}: PrivacyMeterProps) {
  const percentage = (ringSize / maxRingSize) * 100

  const getLevel = () => {
    if (percentage < 30) return { level: 'Low', color: 'blood-crimson', icon: ShieldAlert }
    if (percentage < 60) return { level: 'Medium', color: 'ethereal-cyan', icon: Shield }
    return { level: 'High', color: 'spectral-green', icon: ShieldCheck }
  }

  const { level, color, icon: Icon } = getLevel()

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', `text-${color}`)} />
          <span className="text-sm font-medium text-ghost-white">
            Privacy Level
          </span>
        </div>
        <span className={cn('text-sm font-medium', `text-${color}`)}>
          {level}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-obsidian overflow-hidden">
        {/* Background segments */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-charcoal/50" />
          <div className="flex-1 border-r border-charcoal/50" />
          <div className="flex-1" />
        </div>

        {/* Fill */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
            'bg-gradient-to-r',
            percentage < 30 && 'from-blood-crimson to-blood-crimson',
            percentage >= 30 &&
              percentage < 60 &&
              'from-blood-crimson via-ethereal-cyan to-ethereal-cyan',
            percentage >= 60 &&
              'from-ethereal-cyan via-spectral-green to-spectral-green'
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* Glow effect */}
          <div
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full',
              'blur-sm',
              percentage < 30 && 'bg-blood-crimson',
              percentage >= 30 && percentage < 60 && 'bg-ethereal-cyan',
              percentage >= 60 && 'bg-spectral-green'
            )}
          />
        </div>
      </div>

      {/* Ring size indicator */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-mist-gray">Ring Size</span>
        <span className="font-mono text-ghost-white">
          {ringSize} / {maxRingSize}
        </span>
      </div>

      {/* Details */}
      {showDetails && (
        <div
          className={cn(
            'flex items-start gap-2 p-3 rounded-xl',
            'bg-obsidian/30 border border-arcane-purple/10'
          )}
        >
          <Info className="w-4 h-4 text-mist-gray flex-shrink-0 mt-0.5" />
          <p className="text-xs text-mist-gray">
            {percentage < 30 && (
              <>
                <span className="text-blood-crimson font-medium">Low privacy.</span>{' '}
                Consider increasing the ring size for better anonymity.
              </>
            )}
            {percentage >= 30 && percentage < 60 && (
              <>
                <span className="text-ethereal-cyan font-medium">
                  Moderate privacy.
                </span>{' '}
                Your transaction is mixed with {ringSize - 1} other addresses.
              </>
            )}
            {percentage >= 60 && (
              <>
                <span className="text-spectral-green font-medium">
                  Strong privacy.
                </span>{' '}
                Your identity is well hidden among {ringSize} participants.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
