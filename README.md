# GrimSwap App

Privacy-preserving DEX frontend for Uniswap v4 on Unichain Sepolia, powered by ZK-SNARKs.

## Features

- **Private Swaps**: Swap ETH/USDC with complete sender/recipient unlinkability
- **Stealth Addresses**: One-time addresses for receiving swap outputs
- **ZK Proof Generation**: Client-side Groth16 proof generation
- **Deposit Management**: Grimoire wallet for managing deposit notes
- **Liquidity Provision**: Add/remove liquidity to privacy and vanilla pools
- **Position Tracking**: Track your liquidity positions with on-chain event scanning
- **Real-time Pool Data**: Live pool state from Uniswap v4 StateView
- **Transaction Success Modals**: Animated confirmation modals for all transactions

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS + GSAP animations
- wagmi v2 + viem for Web3
- WalletConnect Web3Modal
- snarkjs for ZK proof generation
- IndexedDB for secure note storage

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Project Structure

```
src/
├── components/
│   ├── effects/       # Aurora background, noise overlay, smooth scroll
│   ├── layout/        # Header, layout wrapper
│   ├── privacy/       # Ring visualization, stealth balance, privacy meter
│   ├── swap/          # Swap card, token inputs, settings, pool statistics
│   ├── ui/            # Buttons, cards, modals, inputs, success modal
│   └── web3/          # Connect button, transaction status
├── hooks/
│   ├── use-deposit-notes.ts       # IndexedDB note management
│   ├── use-grim-pool.ts           # Deposit to privacy pool
│   ├── use-grim-swap.ts           # Private swap execution
│   ├── use-liquidity.ts           # Add/remove liquidity
│   ├── use-liquidity-positions.ts # Track LP positions from events
│   ├── use-merkle-tree.ts         # Poseidon tree sync
│   ├── use-pool-manager.ts        # Pool state from events
│   ├── use-quoter.ts              # Swap quotes from Quoter contract
│   ├── use-settings.ts            # User settings (slippage, deadline)
│   ├── use-state-view.ts          # Pool state from StateView
│   ├── use-stealth-addresses.ts   # Stealth keypair management
│   ├── use-token-balance.ts       # ETH/ERC20 balances
│   ├── use-token-price.ts         # CoinGecko price feeds
│   └── use-zk-proof.ts            # ZK proof generation
├── lib/
│   ├── constants.ts   # Contract addresses, chain config
│   ├── contracts.ts   # Pool keys, ABIs
│   ├── relayer.ts     # Relayer API client
│   ├── tokens.ts      # Token definitions with logos
│   ├── utils.ts       # Utility functions
│   ├── wagmi.ts       # Web3 config
│   ├── storage/       # IndexedDB wrappers
│   └── zk/            # Proof generation, Merkle tree, Poseidon
├── pages/
│   ├── home.tsx       # Landing page
│   ├── pools.tsx      # Liquidity pools management
│   ├── swap.tsx       # Swap interface with pool stats
│   └── wallet.tsx     # Grimoire (deposit notes + stealth addresses)
└── providers.tsx      # Web3 + React Query providers
```

## Pages

### `/swap` - Private Swap
1. Deposit ETH/USDC to GrimPool (creates encrypted note)
2. Select swap amount (uses full note amount)
3. Generate ZK proof client-side
4. Submit to relayer for anonymous execution
5. Receive output tokens at stealth address
6. Claim from stealth address in Grimoire

### `/pools` - Liquidity Pools
- View active pools (vanilla ETH/USDC + GrimSwap privacy pool)
- Add liquidity with ratio validation
- Remove liquidity with percentage controls
- Track your positions (LP tokens, pool share, ETH/USDC amounts)
- View pool statistics (TVL, price, composition)
- Initialize new privacy pools

### `/wallet` - Grimoire
- Deposit ETH or USDC to privacy pool
- Manage deposit notes (view, copy, delete)
- Export/import notes for backup
- View stealth addresses with real-time balances
- Claim tokens from stealth addresses to any wallet
- Transaction history

