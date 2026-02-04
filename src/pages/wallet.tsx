import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useAccount } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useDepositNotes, useGrimPool } from '@/hooks'
import { useNativeBalance } from '@/hooks/use-token-balance'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { AddressDisplay } from '@/components/ui/copy-button'
import { cn } from '@/lib/utils'
import { ETH, formatTokenAmount } from '@/lib/tokens'
import {
  Wallet,
  Shield,
  Activity,
  Plus,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  FileKey,
  Coins,
  Clock,
  Lock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import type { StoredDepositNote } from '@/lib/storage/deposit-notes'

export function WalletPage() {
  const { address, isConnected } = useAccount()
  const pageRef = useRef<HTMLDivElement>(null)

  // Deposit notes management
  const {
    notes,
    unspentNotes,
    loading: notesLoading,
    count,
    deleteNote,
    exportNotes,
    importNotes,
    clearNotes,
    refresh: refreshNotes,
  } = useDepositNotes()

  // GrimPool deposit
  const {
    deposit,
    state: depositState,
    error: depositError,
    isLoading: isDepositing,
    reset: resetDeposit,
    getDepositCount,
  } = useGrimPool()

  // Balances
  const { formatted: ethBalance } = useNativeBalance()

  // UI State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [poolDepositCount, setPoolDepositCount] = useState(0)

  // Deposit modal state
  const [depositAmount, setDepositAmount] = useState('')

  // Copy state
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Fetch pool stats
  useEffect(() => {
    if (isConnected) {
      getDepositCount().then(setPoolDepositCount)
    }
  }, [isConnected, getDepositCount])

  // Animation on mount
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.wallet-element', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
      })
    }, pageRef)

    return () => ctx.revert()
  }, [])

  // Calculate total value from unspent notes
  const totalNoteValue = unspentNotes.reduce((sum, note) => {
    const amount = Number(formatUnits(BigInt(note.amount),
      note.tokenSymbol === 'ETH' ? 18 : 6
    ))
    return sum + amount
  }, 0)

  // Handle deposit (ETH only)
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return

    const amount = parseUnits(depositAmount, ETH.decimals)
    const result = await deposit(ETH.address, ETH.symbol, amount)

    if (result) {
      setIsDepositModalOpen(false)
      setDepositAmount('')
      refreshNotes()
    }
  }

  // Handle export
  const handleExport = async () => {
    try {
      const json = await exportNotes()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grimswap-notes-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Handle import
  const handleImport = async () => {
    if (!importJson.trim()) return

    try {
      const imported = await importNotes(importJson)
      setIsImportModalOpen(false)
      setImportJson('')
      alert(`Successfully imported ${imported} notes`)
    } catch (error) {
      alert('Failed to import notes. Check the JSON format.')
    }
  }

  // Handle clear all
  const handleClear = async () => {
    await clearNotes()
    setIsClearModalOpen(false)
  }

  // Copy note secret
  const copyNoteSecret = async (note: StoredDepositNote) => {
    const secretData = JSON.stringify({
      secret: note.secret.toString(),
      nullifier: note.nullifier.toString(),
      commitment: note.commitment.toString(),
      amount: note.amount.toString(),
    })
    await navigator.clipboard.writeText(secretData)
    setCopiedId(note.id!)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isConnected) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <Wallet className="w-16 h-16 text-arcane-purple/50 mx-auto mb-4" />
          <h2 className="font-display text-2xl text-ghost-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-mist-gray">
            Connect your wallet to access your Grimoire
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={pageRef} className="min-h-[calc(100vh-5rem)] py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="wallet-element flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ghost-white mb-2">
              Your Grimoire
            </h1>
            <p className="text-mist-gray">
              Manage your private deposits and hidden assets
            </p>
          </div>
          <Button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Deposit
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="wallet-element grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Connected Wallet */}
          <Card glow="purple">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-arcane-purple/20">
                  <Wallet className="w-5 h-5 text-arcane-purple" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-mist-gray mb-0.5">Connected</p>
                  {address && <AddressDisplay address={address} chars={4} />}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unspent Notes */}
          <Card glow="green">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-spectral-green/20">
                  <FileKey className="w-5 h-5 text-spectral-green" />
                </div>
                <div>
                  <p className="text-xs text-mist-gray mb-0.5">Active Notes</p>
                  <p className="text-xl font-mono text-ghost-white">
                    {count.unspent}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Deposited */}
          <Card glow="cyan">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-ethereal-cyan/20">
                  <Coins className="w-5 h-5 text-ethereal-cyan" />
                </div>
                <div>
                  <p className="text-xs text-mist-gray mb-0.5">In Privacy Pool</p>
                  <p className="text-xl font-mono text-ghost-white">
                    {totalNoteValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pool Stats */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-mist-gray/20">
                  <Shield className="w-5 h-5 text-mist-gray" />
                </div>
                <div>
                  <p className="text-xs text-mist-gray mb-0.5">Pool Deposits</p>
                  <p className="text-xl font-mono text-ghost-white">
                    {poolDepositCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deposit Notes Section */}
        <div className="wallet-element">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-arcane-purple" />
                <h2 className="font-display text-lg text-ghost-white">
                  Deposit Notes
                </h2>
                <span className="text-xs text-mist-gray bg-charcoal px-2 py-0.5 rounded-full">
                  {count.total} total
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    'hover:bg-white/5',
                    showSecrets ? 'text-spectral-green' : 'text-mist-gray'
                  )}
                  title={showSecrets ? 'Hide secrets' : 'Show secrets'}
                >
                  {showSecrets ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={refreshNotes}
                  disabled={notesLoading}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    'hover:bg-white/5 text-mist-gray hover:text-ghost-white',
                    notesLoading && 'animate-spin'
                  )}
                  title="Refresh notes"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {notesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-arcane-purple border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-12">
                  <FileKey className="w-12 h-12 text-mist-gray/30 mx-auto mb-3" />
                  <p className="text-mist-gray mb-4">No deposit notes yet</p>
                  <Button
                    variant="outline"
                    onClick={() => setIsDepositModalOpen(true)}
                    className="mx-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Make Your First Deposit
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all',
                        note.spent
                          ? 'bg-charcoal/30 border-mist-gray/10 opacity-60'
                          : 'bg-charcoal/50 border-arcane-purple/20 hover:border-arcane-purple/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Token Info */}
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center',
                              note.spent ? 'bg-mist-gray/20' : 'bg-arcane-purple/20'
                            )}
                          >
                            <span className="text-sm font-bold">
                              {note.tokenSymbol?.slice(0, 2) || '??'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ghost-white">
                                {formatTokenAmount(
                                  BigInt(note.amount),
                                  note.tokenSymbol === 'ETH' ? 18 : 6,
                                  4
                                )}{' '}
                                {note.tokenSymbol}
                              </span>
                              {note.spent ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-mist-gray/20 text-mist-gray">
                                  Spent
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-spectral-green/20 text-spectral-green">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-mist-gray">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(note.createdAt)}</span>
                              {note.leafIndex !== undefined && (
                                <>
                                  <span className="text-arcane-purple/50">•</span>
                                  <span>Leaf #{note.leafIndex}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                          {note.depositTxHash && (
                            <a
                              href={`https://unichain-sepolia.blockscout.com/tx/${note.depositTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-white/5 text-mist-gray hover:text-ghost-white transition-colors"
                              title="View transaction"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => copyNoteSecret(note)}
                            className="p-2 rounded-lg hover:bg-white/5 text-mist-gray hover:text-ghost-white transition-colors"
                            title="Copy note secret"
                          >
                            {copiedId === note.id ? (
                              <Check className="w-4 h-4 text-spectral-green" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteNote(note.id!)}
                            className="p-2 rounded-lg hover:bg-blood-crimson/10 text-mist-gray hover:text-blood-crimson transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Secret Preview (when revealed) */}
                      {showSecrets && !note.spent && (
                        <div className="mt-3 pt-3 border-t border-arcane-purple/10">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-mist-gray">Commitment:</span>
                              <p className="font-mono text-ghost-white truncate">
                                {note.commitment.toString().slice(0, 20)}...
                              </p>
                            </div>
                            <div>
                              <span className="text-mist-gray">Nullifier Hash:</span>
                              <p className="font-mono text-ghost-white truncate">
                                {note.nullifierHash.toString().slice(0, 20)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Bar */}
              {notes.length > 0 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-arcane-purple/10">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsImportModalOpen(true)}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsClearModalOpen(true)}
                    className="text-blood-crimson hover:text-blood-crimson hover:bg-blood-crimson/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <div className="wallet-element">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-ethereal-cyan" />
                <h2 className="font-display text-lg text-ghost-white">
                  Transaction History
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-mist-gray/30 mx-auto mb-3" />
                  <p className="text-mist-gray">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes
                    .slice()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, 10)
                    .map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-charcoal/30 hover:bg-charcoal/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              note.spent
                                ? 'bg-blood-crimson/20'
                                : 'bg-spectral-green/20'
                            )}
                          >
                            {note.spent ? (
                              <XCircle className="w-4 h-4 text-blood-crimson" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-spectral-green" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-ghost-white">
                              {note.spent ? 'Withdrawn' : 'Deposited'}{' '}
                              {formatTokenAmount(
                                BigInt(note.amount),
                                note.tokenSymbol === 'ETH' ? 18 : 6,
                                4
                              )}{' '}
                              {note.tokenSymbol}
                            </p>
                            <p className="text-xs text-mist-gray">
                              {formatDate(note.spent ? note.spentAt! : note.createdAt)}
                            </p>
                          </div>
                        </div>
                        {note.depositTxHash && (
                          <a
                            href={`https://unichain-sepolia.blockscout.com/tx/${note.depositTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-arcane-purple hover:underline flex items-center gap-1"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Important Warning */}
        <div className="wallet-element">
          <Card className="border-blood-crimson/30 bg-blood-crimson/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blood-crimson flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blood-crimson mb-1">
                    Backup Your Notes
                  </h3>
                  <p className="text-sm text-mist-gray">
                    Your deposit notes are stored locally in your browser. If you clear your
                    browser data or use a different device, you will lose access to your
                    deposits. Always export and securely backup your notes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deposit Modal */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => {
          setIsDepositModalOpen(false)
          resetDeposit()
          setDepositAmount('')
        }}
        title="Deposit to Privacy Pool"
      >
        <div className="p-4 space-y-4">
          {/* ETH Only Notice */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-obsidian border border-arcane-purple/20">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${ETH.color}40, ${ETH.color})`,
              }}
            >
              <span className="text-sm font-bold text-ghost-white">Ξ</span>
            </div>
            <div className="flex-1">
              <p className="text-ghost-white font-medium">ETH</p>
              <p className="text-xs text-mist-gray">
                Balance: {ethBalance} ETH
              </p>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm text-mist-gray mb-2">Amount</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="pr-20"
              />
              <button
                onClick={() => setDepositAmount(ethBalance)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-arcane-purple hover:text-arcane-purple/80"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-arcane-purple/10 border border-arcane-purple/20">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-arcane-purple flex-shrink-0 mt-0.5" />
              <div className="text-xs text-mist-gray">
                <p className="text-arcane-purple font-medium mb-1">How it works</p>
                <p>
                  Your deposit creates a cryptographic commitment stored on-chain. A secret
                  note is saved locally that proves your ownership. Keep this note safe!
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {depositError && (
            <div className="p-3 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
              <p className="text-sm text-blood-crimson">{depositError}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleDeposit}
            disabled={
              !depositAmount ||
              parseFloat(depositAmount) <= 0 ||
              isDepositing ||
              depositState === 'success'
            }
            className="w-full"
          >
            {isDepositing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-ghost-white border-t-transparent rounded-full animate-spin" />
                {depositState === 'generating' && 'Generating Note...'}
                {depositState === 'approving' && 'Approving...'}
                {depositState === 'depositing' && 'Depositing...'}
                {depositState === 'confirming' && 'Confirming...'}
              </div>
            ) : depositState === 'success' ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Deposit Successful!
              </div>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Deposit to Privacy Pool
              </>
            )}
          </Button>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
          setImportJson('')
        }}
        title="Import Deposit Notes"
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-mist-gray">
            Paste the JSON backup of your deposit notes below.
          </p>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"secret": "...", "nullifier": "...", ...}]'
            className={cn(
              'w-full h-40 p-3 rounded-xl resize-none',
              'bg-obsidian border border-arcane-purple/20',
              'text-ghost-white placeholder:text-mist-gray/50',
              'focus:outline-none focus:border-arcane-purple/50',
              'font-mono text-sm'
            )}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importJson.trim()} className="flex-1">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear All Notes?"
      >
        <div className="p-4 space-y-4">
          <div className="p-4 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blood-crimson flex-shrink-0" />
              <div>
                <p className="text-blood-crimson font-medium mb-1">This action is irreversible</p>
                <p className="text-sm text-mist-gray">
                  Clearing all notes will permanently delete your deposit records. You will lose
                  access to any unspent deposits. Make sure you have exported a backup first.
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsClearModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClear}
              className="flex-1 bg-blood-crimson hover:bg-blood-crimson/80 border-blood-crimson"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
