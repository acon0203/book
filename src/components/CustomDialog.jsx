import React, { useState, useEffect, useRef } from 'react';
import './CustomDialog.css';
import { useStore } from '../store';
import { HelpCircle, AlertTriangle, Edit3, X } from 'lucide-react';

export default function CustomDialog() {
  const dialog = useStore((state) => state.dialog);
  const closeDialog = useStore((state) => state.closeDialog);

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (dialog) {
      if (dialog.type === 'prompt') {
        setInputValue(dialog.defaultValue || '');
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }, 30);
      } else {
        setTimeout(() => {
          confirmBtnRef.current?.focus();
        }, 30);
      }
    }
  }, [dialog]);

  // ESC 및 전역 키보드 제어
  useEffect(() => {
    if (!dialog) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog(null);
      } else if (e.key === 'Enter') {
        if (dialog.type === 'prompt') {
          e.preventDefault();
          closeDialog(inputValue);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, inputValue, closeDialog]);

  if (!dialog) return null;

  const handleConfirm = () => {
    if (dialog.type === 'prompt') {
      closeDialog(inputValue);
    } else {
      closeDialog(true);
    }
  };

  const handleCancel = () => {
    closeDialog(dialog.type === 'prompt' ? null : false);
  };

  const renderIcon = () => {
    if (dialog.danger) {
      return <div className="dialog-icon-badge danger"><AlertTriangle size={20} /></div>;
    }
    if (dialog.type === 'prompt') {
      return <div className="dialog-icon-badge prompt"><Edit3 size={19} /></div>;
    }
    return <div className="dialog-icon-badge info"><HelpCircle size={20} /></div>;
  };

  return (
    <div className="custom-dialog-overlay" onClick={handleCancel}>
      <div
        className={`custom-dialog-card ${dialog.danger ? 'danger-theme' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="dialog-close-btn"
          onClick={handleCancel}
          title="닫기 (Esc)"
        >
          <X size={16} />
        </button>

        <div className="dialog-header">
          {renderIcon()}
          <div className="dialog-title-wrap">
            <h3 className="dialog-title">{dialog.title}</h3>
            {dialog.message && (
              <div className="dialog-message">
                {dialog.message.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {dialog.type === 'prompt' && (
          <div className="dialog-body">
            <input
              ref={inputRef}
              type="text"
              className="dialog-input"
              value={inputValue}
              placeholder={dialog.placeholder || '내용을 입력하세요'}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
          </div>
        )}

        <div className="dialog-footer">
          <button
            type="button"
            className="dialog-btn btn-cancel"
            onClick={handleCancel}
          >
            {dialog.cancelText || '취소'}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`dialog-btn btn-confirm ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
          >
            {dialog.confirmText || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
