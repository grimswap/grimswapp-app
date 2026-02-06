import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { parseEther, parseUnits } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { TransactionSuccessModal } from '@/components/ui/transaction-success-modal'
import { Droplets, Plus, Shield, AlertCircle, ExternalLink, Loader2, TrendingUp, Activity, Coins, PieChart, BarChart3, RefreshCw } from 'lucide-react'
import { CONTRACTS, ETH_USDC_POOL_KEY, ETH_USDC_GRIMSWAP_POOL_KEY, type PoolKey } from '@/lib/contracts'
import { ETH, USDC } from '@/lib/tokens'
import { useStateView } from '@/hooks/use-state-view'
import { useLiquidity, FULL_RANGE_TICK_LOWER, FULL_RANGE_TICK_UPPER } from '@/hooks/use-liquidity'
import { useNativeBalance, useTokenBalance } from '@/hooks/use-token-balance'
import { useLiquidityPositions } from '@/hooks/use-liquidity-positions'
import { calculatePoolId } from '@/hooks/use-pool-manager'

interface PoolInfo {
  id: string
  name: string
  token0: string
  token1: string
  fee: string
  poolKey: PoolKey
  hasPrivacy: boolean
  hookAddress: string
}

// Available pools on Unichain Sepolia
const POOLS: PoolInfo[] = [
  {
    id: 'eth-usdc-vanilla',
    name: 'ETH/USDC',
    token0: 'ETH',
    token1: 'USDC',
    fee: '0.3%',
    poolKey: ETH_USDC_POOL_KEY,
    hasPrivacy: false,
    hookAddress: '0x0000000000000000000000000000000000000000',
  },
  {
    id: 'eth-usdc-grim',
    name: 'ETH/USDC',
    token0: 'ETH',
    token1: 'USDC',
    fee: '0.05%',  // V3 pool uses fee=500 (0.05%)
    poolKey: ETH_USDC_GRIMSWAP_POOL_KEY,
    hasPrivacy: true,
    hookAddress: CONTRACTS.grimSwapZK,
  },
]

// Pool Statistics Modal
interface PoolStatsModalProps {
  isOpen: boolean
  onClose: () => void
  pool: PoolInfo | null
}

