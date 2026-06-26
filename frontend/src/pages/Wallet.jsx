import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';
import Card from '../components/Card';
import Button from '../components/Button';

export default function Wallet() {
  const [wallet, setWallet]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    walletAPI.getBalance()
      .then(res => setWallet(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const txTypeLabel = {
    deposit:              { label: 'Deposit',              color: '#3A8B2F', sign: '+' },
    withdrawal:           { label: 'Withdrawal',           color: '#dc2626', sign: '-' },
    stokvel_contribution: { label: 'Contribution',         color: '#E8621A', sign: '-' },
    stokvel_payout:       { label: 'Payout Received',      color: '#3A8B2F', sign: '+' },
    security_deposit:     { label: 'Security Deposit',     color: '#1B2F5E', sign: '-' },
    security_refund:      { label: 'Security Returned',    color: '#3A8B2F', sign: '+' },
    platform_fee:         { label: 'Platform Fee',         color: '#9ca3af', sign: '-' },
    transfer:             { label: 'Transfer',             color: '#1B2F5E', sign: '' },
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>My Wallet</h1>

      {/* Balance Card */}
      <Card>
        {loading ? (
          <p className="text-gray-400 animate-pulse text-center py-4">Loading balance...</p>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-1">Available Balance</p>
            <p className="text-4xl font-bold" style={{ color: '#1B2F5E' }}>
              {wallet?.availableFormatted || 'R0.00'}
            </p>
            {wallet?.lockedDeposits > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                + {wallet.lockedFormatted} in security deposits (returned on completion)
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Deposit and Withdraw */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold text-sm mb-2" style={{ color: '#1B2F5E' }}>Deposit</h3>
          <p className="text-xs text-gray-500 mb-4">
            Instant EFT from any SA bank via Ozow.
          </p>
          <Button variant="green" className="w-full">
            Deposit via Ozow
          </Button>
          <p className="text-xs text-gray-400 mt-2 text-center">Coming soon</p>
        </Card>

        <Card>
          <h3 className="font-bold text-sm mb-2" style={{ color: '#1B2F5E' }}>Withdraw</h3>
          <p className="text-xs text-gray-500 mb-4">
            Transfer to your SA bank account.
          </p>
          <Button variant="outline" className="w-full">
            Withdraw to Bank
          </Button>
          <p className="text-xs text-gray-400 mt-2 text-center">Coming soon</p>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <h3 className="font-bold text-sm mb-3" style={{ color: '#1B2F5E' }}>How the Wallet Works</h3>
        <div className="flex flex-col gap-3 text-sm text-gray-600">
          {[
            { icon: '💳', text: 'Deposit via Ozow — instant EFT from any SA bank' },
            { icon: '🔒', text: 'Contributions auto-deducted on cycle day' },
            { icon: '💰', text: 'Payouts land directly in your wallet instantly' },
            { icon: '🛡️', text: 'Security deposit held safely and returned on completion' },
            { icon: '🏦', text: 'Withdraw to your bank account within 1-2 business days' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-lg">{item.icon}</span>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <h3 className="font-bold mb-3" style={{ color: '#1B2F5E' }}>Recent Transactions</h3>
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-4 animate-pulse">Loading...</p>
        ) : !wallet?.recentTransactions?.length ? (
          <p className="text-gray-400 text-sm text-center py-4">No transactions yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {wallet.recentTransactions.map(tx => {
              const config = txTypeLabel[tx.type] || { label: tx.type, color: '#9ca3af', sign: '' };
              return (
                <div key={tx.id}
                     className="flex items-center justify-between p-3 rounded-xl"
                     style={{ backgroundColor: '#F5F7FA' }}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{config.label}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.createdAt).toLocaleDateString('en-ZA', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-gray-400">{tx.description}</p>
                    )}
                  </div>
                  <p className="font-bold text-sm" style={{ color: config.color }}>
                    {config.sign}R{(tx.amount / 100).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
