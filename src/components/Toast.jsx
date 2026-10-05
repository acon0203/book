import React from 'react';
import './Toast.css';
import { useStore } from '../store';
import { CheckCircle2, AlertCircle, Info, HelpCircle } from 'lucide-react';

export default function Toast() {
  const toast = useStore((state) => state.toast);
  if (!toast) return null;

  const renderIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={16} color="var(--success)" />;
      case 'error':
        return <AlertCircle size={16} color="var(--danger)" />;
      case 'action':
        return <HelpCircle size={18} color="var(--primary)" />;
      default:
        return <Info size={16} color="var(--primary)" />;
    }
  };

  return (
    <div className="toast-container">
      <div className={`toast ${toast.type || 'info'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {renderIcon()}
          <span>{toast.message}</span>
        </div>

        {toast.isAction && (
          <div className="toast-actions">
            <button className="toast-btn-no" onClick={toast.onNo}>
              {toast.noText || 'No'}
            </button>
            <button className="toast-btn-yes" onClick={toast.onYes}>
              {toast.yesText || 'Yes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
