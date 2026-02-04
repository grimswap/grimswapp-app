import { useState } from 'react'
import { type Address, parseEther, formatEther } from 'viem'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { CopyButton } from '@/components/ui/copy-button'
import { TokenSelectorModal } from './token-selector-modal'
import { useGrimPool } from '@/hooks/use-grim-pool'
import { useTokenPrice } from '@/hooks/use-token-price'
import { serializeNote } from '@/lib/zk'
import { ETH, USDC } from '@/lib/tokens'
import { cn } from '@/lib/utils'
import { ArrowDown, Lock, Shield, CheckCircle2, AlertCircle } from 'lucide-react'

// ETH denominations
const ETH_DENOMINATIONS = [
  { label: '0.01 ETH', value: parseEther('0.01') },
  { label: '0.1 ETH', value: parseEther('0.1') },
  { label: '1 ETH', value: parseEther('1') },
  { label: '10 ETH', value: parseEther('10') },
]

// USDC denominations (6 decimals)
const USDC_DENOMINATIONS = [
  { label: '10 USDC', value: BigInt(10 * 1e6) },
  { label: '100 USDC', value: BigInt(100 * 1e6) },
  { label: '1000 USDC', value: BigInt(1000 * 1e6) },
  { label: '10000 USDC', value: BigInt(10000 * 1e6) },
]

