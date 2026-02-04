import { http } from 'wagmi'
import { type Chain } from 'viem'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

// Custom Unichain Sepolia chain definition
export const unichainSepolia: Chain = {
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
  testnet: true,
}

// WalletConnect project ID - get one at https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64'

// Use RainbowKit's getDefaultConfig which properly sets up wagmi + wallet connectors
export const wagmiConfig = getDefaultConfig({
  appName: 'GrimSwap',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [unichainSepolia],
  transports: {
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
  },
  ssr: false,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
