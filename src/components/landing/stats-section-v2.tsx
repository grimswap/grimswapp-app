import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Activity, Users, DollarSign, Globe } from 'lucide-react'
import { useProtocolStats } from '@/hooks/use-protocol-stats'

interface StatItemProps {
  icon: React.ElementType
  value: string | number
  label: string
  isLoading: boolean
  showDivider?: boolean
}

function StatItem({ icon: Icon, value, label, isLoading, showDivider = true }: StatItemProps) {
  return (
    <div className="stat-item flex items-start gap-4 relative">
      {/* Divider */}
      {showDivider && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px hidden sm:block"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
          }}
        />
      )}

      <div className={showDivider ? 'pl-6 sm:pl-8' : ''}>
        {/* Icon */}
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl mb-4 flex items-center justify-center"
          style={{
            background: 'rgba(0, 237, 218, 0.15)',
            border: '1px solid rgba(0, 237, 218, 0.3)',
          }}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#00EDDA' }} />
        </div>

        {/* Value */}
        {isLoading ? (
          <div className="h-10 w-28 bg-white/10 rounded mb-2 animate-pulse" />
        ) : (
          <div
            className="text-white mb-1"
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
              fontWeight: 400,
              fontFamily: 'var(--font-display)',
            }}
          >
            {value}
          </div>
        )}

        {/* Label */}
        <div className="text-gray-400 text-sm sm:text-base">{label}</div>
      </div>
    </div>
  )
}

export function StatsSectionV2() {
  const { stats, isLoading, error } = useProtocolStats()
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.stats-card',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
          },
        }
      )

      gsap.fromTo(
        '.stat-item',
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          delay: 0.3,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
          },
        }
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const formatEthPrice = (price: number): string => {
    if (!price || price === 0) return '$—'
    return `$${price.toFixed(2)}`
  }

  const statItems = [
    { icon: Activity, label: 'Pool Liquidity', value: stats.poolLiquidity || '—' },
    { icon: Users, label: 'Privacy Deposits', value: stats.depositCount || 0 },
    { icon: DollarSign, label: 'ETH Price', value: formatEthPrice(stats.ethPrice) },
    { icon: Globe, label: 'Network', value: stats.network || 'Unichain Sepolia' },
  ]

  return (
    <section
      ref={sectionRef}
      className="py-16 sm:py-24 px-4"
      style={{ background: '#121214' }}
    >
      <div className="max-w-[1280px] mx-auto">
        {/* Gradient Border Card */}
        <div
          className="stats-card relative rounded-2xl sm:rounded-3xl p-[2px]"
          style={{
            background: 'linear-gradient(135deg, #A4238B 0%, #6B21A8 50%, #00EDDA 100%)',
          }}
        >
          {/* Inner Card */}
          <div
            className="rounded-2xl sm:rounded-3xl p-6 sm:p-10"
            style={{ background: '#121214' }}
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10 sm:mb-12 gap-4">
              <h2
                className="text-2xl sm:text-3xl md:text-4xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span
                  className="italic"
                  style={{ color: '#00EDDA' }}
                >
                  Protocol
                </span>{' '}
                <span className="text-white">Statistics</span>
              </h2>

              <p className="text-gray-400 text-sm sm:text-base">
                {error ? 'Showing cached data' : 'Live Data From the GrimSwap Protocol'}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-0">
              {statItems.map((item, index) => (
                <StatItem
                  key={item.label}
                  icon={item.icon}
                  value={item.value}
                  label={item.label}
                  isLoading={isLoading}
                  showDivider={index !== 0}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
