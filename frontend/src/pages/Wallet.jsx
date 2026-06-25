import { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';

export default function Wallet() {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    // Balance will come from account-service in Phase 4
    // For now show placeholder
    setBalance(null);
  }, []);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>My Wallet</h1>

      <Card>
        <p className="text-xs text-gray-500 mb-1">Available Balance</p>
        <p className="text-4xl font-bold" style={{ color: '#1B2F5E' }}>
          {balance !== null ? `R${(balance / 100).toLocaleString()}` : '—'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Updated just now</p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold text-sm mb-3" style={{ color: '#1B2F5E' }}>Deposit</h3>
          <p className="text-xs text-gray-500 mb-4">
            Add money to your wallet via EFT, card, or instant transfer.
          </p>
          <Button variant="green" className="w-full">
            Deposit via PayFast
          </Button>
          <p className="text-xs text-gray-400 mt-2 text-center">Coming in Phase 4</p>
        </Card>

        <Card>
          <h3 className="font-bold text-sm mb-3" style={{ color: '#1B2F5E' }}>Withdraw</h3>
          <p className="text-xs text-gray-500 mb-4">
            Transfer your balance to your South African bank account.
          </p>
          <Button variant="outline" className="w-full">
            Withdraw to Bank
          </Button>
          <p className="text-xs text-gray-400 mt-2 text-center">Coming in Phase 4</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold text-sm mb-3" style={{ color: '#1B2F5E' }}>How the Wallet Works</h3>
        <div className="flex flex-col gap-3 text-sm text-gray-600">
          {[
            { icon: '💳', text: 'Deposit money via PayFast — EFT, card, or instant EFT' },
            { icon: '🔒', text: 'Contributions are auto-deducted on cycle day' },
            { icon: '💰', text: 'Payouts land directly in your wallet' },
            { icon: '🏦', text: 'Withdraw to your bank account anytime' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-lg">{item.icon}</span>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
