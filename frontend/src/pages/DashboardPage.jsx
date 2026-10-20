import React from 'react';
import StatCard from '../components/StatCard';

export function DashboardPage({
  books = [],
  members = [],
  loans = [],
  overdueLoans = [],
  onNavigate,
  onOpenIssueModal,
  onOpenAddBookModal,
  onOpenAddMemberModal,
}) {
  // Aggregate metrics
  const totalBooks = books.length;
  const totalCopies = books.reduce((acc, b) => acc + (Number(b.total_copies) || 0), 0);
  const availableCopies = books.reduce((acc, b) => acc + (Number(b.available_copies) || 0), 0);
  const issuedCopies = Math.max(0, totalCopies - availableCopies);

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === 'ACTIVE').length;

  const activeLoans = loans.filter((l) => l.status === 'ISSUED').length;
  const overdueCount = overdueLoans.length;

  // Total pending fines across overdue and unreturned loans
  const totalPendingFines = overdueLoans.reduce(
    (acc, l) => acc + (Number(l.fine_amount) || 0) - (Number(l.paid_amount) || 0),
    0
  );

  const lowStockBooks = [...books]
    .filter((b) => b.available_copies <= 1)
    .slice(0, 5);

  const recentLoans = [...loans].slice(0, 5);

  return (
    <div className="page-container dashboard-page">
      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="alert-banner-overdue">
          <div className="alert-banner-content">
            <span className="alert-banner-icon">⚠️</span>
            <div>
              <strong>{overdueCount} Overdue {overdueCount === 1 ? 'Loan' : 'Loans'} Requiring Attention</strong>
              <p>
                Total pending fine amount: <strong>₹{totalPendingFines.toFixed(2)}</strong> (accruing at ₹10.00/day).
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-warning btn-sm"
            onClick={() => onNavigate('fines')}
          >
            Manage Fines →
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <section className="stats-grid">
        <StatCard
          title="Total Book Titles"
          value={totalBooks}
          subtitle={`${totalCopies} total copies in inventory`}
          icon="📚"
          variant="primary"
          onClick={() => onNavigate('books')}
        />
        <StatCard
          title="Available Copies"
          value={availableCopies}
          subtitle={`${issuedCopies} currently borrowed`}
          icon="✅"
          variant="success"
          onClick={() => onNavigate('books')}
        />
        <StatCard
          title="Active Members"
          value={activeMembers}
          subtitle={`${totalMembers} total registered`}
          icon="👥"
          variant="info"
          onClick={() => onNavigate('members')}
        />
        <StatCard
          title="Active Loans"
          value={activeLoans}
          subtitle="Max 3 per member • 14 days"
          icon="🔄"
          variant="secondary"
          onClick={() => onNavigate('loans')}
        />
        <StatCard
          title="Overdue Loans"
          value={overdueCount}
          subtitle={`₹${totalPendingFines.toFixed(0)} pending fines`}
          icon="⚠️"
          variant={overdueCount > 0 ? 'danger' : 'neutral'}
          onClick={() => onNavigate('fines')}
        />
      </section>

      {/* Quick Actions Panel */}
      <section className="dashboard-actions-panel card">
        <h3 className="section-title">⚡ Quick Librarian Actions</h3>
        <div className="quick-actions-bar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenIssueModal}
          >
            <span className="btn-icon">📤</span> Issue Book Loan
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('loans')}
          >
            <span className="btn-icon">📥</span> Return Book
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenAddBookModal}
          >
            <span className="btn-icon">➕</span> Add New Book
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenAddMemberModal}
          >
            <span className="btn-icon">👤</span> Register Member
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('fines')}
          >
            <span className="btn-icon">💰</span> Collect Fines
          </button>
        </div>
      </section>

      {/* Two-Column Overview */}
      <div className="dashboard-columns">
        {/* Recent Circulation Activity */}
        <section className="card col-card">
          <div className="card-header-flex">
            <h3 className="card-title">🔄 Recent Circulation</h3>
            <button
              type="button"
              className="btn btn-text"
              onClick={() => onNavigate('loans')}
            >
              View All ({loans.length}) →
            </button>
          </div>
          {recentLoans.length === 0 ? (
            <div className="empty-state">
              <p>No circulation activity recorded yet.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onOpenIssueModal}
              >
                Issue First Book
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrower</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="fw-500">{loan.book_title || `Book #${loan.book_id}`}</td>
                      <td>{loan.member_name || `Member #${loan.member_id}`}</td>
                      <td>{loan.due_date}</td>
                      <td>
                        <span className={`status-badge status-${(loan.status || '').toLowerCase()}`}>
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Low Availability / Attention List */}
        <section className="card col-card">
          <div className="card-header-flex">
            <h3 className="card-title">📦 Low Stock Inventory (≤1 Copy)</h3>
            <button
              type="button"
              className="btn btn-text"
              onClick={() => onNavigate('books')}
            >
              Catalog ({books.length}) →
            </button>
          </div>
          {lowStockBooks.length === 0 ? (
            <div className="empty-state">
              <p>All catalog titles currently have 2 or more copies available.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Available</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockBooks.map((b) => (
                    <tr key={b.id}>
                      <td className="fw-500">{b.title}</td>
                      <td>{b.author}</td>
                      <td>
                        <span className={`pill-count ${b.available_copies === 0 ? 'pill-zero' : 'pill-low'}`}>
                          {b.available_copies} / {b.total_copies}
                        </span>
                      </td>
                      <td>{b.shelf_location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Circulation Policy Summary Card */}
      <section className="card rules-info-card">
        <h4 className="rules-card-title">📋 Active Circulation Rules</h4>
        <div className="rules-list-grid">
          <div className="rule-item">
            <span className="rule-label">Standard Loan Duration</span>
            <span className="rule-val">14 Calendar Days</span>
          </div>
          <div className="rule-item">
            <span className="rule-label">Overdue Fine Rate</span>
            <span className="rule-val">₹10.00 / Overdue Day</span>
          </div>
          <div className="rule-item">
            <span className="rule-label">Max Active Loans</span>
            <span className="rule-val">3 Books / Member</span>
          </div>
          <div className="rule-item">
            <span className="rule-label">Database Engine</span>
            <span className="rule-val">MySQL 8.0 (InnoDB)</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