function PoolStatsModal({ isOpen, onClose, pool }: PoolStatsModalProps) {
  const { poolState, currentPrice, refetch, isLoading } = useStateView(
    pool?.poolKey ?? ETH_USDC_POOL_KEY
    // useKnownPoolId defaults to true - uses verified known pool IDs
  )

  // Auto-refresh every 10 seconds when modal is open
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => refetch(), 10000)
    return () => clearInterval(interval)
  }, [isOpen, refetch])

  if (!pool) return null

  // Calculate estimated reserves from liquidity
  // For full-range positions: reserves ≈ liquidity / sqrt(price) for token0
  const liquidity = poolState?.liquidity ?? 0n
  const sqrtPriceX96 = poolState?.slot0?.sqrtPriceX96 ?? 0n

  // Estimate virtual reserves using Uniswap v3/v4 concentrated liquidity formula
  // For concentrated liquidity: L = sqrt(x * y) at current price
  // Virtual reserves: x = L / sqrt(P), y = L * sqrt(P)
  // where P is the raw price (token1/token0 adjusted for decimals)
  const estimateReserves = () => {
    if (liquidity === 0n || sqrtPriceX96 === 0n) {
      return { ethReserve: 0, usdcReserve: 0 }
    }

    const liqNum = Number(liquidity)
    const priceInUsdc = currentPrice ?? 0

    if (priceInUsdc <= 0) {
      return { ethReserve: 0, usdcReserve: 0 }
    }

    // Convert price to raw ratio (accounting for decimal difference)
    // price is USDC per ETH (e.g., 4000)
    // raw_price = price * 10^6 / 10^18 = price / 10^12
    const rawPrice = priceInUsdc / 1e12
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

  // Format large numbers
  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
    return num.toFixed(decimals)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pool Statistics">
      <div className="p-4 space-y-6">
        {/* Pool Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-arcane-purple/20">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 border-obsidian bg-charcoal overflow-hidden">
              <img src={ETH.logoURI} alt="ETH" className="w-10 h-10 object-contain" />
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-obsidian bg-charcoal overflow-hidden">
              <img src={USDC.logoURI} alt="USDC" className="w-10 h-10 object-contain" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-ghost-white">
                {pool.token0}/{pool.token1}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-charcoal text-mist-gray">
                {pool.fee}
              </span>
              {pool.hasPrivacy && (
                <span className="text-xs px-2 py-0.5 rounded bg-spectral-green/20 text-spectral-green flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Privacy
                </span>
              )}
            </div>
            <p className="text-sm text-mist-gray">
              {pool.hasPrivacy ? 'GrimSwap Privacy Pool' : 'Standard Uniswap v4'}
            </p>
          </div>
          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="ml-auto p-2 rounded-lg bg-charcoal hover:bg-arcane-purple/20 transition-colors disabled:opacity-50"
            title="Refresh pool data"
          >
            <RefreshCw className={`w-4 h-4 text-mist-gray ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Current Price Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-arcane-purple/20 to-ethereal-cyan/20 border border-arcane-purple/30">
          <p className="text-xs text-mist-gray mb-1">Current Pool Ratio</p>
          <p className="text-xl font-mono text-ghost-white">
            1 ETH = <span className="text-ethereal-cyan">${currentPrice?.toFixed(2) ?? '—'}</span> USDC
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* TVL */}
          <div className="p-4 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-ethereal-cyan" />
              <span className="text-xs text-mist-gray">Total Value Locked</span>
            </div>
            <p className="text-lg font-mono text-ghost-white">
              ${formatNumber(totalValue)}
            </p>
            <p className="text-xs text-mist-gray mt-1">Real pool reserves</p>
          </div>

          {/* 24h Volume - Placeholder */}
          <div className="p-4 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-ethereal-cyan" />
              <span className="text-xs text-mist-gray">24h Volume</span>
            </div>
            <p className="text-lg font-mono text-ghost-white">—</p>
            <p className="text-xs text-mist-gray mt-1">Requires indexer</p>
          </div>

          {/* ETH Price */}
          <div className="p-4 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-spectral-green" />
              <span className="text-xs text-mist-gray">ETH Price</span>
            </div>
            <p className="text-lg font-mono text-ghost-white">
              ${currentPrice?.toFixed(2) ?? '—'}
            </p>
            <p className="text-xs text-mist-gray mt-1">USDC per ETH</p>
          </div>

          {/* APR - Placeholder */}
          <div className="p-4 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blood-crimson" />
              <span className="text-xs text-mist-gray">APR</span>
            </div>
            <p className="text-lg font-mono text-ghost-white">—</p>
            <p className="text-xs text-mist-gray mt-1">Based on trading fees</p>
          </div>
        </div>

        {/* Pool Composition */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-mist-gray" />
            <span className="text-sm font-medium text-ghost-white">Pool Composition</span>
          </div>

          {/* ETH */}
          <div className="p-4 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={ETH.logoURI} alt="ETH" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <p className="font-medium text-ghost-white">Ethereum</p>
                  <p className="text-xs text-mist-gray">ETH</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-ghost-white">{formatNumber(ethReserve, 4)}</p>
                <p className="text-xs text-mist-gray">≈ ${formatNumber(ethValue)}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-mist-gray">{ethPercent.toFixed(1)}% of pool</span>
              </div>
              <div className="h-2 bg-obsidian rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${ethPercent}%`,
                    background: ETH.color,
                  }}
                />
              </div>
            </div>
          </div>

          {/* USDC */}
          <div className="p-4 rounded-xl bg-charcoal/50 border border-arcane-purple/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-charcoal overflow-hidden">
                  <img src={USDC.logoURI} alt="USDC" className="w-10 h-10 object-contain" />
                </div>
                <div>
                  <p className="font-medium text-ghost-white">USD Coin</p>
                  <p className="text-xs text-mist-gray">USDC</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-ghost-white">{formatNumber(usdcReserve, 2)}</p>
                <p className="text-xs text-mist-gray">≈ ${formatNumber(usdcReserve)}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-mist-gray">{usdcPercent.toFixed(1)}% of pool</span>
              </div>
              <div className="h-2 bg-obsidian rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${usdcPercent}%`,
                    background: USDC.color,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Total Value Locked */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-charcoal/80 to-charcoal/50 border border-arcane-purple/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-mist-gray mb-1">Total Value Locked</p>
              <p className="text-xl font-mono text-ethereal-cyan">
                ${formatNumber(totalValue)}
              </p>
              <p className="text-xs text-mist-gray mt-1">Combined pool reserves</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-mist-gray mb-1">Pool Tick</p>
              <p className="text-lg font-mono text-ghost-white">
                {poolState?.slot0?.tick ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Pool Address */}
        {pool.hasPrivacy && (
          <div className="p-3 rounded-lg bg-spectral-green/5 border border-spectral-green/20">
            <p className="text-xs text-mist-gray mb-1">GrimSwapZK Hook</p>
            <a
              href={`https://unichain-sepolia.blockscout.com/address/${pool.hookAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-ethereal-cyan hover:underline flex items-center gap-1"
            >
              {pool.hookAddress.slice(0, 10)}...{pool.hookAddress.slice(-8)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </Modal>
  )
}

function PoolRow({ pool, onAddLiquidity, onViewStats }: { pool: PoolInfo; onAddLiquidity: (pool: PoolInfo) => void; onViewStats: (pool: PoolInfo) => void }) {
  const { poolState, isLoading, currentPrice, isInitialized } = useStateView(pool.poolKey)

  // Calculate TVL from pool state
  const calculateTVL = () => {
    if (!poolState || poolState.liquidity === 0n || !currentPrice) {
      return 0
    }
    const sqrtPriceX96 = poolState.slot0?.sqrtPriceX96 ?? 0n
    if (sqrtPriceX96 === 0n) return 0

    const liqNum = Number(poolState.liquidity)
    const priceInUsdc = currentPrice
    if (priceInUsdc <= 0) return 0

    const rawPrice = priceInUsdc / 1e12
    const sqrtRawPrice = Math.sqrt(rawPrice)

    const ethReserveWei = liqNum / sqrtRawPrice
    const usdcReserveUnits = liqNum * sqrtRawPrice

    const ethReserve = ethReserveWei / 1e18
    const usdcReserve = usdcReserveUnits / 1e6

    const ethValue = ethReserve * priceInUsdc
    return ethValue + usdcReserve
  }

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
    return num.toFixed(2)
  }

  const totalValue = calculateTVL()
  const tvl = totalValue > 0 ? `$${formatNumber(totalValue)}` : '—'

  const priceDisplay = currentPrice
    ? `$${currentPrice.toFixed(2)}`
    : '—'

  return (
    <div onClick={() => onViewStats(pool)} className="cursor-pointer">
      <Card glow="none" className="hover:border-arcane-purple/30 transition-all group">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 items-center">
          {/* Pool Name */}
          <div className="col-span-2 flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-obsidian bg-charcoal overflow-hidden">
                <img src={ETH.logoURI} alt="ETH" className="w-8 h-8 object-contain" />
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-obsidian bg-charcoal overflow-hidden">
                <img src={USDC.logoURI} alt="USDC" className="w-8 h-8 object-contain" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-ghost-white group-hover:text-ethereal-cyan transition-colors">
                  {pool.token0}/{pool.token1}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-charcoal text-mist-gray">
                  {pool.fee}
                </span>
                {pool.hasPrivacy && (
                  <Shield className="w-3.5 h-3.5 text-spectral-green" />
                )}
              </div>
              <span className="text-xs text-mist-gray">
                {pool.hasPrivacy ? 'GrimSwap Privacy Pool' : 'Standard Uniswap v4'}
              </span>
            </div>
          </div>

          {/* TVL */}
          <div>
            <span className="sm:hidden text-xs text-mist-gray block">TVL</span>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-mist-gray" />
            ) : (
              <span className="font-mono text-ghost-white" title="Total Value Locked">
                {isInitialized ? tvl : 'Not initialized'}
              </span>
            )}
          </div>

          {/* Price */}
          <div>
            <span className="sm:hidden text-xs text-mist-gray block">Price</span>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-mist-gray" />
            ) : (
              <span className="font-mono text-ghost-white">{priceDisplay}</span>
            )}
          </div>

          {/* Status */}
          <div>
            <span className="sm:hidden text-xs text-mist-gray block">Status</span>
            {isInitialized ? (
              <span className="text-xs px-2 py-1 rounded bg-spectral-green/20 text-spectral-green">
                Active
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded bg-blood-crimson/20 text-blood-crimson">
                Not Active
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="col-span-2 sm:col-span-1 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAddLiquidity(pool)
              }}
            >
              <Droplets className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface AddLiquidityModalProps {
  isOpen: boolean
  onClose: () => void
  pool: PoolInfo | null
}

function AddLiquidityModal({ isOpen, onClose, pool }: AddLiquidityModalProps) {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [ethAmount, setEthAmount] = useState('')
  const [usdcAmount, setUsdcAmount] = useState('')
  const [initPrice, setInitPrice] = useState('2500') // Default ETH price in USDC
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false)
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add')
  const [removePercent, setRemovePercent] = useState(0)

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successDetails, setSuccessDetails] = useState<{
    type: 'add-liquidity' | 'remove-liquidity'
    txHash: string
    ethAmount: string
    usdcAmount: string
  } | null>(null)

  const { formatted: ethBalance } = useNativeBalance()
  const { formatted: usdcBalance } = useTokenBalance(USDC.address)

  // Calculate pool ID for position tracking
  const poolId = pool ? calculatePoolId(pool.poolKey) : ''

  // Get user's liquidity positions
  const {
    positions,
    totalLiquidity,
    addPosition,
    updatePositionLiquidity,
    removePosition,
    calculateTokenAmounts,
  } = useLiquidityPositions(poolId)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEthAmount('')
      setUsdcAmount('')
      setRemovePercent(0)
    }
  }, [isOpen])

  const {
    initializePool,
    addLiquidity,
    removeLiquidity,
    isInitializing,
    isApproving,
    isAddingLiquidity,
    isRemovingLiquidity,
    error,
    resetError,
  } = useLiquidity()

  // Get pool state to check if initialized
  const { currentPrice, isInitialized, poolState, refetch } = useStateView(
    pool?.poolKey ?? ETH_USDC_POOL_KEY
  )

  // Get vanilla pool price as reference
  const { currentPrice: vanillaPrice, poolState: vanillaPoolState } = useStateView(ETH_USDC_POOL_KEY)

  // Get the sqrtPriceX96 for liquidity calculation
  const sqrtPriceX96 = poolState?.slot0?.sqrtPriceX96 ?? vanillaPoolState?.slot0?.sqrtPriceX96

  /**
   * Convert price to sqrtPriceX96 format
   * sqrtPriceX96 = sqrt(price) * 2^96
   * where price = token1/token0 (USDC per ETH)
   * Need to account for decimal difference: ETH has 18, USDC has 6
   */
  const priceToSqrtPriceX96 = (price: number): bigint => {
    // price is in USDC per ETH (e.g., 2500)
    // Adjust for decimal difference: multiply by 10^(6-18) = 10^-12
    const adjustedPrice = price / 1e12
    const sqrtPrice = Math.sqrt(adjustedPrice)
    const Q96 = BigInt(2) ** BigInt(96)
    // Convert to bigint with enough precision
    return BigInt(Math.floor(sqrtPrice * Number(Q96)))
  }

  const handleInitializePool = async () => {
    if (!pool || !initPrice) return

    resetError()

    const priceNum = parseFloat(initPrice)
    if (isNaN(priceNum) || priceNum <= 0) {
      return
    }

    // Use vanilla pool sqrtPriceX96 if available, otherwise calculate from input
    let sqrtPriceX96: bigint
    if (vanillaPoolState?.slot0?.sqrtPriceX96) {
      // Use the same price as the vanilla pool for consistency
      sqrtPriceX96 = vanillaPoolState.slot0.sqrtPriceX96
      console.log('Using vanilla pool sqrtPriceX96:', sqrtPriceX96.toString())
    } else {
      sqrtPriceX96 = priceToSqrtPriceX96(priceNum)
      console.log('Calculated sqrtPriceX96 from price:', sqrtPriceX96.toString())
    }

    const tx = await initializePool(pool.poolKey, sqrtPriceX96)
    if (tx) {
      // Refetch pool state after initialization
      setTimeout(() => refetch(), 2000)
    }
  }

  const handleEthChange = (value: string) => {
    setEthAmount(value)
    // Auto-calculate USDC based on current price (or vanilla price for uninitialized pools)
    const priceToUse = currentPrice || vanillaPrice

    console.log('handleEthChange:', {
      value,
      currentPrice,
      vanillaPrice,
      priceToUse,
      isInitialized,
    })

    if (priceToUse && value) {
      const ethNum = parseFloat(value)
      if (!isNaN(ethNum)) {
        const calculatedUsdc = (ethNum * priceToUse).toFixed(2)
        console.log('Auto-calculated USDC:', calculatedUsdc)
        setUsdcAmount(calculatedUsdc)
      }
    } else if (!value) {
      setUsdcAmount('')
    }
  }

  const handleUsdcChange = (value: string) => {
    setUsdcAmount(value)
    // Auto-calculate ETH based on current price (or vanilla price for uninitialized pools)
    const priceToUse = currentPrice || vanillaPrice
    if (priceToUse && value) {
      const usdcNum = parseFloat(value)
      if (!isNaN(usdcNum) && priceToUse > 0) {
        setEthAmount((usdcNum / priceToUse).toFixed(6))
      }
    } else if (!value) {
      setEthAmount('')
    }
  }

  // Calculate expected USDC for current ETH amount
  const priceToUse = currentPrice || vanillaPrice
  const expectedUsdc = priceToUse && ethAmount ? parseFloat(ethAmount) * priceToUse : 0
  const actualUsdc = parseFloat(usdcAmount) || 0

  // Check if ratio is off by more than 1%
  const ratioTolerance = 0.01 // 1% tolerance
  const ratioMismatch = expectedUsdc > 0 && Math.abs(actualUsdc - expectedUsdc) / expectedUsdc > ratioTolerance
  const ratioDeviation = expectedUsdc > 0 ? ((actualUsdc - expectedUsdc) / expectedUsdc * 100) : 0

  // Fix ratio to match pool price
  const handleFixRatio = () => {
    if (priceToUse && ethAmount) {
      const ethNum = parseFloat(ethAmount)
      if (!isNaN(ethNum)) {
        setUsdcAmount((ethNum * priceToUse).toFixed(2))
      }
    }
  }

  const handleAddLiquidity = async () => {
    if (!pool || !ethAmount || !usdcAmount) return

    resetError()

    // Double-check pool is initialized before proceeding
    if (!isInitialized) {
      console.error('Cannot add liquidity: pool not initialized', {
        poolKey: pool.poolKey,
        hasPrivacy: pool.hasPrivacy,
      })
      return
    }

    // Validate we have a valid price
    if (!sqrtPriceX96 || sqrtPriceX96 === 0n) {
      console.error('Cannot add liquidity: no valid price available')
      return
    }

    const ethWei = parseEther(ethAmount)
    const usdcWei = parseUnits(usdcAmount, 6)

    // Generate a unique salt for this position
    const salt = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`

    console.log('Attempting to add liquidity:', {
      pool: pool.id,
      hasPrivacy: pool.hasPrivacy,
      ethAmount: ethWei.toString(),
      usdcAmount: usdcWei.toString(),
      sqrtPriceX96: sqrtPriceX96.toString(),
      isInitialized,
      salt,
    })

    const tx = await addLiquidity({
      poolKey: pool.poolKey,
      amount0: ethWei,
      amount1: usdcWei,
      sqrtPriceX96,
      tickLower: FULL_RANGE_TICK_LOWER,
      tickUpper: FULL_RANGE_TICK_UPPER,
      hookData: '0x',
    })

    if (tx) {
      // Wait for transaction confirmation before refetching
      setIsWaitingConfirmation(true)
      try {
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: tx })
        }

        // Save position to local storage
        const liquidity = ethWei / BigInt(10 ** 6) // Same calculation as useLiquidity
        addPosition(poolId, pool.poolKey, liquidity, salt, tx)

        // Show success modal
        setSuccessDetails({
          type: 'add-liquidity',
          txHash: tx,
          ethAmount: ethAmount,
          usdcAmount: usdcAmount,
        })
        setShowSuccessModal(true)

        // Clear form
        setEthAmount('')
        setUsdcAmount('')
        // Refetch pool state after confirmation
        refetch()
        // Refetch again after a short delay to ensure state is updated
        setTimeout(() => refetch(), 3000)
      } catch (err) {
        console.error('Error waiting for confirmation:', err)
      } finally {
        setIsWaitingConfirmation(false)
      }
    }
  }

  // Handle remove liquidity
  const handleRemoveLiquidity = async () => {
    if (!pool || !positions.length || removePercent === 0) return

    resetError()

    // Calculate amount to remove based on percentage
    const amountToRemove = (totalLiquidity * BigInt(removePercent)) / 100n

    if (amountToRemove === 0n) {
      console.error('No liquidity to remove')
      return
    }

    // Get the first position's salt (for single position simplicity)
    const position = positions[0]

    console.log('Removing liquidity:', {
      pool: pool.id,
      percent: removePercent,
      amountToRemove: amountToRemove.toString(),
      totalLiquidity: totalLiquidity.toString(),
      salt: position.salt,
    })

    const tx = await removeLiquidity(
      pool.poolKey,
      amountToRemove,
      position.tickLower,
      position.tickUpper,
      position.salt,
      '0x'
    )

    if (tx) {
      setIsWaitingConfirmation(true)
      try {
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: tx })
        }

        // Update or remove position based on percentage
        if (removePercent === 100) {
          removePosition(position.id)
        } else {
          const remainingLiquidity = totalLiquidity - amountToRemove
          updatePositionLiquidity(position.id, remainingLiquidity)
        }

        // Show success modal
        setSuccessDetails({
          type: 'remove-liquidity',
          txHash: tx,
          ethAmount: removeEthAmount.toFixed(6),
          usdcAmount: removeUsdcAmount.toFixed(2),
        })
        setShowSuccessModal(true)

        // Reset form
        setRemovePercent(0)
        // Refetch pool state
        refetch()
        setTimeout(() => refetch(), 3000)
      } catch (err) {
        console.error('Error waiting for confirmation:', err)
      } finally {
        setIsWaitingConfirmation(false)
      }
    }
  }

  // Calculate user's position value
  const userTokenAmounts = priceToUse
    ? calculateTokenAmounts(totalLiquidity, priceToUse)
    : { ethAmount: 0, usdcAmount: 0 }

  // Calculate pool share (simplified - based on displayed liquidity)
  const poolLiquidity = poolState?.liquidity ?? 0n
  const poolShare = poolLiquidity > 0n && totalLiquidity > 0n
    ? (Number(totalLiquidity) / Number(poolLiquidity)) * 100
    : 0

  // Calculate amounts to receive based on remove percentage
  const removeEthAmount = (userTokenAmounts.ethAmount * removePercent) / 100
  const removeUsdcAmount = (userTokenAmounts.usdcAmount * removePercent) / 100

  const isLoading = isInitializing || isApproving || isAddingLiquidity || isRemovingLiquidity || isWaitingConfirmation
  const canAdd = isConnected && ethAmount && usdcAmount && !isLoading && isInitialized && !ratioMismatch
  const canRemove = isConnected && !isLoading && totalLiquidity > 0n && removePercent > 0
  const canInitialize = isConnected && !isLoading && !isInitialized && pool?.hasPrivacy

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Liquidity">
      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-lg bg-charcoal/50">
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'add'
                ? 'bg-arcane-purple text-ghost-white'
                : 'text-mist-gray hover:text-ghost-white'
            }`}
          >
            Add Liquidity
          </button>
          <button
            onClick={() => setActiveTab('remove')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'remove'
                ? 'bg-arcane-purple text-ghost-white'
                : 'text-mist-gray hover:text-ghost-white'
            }`}
          >
            Remove Liquidity
          </button>
        </div>

        {/* Pool Info */}
        {pool && (
          <div className="p-3 rounded-lg bg-charcoal/50 border border-arcane-purple/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-ghost-white">
                {pool.token0}/{pool.token1}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-obsidian text-mist-gray">
                {pool.fee}
              </span>
              {pool.hasPrivacy && (
                <div className="flex items-center gap-1 text-xs text-spectral-green">
                  <Shield className="w-3 h-3" />
                  Privacy
                </div>
              )}
              {isInitialized ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-spectral-green/20 text-spectral-green">
                  Active
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blood-crimson/20 text-blood-crimson">
                  Not Initialized
                </span>
              )}
            </div>
            {currentPrice ? (
              <p className="text-xs text-mist-gray">
                Current price: <span className="text-ghost-white">${currentPrice.toFixed(2)}</span> per ETH
              </p>
            ) : vanillaPrice ? (
              <p className="text-xs text-mist-gray">
                Reference price (vanilla pool): <span className="text-ghost-white">${vanillaPrice.toFixed(2)}</span> per ETH
              </p>
            ) : null}
          </div>
        )}

        {/* Pool Initialization Section (for uninitialized privacy pools) */}
        {pool?.hasPrivacy && !isInitialized && (
          <div className="p-4 rounded-lg bg-arcane-purple/10 border border-arcane-purple/30 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-ethereal-cyan flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-ghost-white">Pool Needs Initialization</p>
                <p className="text-xs text-mist-gray mt-1">
                  This privacy pool hasn't been created yet. Initialize it to start providing liquidity
                  with the same AMM mechanics as the vanilla ETH/USDC pool.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-mist-gray">Initial Price (USDC per ETH)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="2500"
                  value={initPrice}
                  onChange={(e) => setInitPrice(e.target.value)}
                  className="flex-1"
                />
                {vanillaPrice && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setInitPrice(vanillaPrice.toFixed(2))}
                  >
                    Use Vanilla Price
                  </Button>
                )}
              </div>
              <p className="text-xs text-mist-gray">
                {vanillaPrice
                  ? `Vanilla pool price: $${vanillaPrice.toFixed(2)}`
                  : 'Enter the initial ETH price in USDC'}
              </p>
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={handleInitializePool}
              disabled={!canInitialize || !initPrice}
            >
              {isInitializing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initializing Pool...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Initialize Privacy Pool
                </>
              )}
            </Button>
          </div>
        )}

        {/* ADD LIQUIDITY TAB */}
        {activeTab === 'add' && (
          <>
            {/* Required Ratio Info */}
            {isInitialized && priceToUse && (
              <div className="p-3 rounded-lg bg-arcane-purple/10 border border-arcane-purple/20">
                <p className="text-xs text-mist-gray">
                  <span className="text-ethereal-cyan font-medium">Required Ratio at Current Price</span>
                </p>
                <p className="text-sm text-ghost-white mt-1 font-mono">
                  1 ETH = {priceToUse.toFixed(2)} USDC
                </p>
                <p className="text-xs text-mist-gray mt-1">
                  Both tokens must be provided in this ratio to add liquidity efficiently.
                </p>
              </div>
            )}

            {/* ETH Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-mist-gray">ETH Amount</label>
            <span className="text-xs text-mist-gray">
              Balance: {parseFloat(ethBalance).toFixed(4)} ETH
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.0"
              value={ethAmount}
              onChange={(e) => handleEthChange(e.target.value)}
              className="pr-16"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={() => handleEthChange(ethBalance)}
                className="text-xs text-ethereal-cyan hover:text-ethereal-cyan/80"
              >
                MAX
              </button>
              <span className="text-sm font-medium text-ghost-white">ETH</span>
            </div>
          </div>
        </div>

        {/* Plus icon */}
        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-full bg-charcoal flex items-center justify-center">
            <Plus className="w-4 h-4 text-mist-gray" />
          </div>
        </div>

        {/* USDC Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-mist-gray">USDC Amount</label>
            <span className="text-xs text-mist-gray">
              Balance: {parseFloat(usdcBalance).toFixed(2)} USDC
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.0"
              value={usdcAmount}
              onChange={(e) => handleUsdcChange(e.target.value)}
              className="pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={() => handleUsdcChange(usdcBalance)}
                className="text-xs text-ethereal-cyan hover:text-ethereal-cyan/80"
              >
                MAX
              </button>
              <span className="text-sm font-medium text-ghost-white">USDC</span>
            </div>
          </div>
        </div>

        {/* Ratio Mismatch Warning */}
        {ratioMismatch && ethAmount && usdcAmount && (
          <div className="p-3 rounded-lg bg-blood-crimson/10 border border-blood-crimson/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blood-crimson flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blood-crimson">Token Ratio Mismatch</p>
                <p className="text-xs text-mist-gray mt-1">
                  Your ratio is off by <span className="text-blood-crimson font-medium">{Math.abs(ratioDeviation).toFixed(1)}%</span> from the pool price.
                  <br />
                  Expected: <span className="text-ghost-white">{expectedUsdc.toFixed(2)} USDC</span> for {ethAmount} ETH
                  <br />
                  You entered: <span className="text-ghost-white">{actualUsdc.toFixed(2)} USDC</span>
                </p>
                <p className="text-xs text-blood-crimson mt-2">
                  ⚠️ Adding liquidity with wrong ratio will result in lost value!
                </p>
                <button
                  onClick={handleFixRatio}
                  className="mt-2 text-xs px-3 py-1.5 rounded bg-ethereal-cyan/20 text-ethereal-cyan hover:bg-ethereal-cyan/30 transition-colors"
                >
                  Fix Ratio (Use {expectedUsdc.toFixed(2)} USDC)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Correct Ratio Indicator */}
        {!ratioMismatch && ethAmount && usdcAmount && priceToUse && (
          <div className="p-3 rounded-lg bg-spectral-green/10 border border-spectral-green/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-spectral-green" />
              <p className="text-xs text-spectral-green">
                Ratio matches pool price: 1 ETH = ${priceToUse.toFixed(2)} USDC
              </p>
            </div>
          </div>
        )}

        {/* Price range info */}
        <div className="p-3 rounded-lg bg-ethereal-cyan/5 border border-ethereal-cyan/20">
          <p className="text-xs text-mist-gray">
            <span className="text-ethereal-cyan font-medium">Full Range Position</span>
            <br />
            Your liquidity will be spread across all price levels.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-blood-crimson/10 border border-blood-crimson/30 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blood-crimson flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blood-crimson">{error}</p>
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <Button variant="primary" className="w-full" disabled>
            Connect Wallet
          </Button>
        ) : pool?.hasPrivacy && !isInitialized ? (
          <Button variant="secondary" className="w-full" disabled>
            <AlertCircle className="w-4 h-4 mr-2" />
            Initialize Pool First
          </Button>
        ) : ratioMismatch ? (
          <Button variant="secondary" className="w-full" disabled>
            <AlertCircle className="w-4 h-4 mr-2" />
            Fix Token Ratio First
          </Button>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleAddLiquidity}
            disabled={!canAdd}
          >
            {isApproving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Approving USDC...
              </>
            ) : isAddingLiquidity ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding Liquidity...
              </>
            ) : isWaitingConfirmation ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Waiting for Confirmation...
              </>
            ) : (
              <>
                <Droplets className="w-4 h-4 mr-2" />
                Add Liquidity
              </>
            )}
          </Button>
        )}

            {/* Disclaimer */}
            <p className="text-xs text-mist-gray text-center">
              You will receive LP tokens representing your share of the pool.
            </p>
          </>
        )}

        {/* REMOVE LIQUIDITY TAB */}
        {activeTab === 'remove' && (
          <>
            {/* Your Position */}
            <div className="p-4 rounded-xl bg-charcoal/50 border border-arcane-purple/20 space-y-3">
              <h3 className="text-sm font-medium text-ghost-white">Your Position</h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-obsidian/50">
                  <p className="text-xs text-mist-gray">LP Tokens</p>
                  <p className="text-lg font-mono text-ghost-white">
                    {totalLiquidity > 0n ? (Number(totalLiquidity) / 1e12).toFixed(4) : '0'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-obsidian/50">
                  <p className="text-xs text-mist-gray">Pool Share</p>
                  <p className="text-lg font-mono text-ghost-white">
                    {poolShare.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-obsidian/50">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={ETH.logoURI} alt="ETH" className="w-5 h-5" />
                    <span className="text-xs text-mist-gray">ETH</span>
                  </div>
                  <p className="text-sm font-mono text-ghost-white">
                    {userTokenAmounts.ethAmount.toFixed(6)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-obsidian/50">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={USDC.logoURI} alt="USDC" className="w-5 h-5" />
                    <span className="text-xs text-mist-gray">USDC</span>
                  </div>
                  <p className="text-sm font-mono text-ghost-white">
                    {userTokenAmounts.usdcAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Remove Liquidity Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-mist-gray">Remove Liquidity</span>
                <span className="text-lg font-mono text-ethereal-cyan">{removePercent}%</span>
              </div>

              {/* Percentage Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    onClick={() => setRemovePercent(percent)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      removePercent === percent
                        ? 'bg-arcane-purple text-ghost-white'
                        : 'bg-charcoal/50 text-mist-gray hover:bg-charcoal hover:text-ghost-white'
                    }`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>

              {/* Custom Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={removePercent}
                onChange={(e) => setRemovePercent(parseInt(e.target.value))}
                className="w-full h-2 bg-charcoal rounded-lg appearance-none cursor-pointer accent-arcane-purple"
              />
            </div>

            {/* You Will Receive */}
            <div className="p-4 rounded-xl bg-arcane-purple/10 border border-arcane-purple/20 space-y-3">
              <h3 className="text-sm font-medium text-ghost-white">You will receive:</h3>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={ETH.logoURI} alt="ETH" className="w-6 h-6" />
                  <span className="text-mist-gray">ETH</span>
                </div>
                <span className="text-lg font-mono text-ghost-white">
                  {removeEthAmount.toFixed(6)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={USDC.logoURI} alt="USDC" className="w-6 h-6" />
                  <span className="text-mist-gray">USDC</span>
                </div>
                <span className="text-lg font-mono text-ghost-white">
                  {removeUsdcAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* No Position Warning */}
            {totalLiquidity === 0n && (
              <div className="p-3 rounded-lg bg-charcoal/50 border border-arcane-purple/10">
                <p className="text-sm text-mist-gray text-center">
                  You don't have any liquidity positions to remove.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-blood-crimson/10 border border-blood-crimson/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blood-crimson flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blood-crimson">{error}</p>
              </div>
            )}

            {/* Remove Button */}
            {!isConnected ? (
              <Button variant="primary" className="w-full" disabled>
                Connect Wallet
              </Button>
            ) : (
              <Button
                variant="primary"
                className="w-full"
                onClick={handleRemoveLiquidity}
                disabled={!canRemove}
              >
                {isRemovingLiquidity ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Removing Liquidity...
                  </>
                ) : isWaitingConfirmation ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Waiting for Confirmation...
                  </>
                ) : totalLiquidity === 0n ? (
                  'No Position to Remove'
                ) : removePercent === 0 ? (
                  'Select Amount to Remove'
                ) : (
                  <>
                    <Droplets className="w-4 h-4 mr-2" />
                    Remove {removePercent}% Liquidity
                  </>
                )}
              </Button>
            )}
          </>
        )}

      </div>

      {/* Success Modal */}
      {successDetails && (
        <TransactionSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false)
            setSuccessDetails(null)
          }}
          details={{
            type: successDetails.type,
            txHash: successDetails.txHash,
            fromToken: 'ETH',
            toToken: 'USDC',
            fromAmount: successDetails.ethAmount,
            toAmount: successDetails.usdcAmount,
            fromLogo: ETH.logoURI,
            toLogo: USDC.logoURI,
            poolName: pool?.hasPrivacy ? 'ETH/USDC GrimSwap' : 'ETH/USDC',
          }}
          explorerBaseUrl="https://unichain-sepolia.blockscout.com"
        />
      )}
    </Modal>
  )
}

