import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import Modal from './Modal';

const VARIANTS = {
  success: {
    Icon: CheckCircle2,
    iconBg: '#F0FDF4',
    iconColor: '#3A8B2F',
    title: 'Success',
    buttonColor: '#3A8B2F',
  },
  error: {
    Icon: AlertCircle,
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    title: 'Something went wrong',
    buttonColor: '#1B2F5E',
  },
  info: {
    Icon: Info,
    iconBg: '#EFF6FF',
    iconColor: '#1B2F5E',
    title: 'Notice',
    buttonColor: '#1B2F5E',
  },
};

export default function AlertModal({ open, onClose, variant = 'info', title, message, buttonText = 'Got it' }) {
  const v = VARIANTS[variant] || VARIANTS.info;
  const Icon = v.Icon;
  const displayTitle = title || v.title;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
             style={{ backgroundColor: v.iconBg }}>
          <Icon size={28} style={{ color: v.iconColor }} />
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: '#1B2F5E' }}>
          {displayTitle}
        </h3>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-line">{message}</p>
        <button onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
          style={{ backgroundColor: v.buttonColor }}>
          {buttonText}
        </button>
      </div>
    </Modal>
  );
}