export function DepositCard() {
  const [amount, setAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState<Address | null>(ETH.address)
  const [selectedSymbol, setSelectedSymbol] = useState(ETH.symbol)
  const [selectedDecimals, setSelectedDecimals] = useState(ETH.decimals)
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)

  const { deposit, state, error, currentNote, isLoading, reset } = useGrimPool()
  const { formatted: priceFormatted } = useTokenPrice(selectedToken)

  const handleDeposit = async () => {
    if (!selectedToken || !amount) return

    try {
      // Parse amount with correct decimals
      const amountBigInt = BigInt(
        Math.floor(parseFloat(amount) * Math.pow(10, selectedDecimals))
      )
      const result = await deposit(selectedToken, selectedSymbol, amountBigInt)

      if (result) {
        setShowNoteModal(true)
      }
    } catch (err) {
      console.error('Deposit failed:', err)
    }
  }

  // Get denominations based on selected token
  const denominations = selectedSymbol === 'USDC' ? USDC_DENOMINATIONS : ETH_DENOMINATIONS

  const handleDenominationSelect = (value: bigint) => {
    // Format based on token decimals
    const formatted = Number(value) / Math.pow(10, selectedDecimals)
    setAmount(formatted.toString())
  }

  const handleCloseNoteModal = () => {
    setShowNoteModal(false)
    reset()
    setAmount('')
  }

  const isValidAmount = amount && parseFloat(amount) > 0

  return (
    <>
      <Card className="p-6 bg-charcoal/50 border-arcane-purple/10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-arcane-purple/20 border border-arcane-purple/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-arcane-purple" />
          </div>
          <div>
            <h3 className="font-display text-lg text-ghost-white">Private Deposit</h3>
            <p className="text-sm text-mist-gray">Deposit tokens to the anonymity pool</p>
          </div>
        </div>

        {/* Fixed Denominations */}
        <div className="mb-4">
          <label className="block text-sm text-mist-gray mb-2">Fixed Denominations</label>
          <div className="grid grid-cols-2 gap-2">
            {denominations.map((denom) => (
              <button
                key={denom.label}
                onClick={() => handleDenominationSelect(denom.value)}
                className={cn(
                  'px-4 py-3 rounded-xl border transition-all',
                  'bg-obsidian/50 border-arcane-purple/10',
                  'hover:border-arcane-purple/30 hover:bg-obsidian/70',
                  'text-ghost-white font-medium'
                )}
              >
                {denom.label}
              </button>
            ))}
          </div>
        </div>

        {/* Token Selection */}
        <div className="mb-4">
          <label className="block text-sm text-mist-gray mb-2">Token</label>
          <button
            onClick={() => setShowTokenSelector(true)}
            className={cn(
              'w-full px-4 py-3 rounded-xl border transition-all',
              'bg-obsidian/50 border-arcane-purple/10',
              'hover:border-arcane-purple/30 hover:bg-obsidian/70',
              'flex items-center justify-between'
            )}
          >
            <span className="text-ghost-white font-medium">{selectedSymbol}</span>
            {priceFormatted && (
              <span className="text-sm text-mist-gray">{priceFormatted}</span>
            )}
          </button>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-sm text-mist-gray mb-2">Amount</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="text-xl"
            disabled={isLoading}
          />
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 rounded-xl bg-arcane-purple/5 border border-arcane-purple/20">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-arcane-purple flex-shrink-0 mt-0.5" />
            <div className="text-sm text-mist-gray">
              <p className="mb-2">
                Your deposit will be added to the anonymity pool. You'll receive a deposit note
                that proves ownership without revealing which deposit is yours.
              </p>
              <p className="text-spectral-green">
                <strong>Privacy Level:</strong> Hidden among ALL depositors (~1M capacity)
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
            <div className="flex items-center gap-2 text-blood-crimson">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Deposit Button */}
        <Button
          onClick={handleDeposit}
          disabled={!isValidAmount || isLoading || !selectedToken}
          className="w-full"
        >
          {isLoading ? (
            <>
              {state === 'generating' && 'Generating Commitment...'}
              {state === 'approving' && 'Approving Token...'}
              {state === 'depositing' && 'Depositing...'}
              {state === 'confirming' && 'Confirming Transaction...'}
            </>
          ) : (
            'Deposit to Pool'
          )}
        </Button>

        {/* Progress Steps */}
        {isLoading && (
          <div className="mt-4 space-y-2">
            <ProgressStep
              label="Generate Commitment"
              active={state === 'generating'}
              complete={['approving', 'depositing', 'confirming', 'success'].includes(state)}
            />
            <ProgressStep
              label="Approve Token"
              active={state === 'approving'}
              complete={['depositing', 'confirming', 'success'].includes(state)}
            />
            <ProgressStep
              label="Submit Deposit"
              active={state === 'depositing'}
              complete={['confirming', 'success'].includes(state)}
            />
            <ProgressStep
              label="Confirm Transaction"
              active={state === 'confirming'}
              complete={state === 'success'}
            />
          </div>
        )}
      </Card>

      {/* Token Selector Modal */}
      <TokenSelectorModal
        isOpen={showTokenSelector}
        onClose={() => setShowTokenSelector(false)}
        onSelect={(token) => {
          setSelectedToken(token.address as Address)
          setSelectedSymbol(token.symbol)
          setSelectedDecimals(token.decimals)
          setAmount('') // Reset amount when changing token
          setShowTokenSelector(false)
        }}
      />

      {/* Deposit Note Modal */}
      {currentNote && (
        <Modal
          isOpen={showNoteModal}
          onClose={handleCloseNoteModal}
          title="Deposit Successful"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-spectral-green/20 border-2 border-spectral-green flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-spectral-green" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h3 className="font-display text-xl text-ghost-white mb-2">
                Your deposit is private!
              </h3>
              <p className="text-mist-gray">
                Save your deposit note to withdraw later
              </p>
            </div>

            {/* Deposit Note */}
            <div className="p-4 rounded-xl bg-obsidian/70 border border-arcane-purple/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-mist-gray">Deposit Note</span>
                <CopyButton text={serializeNote(currentNote)} />
              </div>
              <code className="text-xs text-ghost-white break-all block font-mono">
                {serializeNote(currentNote)}
              </code>
            </div>

            {/* Warning */}
            <div className="p-4 rounded-xl bg-blood-crimson/10 border border-blood-crimson/30">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blood-crimson flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blood-crimson">
                  <strong className="block mb-1">Important:</strong>
                  Save this note securely. Without it, you cannot prove ownership of your deposit.
                  It's already saved in your browser's local storage, but you should backup the note.
                </div>
              </div>
            </div>

            {/* Leaf Index */}
            {currentNote.leafIndex !== undefined && (
              <div className="text-center text-sm text-mist-gray">
                Leaf Index: <span className="font-mono text-spectral-green">{currentNote.leafIndex}</span>
              </div>
            )}

            <Button onClick={handleCloseNoteModal} className="w-full">
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function ProgressStep({
  label,
  active,
  complete,
}: {
  label: string
  active: boolean
  complete: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-2 h-2 rounded-full transition-colors',
          complete && 'bg-spectral-green',
          active && 'bg-arcane-purple animate-pulse',
          !active && !complete && 'bg-mist-gray/30'
        )}
      />
      <span
        className={cn(
          'text-sm transition-colors',
          complete && 'text-spectral-green',
          active && 'text-arcane-purple',
          !active && !complete && 'text-mist-gray'
        )}
      >
        {label}
      </span>
    </div>
  )
}
