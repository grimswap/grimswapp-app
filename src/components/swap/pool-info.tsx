import { Info, Droplets, TrendingUp, Activity } from 'lucide-react'
import { type PoolState } from '@/hooks/use-pool-manager'
import { cn } from '@/lib/utils'
import { formatUnits } from 'viem'

interface PoolInfoProps {
  poolState: PoolState | null
  isInitialized: boolean
  isLoading: boolean
  currentPrice: number | null
  fromSymbol: string
  toSymbol: string
  className?: string
}

export function PoolInfo({
  poolState,
  isInitialized,
  isLoading,
  currentPrice,
  fromSymbol,
  toSymbol,
  className,
}: PoolInfoProps) {
  if (isLoading) {
    return (
      <div className={cn('p-4 rounded-xl bg-obsidian/30 border border-arcane-purple/10', className)}>
        <div className="flex items-center gap-2 text-mist-gray text-sm">
          <div className="w-4 h-4 border-2 border-arcane-purple border-t-transparent rounded-full animate-spin" />
          <span>Loading pool data...</span>
        </div>
      </div>
    )
  }

  if (!isInitialized || !poolState) {
    return (
      <div className={cn('p-4 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30', className)}>
        <div className="flex items-center gap-2 text-blood-crimson text-sm">
          <Info className="w-4 h-4" />
          <span>Pool not initialized</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('p-4 rounded-xl bg-obsidian/30 border border-arcane-purple/10 space-y-3', className)}>
      <h4 className="text-sm font-medium text-ghost-white mb-2">Pool Information</h4>

      {/* Current Price */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-mist-gray flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Current Price
        </span>
        <span className="text-ghost-white font-mono">
          1 {fromSymbol} = {currentPrice ? currentPrice.toFixed(6) : '0'} {toSymbol}
        </span>
      </div>

      {/* Pool Liquidity */}
      {poolState.liquidity > 0n && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-mist-gray flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5" />
            Total Liquidity
          </span>
          <span className="text-ghost-white font-mono">
            {formatLiquidity(poolState.liquidity)}
          </span>
        </div>
      )}

      {/* Current Tick */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-mist-gray flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Current Tick
        </span>
        <span className="text-ghost-white font-mono">
          {poolState.tick.toLocaleString()}
        </span>
      </div>

      {/* Protocol Fee */}
      {poolState.protocolFee > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-mist-gray flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Protocol Fee
          </span>
          <span className="text-ghost-white font-mono">
            {(poolState.protocolFee / 10000).toFixed(2)}%
          </span>
        </div>
      )}

      {/* Sqrt Price (for debugging) */}
      <details className="text-xs text-mist-gray">
        <summary className="cursor-pointer hover:text-ghost-white">Technical Details</summary>
        <div className="mt-2 space-y-1 pl-4 font-mono">
          <div>sqrtPriceX96: {poolState.sqrtPriceX96.toString()}</div>
          <div>Liquidity: {poolState.liquidity.toString()}</div>
        </div>
      </details>
    </div>
  )
}

/**
 * Format liquidity value for display
 */
function formatLiquidity(liquidity: bigint): string {
  const value = Number(formatUnits(liquidity, 18))

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  } else {
    return value.toFixed(2)
  }
}
