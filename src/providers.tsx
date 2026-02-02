import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, type Theme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { wagmiConfig } from './lib/wagmi'
import { SmoothScrollProvider } from './components/effects/smooth-scroll-provider'

const queryClient = new QueryClient()

// GrimSwap arcane theme for RainbowKit
const grimswapTheme: Theme = {
  ...darkTheme(),
  colors: {
    ...darkTheme().colors,
    accentColor: '#8B5CF6',
    accentColorForeground: '#E8E8F0',
    connectButtonBackground: '#1A1A2E',
    connectButtonBackgroundError: '#FF3366',
    connectButtonInnerBackground: '#12121A',
    connectButtonText: '#E8E8F0',
    connectButtonTextError: '#E8E8F0',
    modalBackground: '#0A0A0F',
    modalBackdrop: 'rgba(5, 5, 5, 0.85)',
    modalBorder: 'rgba(139, 92, 246, 0.2)',
    modalText: '#E8E8F0',
    modalTextDim: '#9CA3AF',
    modalTextSecondary: '#4B5563',
    profileAction: '#1A1A2E',
    profileActionHover: '#2A2A3E',
    profileForeground: '#12121A',
    selectedOptionBorder: '#8B5CF6',
    downloadBottomCardBackground: '#1A1A2E',
    downloadTopCardBackground: '#12121A',
    error: '#FF3366',
    generalBorder: 'rgba(139, 92, 246, 0.2)',
    generalBorderDim: 'rgba(139, 92, 246, 0.1)',
    menuItemBackground: '#1A1A2E',
    standby: '#00D4FF',
  },
  fonts: {
    body: "'IBM Plex Sans', sans-serif",
  },
  radii: {
    ...darkTheme().radii,
    actionButton: '12px',
    connectButton: '12px',
    menuButton: '12px',
    modal: '16px',
    modalMobile: '16px',
  },
  shadows: {
    connectButton: '0 0 20px rgba(139, 92, 246, 0.3)',
    dialog: '0 0 40px rgba(139, 92, 246, 0.2)',
    profileDetailsAction: '0 0 10px rgba(139, 92, 246, 0.2)',
    selectedOption: '0 0 15px rgba(139, 92, 246, 0.3)',
    selectedWallet: '0 0 15px rgba(139, 92, 246, 0.3)',
    walletLogo: '0 0 10px rgba(0, 0, 0, 0.5)',
  },
}

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={grimswapTheme} modalSize="compact">
          <SmoothScrollProvider>
            {children}
          </SmoothScrollProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
