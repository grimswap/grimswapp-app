import { Header } from './header'
import { Footer } from './footer'
import { NoiseOverlay } from '../effects/noise-overlay'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Main background gradient from design */}
      <div
        className="fixed inset-0"
        style={{
          background: 'linear-gradient(180deg, #121214 5%, #33082A 32%, #36082B 99%)',
        }}
      />

      {/* Background images - left and right */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Left background image */}
        <img
          src="/assets/img/bg-left.png"
          alt=""
          className="absolute left-0 top-0 h-full w-auto object-cover object-left opacity-60"
        />
        {/* Right background image */}
        <img
          src="/assets/img/bg-right.png"
          alt=""
          className="absolute right-0 top-0 h-full w-auto object-cover object-right opacity-60"
        />
      </div>

      {/* Noise texture */}
      <NoiseOverlay />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="pt-20 flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}
