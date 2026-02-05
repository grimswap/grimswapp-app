import { type Address } from 'viem'
import { CONTRACTS } from './constants'
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

// ETH/USDC pool key with GrimSwapZK hook (privacy-enabled pool)
// NOTE: Using fee=500, tickSpacing=10 which is compatible with the deployed hook
export const ETH_USDC_GRIMSWAP_POOL_KEY: PoolKey = {
  currency0: CONTRACTS.nativeEth, // ETH
  currency1: CONTRACTS.usdc,       // USDC
  fee: 500,                        // 0.05% fee tier
  tickSpacing: 10,
  hooks: CONTRACTS.grimSwapZK,     // GrimSwapZK hook for privacy
}

// Default pool key (ETH/USDC GrimSwap Privacy Pool for private swaps)
export const DEFAULT_POOL_KEY: PoolKey = ETH_USDC_GRIMSWAP_POOL_KEY

// Sqrt price limits for swaps
export const MIN_SQRT_PRICE = BigInt('4295128739') + BigInt(1)
export const MAX_SQRT_PRICE = BigInt('1461446703485210103287273052203988822378723970342') - BigInt(1)

// Export all contract addresses
export { CONTRACTS }
