import { useState, useEffect } from 'react'
import { type Address } from 'viem'
import {
  getTokenPrice,
  getTokenPrices,
  type TokenPrice,
  formatUsdPrice,
  formatPriceChange,
  calculateUsdValue,
} from '@/lib/coingecko'

/**
 * Hook to fetch and track a single token price
 */
export function useTokenPrice(tokenAddress: Address | null) {
  const [price, setPrice] = useState<TokenPrice | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tokenAddress) {
      setPrice(null)
      return
    }

    let cancelled = false

    const fetchPrice = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await getTokenPrice(tokenAddress)
        if (!cancelled) {
          if (result) {
            setPrice(result)
          } else {
            setError('Price not available')
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch price')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchPrice()

    // Refresh every 60 seconds
    const interval = setInterval(fetchPrice, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [tokenAddress])

  return {
    price,
    loading,
    error,
    priceUsd: price?.usd ?? null,
    priceChange: price?.usd_24h_change ?? null,
    formatted: price ? formatUsdPrice(price.usd) : null,
    changeFormatted: price ? formatPriceChange(price.usd_24h_change) : null,
  }
}

/**
 * Hook to fetch and track multiple token prices
 */
export function useTokenPrices(tokenAddresses: Address[]) {
  const [prices, setPrices] = useState<Map<Address, TokenPrice>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (tokenAddresses.length === 0) {
      setPrices(new Map())
      return
    }

    let cancelled = false

    const fetchPrices = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await getTokenPrices(tokenAddresses)
        if (!cancelled) {
          setPrices(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch prices')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchPrices()

    // Refresh every 60 seconds
    const interval = setInterval(fetchPrices, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [tokenAddresses.join(',')])

  const getPrice = (address: Address): TokenPrice | null => {
    return prices.get(address) || null
  }

  const getPriceUsd = (address: Address): number | null => {
    return prices.get(address)?.usd ?? null
  }

  return {
    prices,
    loading,
    error,
    getPrice,
    getPriceUsd,
  }
}

/**
 * Hook to calculate USD value of token amount
 */
export function useTokenValue(
  tokenAddress: Address | null,
  amount: bigint | null,
  decimals: number = 18
) {
  const { priceUsd } = useTokenPrice(tokenAddress)

  if (!priceUsd || !amount) return null

  return calculateUsdValue(amount, decimals, priceUsd)
}
