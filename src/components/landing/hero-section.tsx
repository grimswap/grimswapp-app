import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ArrowLeftRight, Layers, BookOpen, Activity, Users, DollarSign, Globe } from 'lucide-react'
import { GrimConnectButton } from '@/components/web3/connect-button'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { useProtocolStats } from '@/hooks/use-protocol-stats'

const navItems = [
  { icon: ArrowLeftRight, label: 'Swap', href: '/swap' },
  { icon: Layers, label: 'Pools', href: '/pools' },
  { icon: BookOpen, label: 'Grimoire', href: '/wallet' },
]

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
      {/* Divider - only on large screens for left border */}
      {showDivider && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px hidden lg:block"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
          }}
        />
      )}

      <div className={showDivider ? 'lg:pl-8' : ''}>
        {/* Icon */}
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl mb-3 sm:mb-4 flex items-center justify-center"
          style={{
            background: 'rgba(0, 237, 218, 0.15)',
            border: '1px solid rgba(0, 237, 218, 0.3)',
          }}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#00EDDA' }} />
        </div>

        {/* Value */}
        {isLoading ? (
          <div className="h-8 sm:h-10 w-20 sm:w-28 bg-white/10 rounded mb-2 animate-pulse" />
        ) : (
          <div
            className="text-white mb-1 text-xl sm:text-2xl lg:text-3xl"
            style={{
              fontWeight: 400,
              fontFamily: 'var(--font-display)',
            }}
          >
            {value}
          </div>
        )}

        {/* Label */}
        <div className="text-gray-400 text-xs sm:text-sm lg:text-base">{label}</div>
      </div>
    </div>
  )
}

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { stats, isLoading, error } = useProtocolStats()

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero elements animation
      gsap.from('.hero-element', {
        y: 60,
        opacity: 0,
        filter: 'blur(10px)',
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
      })

      // Swirl image animation
      gsap.from('.hero-swirl', {
        x: 100,
        opacity: 0,
        duration: 1.2,
        delay: 0.3,
        ease: 'power3.out',
      })

      // Stats card animation
      gsap.fromTo(
        '.stats-card',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          delay: 0.5,
          ease: 'power2.out',
        }
      )

      // Stat items animation
      gsap.fromTo(
        '.stat-item',
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          delay: 0.8,
          ease: 'power2.out',
        }
      )
    }, heroRef)

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
      ref={heroRef}
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #121214 0%, #4E357F 45%, #1C0E1B 85%, #121214 100%)',
      }}
    >
      {/* Header */}
      <header className="relative z-20 w-full">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-6 lg:px-16 py-6">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src="/assets/img/logo-grimswap.png"
              alt="GrimSwap"
              className="h-8 sm:h-10 w-auto"
            />
          </Link>

          {/* Center Navigation */}
          <nav
            className="hidden md:flex items-center gap-1 px-2 py-2 rounded-full"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Connect Wallet Button */}
          <GrimConnectButton />
        </div>
      </header>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] px-4 text-center max-w-[1440px] mx-auto w-full">
        {/* Main Headline */}
        <h1 className="hero-element font-display tracking-wide mb-6">
          <span
            className="block text-white"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 6rem)',
              lineHeight: 1,
              letterSpacing: '0.02em',
            }}
          >
            THE DARK ARTS
          </span>
          <span
            className="block"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 6rem)',
              lineHeight: 1,
              letterSpacing: '0.02em',
              color: '#00EDDA',
            }}
          >
            OF DEFI
          </span>
        </h1>

        {/* Subtext */}
        <p
          className="hero-element max-w-xl mx-auto mb-10 text-gray-300"
          style={{
            fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 400,
            lineHeight: 1.6,
          }}
        >
          Privacy-preserving token swaps powered by ZK-SNARK proofs and stealth addresses. Trade invisibly on Uniswap v4.
        </p>

        {/* CTA Button */}
        <Link to="/swap" className="hero-element">
          <ShimmerButton className="px-8 py-4 text-base font-medium">
            Enter the Grimoire
          </ShimmerButton>
        </Link>
      </div>

      {/* Protocol Statistics - Integrated into gradient flow */}
      <div className="relative z-10 pb-24 px-4">
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-4 sm:gap-6 lg:gap-0">
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
      </div>

      {/* Hero Swirl Image - Positioned between hero content and stats */}
      <div
        className="hero-swirl absolute right-0 w-[60%] h-[50%] pointer-events-none"
        style={{
          top: '40%',
          backgroundImage: 'url(/assets/img/hero-swirl.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.25,
          mixBlendMode: 'screen',
        }}
      />
    </section>
  )
}
