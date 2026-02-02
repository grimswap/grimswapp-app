import { ConnectButton } from '@rainbow-me/rainbowkit'
import { cn } from '@/lib/utils'

export function GrimConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted
        const connected = ready && account && chain

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className={cn(
                      'px-5 py-2.5 rounded-xl',
                      'bg-gradient-to-r from-arcane-purple to-purple-deep',
                      'text-ghost-white text-sm font-semibold',
                      'shadow-[0_0_20px_rgba(139,92,246,0.3)]',
                      'hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      'transition-all duration-200'
                    )}
                  >
                    Enter Grimoire
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className={cn(
                      'px-5 py-2.5 rounded-xl',
                      'bg-blood-crimson/80 text-ghost-white text-sm font-medium',
                      'hover:bg-blood-crimson transition-colors'
                    )}
                  >
                    Wrong Realm
                  </button>
                )
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl',
                      'bg-charcoal/80 border border-arcane-purple/20',
                      'hover:border-arcane-purple/40 transition-all'
                    )}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain'}
                        src={chain.iconUrl}
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span className="text-ghost-white text-sm hidden sm:block">
                      {chain.name}
                    </span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl',
                      'bg-charcoal/80 border border-spectral-green/20',
                      'hover:border-spectral-green/40 transition-all',
                      'hover:shadow-[0_0_15px_rgba(0,255,136,0.15)]'
                    )}
                  >
                    <span className="text-spectral-green font-mono text-sm">
                      {account.displayName}
                    </span>
                    {account.displayBalance && (
                      <span className="text-mist-gray text-sm hidden sm:block">
                        {account.displayBalance}
                      </span>
                    )}
                  </button>
                </div>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
