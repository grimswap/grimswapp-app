import { cn } from '@/lib/utils'
import { RING_SIZES } from '@/lib/constants'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'

interface RingSelectorProps {
  ringSize: number
  onRingSizeChange: (size: number) => void
  disabled?: boolean
  className?: string
}

export function RingSelector({
  ringSize,
  onRingSizeChange,
  disabled,
  className,
}: RingSelectorProps) {
  const getPrivacyLevel = (size: number) => {
    if (size <= 3) return { label: 'Low', color: 'text-blood-crimson', icon: ShieldAlert, bg: 'bg-blood-crimson/10' }
    if (size <= 5) return { label: 'Medium', color: 'text-ethereal-cyan', icon: Shield, bg: 'bg-ethereal-cyan/10' }
    return { label: 'High', color: 'text-spectral-green', icon: ShieldCheck, bg: 'bg-spectral-green/10' }
  }

  const privacy = getPrivacyLevel(ringSize)
  const PrivacyIcon = privacy.icon

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-mist-gray">Anonymity Set</span>
        <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg', privacy.bg)}>
          <PrivacyIcon className={cn('w-4 h-4', privacy.color)} />
          <span className={cn('text-sm font-medium', privacy.color)}>
            {privacy.label}
          </span>
        </div>
      </div>

      <div className={cn('flex gap-2', disabled && 'opacity-50 pointer-events-none')}>
        {RING_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => onRingSizeChange(size)}
            disabled={disabled}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-mono font-medium',
              'border transition-all duration-200',
              'disabled:cursor-not-allowed',
              ringSize === size
                ? 'bg-arcane-purple/20 border-arcane-purple text-arcane-purple shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                : 'bg-transparent border-mist-gray/20 text-mist-gray hover:border-mist-gray/40 hover:text-ghost-white'
            )}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Privacy meter */}
      <div className="h-1.5 rounded-full bg-obsidian overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            'bg-gradient-to-r',
            ringSize <= 3 && 'from-blood-crimson to-blood-crimson',
            ringSize > 3 && ringSize <= 5 && 'from-blood-crimson via-ethereal-cyan to-ethereal-cyan',
            ringSize > 5 && 'from-ethereal-cyan via-spectral-green to-spectral-green'
          )}
          style={{ width: `${(ringSize / 11) * 100}%` }}
        />
      </div>

      <p className="text-xs text-shadow-gray">
        Your transaction mixes with {ringSize - 1} decoys, making it {ringSize}× harder to trace.
      </p>
    </div>
  )
}
