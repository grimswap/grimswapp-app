import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { Shield, Eye, Zap, Lock, Github, Twitter } from 'lucide-react'

// Landing page sections
import { HeroSection } from '@/components/landing/hero-section'
import { HowItWorksSection } from '@/components/landing/how-it-works'
import { TokenGridSection } from '@/components/landing/token-grid'
import { SecuritySection } from '@/components/landing/security-section'
import { FAQSection } from '@/components/landing/faq-section'

const features = [
  {
    icon: Shield,
    title: 'Zero-Knowledge Proofs',
    description: 'ZK-SNARK technology hides you among all depositors. Prove you deposited without revealing which one.',
    color: 'cyan' as const,
  },
  {
    icon: Eye,
    title: 'Stealth Addresses',
    description: 'One-time addresses for every swap. No one can link your transactions together.',
    color: 'cyan' as const,
  },
  {
    icon: Zap,
    title: 'Uniswap v4 Hooks',
    description: 'Built on the latest Uniswap technology for efficient, trustless swaps.',
    color: 'cyan' as const,
  },
  {
    icon: Lock,
    title: 'Relayer Network',
    description: 'Relayers submit your transaction, hiding even your gas payment for complete privacy.',
    color: 'cyan' as const,
  },
]

const featureColors = {
  cyan: {
    iconColor: '#00EDDA',
    iconBg: 'rgba(0, 237, 218, 0.2)',
    iconBorder: 'rgba(0, 237, 218, 0.4)',
    hoverBorder: 'rgba(0, 237, 218, 0.5)',
    hoverGlow: 'rgba(0, 237, 218, 0.3)',
  },
}

interface FeatureCardProps {
  feature: typeof features[0]
}

function FeatureCard({ feature }: FeatureCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const Icon = feature.icon
  const colors = featureColors[feature.color]

  return (
    <div
      className="feature-card p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'rgba(18, 18, 20, 0.8)',
        border: `1px solid ${isHovered ? colors.hoverBorder : 'rgba(255, 255, 255, 0.1)'}`,
        boxShadow: isHovered ? `0 0 25px ${colors.hoverGlow}` : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center"
        style={{
          background: colors.iconBg,
          border: `1px solid ${colors.iconBorder}`,
        }}
      >
        <Icon className="w-7 h-7" style={{ color: colors.iconColor }} />
      </div>
      <h3 className="font-display text-xl text-white mb-2">{feature.title}</h3>
      <p className="text-gray-400 leading-relaxed">{feature.description}</p>
    </div>
  )
}

export function HomePage() {
  const featuresRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Features animation
      gsap.fromTo(
        '.feature-card',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: featuresRef.current,
            start: 'top 80%',
          },
        }
      )
    }, featuresRef)

    return () => ctx.revert()
  }, [])

  return (
    <div className="landing-page">
      {/* Hero Section with Protocol Statistics - Seamless gradient flow */}
      <HeroSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Features Section */}
      <section
        ref={featuresRef}
        className="py-24 px-4"
        style={{ background: '#121214' }}
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl text-white text-center mb-4">
            How The <span style={{ color: '#00EDDA' }}>Magic</span> Works
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
            Advanced cryptographic techniques combined with DeFi innovation to bring you true financial privacy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Supported Tokens */}
      <TokenGridSection />

      {/* Security & Trust */}
      <SecuritySection />

      {/* FAQ */}
      <FAQSection />

      {/* CTA Section */}
      <section className="py-24 px-4" style={{ background: '#121214' }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative">
            {/* Glow background */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] rounded-full blur-[80px] opacity-30"
              style={{ background: 'radial-gradient(circle, #00EDDA 0%, transparent 70%)' }}
            />

            <div className="relative">
              <h2 className="font-display text-3xl sm:text-4xl text-white mb-2">
                Ready To <span style={{ color: '#00EDDA' }}>Vanish</span>?
              </h2>
              <p className="text-gray-400 mb-8">
                Your transactions deserve privacy. Start swapping invisibly today.
              </p>

              <Link to="/swap">
                <ShimmerButton>Cast Your First Spell</ShimmerButton>
              </Link>

              {/* Social links */}
              <div className="mt-8 flex items-center justify-center gap-4">
                {[
                  { icon: Twitter, href: 'https://twitter.com/grimswap', label: 'Twitter' },
                  { icon: Github, href: 'https://github.com/grimswap', label: 'GitHub' },
                ].map((social) => {
                  const Icon = social.icon
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 237, 218, 0.4)'
                        e.currentTarget.style.background = 'rgba(0, 237, 218, 0.1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                      }}
                      aria-label={social.label}
                    >
                      <Icon className="w-5 h-5 text-gray-400" />
                    </a>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
