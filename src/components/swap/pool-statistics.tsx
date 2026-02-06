import { Card, CardContent } from '@/components/ui/card'
import { Coins, BarChart3, TrendingUp, Activity, Droplets } from 'lucide-react'
import { useStateView } from '@/hooks/use-state-view'
import { DEFAULT_POOL_KEY } from '@/lib/contracts'
import { ETH, USDC } from '@/lib/tokens'

/**
 * Pool Statistics component for the swap page sidebar
 * Shows real-time metrics for the active liquidity pool
 */
export function PoolStatistics() {
  const { poolState, currentPrice, isInitialized, isLoading } = useStateView(DEFAULT_POOL_KEY)

  // Calculate reserves from liquidity using Uniswap v3/v4 concentrated liquidity formula
  // For concentrated liquidity: L = sqrt(x * y) at current price
  // Virtual reserves: x = L / sqrt(P), y = L * sqrt(P)
  const estimateReserves = () => {
    if (!poolState || poolState.liquidity === 0n || !currentPrice || currentPrice <= 0) {
      return { ethReserve: 0, usdcReserve: 0 }
    }

    const liqNum = Number(poolState.liquidity)

    // Convert price to raw ratio (accounting for decimal difference)
    // price is USDC per ETH (e.g., 2500)
    // raw_price = price * 10^6 / 10^18 = price / 10^12
    const rawPrice = currentPrice / 1e12
    const sqrtRawPrice = Math.sqrt(rawPrice)

    // Virtual reserves in raw units:
    // x (ETH in wei) = L / sqrt(rawPrice)
    // y (USDC in smallest units) = L * sqrt(rawPrice)
    const ethReserveWei = liqNum / sqrtRawPrice
    const usdcReserveUnits = liqNum * sqrtRawPrice

    // Convert to human-readable
    const ethReserve = ethReserveWei / 1e18
    const usdcReserve = usdcReserveUnits / 1e6

    return { ethReserve, usdcReserve }
  }

  const { ethReserve, usdcReserve } = estimateReserves()
  const ethValue = ethReserve * (currentPrice ?? 0)
  const totalValue = ethValue + usdcReserve
  const ethPercent = totalValue > 0 ? (ethValue / totalValue) * 100 : 50
  const usdcPercent = totalValue > 0 ? (usdcReserve / totalValue) * 100 : 50

  // Format numbers
  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
    if (num < 0.01 && num > 0) return num.toFixed(6)
    return num.toFixed(decimals)
  }

  if (isLoading) {
    return (
      <Card glow="purple" className="w-[420px]">
        <CardContent className="p-5">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-arcane-purple border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card glow="purple" className="w-[420px]">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="text-center pb-3 border-b border-arcane-purple/20">
          <h3 className="font-display text-lg text-ghost-white">Pool Statistics</h3>
          <p className="text-xs text-mist-gray mt-1">
            Real-time metrics for the ETH/USDC liquidity pool
          </p>
        </div>

        {/* Current Pool Ratio */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-arcane-purple/10 to-ethereal-cyan/10 border border-arcane-purple/20">
          <p className="text-xs text-mist-gray mb-1">Current Pool Ratio</p>
          <p className="text-lg font-mono text-ghost-white">
            1 ETH = <span className="text-ethereal-cyan">${currentPrice?.toFixed(2) ?? '—'}</span> USDC
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* TVL */}
          <div className="p-3 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Coins className="w-3.5 h-3.5 text-ethereal-cyan" />
              <span className="text-xs text-mist-gray">TVL</span>
            </div>
            <p className="text-sm font-mono text-ghost-white">
              ${formatNumber(totalValue)}
            </p>
            <p className="text-[10px] text-mist-gray">Real pool reserves</p>
          </div>

          {/* 24h Volume */}
          <div className="p-3 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-ethereal-cyan" />
              <span className="text-xs text-mist-gray">24h Volume</span>
            </div>
            <p className="text-sm font-mono text-ghost-white">—</p>
            <p className="text-[10px] text-mist-gray">Requires indexer</p>
          </div>

          {/* ETH Price */}
          <div className="p-3 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-spectral-green" />
              <span className="text-xs text-mist-gray">ETH Price</span>
            </div>
            <p className="text-sm font-mono text-ghost-white">
              ${currentPrice?.toFixed(2) ?? '—'}
            </p>
            <p className="text-[10px] text-mist-gray">USDC per ETH</p>
          </div>

          {/* APR */}
          <div className="p-3 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-blood-crimson" />
              <span className="text-xs text-mist-gray">APR</span>
            </div>
            <p className="text-sm font-mono text-ghost-white">—</p>
            <p className="text-[10px] text-mist-gray">Based on fees</p>
          </div>
        </div>

        {/* Pool Composition */}
        <div className="space-y-2">
          <p className="text-xs text-mist-gray font-medium">Pool Composition</p>

          {/* ETH */}
          <div className="p-3 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={ETH.logoURI} alt="ETH" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ghost-white">ETH</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-ghost-white">{formatNumber(ethReserve, 4)}</p>
                <p className="text-[10px] text-mist-gray">≈ ${formatNumber(ethValue)}</p>
              </div>
            </div>
            <div className="h-1.5 bg-obsidian rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${ethPercent}%`, background: ETH.color }}
              />
            </div>
            <p className="text-[10px] text-mist-gray mt-1">{ethPercent.toFixed(1)}% of pool</p>
          </div>

          {/* USDC */}
          <div className="p-3 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={USDC.logoURI} alt="USDC" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ghost-white">USDC</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-ghost-white">{formatNumber(usdcReserve, 2)}</p>
                <p className="text-[10px] text-mist-gray">≈ ${formatNumber(usdcReserve)}</p>
              </div>
            </div>
            <div className="h-1.5 bg-obsidian rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${usdcPercent}%`, background: USDC.color }}
              />
            </div>
            <p className="text-[10px] text-mist-gray mt-1">{usdcPercent.toFixed(1)}% of pool</p>
          </div>
        </div>

        {/* Total Liquidity */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-charcoal/80 to-charcoal/50 border border-arcane-purple/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-ethereal-cyan" />
              <div>
                <p className="text-xs text-mist-gray">Total Value Locked</p>
                <p className="text-sm font-mono text-ethereal-cyan">
                  {isInitialized ? `$${formatNumber(totalValue)}` : '—'}
                </p>
              </div>
            </div>
            {poolState?.slot0?.tick !== undefined && (
              <div className="text-right">
                <p className="text-xs text-mist-gray">Pool Tick</p>
                <p className="text-sm font-mono text-ghost-white">{poolState.slot0.tick}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
