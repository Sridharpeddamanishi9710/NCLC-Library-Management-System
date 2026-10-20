import React from 'react';
import Modal from './Modal';

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isLoading = false,
  error = null,
}) {
  const footer = (
    <div className="modal-actions">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClose}
        disabled={isLoading}
      >
        {cancelText}
      </button>
      <button
        type="button"
        className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
        onClick={onConfirm}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : confirmText}
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} maxWidth="460px">
      <div className="confirm-modal-content">
        {error && <div className="alert alert-error">{error}</div>}
        <p className="confirm-modal-text">{message}</p>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
