import { type Address } from 'viem'

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

// Relayer API URL
export const RELAYER_URL = 'https://grimswap-relayer-production.up.railway.app'

// Deployed Contract Addresses V2 (Unichain Sepolia)
export const CONTRACTS = {
  // ZK-SNARK Privacy Contracts V2 (Production)
  grimPool: '0x023F6b2Bb485A9c77F1b3e4009E58064E53414b9' as Address,
  groth16Verifier: '0xF7D14b744935cE34a210D7513471a8E6d6e696a0' as Address,
  grimSwapZK: '0xc52c297f4f0d0556b1cd69b655F23df2513eC0C4' as Address,

  // Stealth Address Support
  stealthRegistry: '0xA9e4ED4183b3B3cC364cF82dA7982D5ABE956307' as Address,
  announcer: '0x42013A72753F6EC28e27582D4cDb8425b44fd311' as Address,

  // Uniswap v4 Core
  poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
  poolHelper: '0x0f8113EfA5527346978534192a76C94a567cae42' as Address,

  // Uniswap v4 Periphery (NEW)
  stateView: '0xc199f1072a74d4e905aba1a84d9a45e2546b6222' as Address,
  quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  positionManager: '0xf969aee60879c54baaed9f3ed26147db216fd664' as Address,
  universalRouter: '0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d' as Address,
  poolSwapTest: '0x9140a78c1a137c7ff1c151ec8231272af78a99a4' as Address,
  poolModifyLiquidityTest: '0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab' as Address,

  // L2 Contracts
  weth9: '0x4200000000000000000000000000000000000006' as Address,
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  swapRouter02: '0x9e5a52f57b3038f1b8eee45f28b3c1967e22799c' as Address,

  // Test Tokens
  tokenA: '0x48bA64b5312AFDfE4Fc96d8F03010A0a86e17963' as Address,
  tokenB: '0x96aC37889DfDcd4dA0C898a5c9FB9D17ceD60b1B' as Address,

  // Real Unichain Sepolia Tokens
  usdc: '0x31d0220469e10c4E71834a79b1f276d740d3768F' as Address,
  nativeEth: '0x0000000000000000000000000000000000000000' as Address,
} as const

// Merkle tree configuration
export const MERKLE_TREE_HEIGHT = 20 // 2^20 = ~1M deposits
export const MAX_DEPOSIT_AMOUNT = BigInt('100000000000000000000') // 100 tokens

// Default slippage tolerance (0.5%)
export const DEFAULT_SLIPPAGE = 0.5

// Transaction deadlines
export const DEFAULT_DEADLINE_MINUTES = 20
