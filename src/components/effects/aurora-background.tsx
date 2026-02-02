import { cn } from '@/lib/utils'

interface AuroraBackgroundProps {
  className?: string
  children?: React.ReactNode
  intensity?: 'low' | 'medium' | 'high'
}

export function AuroraBackground({
  className,
  children,
  intensity = 'medium',
}: AuroraBackgroundProps) {
  const intensityStyles = {
    low: 'opacity-30',
    medium: 'opacity-50',
    high: 'opacity-70',
  }

  return (
    <div className={cn('relative overflow-hidden bg-void-black', className)}>
      {/* Aurora layers */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={cn(
            'absolute -inset-[10px]',
            intensityStyles[intensity],
            'animate-aurora'
          )}
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                100deg,
                var(--arcane-purple) 10%,
                var(--ethereal-cyan) 15%,
                var(--spectral-green) 20%,
                var(--arcane-purple) 25%,
                var(--spectral-green) 30%
              )
            `,
            backgroundSize: '300% 200%',
            backgroundPosition: '50% 50%',
            filter: 'blur(10px)',
          }}
        />
      </div>

      {/* Secondary glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={cn(
            'absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-full',
            'bg-arcane-purple/20 blur-[100px]',
            'animate-glow-pulse'
          )}
        />
        <div
          className={cn(
            'absolute bottom-1/4 right-1/4 w-1/3 h-1/3 rounded-full',
            'bg-spectral-green/10 blur-[80px]',
            'animate-glow-pulse',
            'animation-delay-1000'
          )}
        />
      </div>

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
