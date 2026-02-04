import { cn } from '@/lib/utils'
import { useTransactionHistory, type Transaction } from '@/hooks/use-transaction-history'
import { useAccount } from 'wagmi'
import {
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Trash2,
  Clock,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const EXPLORER_URL = 'https://unichain-sepolia.blockscout.com'

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function TransactionIcon({ type, status }: { type: Transaction['type']; status: Transaction['status'] }) {
  if (status === 'pending') {
    return <Loader2 className="w-5 h-5 text-ethereal-cyan animate-spin" />
  }

  if (status === 'failed') {
    return <XCircle className="w-5 h-5 text-blood-crimson" />
  }

  switch (type) {
    case 'swap':
      return <ArrowRightLeft className="w-5 h-5 text-spectral-green" />
    case 'approve':
      return <CheckCircle className="w-5 h-5 text-spectral-green" />
    default:
      return <CheckCircle className="w-5 h-5 text-spectral-green" />
  }
}

function TransactionItem({ tx, onRemove }: { tx: Transaction; onRemove: () => void }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-xl',
        'bg-obsidian/30 border border-transparent',
        'hover:border-arcane-purple/20 transition-all',
        'group'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          tx.status === 'pending' && 'bg-ethereal-cyan/10',
          tx.status === 'confirmed' && 'bg-spectral-green/10',
          tx.status === 'failed' && 'bg-blood-crimson/10'
        )}
      >
        <TransactionIcon type={tx.type} status={tx.status} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ghost-white truncate">
            {tx.summary}
          </span>
          {tx.details?.ringSize && (
            <span className="flex items-center gap-1 text-xs text-spectral-green">
              <Shield className="w-3 h-3" />
              {tx.details.ringSize}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-mist-gray mt-1">
          <Clock className="w-3 h-3" />
          <span>{formatTimeAgo(tx.timestamp)}</span>
          <span>•</span>
          <span className="font-mono truncate">
            {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={`${EXPLORER_URL}/tx/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg hover:bg-white/5 text-mist-gray hover:text-ghost-white transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        {tx.status !== 'pending' && (
          <button
            onClick={onRemove}
            className="p-2 rounded-lg hover:bg-blood-crimson/10 text-mist-gray hover:text-blood-crimson transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function TransactionHistory() {
  const { address } = useAccount()
  const {
    transactions,
    pendingTransactions,
    removeTransaction,
    clearTransactions,
    isLoaded,
  } = useTransactionHistory(address)

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-arcane-purple animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="font-display text-lg text-ghost-white">
          Recent Transactions
        </h3>
        {transactions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTransactions}
            className="text-mist-gray hover:text-blood-crimson"
          >
            Clear all
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {pendingTransactions.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-ethereal-cyan/10 border border-ethereal-cyan/20">
            <div className="flex items-center gap-2 text-sm text-ethereal-cyan">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{pendingTransactions.length} pending transaction(s)</span>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <ArrowRightLeft className="w-12 h-12 text-mist-gray/30 mx-auto mb-4" />
            <p className="text-mist-gray">No transactions yet</p>
            <p className="text-sm text-shadow-gray mt-1">
              Your swap history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 10).map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                onRemove={() => removeTransaction(tx.hash)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
