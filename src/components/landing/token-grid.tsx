import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Plus } from 'lucide-react'
import { ETH, USDC, type Token } from '@/lib/tokens'

const supportedTokens: (Token | { comingSoon: true })[] = [USDC, ETH, { comingSoon: true }]

interface TokenItemProps {
  token?: Token
  comingSoon?: boolean
  showDivider?: boolean
}

function TokenItem({ token, comingSoon, showDivider = true }: TokenItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  if (comingSoon) {
    return (
      <div className="token-item flex items-center gap-4 sm:gap-5 px-5 sm:px-8 py-5 sm:py-6 relative">
        {/* Divider - horizontal on mobile, vertical on desktop */}
        {showDivider && (
          <>
            {/* Mobile: horizontal divider */}
            <div
              className="absolute left-5 right-5 top-0 h-px sm:hidden"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(164, 35, 139, 0.3) 50%, transparent 100%)',
              }}
            />
            {/* Desktop: vertical divider */}
            <div
              className="absolute left-0 top-4 bottom-4 w-px hidden sm:block"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(164, 35, 139, 0.3) 50%, transparent 100%)',
              }}
            />
          </>
        )}

        {/* Icon */}
        <div
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(164, 35, 139, 0.1)',
            border: '2px dashed rgba(164, 35, 139, 0.3)',
          }}
        >
          <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
        </div>

        {/* Text */}
        <div className="flex flex-col">
          <span
            className="text-base sm:text-lg text-gray-400 mb-0.5"
            style={{ fontFamily: "'Crimson Text', serif" }}
          >
            More
          </span>
          <span
            className="text-xs sm:text-sm text-gray-500"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Coming Soon
          </span>
        </div>
      </div>
    )
  }

  if (!token) return null

  return (
    <div
      className="token-item flex items-center gap-4 sm:gap-5 px-5 sm:px-8 py-5 sm:py-6 relative cursor-pointer transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Divider - horizontal on mobile, vertical on desktop */}
      {showDivider && (
        <>
          {/* Mobile: horizontal divider */}
          <div
            className="absolute left-5 right-5 top-0 h-px sm:hidden"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(164, 35, 139, 0.3) 50%, transparent 100%)',
            }}
          />
          {/* Desktop: vertical divider */}
          <div
            className="absolute left-0 top-4 bottom-4 w-px hidden sm:block"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(164, 35, 139, 0.3) 50%, transparent 100%)',
            }}
          />
        </>
      )}

      {/* Token Icon */}
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden transition-transform duration-200"
        style={{
          background: '#121214',
          border: `2px solid ${isHovered ? '#00EDDA' : token.color || '#A4238B'}`,
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {token.logoURI ? (
          <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
        ) : (
          <span
            className="text-lg sm:text-xl font-medium"
            style={{ color: token.color || '#A4238B' }}
          >
            {token.symbol.charAt(0)}
          </span>
        )}
      </div>

      {/* Token Info */}
      <div className="flex flex-col">
        <span
          className="text-base sm:text-lg text-white mb-0.5"
          style={{ fontFamily: "'Crimson Text', serif" }}
        >
          {token.name}
        </span>
        <span
          className="text-xs sm:text-sm text-gray-400"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {token.symbol}
        </span>
      </div>
    </div>
  )
}

export function TokenGridSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.tokens-container',
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          },
        }
      )

      gsap.fromTo(
        '.token-item',
        { x: -20, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.15,
          delay: 0.3,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          },
        }
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="py-20 lg:py-28 px-6 lg:px-16"
      style={{ background: '#121214' }}
    >
      <div className="max-w-[1000px] mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h2
            className="text-4xl lg:text-5xl tracking-tight mb-4"
            style={{ fontFamily: "'Crimson Text', serif" }}
          >
            <span className="text-white">Supported </span>
            <span className="text-[#00EDDA]">Tokens</span>
          </h2>
          <p
            className="text-gray-400 text-base"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Trade these tokens privately on Unichain Sepolia
          </p>
        </div>

        {/* Tokens Container - Rounded on mobile, pill on desktop */}
        <div
          className="tokens-container rounded-2xl sm:rounded-full p-[2px] mx-auto w-full sm:w-auto max-w-sm sm:max-w-none"
          style={{
            background: 'linear-gradient(135deg, #A4238B 0%, #6B21A8 50%, #00EDDA 100%)',
          }}
        >
          <div
            className="rounded-2xl sm:rounded-full flex flex-col sm:flex-row items-stretch"
            style={{ background: '#121214' }}
          >
            {supportedTokens.map((item, index) => (
              <TokenItem
                key={'comingSoon' in item ? 'coming-soon' : item.symbol}
                token={'comingSoon' in item ? undefined : item}
                comingSoon={'comingSoon' in item}
                showDivider={index !== 0}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