## Contract Addresses (Unichain Sepolia)

| Contract | Address |
|----------|---------|
| GrimPoolMultiToken | `0xEAB5E7B4e715A22E8c114B7476eeC15770B582bb` |
| GrimSwapZK V3 (Hook) | `0x6AFe3f3B81d6a22948800C924b2e9031e76E00C4` |
| Groth16Verifier | `0xF7D14b744935cE34a210D7513471a8E6d6e696a0` |
| PoolManager | `0xC81462Fec8B23319F288047f8A03A57682a35C1A` |
| StateView | `0xc199F1072a74D4e905ABa1A84D9a45E2546B6222` |
| Quoter | `0x7643a9a6BE6Dc9c7689ba89A81A9611e17Bf02c4` |
| PoolModifyLiquidityTest | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| USDC | `0x31d0220469e10c4E71834a79b1f276d740d3768F` |

## Pool Configuration

### ETH/USDC GrimSwap Privacy Pool (V3)

| Parameter | Value |
|-----------|-------|
| Pool ID | `0xbd351665b4f49e58a20e3fdc4861d0fbf0affff0f63fd7b9e113cbaf2734f712` |
| Fee | 500 (0.05%) |
| TickSpacing | 10 |
| Hook | `0x6AFe3f3B81d6a22948800C924b2e9031e76E00C4` |

### ETH/USDC Vanilla Pool

| Parameter | Value |
|-----------|-------|
| Pool ID | `0x1927686e9757bb312fc499e480536d466c788dcdc86a1b62c82643157f05b603` |
| Fee | 3000 (0.3%) |
| TickSpacing | 60 |
| Hook | `0x0000000000000000000000000000000000000000` |

## Privacy Flow

```
1. DEPOSIT
   User → GrimPoolMultiToken.deposit(commitment) + ETH/USDC
   └─► Commitment added to Merkle tree
   └─► Deposit event emitted with leafIndex
   └─► Note saved locally (secret + nullifier + amount)

2. PRIVATE SWAP
   User → Generate ZK proof (proves deposit without revealing which one)
   └─► Proof includes: nullifierHash, recipient (stealth), swapAmountOut
   └─► Submit proof to relayer
   └─► Relayer verifies proof + executes swap via GrimSwapZK hook
   └─► Output tokens sent to stealth address
   └─► Relayer funds stealth address with ETH for gas

3. CLAIM
   User → View stealth address balance in Grimoire
   └─► Click "Claim" → enter destination address
   └─► Sign transaction with stealth private key
   └─► Tokens transferred to destination
```

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Preview production build
npm run preview
```

## Relayer

The app connects to the GrimSwap relayer at `https://services.grimswap.com` for submitting private swaps. The relayer:
- Validates ZK proofs before submission
- Submits transactions on-chain
- Pays gas on behalf of users
- Funds stealth addresses with ETH for claiming (~0.0001 ETH)

### Relayer Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /info` | Relayer address and fee info |
| `POST /relay` | Submit private swap with proof |

## Key Components

### TransactionSuccessModal
Animated success modal shown after:
- Successful swaps
- Adding liquidity
- Removing liquidity
- Deposits to privacy pool
- Claiming from stealth addresses

### Pool Statistics
Real-time pool metrics including:
- Current price (from StateView)
- TVL calculated from virtual reserves
- Pool composition (ETH/USDC percentages)
- Liquidity depth

### Liquidity Position Tracking
Tracks user positions via:
- On-chain ModifyLiquidity events from PoolManager
- localStorage for pending confirmations
- Calculates ETH/USDC amounts from liquidity + price

## Browser Storage

| Storage | Purpose |
|---------|---------|
| IndexedDB | Deposit notes (encrypted secrets) |
| localStorage | Stealth addresses, LP positions, settings |

**Important**: Always backup your deposit notes! They are stored locally and cannot be recovered if lost.

## License

MIT
