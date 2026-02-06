import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Wallet, Shield, ArrowLeftRight } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header Animation
      gsap.fromTo(
        '.header-animate',
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 80%',
          },
        }
      )

      // Steps Animation (Desktop)
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.desktop-diagram',
          start: 'top 70%',
        },
      })

      tl.fromTo(
        '.curve-line',
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 1, ease: 'power2.out' }
      )
        .fromTo(
          '.step-icon',
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, stagger: 0.2, ease: 'back.out(1.7)' },
          '-=0.8'
        )
        .fromTo(
          '.step-content',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.2, ease: 'power2.out' },
          '-=0.6'
        )

      // Mobile Animation
      gsap.fromTo(
        '.mobile-step',
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.mobile-steps-container',
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
      className="relative py-20 lg:py-32 overflow-hidden bg-[#121214]"
    >
      {/* Left Swirl Decoration */}
      <div
        className="absolute left-0 bottom-0 w-[400px] h-[500px] pointer-events-none opacity-70 z-0"
        style={{
          backgroundImage: 'url(/assets/img/left-hero-swirl.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'left bottom',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <div className="relative z-10 max-w-[1440px] mx-auto px-6 lg:px-16">
        {/* Section Header */}
        <div className="text-center mb-16 lg:mb-32">
          <h2
            className="header-animate mb-6 text-4xl lg:text-6xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontVariant: 'small-caps' }}
          >
            <span className="italic text-[#00EDDA] mr-3">How</span>
            <span className="text-white">It Works</span>
          </h2>
          <p
            className="header-animate text-gray-400 max-w-xl mx-auto text-base lg:text-lg leading-relaxed"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Three simple steps to complete your first private swap using zero-knowledge proofs.
          </p>
        </div>

        {/* Desktop Layout - Pixel Perfect Diagram */}
        <div className="desktop-diagram hidden lg:block relative w-full max-w-[1200px] mx-auto h-[600px]">
          {/* 
             Reference Container: 80% Width - Uses available side space
          */}
          <div className="relative w-[80%] lg:w-[75%] xl:w-[80%] mx-auto top-[180px]">
            {/* SVG Curve */}
            <img
              src="/assets/img/3-steps-line.svg"
              alt=""
              className="curve-line w-full h-auto pointer-events-none select-none relative z-10"
            />

            {/* ================= STEP 1: DEPOSIT ================= */}
            {/* Layout: Text Group ABOVE the curve. Icon ON the curve. */}
            
            {/* Content Group - Above Curve */}
            <div
              className="step-content absolute flex items-start gap-0 w-[320px]"
              style={{ left: '-5%', top: '-55%' }}
            >
               {/* Text Side */}
               <div className="flex-1 text-left pt-6">
                 <h3
                   className="text-white text-3xl font-bold mb-2 tracking-wide"
                   style={{ fontFamily: 'var(--font-display)', fontVariant: 'small-caps' }}
                 >
                   Deposit
                 </h3>
                 <p className="text-gray-400 text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                   Deposit ETH into the GrimPool and merge into a shared privacy set.
                 </p>
               </div>
               
               {/* Number Side */}
               <div className="w-[65px] flex-shrink-0 pt-2 -ml-4">
                  <img 
                    src="/assets/img/number-1.png" 
                    alt="1" 
                    className="w-full h-auto opacity-80 mix-blend-screen pointer-events-none select-none"
                  />
               </div>
            </div>

            {/* Icon - On Curve (Start) */}
            <div
              className="step-icon absolute w-10 h-10 rounded-full bg-[#121214] border-2 border-[#A4238B] flex items-center justify-center z-20 shadow-[0_0_15px_rgba(164,35,139,0.4)]"
              style={{ left: '0%', top: '68%', transform: 'translate(-50%, -50%)' }}
            >
              <Wallet className="w-5 h-5 text-[#A4238B]" />
            </div>


            {/* ================= STEP 2: PROVE ================= */}
            {/* Layout: Text Group BELOW the curve peak. Icon ON the curve peak. */}

            {/* Icon - On Curve (Peak) */}
            <div
              className="step-icon absolute w-10 h-10 rounded-full bg-[#121214] border-2 border-[#A4238B] flex items-center justify-center z-20 shadow-[0_0_15px_rgba(164,35,139,0.4)]"
              style={{ left: '50.8%', top: '3%', transform: 'translate(-50%, -50%)' }}
            >
              <Shield className="w-5 h-5 text-[#A4238B]" />
            </div>

            {/* Content Group - Below Curve */}
            <div
              className="step-content absolute flex items-start gap-0 w-[320px]"
              style={{ left: '35%', top: '65%' }}
            >
              {/* Text Side */}
              <div className="flex-1 text-left pt-4">
                <h3
                   className="text-white text-3xl font-bold mb-2 tracking-wide"
                   style={{ fontFamily: 'var(--font-display)', fontVariant: 'small-caps' }}
                 >
                   Prove
                 </h3>
                 <p className="text-gray-400 text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                   Prove ownership with zero-knowledge — without revealing yourself.
                 </p>
              </div>

              {/* Number Side */}
              <div className="w-[65px] flex-shrink-0 -mt-2 -ml-4">
                  <img 
                    src="/assets/img/number-2.png" 
                    alt="2" 
                    className="w-full h-auto opacity-70 mix-blend-screen pointer-events-none select-none"
                  />
               </div>
            </div>


            {/* ================= STEP 3: SWAP ================= */}
            {/* Layout: Text Group BELOW the curve end. Icon ON the curve end. */}

            {/* Icon - On Curve (End) */}
            <div
              className="step-icon absolute w-10 h-10 rounded-full bg-[#121214] border-2 border-[#00EDDA] flex items-center justify-center z-20 shadow-[0_0_15px_rgba(0,237,218,0.4)]"
              style={{ left: '100%', top: '19%', transform: 'translate(-50%, -50%)' }}
            >
              <ArrowLeftRight className="w-5 h-5 text-[#00EDDA]" />
            </div>

            {/* Content Group - Below Icon */}
            <div
              className="step-content absolute flex items-start gap-0 w-[320px]"
              style={{ left: '75%', top: '55%' }}
            >
               {/* Text Side */}
               <div className="flex-1 text-left pt-6">
                 <h3
                   className="text-white text-3xl font-bold mb-2 tracking-wide"
                   style={{ fontFamily: 'var(--font-display)', fontVariant: 'small-caps' }}
                 >
                   Swap
                 </h3>
                 <p className="text-gray-400 text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                   Execute a private swap. Your transaction leaves no trace.
                 </p>
               </div>

               {/* Number Side */}
               <div className="w-[65px] flex-shrink-0 pt-3 -ml-4">
                  <img 
                    src="/assets/img/number-3.png" 
                    alt="3" 
                    className="w-full h-auto opacity-80 mix-blend-screen pointer-events-none select-none"
                  />
               </div>
            </div>

          </div>
        </div>

        {/* Mobile Layout (Stacked) */}
        <div className="mobile-steps-container lg:hidden space-y-20 mt-12">
          {/* Step 1 */}
          <div className="mobile-step relative flex flex-col items-center text-center">
             <div className="relative mb-6">
                <img src="/assets/img/number-1.png" alt="1" className="w-24 h-auto opacity-80" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#121214] border-2 border-[#A4238B] flex items-center justify-center shadow-[0_0_15px_rgba(164,35,139,0.3)]">
                   <Wallet className="w-5 h-5 text-[#A4238B]" />
                </div>
             </div>
             <h3 className="text-2xl text-white font-bold mb-3 tracking-wider" style={{ fontFamily: 'var(--font-display)', fontVariant: 'small-caps' }}>
               Deposit
             </h3>
             <p className="text-gray-400 text-sm leading-relaxed max-w-xs px-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
               Deposit ETH into the GrimPool and merge into a shared privacy set.
             </p>
          </div>

          {/* Step 2 */}
          <div className="mobile-step relative flex flex-col items-center text-center">
             <div className="relative mb-6">
                <img src="/assets/img/number-2.png" alt="2" className="w-28 h-auto opacity-80" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#121214] border-2 border-[#A4238B] flex items-center justify-center shadow-[0_0_15px_rgba(164,35,139,0.3)]">
                   <Shield className="w-5 h-5 text-[#A4238B]" />
                </div>
             </div>
             <h3 className="text-2xl text-white font-bold mb-3 tracking-wider" style={{ fontFamily: 'var(--font-display)', fontVariant: 'small-caps' }}>
               Prove
             </h3>
             <p className="text-gray-400 text-sm leading-relaxed max-w-xs px-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
               Prove ownership with zero-knowledge — without revealing yourself.
             </p>
          </div>

          {/* Step 3 */}
          <div className="mobile-step relative flex flex-col items-center text-center">
             <div className="relative mb-6">
                <img src="/assets/img/number-3.png" alt="3" className="w-28 h-auto opacity-80" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#121214] border-2 border-[#00EDDA] flex items-center justify-center shadow-[0_0_15px_rgba(0,237,218,0.3)]">
                   <ArrowLeftRight className="w-5 h-5 text-[#00EDDA]" />
                </div>
             </div>
             <h3 className="text-2xl text-white font-bold mb-3 tracking-wider" style={{ fontFamily: 'var(--font-display)', fontVariant: 'small-caps' }}>
               Swap
             </h3>
             <p className="text-gray-400 text-sm leading-relaxed max-w-xs px-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
               Execute a private swap. Your transaction leaves no trace.
             </p>
          </div>
        </div>
      </div>
    </section>
  )
}
