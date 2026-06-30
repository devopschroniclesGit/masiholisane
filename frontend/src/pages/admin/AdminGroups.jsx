import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../../services/api';
import TierBadge from '../../components/TierBadge';
import ConfirmModal from '../../components/ConfirmModal';
import AlertModal from '../../components/AlertModal';

export default function AdminGroups() {
  const navigate = useNavigate();
  const [groups, setGroups]   = useState([]);
  const [filter, setFilter]   = useState('');
  const [loading, setLoading] = useState(true);

  const [removeTarget, setRemoveTarget] = useState(null); // { groupId, userId, name }
  const [removing, setRemoving]         = useState(false);
  const [alert, setAlert]               = useState(null); // { variant, title, message }

  function load(status = '') {
    setLoading(true);
    const url = status ? `/admin/dashboard/groups?status=${status}` : '/admin/dashboard/groups';
    api.get(url)
      .then(res => setGroups(res.data.data.groups || []))
      .catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.post(`/admin/dashboard/groups/${removeTarget.groupId}/remove-member`, {
        userId: removeTarget.userId,
        reason: 'Admin removed via dashboard',
      });
      setAlert({ variant: 'success', title: 'Member Removed', message: `${removeTarget.name} has been removed from the group.` });
      setRemoveTarget(null);
      load(filter);
    } catch (err) {
      setAlert({ variant: 'error', title: 'Could Not Remove Member', message: err.response?.data?.message || 'Failed to remove member' });
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  }

  const sc = {
    active:    { bg: '#dcfce7', text: '#3A8B2F' },
    forming:   { bg: '#fef9c3', text: '#92400e' },
    completed: { bg: '#dbeafe', text: '#1B2F5E' },
    cancelled: { bg: '#fee2e2', text: '#dc2626' },
    suspended: { bg: '#ffedd5', text: '#E8621A' },
  };

  const tierLabels = { 1: 'Starter R500', 2: 'Builder R1,000', 3: 'Wealth R2,000' };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1B2F5E' }}>Groups</h1>
          <p className="text-gray-500 text-sm">{groups.length} groups</p>
        </div>
        <select value={filter} onChange={e => { setFilter(e.target.value); load(e.target.value); }}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none w-full sm:w-auto">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="forming">Forming</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-8 animate-pulse">Loading...</p>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">No groups found</div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(group => {
            const s = sc[group.status] || { bg: '#F5F7FA', text: '#9ca3af' };
            const paid = group.cycles?.filter(c => c.status === 'paid').length || 0;
            const canRemove = ['forming', 'active'].includes(group.status);

            return (
              <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TierBadge tier={group.tier} />
                    <span className="text-sm font-semibold text-gray-700">{tierLabels[group.tier]}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(group.createdAt).toLocaleDateString('en-ZA')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full"
                          style={{ backgroundColor: s.bg, color: s.text }}>
                      {group.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">Cycle {paid}/3</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {group.members?.map(m => (
                    <div key={m.id} className="p-3 rounded-xl text-xs flex items-start justify-between gap-2"
                         style={{ backgroundColor: '#F5F7FA' }}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-700 truncate">{m.user?.name}</p>
                        <p className="text-gray-400">Pos {m.position} {m.status}</p>
                      </div>
                      {canRemove && (
                        <button
                          onClick={() => setRemoveTarget({
                            groupId: group.id, userId: m.userId, name: m.user?.name
                          })}
                          className="flex-shrink-0 p-1 rounded-lg hover:bg-red-50 transition"
                          title="Remove from group">
                          <X size={14} style={{ color: '#DC2626' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {group.escrow && (
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>Fees: <strong style={{ color: '#E8621A' }}>R{(group.escrow.platformFees / 100).toFixed(2)}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Remove Member?"
        message={
          removeTarget
            ? `Are you sure you want to remove ${removeTarget.name} from this group?\n\nThis action is logged and cannot be undone.`
            : ''
        }
        confirmText="Yes, remove member"
        cancelText="Cancel"
        variant="danger"
        loading={removing}
      />

      <AlertModal
        open={!!alert}
        onClose={() => setAlert(null)}
        variant={alert?.variant}
        title={alert?.title}
        message={alert?.message}
      />
    </div>
  );
}
