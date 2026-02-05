import { Link } from 'react-router-dom'
import { Github, Twitter } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Swap', href: '/swap' },
  { name: 'Pool', href: '/pool' },
  { name: 'Wallet', href: '/wallet' },
]

const socials = [
  {
    name: 'Twitter',
    href: 'https://twitter.com/grimswap',
    icon: Twitter,
  },
  {
    name: 'GitHub',
    href: 'https://github.com/grimswap',
    icon: Github,
  },
]

export function Footer() {
  return (
    <footer
      className="relative border-t"
      style={{ borderColor: 'rgba(164, 35, 139, 0.15)' }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(18, 18, 20, 0.8) 100%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="inline-flex items-center gap-3 mb-4 group">
              <img
                src="/grimoire.svg"
                alt="GrimSwap"
                className="w-10 h-10 group-hover:scale-105 transition-transform"
                style={{ filter: 'drop-shadow(0 0 10px rgba(0, 237, 218, 0.4))' }}
              />
              <span className="font-display text-2xl text-ghost-white">GrimSwap</span>
            </Link>
            <p className="text-mist-gray text-sm leading-relaxed max-w-xs">
              The Dark Arts of DeFi. Privacy-preserving token swaps powered by ZK-SNARK proofs
              and Uniswap v4 hooks.
            </p>

            {/* Built on badge */}
            <div
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(42, 20, 40, 0.5)',
                border: '1px solid rgba(164, 35, 139, 0.15)',
              }}
            >
              <span className="text-xs text-mist-gray">Built on</span>
              <span className="text-xs font-medium text-ghost-white">Uniswap v4</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-display text-sm text-ghost-white mb-4">Navigate</h4>
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      'text-mist-gray text-sm',
                      'hover:text-grim-cyan',
                      'transition-colors duration-200'
                    )}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social & Links */}
          <div>
            <h4 className="font-display text-sm text-ghost-white mb-4">Community</h4>
            <div className="flex gap-3">
              {socials.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'w-10 h-10 rounded-xl',
                      'flex items-center justify-center',
                      'transition-all duration-200'
                    )}
                    style={{
                      background: 'rgba(42, 20, 40, 0.5)',
                      border: '1px solid rgba(164, 35, 139, 0.15)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 237, 218, 0.3)'
                      e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 237, 218, 0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(164, 35, 139, 0.15)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    aria-label={social.name}
                  >
                    <Icon className="w-5 h-5 text-mist-gray" />
                  </a>
                )
              })}
            </div>

            {/* Network badge */}
            <div className="mt-6">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(0, 237, 218, 0.1)',
                  border: '1px solid rgba(0, 237, 218, 0.2)',
                }}
              >
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: '#00EDDA' }}
                />
                <span className="text-xs" style={{ color: '#00EDDA' }}>
                  Unichain Sepolia
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 border-t"
          style={{ borderColor: 'rgba(164, 35, 139, 0.15)' }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-mist-gray/60">
              &copy; {new Date().getFullYear()} GrimSwap. All rights reserved.
            </p>
            <p className="text-xs text-mist-gray/60">
              Made with dark magic for the privacy-conscious.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
