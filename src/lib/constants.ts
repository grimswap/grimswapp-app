import { type Address } from 'viem'
import { RELAYER_DEFAULT_URL } from '@grimswap/circuits'

// Unichain Sepolia (Chain ID: 1301)
export const UNICHAIN_SEPOLIA = {
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://unichain-sepolia.blockscout.com',
    },
  },
} as const

// Relayer API URL (from SDK)
export const RELAYER_URL = RELAYER_DEFAULT_URL

// V3 Contract Addresses (Multi-Token Support)
export const CONTRACTS_V3 = {
  // GrimSwap V3 Contracts
  grimPoolMultiToken: '0x6777cfe2A72669dA5a8087181e42CA3dB29e7710' as Address,
  grimSwapZK: '0x6AFe3f3B81d6a22948800C924b2e9031e76E00C4' as Address,
  grimSwapRouterV2: '0x5EE78E89A0d5B4669b05aC8B7D7ea054a08f555f' as Address,
  groth16Verifier: '0xF7D14b744935cE34a210D7513471a8E6d6e696a0' as Address,

  // Uniswap v4 Core
  poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
  poolSwapTest: '0x9140a78c1A137c7fF1c151EC8231272aF78a99A4' as Address,

  // Tokens
  usdc: '0x31d0220469e10c4E71834a79b1f276d740d3768F' as Address,
  nativeEth: '0x0000000000000000000000000000000000000000' as Address,
} as const

// V3 Pool Configuration
export const V3_POOL_CONFIG = {
  fee: 500,        // 0.05% fee tier
  tickSpacing: 10,
} as const

// V3 Swap Price Limits
export const V3_SQRT_PRICE_LIMITS = {
  // ETH → USDC (zeroForOne = true)
  MIN: BigInt('4295128740'),
  // USDC → ETH (zeroForOne = false)
  MAX: BigInt('1461446703485210103287273052203988822378723970341'),
} as const

// Contract Addresses (combined legacy + V3)
export const CONTRACTS = {
  // V3 Primary Contracts (use these for new integrations)
  grimPool: CONTRACTS_V3.grimPoolMultiToken,
  grimPoolMultiToken: CONTRACTS_V3.grimPoolMultiToken,
  groth16Verifier: CONTRACTS_V3.groth16Verifier,
  grimSwapZK: CONTRACTS_V3.grimSwapZK,
  grimSwapRouter: CONTRACTS_V3.grimSwapRouterV2,
  grimSwapRouterV2: CONTRACTS_V3.grimSwapRouterV2,

  // Uniswap v4 Core
  poolManager: CONTRACTS_V3.poolManager,

  // Uniswap v4 Periphery
  stateView: '0xc199f1072a74d4e905aba1a84d9a45e2546b6222' as Address,
  quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  positionManager: '0xf969aee60879c54baaed9f3ed26147db216fd664' as Address,
  universalRouter: '0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d' as Address,
  poolSwapTest: CONTRACTS_V3.poolSwapTest,
  poolModifyLiquidityTest: '0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab' as Address,
  poolHelper: '0x0f8113EfA5527346978534192a76C94a567cae42' as Address,

  // L2 Contracts
  weth9: '0x4200000000000000000000000000000000000006' as Address,
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  swapRouter02: '0x9e5a52f57b3038f1b8eee45f28b3c1967e22799c' as Address,

  // Stealth Address Support
  stealthRegistry: '0xA9e4ED4183b3B3cC364cF82dA7982D5ABE956307' as Address,
  announcer: '0x42013A72753F6EC28e27582D4cDb8425b44fd311' as Address,

  // Test Tokens
  tokenA: '0x48bA64b5312AFDfE4Fc96d8F03010A0a86e17963' as Address,
  tokenB: '0x96aC37889DfDcd4dA0C898a5c9FB9D17ceD60b1B' as Address,

  // Real Unichain Sepolia Tokens
  usdc: CONTRACTS_V3.usdc,
  nativeEth: CONTRACTS_V3.nativeEth,
} as const

// Merkle tree configuration
export const MERKLE_TREE_HEIGHT = 20 // 2^20 = ~1M deposits
export const MAX_DEPOSIT_AMOUNT = BigInt('100000000000000000000') // 100 tokens

// GrimPool deployment block on Unichain Sepolia
export const GRIMPOOL_DEPLOYMENT_BLOCK = 43_000_000n

// Default slippage tolerance (0.5%)
export const DEFAULT_SLIPPAGE = 0.5

// Transaction deadlines
export const DEFAULT_DEADLINE_MINUTES = 20
