import { X } from 'lucide-react';

export default function Modal({ open, onClose, children, maxWidth = 'max-w-md' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
         onClick={onClose}>
      <div className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto relative`}
           onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition z-10"
          style={{ color: '#6B7280' }}>
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
