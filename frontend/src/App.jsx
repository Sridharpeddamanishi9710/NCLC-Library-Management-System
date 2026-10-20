import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import NotificationToast from './components/NotificationToast';

import DashboardPage from './pages/DashboardPage';
import BooksPage from './pages/BooksPage';
import MembersPage from './pages/MembersPage';
import CirculationPage from './pages/CirculationPage';
import FinesPage from './pages/FinesPage';

import bookService from './services/bookService';
import memberService from './services/memberService';
import loanService from './services/loanService';
import systemService from './services/systemService';

const TAB_TITLES = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: 'High-level circulation analytics, inventory stock, and quick librarian actions.',
  },
  books: {
    title: 'Book Catalog',
    subtitle: 'Manage catalog books, inventory copies, ISBN indexing, and shelf locations.',
  },
  members: {
    title: 'Member Directory',
    subtitle: 'Manage library membership records, borrowing limits, and membership statuses.',
  },
  loans: {
    title: 'Circulation & Loans',
    subtitle: 'Issue book loans (14-day duration), check in returned books, and track loans.',
  },
  fines: {
    title: 'Overdue Loans & Fine Settlements',
    subtitle: 'Monitor overdue loans and collect overdue fines at ₹10.00 / day.',
  },
};

export function App() {
  const [currentTab, setCurrentTab] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    return TAB_TITLES[hash] ? hash : 'dashboard';
  });

  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [overdueLoans, setOverdueLoans] = useState([]);
  const [health, setHealth] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Cross-page modal quick trigger states
  const [externalAddBookModal, setExternalAddBookModal] = useState(false);
  const [externalAddMemberModal, setExternalAddMemberModal] = useState(false);
  const [externalIssueModal, setExternalIssueModal] = useState(false);

  // Toast Notification helper
  const showToast = useCallback(({ type = 'info', message, title, duration = 4500 }) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setNotifications((prev) => [...prev, { id, type, message, title, duration }]);
  }, []);

  const handleDismissToast = useCallback((id) => {
    setNotifications((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync tab with URL hash
  const handleSelectTab = (tabId) => {
    setCurrentTab(tabId);
    window.location.hash = `#/${tabId}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (TAB_TITLES[hash]) {
        setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Refresh dataset from backend
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [booksData, membersData, loansData, overdueData, healthData] =
        await Promise.allSettled([
          bookService.getBooks(),
          memberService.getMembers(),
          loanService.getLoans(),
          loanService.getOverdueLoans(),
          systemService.getHealth(),
        ]);

      if (booksData.status === 'fulfilled') setBooks(booksData.value);
      if (membersData.status === 'fulfilled') setMembers(membersData.value);
      if (loansData.status === 'fulfilled') setLoans(loansData.value);
      if (overdueData.status === 'fulfilled') setOverdueLoans(overdueData.value);
      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      else setHealth({ status: 'OFFLINE' });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Connection Error',
        message: err.message || 'Failed to communicate with MySQL backend.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  // Initial load
  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [booksData, membersData, loansData, overdueData, healthData] =
          await Promise.allSettled([
            bookService.getBooks(),
            memberService.getMembers(),
            loanService.getLoans(),
            loanService.getOverdueLoans(),
            systemService.getHealth(),
          ]);

        if (!ignore) {
          if (booksData.status === 'fulfilled') setBooks(booksData.value);
          if (membersData.status === 'fulfilled') setMembers(membersData.value);
          if (loansData.status === 'fulfilled') setLoans(loansData.value);
          if (overdueData.status === 'fulfilled') setOverdueLoans(overdueData.value);
          if (healthData.status === 'fulfilled') setHealth(healthData.value);
          else setHealth({ status: 'OFFLINE' });
          setIsLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          showToast({
            type: 'error',
            title: 'Connection Error',
            message: err.message || 'Failed to communicate with MySQL backend.',
          });
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [showToast]);

  // Book Mutation Handlers
  const handleCreateBook = async (bookData) => {
    await bookService.createBook(bookData);
    await refreshData();
  };

  const handleUpdateBook = async (id, bookData) => {
    await bookService.updateBook(id, bookData);
    await refreshData();
  };

  const handleDeleteBook = async (id) => {
    await bookService.deleteBook(id);
    await refreshData();
  };

  // Member Mutation Handlers
  const handleCreateMember = async (memberData) => {
    await memberService.createMember(memberData);
    await refreshData();
  };

  const handleUpdateMember = async (id, memberData) => {
    await memberService.updateMember(id, memberData);
    await refreshData();
  };

  const handleDeleteMember = async (id, action) => {
    await memberService.deleteMember(id, action);
    await refreshData();
  };

  // Loan Mutation Handlers
  const handleIssueLoan = async (loanData) => {
    await loanService.issueLoan(loanData);
    await refreshData();
  };

  const handleReturnLoan = async (id, returnData) => {
    const res = await loanService.returnLoan(id, returnData);
    await refreshData();
    return res;
  };

  const handlePayFine = async (id, amount) => {
    const res = await loanService.payFine(id, amount);
    await refreshData();
    return res;
  };

  const activeTabMeta = TAB_TITLES[currentTab] || TAB_TITLES.dashboard;

  return (
    <div className="app-shell">
      {/* Toast Notification Container */}
      <NotificationToast
        notifications={notifications}
        onDismiss={handleDismissToast}
      />

      {/* Responsive Left Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        overdueCount={overdueLoans.length}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Layout */}
      <div className="app-main">
        <Header
          title={activeTabMeta.title}
          subtitle={activeTabMeta.subtitle}
          health={health}
          isRefreshing={isRefreshing}
          onRefresh={refreshData}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="app-content">
          {currentTab === 'dashboard' && (
            <DashboardPage
              books={books}
              members={members}
              loans={loans}
              overdueLoans={overdueLoans}
              onNavigate={handleSelectTab}
              onOpenIssueModal={() => {
                handleSelectTab('loans');
                setExternalIssueModal(true);
              }}
              onOpenAddBookModal={() => {
                handleSelectTab('books');
                setExternalAddBookModal(true);
              }}
              onOpenAddMemberModal={() => {
                handleSelectTab('members');
                setExternalAddMemberModal(true);
              }}
            />
          )}

          {currentTab === 'books' && (
            <BooksPage
              books={books}
              isLoading={isLoading}
              onRefresh={refreshData}
              onCreateBook={handleCreateBook}
              onUpdateBook={handleUpdateBook}
              onDeleteBook={handleDeleteBook}
              showToast={showToast}
              externalAddModalOpen={externalAddBookModal}
              onCloseExternalAddModal={() => setExternalAddBookModal(false)}
            />
          )}

          {currentTab === 'members' && (
            <MembersPage
              members={members}
              isLoading={isLoading}
              onRefresh={refreshData}
              onCreateMember={handleCreateMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              showToast={showToast}
              externalAddModalOpen={externalAddMemberModal}
              onCloseExternalAddModal={() => setExternalAddMemberModal(false)}
            />
          )}

          {currentTab === 'loans' && (
            <CirculationPage
              loans={loans}
              books={books}
              members={members}
              isLoading={isLoading}
              onRefresh={refreshData}
              onIssueLoan={handleIssueLoan}
              onReturnLoan={handleReturnLoan}
              onPayFine={handlePayFine}
              showToast={showToast}
              externalIssueModalOpen={externalIssueModal}
              onCloseExternalIssueModal={() => setExternalIssueModal(false)}
            />
          )}

          {currentTab === 'fines' && (
            <FinesPage
              loans={loans}
              overdueLoans={overdueLoans}
              isLoading={isLoading}
              onRefresh={refreshData}
              onPayFine={handlePayFine}
              onReturnLoan={handleReturnLoan}
              showToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
