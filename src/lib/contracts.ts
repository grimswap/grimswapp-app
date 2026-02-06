import { type Address } from 'viem'
import { CONTRACTS, CONTRACTS_V3, V3_POOL_CONFIG, V3_SQRT_PRICE_LIMITS } from './constants'
import {
  GRIM_POOL_ABI,
  GRIM_SWAP_ZK_ABI,
  GROTH16_VERIFIER_ABI,
  GRIM_SWAP_ROUTER_ABI,
} from '@grimswap/circuits'

// Import Uniswap v4 ABIs (keep local for now as SDK doesn't include these)
import PoolManagerABI from './PoolManager_ABI.json'
import StateViewABI from './StateView_ABI.json'
import QuoterABI from './Quoter_ABI.json'
import PoolModifyLiquidityTestABI from './PoolModifyLiquidityTest_ABI.json'

// Contract configurations using SDK ABIs
export const grimPoolConfig = {
  address: CONTRACTS.grimPool,
  abi: GRIM_POOL_ABI,
} as const

export const grimSwapZKConfig = {
  address: CONTRACTS.grimSwapZK,
  abi: GRIM_SWAP_ZK_ABI,
} as const

export const groth16VerifierConfig = {
  address: CONTRACTS.groth16Verifier,
  abi: GROTH16_VERIFIER_ABI,
} as const

export const grimSwapRouterConfig = {
  address: CONTRACTS.grimSwapRouter,
  abi: GRIM_SWAP_ROUTER_ABI,
} as const

export const poolManagerConfig = {
  address: CONTRACTS.poolManager,
  abi: PoolManagerABI,
} as const

export const stateViewConfig = {
  address: CONTRACTS.stateView,
  abi: StateViewABI,
} as const

export const quoterConfig = {
  address: CONTRACTS.quoter,
  abi: QuoterABI,
} as const

export const poolModifyLiquidityTestConfig = {
  address: CONTRACTS.poolModifyLiquidityTest,
  abi: PoolModifyLiquidityTestABI,
} as const

// Pool Helper ABI (minimal for initializePool and swap)
export const poolHelperABI = [
  {
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
    name: 'initializePool',
    outputs: [{ name: 'tick', type: 'int24' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'zeroForOne', type: 'bool' },
      { name: 'amountSpecified', type: 'int256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
      { name: 'hookData', type: 'bytes' },
    ],
    name: 'swap',
    outputs: [{ name: 'delta', type: 'int256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

export const poolHelperConfig = {
  address: CONTRACTS.poolHelper,
  abi: poolHelperABI,
} as const

// ERC-5564 Stealth Address ABIs
export const stealthRegistryABI = [
  {
    inputs: [
      { name: 'schemeId', type: 'uint256' },
      { name: 'stealthMetaAddress', type: 'bytes' },
    ],
    name: 'registerKeys',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'registrant', type: 'address' },
      { name: 'schemeId', type: 'uint256' },
    ],
    name: 'stealthMetaAddressOf',
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const announcerABI = [
  {
    anonymous: true,
    inputs: [
      { indexed: true, name: 'schemeId', type: 'uint256' },
      { indexed: true, name: 'stealthAddress', type: 'address' },
      { indexed: false, name: 'caller', type: 'address' },
      { indexed: false, name: 'ephemeralPubKey', type: 'bytes' },
      { indexed: false, name: 'metadata', type: 'bytes' },
    ],
    name: 'Announcement',
    type: 'event',
  },
] as const

export const stealthRegistryConfig = {
  address: CONTRACTS.stealthRegistry,
  abi: stealthRegistryABI,
} as const

export const announcerConfig = {
  address: CONTRACTS.announcer,
  abi: announcerABI,
} as const

// ERC20 ABI (for token approvals and balances)
export const erc20ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// Helper function to get ERC20 contract config
export const getERC20Config = (tokenAddress: Address) => ({
  address: tokenAddress,
  abi: erc20ABI,
})

// Uniswap v4 Pool Key structure
export interface PoolKey {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

// ETH/USDC pool key (vanilla Uniswap pool on Unichain Sepolia)
// Native ETH (0x000...000) < USDC (0x31d...), so ETH is currency0
export const ETH_USDC_POOL_KEY: PoolKey = {
  currency0: CONTRACTS.nativeEth, // ETH
  currency1: CONTRACTS.usdc,       // USDC
  fee: 3000,                       // 0.3% fee tier
  tickSpacing: 60,
  hooks: '0x0000000000000000000000000000000000000000' as Address, // No hooks (vanilla Uniswap)
}

// V3 ETH/USDC GrimSwap Privacy Pool (with ZK hook)
// Uses fee=500 (0.05%), tickSpacing=10 for the new V3 pool
export const ETH_USDC_GRIMSWAP_POOL_KEY_V3: PoolKey = {
  currency0: CONTRACTS_V3.nativeEth, // ETH
  currency1: CONTRACTS_V3.usdc,       // USDC
  fee: V3_POOL_CONFIG.fee,            // 0.05% fee tier (V3)
  tickSpacing: V3_POOL_CONFIG.tickSpacing, // 10 (V3)
  hooks: CONTRACTS_V3.grimSwapZK,     // V3 GrimSwapZK hook
}

// Legacy V2 ETH/USDC pool key with GrimSwapZK hook (kept for reference)
export const ETH_USDC_GRIMSWAP_POOL_KEY: PoolKey = ETH_USDC_GRIMSWAP_POOL_KEY_V3

// Default pool key - uses V3 configuration
export const DEFAULT_POOL_KEY: PoolKey = ETH_USDC_GRIMSWAP_POOL_KEY_V3

// V3 Sqrt price limits for swaps (from relayer docs)
export const MIN_SQRT_PRICE = V3_SQRT_PRICE_LIMITS.MIN  // ETH → USDC
export const MAX_SQRT_PRICE = V3_SQRT_PRICE_LIMITS.MAX  // USDC → ETH

/**
 * Get the correct sqrt price limit based on swap direction
 * @param zeroForOne - true if swapping token0 (ETH) for token1 (USDC)
 */
export function getSqrtPriceLimitX96(zeroForOne: boolean): bigint {
  return zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE
}

/**
 * Determine swap direction based on token addresses
 * @param fromToken - Token being sold
 * @param _toToken - Token being bought (kept for API clarity)
 * @param poolKey - Pool key for the swap
 */
export function getSwapDirection(
  fromToken: Address,
  _toToken: Address,
  poolKey: PoolKey = DEFAULT_POOL_KEY
): { zeroForOne: boolean; sqrtPriceLimitX96: bigint } {
  const zeroForOne = fromToken.toLowerCase() === poolKey.currency0.toLowerCase()
  return {
    zeroForOne,
    sqrtPriceLimitX96: getSqrtPriceLimitX96(zeroForOne),
  }
}

/**
 * Check if a token is native ETH
 */
export function isNativeToken(tokenAddress: Address): boolean {
  return tokenAddress.toLowerCase() === CONTRACTS.nativeEth.toLowerCase()
}

// Export all contract addresses
export { CONTRACTS }
