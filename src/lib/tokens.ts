import { type Address } from 'viem'

export interface Token {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  isNative?: boolean
  color?: string
}

// Native ETH representation
export const ETH: Token = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  isNative: true,
  color: '#627EEA',
}

// Common tokens on Unichain Sepolia (mock addresses for testnet)
export const TOKENS: Token[] = [
  ETH,
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    color: '#2775CA',
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    color: '#50AF95',
  },
  {
    address: '0x6B175474E89094C44Da98b954EescdeCB5BE3D00',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    color: '#F5AC37',
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    color: '#F7931A',
  },
  {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    color: '#627EEA',
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    color: '#FF007A',
  },
  {
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    color: '#2A5ADA',
  },
  {
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    symbol: 'AAVE',
    name: 'Aave',
    decimals: 18,
    color: '#B6509E',
  },
  {
    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    symbol: 'MKR',
    name: 'Maker',
    decimals: 18,
    color: '#1AAB9B',
  },
]

// Default tokens for swap
export const DEFAULT_FROM_TOKEN = ETH
export const DEFAULT_TO_TOKEN = TOKENS[1] // USDC

// Get token by symbol
export function getTokenBySymbol(symbol: string): Token | undefined {
  return TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase())
}

// Get token by address
export function getTokenByAddress(address: Address): Token | undefined {
  return TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
}

// Format token amount for display
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals: number = 4
): string {
  const divisor = BigInt(10 ** decimals)
  const integerPart = amount / divisor
  const fractionalPart = amount % divisor

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  const displayFractional = fractionalStr.slice(0, displayDecimals)

  if (displayFractional === '0'.repeat(displayDecimals)) {
    return integerPart.toString()
  }

  return `${integerPart}.${displayFractional.replace(/0+$/, '')}`
}

// Parse token amount from string
export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === '') return BigInt(0)

  const [integerPart, fractionalPart = ''] = amount.split('.')
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals)

  return BigInt(integerPart + paddedFractional)
}
