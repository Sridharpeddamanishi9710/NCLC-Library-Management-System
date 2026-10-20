import React, { useState, useMemo } from 'react';
import Modal from '../components/Modal';

function formatTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateDueDate(issueDateStr, durationDays = 14) {
  const d = new Date(issueDateStr);
  d.setDate(d.getDate() + durationDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeOverdueDetails(dueDateStr, returnDateStr) {
  if (!dueDateStr || !returnDateStr) return { overdueDays: 0, fine: 0 };
  const due = new Date(dueDateStr);
  const ret = new Date(returnDateStr);
  const diffTime = ret.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const overdueDays = Math.max(0, diffDays);
  const fine = overdueDays * 10;
  return { overdueDays, fine };
}

export function CirculationPage({
  loans = [],
  books = [],
  members = [],
  isLoading,
  onIssueLoan,
  onReturnLoan,
  onPayFine,
  showToast,
  externalIssueModalOpen = false,
  onCloseExternalIssueModal = () => {},
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Issue Loan Modal state
  const [internalIssueModalOpen, setInternalIssueModalOpen] = useState(false);
  const isIssueModalOpen = internalIssueModalOpen || externalIssueModalOpen;
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [issueDate, setIssueDate] = useState(formatTodayDate());
  const [dueDate, setDueDate] = useState(calculateDueDate(formatTodayDate(), 14));
  const [issueErrors, setIssueErrors] = useState({});
  const [isIssuing, setIsIssuing] = useState(false);

  // Return Loan Modal state
  const [returningLoan, setReturningLoan] = useState(null);
  const [returnDate, setReturnDate] = useState(formatTodayDate());
  const [isReturning, setIsReturning] = useState(false);

  // Pay Fine Shortcut Modal
  const [payingLoan, setPayingLoan] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Update due date when issue date changes
  const handleIssueDateChange = (val) => {
    setIssueDate(val);
    setDueDate(calculateDueDate(val, 14));
  };

  const handleOpenIssueModal = () => {
    setSelectedBookId('');
    setSelectedMemberId('');
    setIssueDate(formatTodayDate());
    setDueDate(calculateDueDate(formatTodayDate(), 14));
    setIssueErrors({});
    setInternalIssueModalOpen(true);
  };

  const handleCloseIssueModal = () => {
    setInternalIssueModalOpen(false);
    onCloseExternalIssueModal();
  };

  // Filtered loans list
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      if (statusFilter !== 'ALL' && loan.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesBook = (loan.book_title || '').toLowerCase().includes(query);
        const matchesIsbn = (loan.book_isbn || '').toLowerCase().includes(query);
        const matchesMember = (loan.member_name || '').toLowerCase().includes(query);
        const matchesCode = (loan.member_code || '').toLowerCase().includes(query);
        return matchesBook || matchesIsbn || matchesMember || matchesCode;
      }
      return true;
    });
  }, [loans, search, statusFilter]);

  // Selected entities for issue modal validation feedback
  const chosenMember = useMemo(() => {
    return members.find((m) => m.id === Number(selectedMemberId));
  }, [members, selectedMemberId]);

  const chosenBook = useMemo(() => {
    return books.find((b) => b.id === Number(selectedBookId));
  }, [books, selectedBookId]);

  // Active borrow limits
  const isMemberEligible = useMemo(() => {
    if (!chosenMember) return true;
    if (chosenMember.status !== 'ACTIVE') return false;
    const currentActive = chosenMember.active_loans_count || 0;
    const limit = chosenMember.max_borrow_limit || 3;
    return currentActive < limit;
  }, [chosenMember]);

  const isBookAvailable = useMemo(() => {
    if (!chosenBook) return true;
    return (chosenBook.available_copies || 0) > 0;
  }, [chosenBook]);

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!selectedBookId) errors.book = 'Please select a book to issue.';
    if (!selectedMemberId) errors.member = 'Please select a member.';

    if (chosenMember) {
      if (chosenMember.status !== 'ACTIVE') {
        errors.member = `Member status is ${chosenMember.status}. Only ACTIVE members can borrow books.`;
      } else if (!isMemberEligible) {
        errors.member = `Member has reached their borrow limit (${chosenMember.active_loans_count}/${chosenMember.max_borrow_limit}).`;
      }
    }

    if (chosenBook && !isBookAvailable) {
      errors.book = `No copies available for "${chosenBook.title}".`;
    }

    if (Object.keys(errors).length > 0) {
      setIssueErrors(errors);
      return;
    }

    setIsIssuing(true);
    setIssueErrors({});
    try {
      await onIssueLoan({
        book_id: Number(selectedBookId),
        member_id: Number(selectedMemberId),
        issue_date: issueDate,
        due_date: dueDate,
      });
      showToast({
        type: 'success',
        message: `Book "${chosenBook.title}" issued to ${chosenMember.name} (Due: ${dueDate}).`,
      });
      handleCloseIssueModal();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to issue book loan.' });
    } finally {
      setIsIssuing(false);
    }
  };

  const handleOpenReturnModal = (loan) => {
    setReturningLoan(loan);
    setReturnDate(formatTodayDate());
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returningLoan) return;
    setIsReturning(true);
    try {
      const result = await onReturnLoan(returningLoan.id, { return_date: returnDate });
      const fineMsg =
        result.fine_amount > 0
          ? `Overdue by ${result.overdue_days} days. Fine of ₹${result.fine_amount} applied.`
          : 'Returned on time without fines.';
      showToast({
        type: 'success',
        message: `Loan #${returningLoan.id} returned successfully! ${fineMsg}`,
      });
      setReturningLoan(null);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to return book.' });
    } finally {
      setIsReturning(false);
    }
  };

  const handleOpenPayFine = (loan) => {
    setPayingLoan(loan);
    const balance = (Number(loan.fine_amount) || 0) - (Number(loan.paid_amount) || 0);
    setPaymentAmount(balance > 0 ? String(balance) : '');
  };

  const handlePayFineSubmit = async (e) => {
    e.preventDefault();
    if (!payingLoan) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      showToast({ type: 'warning', message: 'Enter a valid payment amount.' });
      return;
    }
    setIsPaying(true);
    try {
      await onPayFine(payingLoan.id, amount);
      showToast({
        type: 'success',
        message: `Payment of ₹${amount.toFixed(2)} recorded for Loan #${payingLoan.id}.`,
      });
      setPayingLoan(null);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to settle fine.' });
    } finally {
      setIsPaying(false);
    }
  };

  const returnCalculation = useMemo(() => {
    if (!returningLoan) return { overdueDays: 0, fine: 0 };
    return computeOverdueDetails(returningLoan.due_date, returnDate);
  }, [returningLoan, returnDate]);

  return (
    <div className="page-container circulation-page">
      {/* Top Filter and Actions Bar */}
      <div className="page-actions-bar card">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="form-control search-input"
              placeholder="Search by book title or borrower name..."
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
              aria-label="Filter by Loan Status"
            >
              <option value="ALL">All Loans</option>
              <option value="ISSUED">Active / Issued</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="RETURNED">Returned</option>
            </select>
          </div>
        </div>

        <div className="page-action-buttons">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenIssueModal}
          >
            <span className="btn-icon">📤</span> Issue Book Loan
          </button>
        </div>
      </div>

      {/* Circulation Table */}
      <div className="card table-card">
        <div className="card-header-flex">
          <h3 className="card-title">
            🔄 Circulation Records ({filteredLoans.length} of {loans.length})
          </h3>
          <span className="text-muted-sm">
            Standard loan period: 14 days • Overdue rate: ₹10/day
          </span>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading circulation ledger from MySQL...</p>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="empty-state">
            <p>No loan records match your current criteria.</p>
            {loans.length === 0 ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenIssueModal}
              >
                Issue First Book
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                }}
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>Book Title</th>
                  <th>Borrower</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Return Date</th>
                  <th>Status</th>
                  <th>Fine Balance</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const isReturned = loan.status === 'RETURNED';
                  const isOverdue = loan.status === 'OVERDUE' || (loan.overdue_days && loan.overdue_days > 0);
                  const fineBalance =
                    (Number(loan.fine_amount) || 0) - (Number(loan.paid_amount) || 0);

                  return (
                    <tr key={loan.id}>
                      <td>
                        <span className="loan-id-tag">#{loan.id}</span>
                      </td>
                      <td>
                        <div className="book-title-cell">
                          <span className="fw-600">{loan.book_title || `Book #${loan.book_id}`}</span>
                          {loan.book_isbn && (
                            <span className="text-muted-xs">ISBN: {loan.book_isbn}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="member-name-cell">
                          <span className="fw-500">{loan.member_name || `Member #${loan.member_id}`}</span>
                          {loan.member_code && (
                            <span className="text-muted-xs">{loan.member_code}</span>
                          )}
                        </div>
                      </td>
                      <td>{loan.issue_date}</td>
                      <td>
                        <span className={isOverdue && !isReturned ? 'text-danger fw-600' : ''}>
                          {loan.due_date}
                        </span>
                      </td>
                      <td>{loan.return_date || <span className="text-muted">—</span>}</td>
                      <td>
                        <span className={`status-badge status-${(loan.status || '').toLowerCase()}`}>
                          {loan.status}
                        </span>
                      </td>
                      <td>
                        {fineBalance > 0 ? (
                          <span className="fine-tag fine-unpaid">
                            ₹{fineBalance.toFixed(2)}
                          </span>
                        ) : loan.fine_amount > 0 ? (
                          <span className="fine-tag fine-paid">Settled</span>
                        ) : (
                          <span className="text-muted-xs">₹0.00</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="action-buttons-group">
                          {!isReturned && (
                            <button
                              type="button"
                              className="btn btn-success btn-xs"
                              title="Process Book Return"
                              onClick={() => handleOpenReturnModal(loan)}
                            >
                              📥 Return
                            </button>
                          )}
                          {fineBalance > 0 && (
                            <button
                              type="button"
                              className="btn btn-warning btn-xs"
                              title="Settle Fine"
                              onClick={() => handleOpenPayFine(loan)}
                            >
                              💰 Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue Book Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => handleCloseIssueModal()}
        title="📤 Issue Book Loan"
        maxWidth="540px"
      >
        <form onSubmit={handleIssueSubmit} className="modal-form">
          {/* Member Picker */}
          <div className="form-group">
            <label className="form-label" htmlFor="issue-member-select">
              Select Member <span className="text-danger">*</span>
            </label>
            <select
              id="issue-member-select"
              className={`form-control form-select ${issueErrors.member ? 'is-invalid' : ''}`}
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              required
            >
              <option value="">-- Choose Borrower --</option>
              {members.map((m) => {
                const isMaxed = (m.active_loans_count || 0) >= (m.max_borrow_limit || 3);
                const isInactive = m.status !== 'ACTIVE';
                const tag = isInactive
                  ? ` [${m.status}]`
                  : isMaxed
                  ? ' [Borrow Limit Reached]'
                  : ` (${m.active_loans_count || 0}/${m.max_borrow_limit || 3} loans)`;
                return (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={isInactive || isMaxed}
                  >
                    {m.name} ({m.member_code}){tag}
                  </option>
                );
              })}
            </select>
            {issueErrors.member && (
              <div className="invalid-feedback">{issueErrors.member}</div>
            )}
            {chosenMember && (
              <div className="member-status-hint">
                Status: <strong>{chosenMember.status}</strong> • Active Loans:{' '}
                <strong>
                  {chosenMember.active_loans_count || 0} / {chosenMember.max_borrow_limit || 3}
                </strong>
              </div>
            )}
          </div>

          {/* Book Picker */}
          <div className="form-group">
            <label className="form-label" htmlFor="issue-book-select">
              Select Book <span className="text-danger">*</span>
            </label>
            <select
              id="issue-book-select"
              className={`form-control form-select ${issueErrors.book ? 'is-invalid' : ''}`}
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              required
            >
              <option value="">-- Choose Book from Catalog --</option>
              {books.map((b) => {
                const outOfStock = (b.available_copies || 0) <= 0;
                return (
                  <option key={b.id} value={b.id} disabled={outOfStock}>
                    {b.title} by {b.author} ({b.available_copies} available)
                    {outOfStock ? ' [OUT OF STOCK]' : ''}
                  </option>
                );
              })}
            </select>
            {issueErrors.book && <div className="invalid-feedback">{issueErrors.book}</div>}
            {chosenBook && (
              <div className="book-status-hint">
                Available: <strong>{chosenBook.available_copies}</strong> of{' '}
                <strong>{chosenBook.total_copies}</strong> copies • Location:{' '}
                <strong>{chosenBook.shelf_location || 'Not set'}</strong>
              </div>
            )}
          </div>

          {/* Date Pickers */}
          <div className="form-row">
            <div className="form-group form-col">
              <label className="form-label" htmlFor="issue-date">
                Issue Date <span className="text-danger">*</span>
              </label>
              <input
                id="issue-date"
                type="date"
                className="form-control"
                value={issueDate}
                onChange={(e) => handleIssueDateChange(e.target.value)}
                required
              />
            </div>

            <div className="form-group form-col">
              <label className="form-label" htmlFor="due-date">
                Due Date (14 Days) <span className="text-danger">*</span>
              </label>
              <input
                id="due-date"
                type="date"
                className="form-control"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleCloseIssueModal()}
              disabled={isIssuing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isIssuing || !isMemberEligible || !isBookAvailable}
            >
              {isIssuing ? 'Issuing...' : 'Confirm Loan Issue'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Book Modal */}
      {returningLoan && (
        <Modal
          isOpen={Boolean(returningLoan)}
          onClose={() => setReturningLoan(null)}
          title="📥 Return Book"
          maxWidth="500px"
        >
          <form onSubmit={handleReturnSubmit} className="modal-form">
            <div className="return-summary-card">
              <div className="return-meta-item">
                <span className="meta-label">Book:</span>
                <span className="meta-val fw-600">{returningLoan.book_title}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Borrower:</span>
                <span className="meta-val">{returningLoan.member_name}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Due Date:</span>
                <span className="meta-val">{returningLoan.due_date}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="return-date-input">
                Return Date
              </label>
              <input
                id="return-date-input"
                type="date"
                className="form-control"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
              />
            </div>

            {/* Overdue calculation display */}
            <div className={`fine-calculation-box ${returnCalculation.overdueDays > 0 ? 'box-overdue' : 'box-ontime'}`}>
              {returnCalculation.overdueDays > 0 ? (
                <>
                  <div className="fine-title">⚠️ Loan is Overdue</div>
                  <div className="fine-details">
                    <span>Overdue Duration: <strong>{returnCalculation.overdueDays} days</strong></span>
                    <span>Fine Rate: <strong>₹10.00 / day</strong></span>
                    <span className="fine-total">Total Fine: <strong>₹{returnCalculation.fine.toFixed(2)}</strong></span>
                  </div>
                </>
              ) : (
                <div className="fine-ontime-text">
                  ✅ Book is returned on time! No overdue fine charged.
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReturningLoan(null)}
                disabled={isReturning}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success"
                disabled={isReturning}
              >
                {isReturning ? 'Processing...' : 'Confirm Book Return'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Pay Fine Modal */}
      {payingLoan && (
        <Modal
          isOpen={Boolean(payingLoan)}
          onClose={() => setPayingLoan(null)}
          title="💰 Settle Overdue Fine"
          maxWidth="460px"
        >
          <form onSubmit={handlePayFineSubmit} className="modal-form">
            <div className="return-summary-card">
              <div className="return-meta-item">
                <span className="meta-label">Loan ID:</span>
                <span className="meta-val">#{payingLoan.id}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Borrower:</span>
                <span className="meta-val">{payingLoan.member_name}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Total Fine:</span>
                <span className="meta-val">₹{Number(payingLoan.fine_amount || 0).toFixed(2)}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Paid So Far:</span>
                <span className="meta-val">₹{Number(payingLoan.paid_amount || 0).toFixed(2)}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Remaining Balance:</span>
                <span className="meta-val fw-600 text-danger">
                  ₹{((Number(payingLoan.fine_amount) || 0) - (Number(payingLoan.paid_amount) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pay-fine-amount">
                Payment Amount (₹) <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-prefix">₹</span>
                <input
                  id="pay-fine-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={((Number(payingLoan.fine_amount) || 0) - (Number(payingLoan.paid_amount) || 0))}
                  className="form-control"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const bal = (Number(payingLoan.fine_amount) || 0) - (Number(payingLoan.paid_amount) || 0);
                    setPaymentAmount(String(bal));
                  }}
                >
                  Pay Full
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPayingLoan(null)}
                disabled={isPaying}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-warning"
                disabled={isPaying}
              >
                {isPaying ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default CirculationPage;
