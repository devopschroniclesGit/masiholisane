import { useState, useEffect } from 'react';
import { ScrollText, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { adminLogsAPI } from '../../services/api';

function labelForAction(action) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTION_COLORS = {
  approve_id_verification: { bg: '#F0FDF4', color: '#3A8B2F' },
  reject_id_verification:  { bg: '#FEF2F2', color: '#dc2626' },
  cancel_active_group:     { bg: '#FEF2F2', color: '#dc2626' },
  remove_member_forming:   { bg: '#FFF7ED', color: '#E8621A' },
  add_bonus_funds:         { bg: '#EFF6FF', color: '#1B2F5E' },
  create_promo_code:       { bg: '#EFF6FF', color: '#1B2F5E' },
};
const DEFAULT_COLOR = { bg: '#F5F7FA', color: '#374151' };

export default function AdminLogs() {
  const [logs, setLogs]         = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [actions, setActions]   = useState([]);
  const [filters, setFilters]   = useState({ action: '', from: '', to: '' });
  const [loading, setLoading]   = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    adminLogsAPI.actions()
      .then((res) => setActions(res.data.data.actions || []))
      .catch(() => {});
  }, []);

  function load(page = 1) {
    setLoading(true);
    adminLogsAPI.list({ page, limit: pagination.limit, ...filters })
      .then((res) => {
        setLogs(res.data.data.logs || []);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(1); }, [filters]);

  function resetFilters() {
    setFilters({ action: '', from: '', to: '' });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#1B2F5E' }}>
            <ScrollText size={22} /> Audit Logs
          </h1>
          <p className="text-gray-500 text-sm">{pagination.total} total events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm min-w-[200px]"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{labelForAction(a)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
        </div>
        {(filters.action || filters.from || filters.to) && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
          >
            <RotateCcw size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-center py-10 text-gray-400 text-sm">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">No events match these filters</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => {
              const colors = ACTION_COLORS[log.action] || DEFAULT_COLOR;
              const isOpen = expandedId === log.id;
              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : log.id)}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    {isOpen ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                    <span className="text-xs text-gray-400 w-40 flex-shrink-0">
                      {new Date(log.createdAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: colors.bg, color: colors.color }}
                    >
                      {labelForAction(log.action)}
                    </span>
                    <span className="text-sm text-gray-600 flex-1 truncate">
                      {log.admin?.name || 'Unknown admin'} <span className="text-gray-400">({log.admin?.email || log.adminId})</span>
                    </span>
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{log.ipAddress || 'N/A'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pl-13 flex flex-col gap-2">
                      {log.targetId && (
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Target:</span> <span className="font-mono">{log.targetId}</span>
                        </p>
                      )}
                      {log.details && (
                        <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => load(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.pages}</span>
          <button
            onClick={() => load(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
