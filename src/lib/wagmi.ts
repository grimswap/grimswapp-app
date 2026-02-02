import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'
import { type Chain } from 'viem'

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

// WalletConnect project ID (replace with your own)
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

export const wagmiConfig = createConfig({
  chains: [unichainSepolia, mainnet, sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: walletConnectProjectId,
      metadata: {
        name: 'GrimSwap',
        description: 'The Dark Arts of DeFi',
        url: 'https://grimswap.xyz',
        icons: ['https://grimswap.xyz/grimoire.svg'],
      },
    }),
    coinbaseWallet({
      appName: 'GrimSwap',
    }),
  ],
  transports: {
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
