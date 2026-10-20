import React, { useState, useMemo } from 'react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const INITIAL_MEMBER_FORM = {
  member_code: '',
  name: '',
  email: '',
  phone: '',
  status: 'ACTIVE',
  max_borrow_limit: 3,
};

export function MembersPage({
  members = [],
  isLoading,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  showToast,
  externalAddModalOpen = false,
  onCloseExternalAddModal = () => {},
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form Modal
  const [internalFormModalOpen, setInternalFormModalOpen] = useState(false);
  const isFormModalOpen = internalFormModalOpen || externalAddModalOpen;
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState(INITIAL_MEMBER_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Details Modal
  const [viewingMember, setViewingMember] = useState(null);

  // Delete / Deactivate Confirm Modal
  const [deletingMember, setDeletingMember] = useState(null);
  const [deleteAction, setDeleteAction] = useState('delete'); // 'delete' or 'deactivate'
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleOpenCreate = () => {
    setEditingMember(null);
    setFormData(INITIAL_MEMBER_FORM);
    setFormErrors({});
    setInternalFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setInternalFormModalOpen(false);
    onCloseExternalAddModal();
  };

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      if (statusFilter !== 'ALL' && member.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = (member.name || '').toLowerCase().includes(query);
        const matchesCode = (member.member_code || '').toLowerCase().includes(query);
        const matchesEmail = (member.email || '').toLowerCase().includes(query);
        const matchesPhone = (member.phone || '').toLowerCase().includes(query);
        return matchesName || matchesCode || matchesEmail || matchesPhone;
      }
      return true;
    });
  }, [members, search, statusFilter]);

  const handleOpenEdit = (member) => {
    setEditingMember(member);
    setFormData({
      member_code: member.member_code || '',
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      status: member.status || 'ACTIVE',
      max_borrow_limit: member.max_borrow_limit || 3,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.member_code || !formData.member_code.trim()) {
      errors.member_code = 'Member Code is required.';
    }
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Full Name is required.';
    }
    if (!formData.email || !formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Valid email address is required.';
    }
    const limit = Number(formData.max_borrow_limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      errors.max_borrow_limit = 'Max borrow limit must be between 1 and 10.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingMember) {
        await onUpdateMember(editingMember.id, formData);
        showToast({ type: 'success', message: `Member "${formData.name}" updated successfully.` });
      } else {
        await onCreateMember(formData);
        showToast({ type: 'success', message: `Member "${formData.name}" registered successfully.` });
      }
      handleCloseFormModal();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to save member record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (member, action = 'delete') => {
    setDeletingMember(member);
    setDeleteAction(action);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteMember(deletingMember.id, deleteAction);
      const actionLabel = deleteAction === 'deactivate' ? 'deactivated' : 'removed';
      showToast({
        type: 'success',
        message: `Member "${deletingMember.name}" ${actionLabel} successfully.`,
      });
      setDeletingMember(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to process member deletion/deactivation.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="page-container members-page">
      {/* Search and Filters Bar */}
      <div className="page-actions-bar card">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="form-control search-input"
              placeholder="Search by name, code, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-select-wrap">
            <select
              className="form-control form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Member Status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="page-action-buttons">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreate}
          >
            <span className="btn-icon">👤</span> Register Member
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="card table-card">
        <div className="card-header-flex">
          <h3 className="card-title">
            👥 Registered Members ({filteredMembers.length} of {members.length})
          </h3>
          <span className="text-muted-sm">
            {statusFilter === 'ALL' ? 'Showing all members' : `Filtered: ${statusFilter}`}
          </span>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading members from MySQL database...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="empty-state">
            <p>No members match your search or filter criteria.</p>
            {(search || statusFilter !== 'ALL') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Member Code</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Borrow Limit</th>
                  <th>Active Loans</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-name-cell">
                        <span className="fw-600">{member.name}</span>
                        <span className="text-muted-xs">ID #{member.id}</span>
                      </div>
                    </td>
                    <td>
                      <code className="code-badge">{member.member_code}</code>
                    </td>
                    <td>
                      <div className="contact-cell">
                        <span>{member.email}</span>
                        {member.phone && <span className="text-muted-xs">{member.phone}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${(member.status || '').toLowerCase()}`}>
                        {member.status}
                      </span>
                    </td>
                    <td>
                      <span className="borrow-limit-tag">
                        Max {member.max_borrow_limit || 3}
                      </span>
                    </td>
                    <td>
                      <span className="active-loans-tag">
                        {member.active_loans_count !== undefined ? member.active_loans_count : '0'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="btn-action btn-view"
                          title="View Member Details"
                          onClick={() => setViewingMember(member)}
                        >
                          👁️
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-edit"
                          title="Edit Member"
                          onClick={() => handleOpenEdit(member)}
                        >
                          ✏️
                        </button>
                        {member.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            className="btn-action btn-warning-action"
                            title="Deactivate Member"
                            onClick={() => handleDeleteClick(member, 'deactivate')}
                          >
                            ⏸️
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn-action btn-delete"
                          title="Delete Member"
                          onClick={() => handleDeleteClick(member, 'delete')}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register / Edit Member Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => handleCloseFormModal()}
        title={editingMember ? '✏️ Edit Member Profile' : '👤 Register New Member'}
        maxWidth="520px"
      >
        <form onSubmit={handleSubmitForm} className="modal-form">
          <div className="form-row">
            <div className="form-group form-col">
              <label className="form-label" htmlFor="member-code">
                Member Code <span className="text-danger">*</span>
              </label>
              <input
                id="member-code"
                type="text"
                className={`form-control ${formErrors.member_code ? 'is-invalid' : ''}`}
                placeholder="e.g. MEM-1006"
                value={formData.member_code}
                onChange={(e) => setFormData({ ...formData, member_code: e.target.value })}
                required
              />
              {formErrors.member_code && (
                <div className="invalid-feedback">{formErrors.member_code}</div>
              )}
            </div>

            <div className="form-group form-col">
              <label className="form-label" htmlFor="member-status">
                Status
              </label>
              <select
                id="member-status"
                className="form-control form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="member-name">
              Full Name <span className="text-danger">*</span>
            </label>
            <input
              id="member-name"
              type="text"
              className={`form-control ${formErrors.name ? 'is-invalid' : ''}`}
              placeholder="e.g. Priyanshu Sen"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            {formErrors.name && <div className="invalid-feedback">{formErrors.name}</div>}
          </div>

          <div className="form-row">
            <div className="form-group form-col">
              <label className="form-label" htmlFor="member-email">
                Email Address <span className="text-danger">*</span>
              </label>
              <input
                id="member-email"
                type="email"
                className={`form-control ${formErrors.email ? 'is-invalid' : ''}`}
                placeholder="priyanshu@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {formErrors.email && <div className="invalid-feedback">{formErrors.email}</div>}
            </div>

            <div className="form-group form-col">
              <label className="form-label" htmlFor="member-phone">
                Phone Number
              </label>
              <input
                id="member-phone"
                type="text"
                className="form-control"
                placeholder="+91-9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="member-limit">
              Max Active Borrow Limit (1 - 10)
            </label>
            <input
              id="member-limit"
              type="number"
              min="1"
              max="10"
              className={`form-control ${formErrors.max_borrow_limit ? 'is-invalid' : ''}`}
              value={formData.max_borrow_limit}
              onChange={(e) => setFormData({ ...formData, max_borrow_limit: e.target.value })}
              required
            />
            <span className="form-hint">System default is 3 books per member.</span>
            {formErrors.max_borrow_limit && (
              <div className="invalid-feedback">{formErrors.max_borrow_limit}</div>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleCloseFormModal()}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : editingMember ? 'Update Profile' : 'Register Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Member Details Modal */}
      {viewingMember && (
        <Modal
          isOpen={Boolean(viewingMember)}
          onClose={() => setViewingMember(null)}
          title="👤 Member Profile"
          maxWidth="480px"
          footer={
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingMember(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const m = viewingMember;
                  setViewingMember(null);
                  handleOpenEdit(m);
                }}
              >
                Edit Profile
              </button>
            </div>
          }
        >
          <div className="details-card-body">
            <div className="details-header-block">
              <h4 className="details-title">{viewingMember.name}</h4>
              <p className="details-subtitle">
                <code className="code-badge">{viewingMember.member_code}</code> •{' '}
                <span className={`status-badge status-${(viewingMember.status || '').toLowerCase()}`}>
                  {viewingMember.status}
                </span>
              </p>
            </div>
            <div className="details-grid">
              <div className="details-row">
                <span className="details-label">Email:</span>
                <span>{viewingMember.email}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Phone:</span>
                <span>{viewingMember.phone || 'Not Provided'}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Borrow Limit:</span>
                <span className="fw-600">{viewingMember.max_borrow_limit || 3} books</span>
              </div>
              <div className="details-row">
                <span className="details-label">Currently Borrowed:</span>
                <span className="fw-600">{viewingMember.active_loans_count || 0} active loans</span>
              </div>
              <div className="details-row">
                <span className="details-label">Registered Since:</span>
                <span>{viewingMember.created_at ? new Date(viewingMember.created_at).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete / Deactivate Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deletingMember)}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleConfirmDelete}
        title={deleteAction === 'deactivate' ? '⏸️ Deactivate Member' : '⚠️ Remove Member Record'}
        message={
          deletingMember
            ? deleteAction === 'deactivate'
              ? `Are you sure you want to deactivate "${deletingMember.name}" (${deletingMember.member_code})? Inactive members cannot borrow new books.`
              : `Are you sure you want to delete member "${deletingMember.name}" (${deletingMember.member_code})? Members with active loans cannot be removed.`
            : ''
        }
        confirmText={deleteAction === 'deactivate' ? 'Deactivate Member' : 'Delete Member'}
        isDanger={true}
        isLoading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}

export default MembersPage;
