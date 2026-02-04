import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/use-settings'
import { AlertTriangle, Info } from 'lucide-react'

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0]
const DEADLINE_OPTIONS = [10, 20, 30]

export function SettingsPanel() {
  const { settings, setSlippage, setDeadline, toggleExpertMode } = useSettings()
  const [customSlippage, setCustomSlippage] = useState('')
  const [showCustomSlippage, setShowCustomSlippage] = useState(false)

  const currentSlippage = settings.swap.slippageTolerance
  const isHighSlippage = currentSlippage > 1
  const isLowSlippage = currentSlippage < 0.1

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0 && num <= 50) {
      setSlippage(num)
    }
  }

  const handleSlippageSelect = (value: number) => {
    setSlippage(value)
    setShowCustomSlippage(false)
    setCustomSlippage('')
  }

  return (
    <div className="space-y-4 p-4 rounded-xl bg-obsidian/50 border border-arcane-purple/10">
      {/* Slippage Tolerance */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-mist-gray">Slippage Tolerance</span>
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-shadow-gray cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-charcoal border border-arcane-purple/20 text-xs text-mist-gray w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Your transaction will revert if the price changes unfavorably by more than this percentage.
              </div>
            </div>
          </div>
          <span className="text-sm font-mono text-ghost-white">
            {currentSlippage}%
          </span>
        </div>

        <div className="flex gap-2">
          {SLIPPAGE_OPTIONS.map((value) => (
            <button
              key={value}
              onClick={() => handleSlippageSelect(value)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                'border transition-all',
                currentSlippage === value && !showCustomSlippage
                  ? 'bg-arcane-purple/20 border-arcane-purple text-arcane-purple'
                  : 'bg-charcoal border-mist-gray/20 text-mist-gray hover:border-arcane-purple/40'
              )}
            >
              {value}%
            </button>
          ))}
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Custom"
              value={customSlippage}
              onFocus={() => setShowCustomSlippage(true)}
              onChange={(e) => handleCustomSlippage(e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm font-medium text-center',
                'border transition-all bg-charcoal',
                'placeholder:text-mist-gray/50',
                'focus:outline-none',
                showCustomSlippage && customSlippage
                  ? 'border-arcane-purple text-ghost-white'
                  : 'border-mist-gray/20 text-mist-gray'
              )}
            />
            {customSlippage && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mist-gray">
                %
              </span>
            )}
          </div>
        </div>

        {/* Slippage warnings */}
        {isHighSlippage && (
          <div className="flex items-center gap-2 mt-2 text-xs text-blood-crimson">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>High slippage increases risk of front-running</span>
          </div>
        )}
        {isLowSlippage && (
          <div className="flex items-center gap-2 mt-2 text-xs text-ethereal-cyan">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low slippage may cause transaction to fail</span>
          </div>
        )}
      </div>

      {/* Transaction Deadline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-mist-gray">Transaction Deadline</span>
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-shadow-gray cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-charcoal border border-arcane-purple/20 text-xs text-mist-gray w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Your transaction will revert if it is pending for more than this time.
              </div>
            </div>
          </div>
          <span className="text-sm font-mono text-ghost-white">
            {settings.swap.transactionDeadline}m
          </span>
        </div>

        <div className="flex gap-2">
          {DEADLINE_OPTIONS.map((value) => (
            <button
              key={value}
              onClick={() => setDeadline(value)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                'border transition-all',
                settings.swap.transactionDeadline === value
                  ? 'bg-arcane-purple/20 border-arcane-purple text-arcane-purple'
                  : 'bg-charcoal border-mist-gray/20 text-mist-gray hover:border-arcane-purple/40'
              )}
            >
              {value}m
            </button>
          ))}
        </div>
      </div>

      {/* Expert Mode */}
      <div className="flex items-center justify-between pt-2 border-t border-arcane-purple/10">
        <div className="flex items-center gap-2">
          <span className="text-sm text-mist-gray">Expert Mode</span>
          <div className="group relative">
            <Info className="w-3.5 h-3.5 text-shadow-gray cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-charcoal border border-arcane-purple/20 text-xs text-mist-gray w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Bypass confirmation modals and allow high slippage trades. Use at your own risk.
            </div>
          </div>
        </div>
        <button
          onClick={toggleExpertMode}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            settings.swap.expertMode
              ? 'bg-blood-crimson'
              : 'bg-shadow-gray'
          )}
        >
          <div
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-ghost-white transition-transform',
              settings.swap.expertMode ? 'left-6' : 'left-1'
            )}
          />
        </button>
      </div>

      {settings.swap.expertMode && (
        <div className="p-3 rounded-lg bg-blood-crimson/10 border border-blood-crimson/30">
          <div className="flex items-center gap-2 text-xs text-blood-crimson">
            <AlertTriangle className="w-4 h-4" />
            <span>Expert mode is ON. Proceed with caution.</span>
          </div>
        </div>
      )}
    </div>
  )
}
