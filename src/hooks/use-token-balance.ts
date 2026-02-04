import { useAccount, useBalance, useReadContract } from 'wagmi'
import { type Address } from 'viem'
import { getERC20Config } from '@/lib/contracts'

/**
 * Hook to get native ETH balance
 */
export function useNativeBalance() {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useBalance({
    address,
  })

  return {
    balance: data?.value ?? BigInt(0),
    formatted: data?.formatted ?? '0',
    symbol: data?.symbol ?? 'ETH',
    decimals: data?.decimals ?? 18,
    isLoading,
    refetch,
  }
}

/**
 * Hook to get ERC20 token balance
 */
export function useTokenBalance(tokenAddress: Address | null) {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useReadContract({
    ...getERC20Config(tokenAddress || '0x0000000000000000000000000000000000000000'),
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenAddress,
    },
  })

  const { data: decimalsData } = useReadContract({
    ...getERC20Config(tokenAddress || '0x0000000000000000000000000000000000000000'),
    functionName: 'decimals',
    query: {
      enabled: !!tokenAddress,
    },
  })

  const { data: symbolData } = useReadContract({
    ...getERC20Config(tokenAddress || '0x0000000000000000000000000000000000000000'),
    functionName: 'symbol',
    query: {
      enabled: !!tokenAddress,
    },
  })

  const balance = (data as bigint) ?? BigInt(0)
  const decimals = (decimalsData as number) ?? 18
  const symbol = (symbolData as string) ?? 'TOKEN'

  // Format balance
  const formatted = (Number(balance) / Math.pow(10, decimals)).toFixed(6)

  return {
    balance,
    formatted,
    symbol,
    decimals,
    isLoading,
    refetch,
  }
}

/**
 * Hook to get token allowance
 */
export function useTokenAllowance(tokenAddress: Address | null, spender: Address) {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useReadContract({
    ...getERC20Config(tokenAddress || '0x0000000000000000000000000000000000000000'),
    functionName: 'allowance',
    args: address ? [address, spender] : undefined,
    query: {
      enabled: !!address && !!tokenAddress,
    },
  })

  const allowance = (data as bigint) ?? BigInt(0)

  return {
    allowance,
    isLoading,
    refetch,
    hasAllowance: (amount: bigint) => allowance >= amount,
  }
}

/**
 * Hook to get multiple token balances
 */
export function useTokenBalances(tokenAddresses: Address[]) {
  const { address } = useAccount()

  const balances = tokenAddresses.map((tokenAddress) => {
    const { data } = useReadContract({
      ...getERC20Config(tokenAddress),
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
      query: {
        enabled: !!address,
      },
    })

    return {
      address: tokenAddress,
      balance: (data as bigint) ?? BigInt(0),
    }
  })

  return {
    balances,
    getBalance: (tokenAddress: Address) => {
      const found = balances.find((b) => b.address === tokenAddress)
      return found?.balance ?? BigInt(0)
    },
  }
}
