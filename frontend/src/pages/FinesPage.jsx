import React, { useState, useMemo } from 'react';
import Modal from '../components/Modal';

export function FinesPage({
  loans = [],
  overdueLoans = [],
  isLoading,
  onPayFine,
  onReturnLoan,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState('overdue'); // 'overdue' | 'returned_unpaid' | 'all'
  const [search, setSearch] = useState('');

  // Settle fine modal
  const [settlingLoan, setSettlingLoan] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Return overdue loan modal
  const [returningLoan, setReturningLoan] = useState(null);
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Unreturned overdue loans
  const unreturnedOverdue = overdueLoans;

  // Returned loans with unpaid fines
  const returnedWithUnpaidFines = useMemo(() => {
    return loans.filter((l) => {
      if (l.status !== 'RETURNED') return false;
      const balance = (Number(l.fine_amount) || 0) - (Number(l.paid_amount) || 0);
      return balance > 0;
    });
  }, [loans]);

  // All loans with unpaid fines (either unreturned overdue or returned unpaid)
  const allUnpaidLoans = useMemo(() => {
    const map = new Map();
    unreturnedOverdue.forEach((l) => map.set(l.id, l));
    returnedWithUnpaidFines.forEach((l) => map.set(l.id, l));
    return Array.from(map.values());
  }, [unreturnedOverdue, returnedWithUnpaidFines]);

  // Aggregate metrics
  const totalAccruedFine = allUnpaidLoans.reduce(
    (acc, l) => acc + (Number(l.fine_amount) || 0),
    0
  );
  const totalPaidFine = allUnpaidLoans.reduce(
    (acc, l) => acc + (Number(l.paid_amount) || 0),
    0
  );
  const totalOutstanding = Math.max(0, totalAccruedFine - totalPaidFine);

  const displayedList = useMemo(() => {
    let list = [];
    if (activeTab === 'overdue') {
      list = unreturnedOverdue;
    } else if (activeTab === 'returned_unpaid') {
      list = returnedWithUnpaidFines;
    } else {
      list = allUnpaidLoans;
    }

    if (!search.trim()) return list;

    const query = search.toLowerCase();
    return list.filter((l) => {
      const book = (l.book_title || '').toLowerCase();
      const member = (l.member_name || '').toLowerCase();
      const code = (l.member_code || '').toLowerCase();
      const isbn = (l.book_isbn || '').toLowerCase();
      return (
        book.includes(query) ||
        member.includes(query) ||
        code.includes(query) ||
        isbn.includes(query)
      );
    });
  }, [activeTab, unreturnedOverdue, returnedWithUnpaidFines, allUnpaidLoans, search]);

  const handleOpenSettle = (loan) => {
    setSettlingLoan(loan);
    const balance = (Number(loan.fine_amount) || 0) - (Number(loan.paid_amount) || 0);
    setPayAmount(balance > 0 ? String(balance) : '');
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!settlingLoan) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      showToast({ type: 'warning', message: 'Enter a valid payment amount.' });
      return;
    }

    setIsSubmittingPay(true);
    try {
      await onPayFine(settlingLoan.id, amount);
      showToast({
        type: 'success',
        message: `Settled ₹${amount.toFixed(2)} fine for Loan #${settlingLoan.id}.`,
      });
      setSettlingLoan(null);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Payment recording failed.' });
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returningLoan) return;
    setIsSubmittingReturn(true);
    try {
      const res = await onReturnLoan(returningLoan.id, { return_date: returnDate });
      showToast({
        type: 'success',
        message: `Loan #${returningLoan.id} returned! Overdue fine of ₹${res.fine_amount} recorded.`,
      });
      setReturningLoan(null);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to return overdue loan.' });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="page-container fines-page">
      {/* Top Fine Summary Metrics */}
      <section className="stats-grid">
        <div className="stat-card stat-danger">
          <div className="stat-header">
            <span className="stat-title">Active Overdue Loans</span>
            <span className="stat-icon">⚠️</span>
          </div>
          <div className="stat-value">{unreturnedOverdue.length}</div>
          <div className="stat-subtitle">Currently unreturned past due date</div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-header">
            <span className="stat-title">Total Fines Accrued</span>
            <span className="stat-icon">📈</span>
          </div>
          <div className="stat-value">₹{totalAccruedFine.toFixed(2)}</div>
          <div className="stat-subtitle">Calculated at ₹10.00 / day</div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-header">
            <span className="stat-title">Total Fines Collected</span>
            <span className="stat-icon">💰</span>
          </div>
          <div className="stat-value">₹{totalPaidFine.toFixed(2)}</div>
          <div className="stat-subtitle">Recorded librarian settlements</div>
        </div>

        <div className="stat-card stat-primary">
          <div className="stat-header">
            <span className="stat-title">Net Outstanding Balance</span>
            <span className="stat-icon">⚖️</span>
          </div>
          <div className="stat-value">₹{totalOutstanding.toFixed(2)}</div>
          <div className="stat-subtitle">Pending payment collection</div>
        </div>
      </section>

      {/* Tabs and Search Bar */}
      <div className="page-actions-bar card">
        <div className="tab-buttons-group">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'overdue' ? 'active' : ''}`}
            onClick={() => setActiveTab('overdue')}
          >
            ⚠️ Active Overdue ({unreturnedOverdue.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'returned_unpaid' ? 'active' : ''}`}
            onClick={() => setActiveTab('returned_unpaid')}
          >
            📥 Returned Unpaid ({returnedWithUnpaidFines.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            📋 All Unsettled ({allUnpaidLoans.length})
          </button>
        </div>

        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="form-control search-input"
            placeholder="Search borrower or book..."
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
      </div>

      {/* Overdue & Fines Ledger */}
      <div className="card table-card">
        <div className="card-header-flex">
          <h3 className="card-title">
            💰 Overdue & Fine Ledger ({displayedList.length})
          </h3>
          <span className="text-muted-sm">
            Fine Rate: ₹10.00 / calendar day overdue
          </span>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading fines data...</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="empty-state">
            <p>
              {activeTab === 'overdue'
                ? '🎉 Fantastic! There are no unreturned overdue books currently.'
                : 'No fine records match your current view.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loan</th>
                  <th>Book Title</th>
                  <th>Borrower</th>
                  <th>Due Date</th>
                  <th>Overdue Days</th>
                  <th>Accrued Fine</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedList.map((loan) => {
                  const isReturned = loan.status === 'RETURNED';
                  const balance =
                    (Number(loan.fine_amount) || 0) - (Number(loan.paid_amount) || 0);

                  return (
                    <tr key={loan.id}>
                      <td>
                        <span className="loan-id-tag">#{loan.id}</span>
                      </td>
                      <td>
                        <span className="fw-600">{loan.book_title}</span>
                      </td>
                      <td>
                        <div className="member-name-cell">
                          <span>{loan.member_name}</span>
                          <span className="text-muted-xs">{loan.member_code}</span>
                        </div>
                      </td>
                      <td>
                        <span className={!isReturned ? 'text-danger fw-600' : ''}>
                          {loan.due_date}
                        </span>
                      </td>
                      <td>
                        <span className="overdue-days-pill">
                          {loan.overdue_days || 0} days
                        </span>
                      </td>
                      <td>₹{Number(loan.fine_amount || 0).toFixed(2)}</td>
                      <td>₹{Number(loan.paid_amount || 0).toFixed(2)}</td>
                      <td>
                        <span className="fine-tag fine-unpaid fw-600">
                          ₹{balance.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${(loan.status || '').toLowerCase()}`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="action-buttons-group">
                          {!isReturned && (
                            <button
                              type="button"
                              className="btn btn-success btn-xs"
                              title="Return Book"
                              onClick={() => setReturningLoan(loan)}
                            >
                              📥 Return
                            </button>
                          )}
                          {balance > 0 && (
                            <button
                              type="button"
                              className="btn btn-warning btn-xs"
                              title="Collect Fine Payment"
                              onClick={() => handleOpenSettle(loan)}
                            >
                              💰 Settle Fine
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

      {/* Settle Fine Modal */}
      {settlingLoan && (
        <Modal
          isOpen={Boolean(settlingLoan)}
          onClose={() => setSettlingLoan(null)}
          title="💰 Collect Fine Payment"
          maxWidth="460px"
        >
          <form onSubmit={handleSubmitPayment} className="modal-form">
            <div className="return-summary-card">
              <div className="return-meta-item">
                <span className="meta-label">Loan ID:</span>
                <span className="meta-val">#{settlingLoan.id}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Borrower:</span>
                <span className="meta-val fw-600">{settlingLoan.member_name}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Book:</span>
                <span className="meta-val">{settlingLoan.book_title}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Total Fine Accrued:</span>
                <span className="meta-val">₹{Number(settlingLoan.fine_amount || 0).toFixed(2)}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Amount Paid:</span>
                <span className="meta-val">₹{Number(settlingLoan.paid_amount || 0).toFixed(2)}</span>
              </div>
              <div className="return-meta-item">
                <span className="meta-label">Outstanding Balance:</span>
                <span className="meta-val fw-600 text-danger">
                  ₹{((Number(settlingLoan.fine_amount) || 0) - (Number(settlingLoan.paid_amount) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fines-pay-amount">
                Payment Amount (₹) <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-prefix">₹</span>
                <input
                  id="fines-pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={((Number(settlingLoan.fine_amount) || 0) - (Number(settlingLoan.paid_amount) || 0))}
                  className="form-control"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const bal = (Number(settlingLoan.fine_amount) || 0) - (Number(settlingLoan.paid_amount) || 0);
                    setPayAmount(String(bal));
                  }}
                >
                  Pay Full Balance
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSettlingLoan(null)}
                disabled={isSubmittingPay}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-warning"
                disabled={isSubmittingPay}
              >
                {isSubmittingPay ? 'Recording Payment...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Return Loan Modal */}
      {returningLoan && (
        <Modal
          isOpen={Boolean(returningLoan)}
          onClose={() => setReturningLoan(null)}
          title="📥 Return Overdue Book"
          maxWidth="480px"
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
              <label className="form-label" htmlFor="return-date-fine">
                Return Date
              </label>
              <input
                id="return-date-fine"
                type="date"
                className="form-control"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReturningLoan(null)}
                disabled={isSubmittingReturn}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success"
                disabled={isSubmittingReturn}
              >
                {isSubmittingReturn ? 'Processing...' : 'Confirm Return'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default FinesPage;
