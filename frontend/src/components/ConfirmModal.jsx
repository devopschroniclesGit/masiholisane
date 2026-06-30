import { AlertCircle, HelpCircle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title       = 'Are you sure?',
  message     = '',
  confirmText = 'Yes, continue',
  cancelText  = 'Cancel',
  variant     = 'warning',
  loading     = false,
}) {
  const config = {
    warning: { Icon: AlertCircle, iconBg: '#FFF7ED', iconColor: '#E8621A', confirmBg: '#E8621A' },
    danger:  { Icon: AlertCircle, iconBg: '#FEF2F2', iconColor: '#DC2626', confirmBg: '#DC2626' },
    info:    { Icon: HelpCircle,  iconBg: '#EFF6FF', iconColor: '#1B2F5E', confirmBg: '#1B2F5E' },
  };
  const v    = config[variant] || config.warning;
  const Icon = v.Icon;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
             style={{ backgroundColor: v.iconBg }}>
          <Icon size={28} style={{ color: v.iconColor }} />
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2F5E' }}>
          {title}
        </h3>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-line">{message}</p>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
            {cancelText}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: v.confirmBg }}>
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
