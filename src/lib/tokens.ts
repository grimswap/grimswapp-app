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

// USDC on Unichain Sepolia
export const USDC: Token = {
  address: '0x31d0220469e10c4E71834a79b1f276d740d3768F',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  color: '#2775CA',
}

// Unichain Sepolia Test Tokens (deployed for GrimSwap)
export const TOKEN_A: Token = {
  address: '0x48bA64b5312AFDfE4Fc96d8F03010A0a86e17963',
  symbol: 'PTA',
  name: 'Pool Test Token A',
  decimals: 18,
  color: '#7B3FE4',
}

export const TOKEN_B: Token = {
  address: '0x96aC37889DfDcd4dA0C898a5c9FB9D17ceD60b1B',
  symbol: 'PTB',
  name: 'Pool Test Token B',
  decimals: 18,
  color: '#00D632',
}

// Available tokens on Unichain Sepolia
export const TOKENS: Token[] = [
  ETH,
  USDC,
  TOKEN_A,
  TOKEN_B,
]

// Default tokens for swap (ETH -> USDC - real Uniswap pool)
export const DEFAULT_FROM_TOKEN = ETH
export const DEFAULT_TO_TOKEN = USDC

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