export function PoolsPage() {
  const pageRef = useRef<HTMLDivElement>(null)

  const [selectedPool, setSelectedPool] = useState<PoolInfo | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statsPool, setStatsPool] = useState<PoolInfo | null>(null)
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false)

  // Fetch stats for both pools
  const { poolState: vanillaState, isInitialized: vanillaInit, currentPrice: vanillaPrice } = useStateView(ETH_USDC_POOL_KEY)
  const { poolState: grimState, isInitialized: grimInit, currentPrice: grimPrice } = useStateView(ETH_USDC_GRIMSWAP_POOL_KEY)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.pool-element', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
      })
    }, pageRef)

    return () => ctx.revert()
  }, [])

  const handleAddLiquidity = (pool: PoolInfo) => {
    setSelectedPool(pool)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedPool(null)
  }

  const handleViewStats = (pool: PoolInfo) => {
    setStatsPool(pool)
    setIsStatsModalOpen(true)
  }

  const handleCloseStatsModal = () => {
    setIsStatsModalOpen(false)
    setStatsPool(null)
  }

  // Calculate TVL for a pool from liquidity and price
  const calculatePoolTVL = (liquidity: bigint | undefined, price: number | null): number => {
    if (!liquidity || liquidity === 0n || !price || price <= 0) return 0

    const liqNum = Number(liquidity)
    // Convert price to raw ratio (accounting for decimal difference)
    // price is USDC per ETH (e.g., 4000)
    const rawPrice = price / 1e12
    const sqrtRawPrice = Math.sqrt(rawPrice)

    // Virtual reserves
    const ethReserveWei = liqNum / sqrtRawPrice
    const usdcReserveUnits = liqNum * sqrtRawPrice

    // Convert to human-readable
    const ethReserve = ethReserveWei / 1e18
    const usdcReserve = usdcReserveUnits / 1e6

    // Calculate TVL in USD
    const ethValue = ethReserve * price
    return ethValue + usdcReserve
  }

  // Calculate TVL for each pool
  const vanillaTVL = calculatePoolTVL(vanillaState?.liquidity, vanillaPrice)
  const grimTVL = calculatePoolTVL(grimState?.liquidity, grimPrice)
  const totalTVL = vanillaTVL + grimTVL

  const privacyPoolsCount = grimInit ? 1 : 0
  const activePoolsCount = (vanillaInit ? 1 : 0) + (grimInit ? 1 : 0)

  // Format TVL for display
  const formatTVL = (tvl: number): string => {
    if (tvl === 0) return '—'
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`
    return `$${tvl.toFixed(2)}`
  }

  return (
    <div ref={pageRef} className="min-h-[calc(100vh-5rem)] py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="pool-element flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ghost-white mb-2">
              Liquidity Pools
            </h1>
            <p className="text-mist-gray">
              Provide liquidity to Uniswap v4 pools on Unichain Sepolia
            </p>
          </div>
          <Button
            variant="primary"
            className="sm:w-auto"
            onClick={() => handleAddLiquidity(POOLS[1])} // Default to GrimSwap pool
          >
            <Plus className="w-4 h-4 mr-2" />
            New Position
          </Button>
        </div>

        {/* Info Banner */}
        <div className="pool-element p-4 rounded-xl bg-arcane-purple/10 border border-arcane-purple/20">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-ethereal-cyan flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-ghost-white mb-1">GrimSwap Privacy Pools</h3>
              <p className="text-sm text-mist-gray">
                Pools with the <span className="text-spectral-green">Privacy</span> badge use the GrimSwapZK hook
                for enhanced transaction privacy through ZK proofs. Your swaps and liquidity positions
                benefit from our privacy-preserving matchmaking system.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="pool-element grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card glow="purple">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-mist-gray mb-1">Total Value Locked</p>
              <p className="text-2xl font-mono text-ghost-white">
                {formatTVL(totalTVL)}
              </p>
            </CardContent>
          </Card>
          <Card glow="green">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-mist-gray mb-1">Active Pools</p>
              <p className="text-2xl font-mono text-ghost-white">{activePoolsCount}</p>
            </CardContent>
          </Card>
          <Card glow="cyan">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-mist-gray mb-1">Privacy Pools</p>
              <p className="text-2xl font-mono text-ghost-white">{privacyPoolsCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pool List */}
        <div className="pool-element space-y-4">
          <h2 className="font-display text-xl text-ghost-white">Available Pools</h2>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-6 gap-4 px-4 py-2 text-sm text-mist-gray">
            <div className="col-span-2">Pool</div>
            <div>TVL</div>
            <div>Price</div>
            <div>Status</div>
            <div></div>
          </div>

          {/* Pool Rows */}
          {POOLS.map((pool) => (
            <PoolRow
              key={pool.id}
              pool={pool}
              onAddLiquidity={handleAddLiquidity}
              onViewStats={handleViewStats}
            />
          ))}
        </div>

        {/* Contract Info */}
        <div className="pool-element p-4 rounded-xl bg-charcoal/30 border border-arcane-purple/10">
          <h3 className="font-medium text-ghost-white mb-3">Contract Addresses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-mist-gray mb-1">PoolModifyLiquidityTest</p>
              <a
                href={`https://unichain-sepolia.blockscout.com/address/${CONTRACTS.poolModifyLiquidityTest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-ethereal-cyan hover:underline break-all"
              >
                {CONTRACTS.poolModifyLiquidityTest}
              </a>
            </div>
            <div>
              <p className="text-mist-gray mb-1">GrimSwapZK Hook</p>
              <a
                href={`https://unichain-sepolia.blockscout.com/address/${CONTRACTS.grimSwapZK}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-ethereal-cyan hover:underline break-all"
              >
                {CONTRACTS.grimSwapZK}
              </a>
            </div>
            <div>
              <p className="text-mist-gray mb-1">StateView</p>
              <a
                href={`https://unichain-sepolia.blockscout.com/address/${CONTRACTS.stateView}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-ethereal-cyan hover:underline break-all"
              >
                {CONTRACTS.stateView}
              </a>
            </div>
            <div>
              <p className="text-mist-gray mb-1">PoolManager</p>
              <a
                href={`https://unichain-sepolia.blockscout.com/address/${CONTRACTS.poolManager}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-ethereal-cyan hover:underline break-all"
              >
                {CONTRACTS.poolManager}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Add Liquidity Modal */}
      {/* Add Liquidity Modal */}
      <AddLiquidityModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        pool={selectedPool}
      />

      {/* Pool Stats Modal */}
      <PoolStatsModal
        isOpen={isStatsModalOpen}
        onClose={handleCloseStatsModal}
        pool={statsPool}
      />
    </div>
  )
}
