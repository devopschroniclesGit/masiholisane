import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { authAPI, walletAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';

export default function RequestAccountDeletion() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [balance, setBalance]   = useState(null);

  useEffect(() => {
    if (!user?.deletionRequestedAt) {
      walletAPI.getBalance()
        .then((res) => setBalance(res.data.data))
        .catch(() => {});
    }
  }, [user?.deletionRequestedAt]);

  // Same definition used in the admin-side warning: available cash + bonus.
  // Held/locked group reservations aren't included here since those are
  // already covered separately by the "resolve active groups first" copy.
  const atRisk = balance ? balance.available + balance.bonus : 0;

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await authAPI.requestDeletion();
      await refreshUser();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 -mb-2">
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Request Account Deletion</h1>

      {user?.deletionRequestedAt ? (
        <Card>
          <div className="text-center py-6">
            <Clock size={28} className="mx-auto mb-3" style={{ color: '#E8621A' }} />
            <p className="font-bold text-sm mb-1" style={{ color: '#1B2F5E' }}>Request Received</p>
            <p className="text-sm text-gray-500">
              Submitted on {new Date(user.deletionRequestedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.
              We'll review your account and confirm with you before anything is removed.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-gray-600 mb-3">
            This will request that your Masiholisane account and personal data be deleted. Because group savings
            involve money owed to or by other members, we review each request manually rather than deleting
            instantly. If you currently have an active group, outstanding contributions, or a pending payout, we'll
            need to resolve those with you first.
          </p>
          <p className="text-sm text-gray-600 mb-5">
            This does not happen immediately, and you'll remain able to use the app until your request is processed.
          </p>

          {atRisk > 0 && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-xl text-sm text-amber-800 bg-amber-50 border border-amber-200">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                Wallet balance of R{(atRisk / 100).toFixed(2)} will be lost, it does not get refunded automatically.
                Consider withdrawing or spending it first.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <Button variant="danger" className="w-full flex items-center justify-center gap-2" onClick={() => setConfirmOpen(true)}>
            <Trash2 size={16} /> Request Account Deletion
          </Button>
        </Card>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="p-8 text-center">
          <Trash2 size={28} className="mx-auto mb-4" style={{ color: '#dc2626' }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2F5E' }}>Are you sure?</h3>
          <p className="text-sm text-gray-600 mb-4">
            We'll start reviewing your account for deletion. This can't be easily undone once processed.
          </p>
          {atRisk > 0 && (
            <p className="text-sm font-semibold mb-6" style={{ color: '#dc2626' }}>
              R{(atRisk / 100).toFixed(2)} in your wallet will be lost, it is not refunded automatically.
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={() => setConfirmOpen(false)} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: loading ? '#9ca3af' : '#dc2626' }}>
              {loading ? 'Submitting...' : 'Yes, Request Deletion'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
