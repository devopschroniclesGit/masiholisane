import { useState, useEffect } from 'react';
import { UserX, ShieldCheck, AlertTriangle } from 'lucide-react';
import { adminDeletionAPI } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';

export default function AdminDeletions() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  // { user, action: 'process' | 'cancel' } or null
  const [pending, setPending] = useState(null);
  const [working, setWorking] = useState(false);

  function load() {
    setLoading(true);
    adminDeletionAPI.list()
      .then((res) => setUsers(res.data.data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function warningsFor(user) {
    const warnings = [];
    const activeMembership = (user.stokvelMembers || []).find(
      (m) => ['active', 'forming'].includes(m.group?.status)
    );
    if (activeMembership) {
      warnings.push(`Still in a Tier ${activeMembership.group.tier} group (${activeMembership.group.status})`);
    }
    const balance = (user.account?.balance || 0) + (user.account?.bonusBalance || 0);
    if (balance > 0) {
      warnings.push(`Wallet balance of R${(balance / 100).toFixed(2)} will be lost, it does not get refunded automatically`);
    }
    return warnings;
  }

  async function handleConfirm() {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.action === 'process') {
        await adminDeletionAPI.process(pending.user.id);
      } else {
        await adminDeletionAPI.cancel(pending.user.id);
      }
      setPending(null);
      setReason('');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not complete this action');
    } finally {
      setWorking(false);
    }
  }

  const warnings = pending?.action === 'process' ? warningsFor(pending.user) : [];

  const modalCopy = pending?.action === 'process'
    ? {
        title: 'Process Account Deletion?',
        message: warnings.length > 0
          ? `${pending.user.name}'s account will be anonymized and deactivated.\n\n${warnings.join('\n')}\n\nThis cannot be undone.`
          : `${pending?.user?.name}'s account will be anonymized and deactivated. This cannot be undone.`,
        confirmText: 'Yes, process deletion',
        variant: 'danger',
      }
    : {
        title: 'Cancel Deletion Request?',
        message: `${pending?.user?.name}'s account will be left exactly as it is. They can submit a new deletion request later if they still want to.`,
        confirmText: 'Yes, cancel request',
        variant: 'warning',
      };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Account Deletion Requests</h1>
        <p className="text-gray-500 text-sm">{users.length} pending</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400 text-sm">
          No pending deletion requests
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => {
            const userWarnings = warningsFor(user);
            return (
              <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#1B2F5E' }}>{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email || user.phone}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested {new Date(user.deletionRequestedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setPending({ user, action: 'cancel' })}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      <ShieldCheck size={14} /> Cancel Request
                    </button>
                    <button
                      onClick={() => setPending({ user, action: 'process' })}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ backgroundColor: '#dc2626' }}
                    >
                      <UserX size={14} /> Process Deletion
                    </button>
                  </div>
                </div>

                {userWarnings.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {userWarnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg text-xs text-amber-800 bg-amber-50 border border-amber-200">
                        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        title={modalCopy.title}
        message={modalCopy.message}
        confirmText={modalCopy.confirmText}
        cancelText="Go back"
        variant={modalCopy.variant}
        loading={working}
      />
    </div>
  );
}
