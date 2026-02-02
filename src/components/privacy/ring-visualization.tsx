import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { cn } from '@/lib/utils'

// Mock addresses for visualization
const MOCK_ADDRESSES = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
  '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
  '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
  '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec',
  '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E',
  '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5',
  '0x2E15D7AA0650dE1009710FDd45C3468d75AE1392',
]

export function RingVisualization() {
  const containerRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Continuous slow rotation
  useEffect(() => {
    if (ringRef.current && !isAnimating) {
      gsap.to(ringRef.current, {
        rotation: '+=360',
        duration: 30,
        ease: 'none',
        repeat: -1,
      })
    }

    return () => {
      if (ringRef.current) {
        gsap.killTweensOf(ringRef.current)
      }
    }
  }, [isAnimating])

  // Cycle through active addresses
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % MOCK_ADDRESSES.length)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const triggerAnimation = () => {
    if (ringRef.current) {
      setIsAnimating(true)
      gsap.killTweensOf(ringRef.current)

      gsap.to(ringRef.current, {
        rotation: '+=720',
        duration: 2,
        ease: 'power2.inOut',
        onComplete: () => {
          setIsAnimating(false)
        },
      })
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-72 h-72 xl:w-80 xl:h-80',
        'rounded-2xl p-4 xl:p-6',
        'bg-charcoal/30 border border-arcane-purple/10'
      )}
    >
      {/* Title */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-mist-gray">Ring Visualization</h3>
        <button
          onClick={triggerAnimation}
          className={cn(
            'px-3 py-1 rounded-lg text-xs',
            'bg-arcane-purple/20 text-arcane-purple',
            'hover:bg-arcane-purple/30 transition-colors'
          )}
        >
          Simulate
        </button>
      </div>

      {/* Ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Outer glow ring */}
        <div
          className={cn(
            'absolute w-56 h-56 rounded-full',
            'border border-arcane-purple/20',
            'shadow-[0_0_30px_rgba(139,92,246,0.1)]',
            isAnimating && 'shadow-[0_0_50px_rgba(139,92,246,0.3)]',
            'transition-shadow duration-500'
          )}
        />

        {/* Orbiting members */}
        <div ref={ringRef} className="relative w-56 h-56">
          {MOCK_ADDRESSES.slice(0, 5).map((address, i) => {
            const angle = (i / 5) * 360
            const isActive = i === activeIndex

            return (
              <div
                key={address}
                className={cn(
                  'absolute w-10 h-10 rounded-full',
                  'flex items-center justify-center',
                  'transition-all duration-300',
                  isActive
                    ? 'bg-spectral-green shadow-[0_0_20px_rgba(0,255,136,0.5)] scale-110'
                    : 'bg-charcoal border border-mist-gray/30'
                )}
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `
                    translate(-50%, -50%)
                    rotate(${angle}deg)
                    translateY(-112px)
                    rotate(-${angle}deg)
                  `,
                }}
              >
                <span
                  className={cn(
                    'text-[10px] font-mono',
                    isActive ? 'text-void-black font-bold' : 'text-mist-gray'
                  )}
                >
                  {address.slice(2, 6)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Center - You */}
        <div
          className={cn(
            'absolute w-20 h-20 rounded-full',
            'bg-arcane-purple/20 border-2 border-arcane-purple',
            'flex flex-col items-center justify-center',
            'shadow-[0_0_20px_rgba(139,92,246,0.3)]'
          )}
        >
          <span className="text-xs text-mist-gray">You</span>
          <span className="text-sm font-mono text-arcane-purple">????</span>
        </div>
      </div>

      {/* Info text */}
      <div className="absolute bottom-4 left-4 right-4 text-center">
        <p className="text-xs text-shadow-gray">
          {isAnimating
            ? 'Mixing transaction...'
            : 'Your identity is hidden among the ring'}
        </p>
      </div>
    </div>
  )
}
