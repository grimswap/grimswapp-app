import { useState, useEffect, useCallback } from 'react'

export interface SwapSettings {
  slippageTolerance: number // percentage, e.g., 0.5 = 0.5%
  transactionDeadline: number // minutes
  expertMode: boolean
  disableMultihops: boolean
}

export interface AppSettings {
  swap: SwapSettings
  favoriteTokens: string[] // token addresses
  recentTokens: string[] // token addresses
  hideSmallBalances: boolean
  showTestnets: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  swap: {
    slippageTolerance: 0.5,
    transactionDeadline: 20,
    expertMode: false,
    disableMultihops: false,
  },
  favoriteTokens: [
    '0x0000000000000000000000000000000000000000', // ETH
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  ],
  recentTokens: [],
  hideSmallBalances: false,
  showTestnets: true,
}

const STORAGE_KEY = 'grimswap-settings'

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        swap: {
          ...DEFAULT_SETTINGS.swap,
          ...parsed.swap,
        },
      }
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }

  return DEFAULT_SETTINGS
}

function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings())
    setIsLoaded(true)
  }, [])

  // Save settings when they change
  useEffect(() => {
    if (isLoaded) {
      saveSettings(settings)
    }
  }, [settings, isLoaded])

  const updateSwapSettings = useCallback((updates: Partial<SwapSettings>) => {
    setSettings((prev) => ({
      ...prev,
      swap: {
        ...prev.swap,
        ...updates,
      },
    }))
  }, [])

  const setSlippage = useCallback((slippage: number) => {
    updateSwapSettings({ slippageTolerance: slippage })
  }, [updateSwapSettings])

  const setDeadline = useCallback((deadline: number) => {
    updateSwapSettings({ transactionDeadline: deadline })
  }, [updateSwapSettings])

  const toggleExpertMode = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      swap: {
        ...prev.swap,
        expertMode: !prev.swap.expertMode,
      },
    }))
  }, [])

  const addFavoriteToken = useCallback((address: string) => {
    setSettings((prev) => ({
      ...prev,
      favoriteTokens: prev.favoriteTokens.includes(address)
        ? prev.favoriteTokens
        : [...prev.favoriteTokens, address],
    }))
  }, [])

  const removeFavoriteToken = useCallback((address: string) => {
    setSettings((prev) => ({
      ...prev,
      favoriteTokens: prev.favoriteTokens.filter((a) => a !== address),
    }))
  }, [])

  const addRecentToken = useCallback((address: string) => {
    setSettings((prev) => {
      const filtered = prev.recentTokens.filter((a) => a !== address)
      return {
        ...prev,
        recentTokens: [address, ...filtered].slice(0, 10), // Keep last 10
      }
    })
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return {
    settings,
    isLoaded,
    updateSwapSettings,
    setSlippage,
    setDeadline,
    toggleExpertMode,
    addFavoriteToken,
    removeFavoriteToken,
    addRecentToken,
    resetSettings,
  }
}
