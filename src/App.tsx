import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { Navbar, ActiveTab } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { BookCatalogView } from './components/books/BookCatalogView';
import { LoansView } from './components/loans/LoansView';
import { MembersView } from './components/members/MembersView';
import { ReservationsView } from './components/reservations/ReservationsView';
import { ReportsView } from './components/reports/ReportsView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { StudentPortalView, StudentSubTab } from './components/student/StudentPortalView';
import { SmartQrBorrowModal } from './components/scanner/SmartQrBorrowModal';
import { LoginPage } from './components/auth/LoginPage';
import { SchoolRegistrySyncModal } from './components/admin/SchoolRegistrySyncModal';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { ToastContainer } from './components/common/ToastContainer';
import { AppNotification, Book, Reservation } from './types/library';
import { School } from 'lucide-react';

const GERANT_ROUTES: Record<Exclude<ActiveTab, 'registry'>, string> = {
  dashboard: '/gerant/dashboard',
  catalog: '/gerant/catalog',
  loans: '/gerant/loans',
  reservations: '/gerant/reservations',
  members: '/gerant/members',
  reports: '/gerant/reports',
  notifications: '/gerant/notifications',
};

const STUDENT_ROUTES: Record<StudentSubTab, string> = {
  overview: '/etudiant/dashboard',
  catalog: '/etudiant/catalog',
  my_loans: '/etudiant/emprunts',
  my_reservations: '/etudiant/reservations',
  my_card: '/etudiant/carte',
  my_profile: '/etudiant/profil',
  notifications: '/etudiant/notifications',
  guidelines: '/etudiant/reglement',
};

const PUBLIC_CATALOG_PATHS = ['/', '/catalogue'];

function isPublicCatalogPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_CATALOG_PATHS.includes(clean);
}

function isLoginPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return clean === '/login';
}

function parseGerantRoute(pathname: string): ActiveTab | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.entries(GERANT_ROUTES) as Array<[ActiveTab, string]>).find(
    ([, path]) => path === clean
  );
  return match ? match[0] : null;
}

function parseStudentRoute(pathname: string): StudentSubTab | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.entries(STUDENT_ROUTES) as Array<[StudentSubTab, string]>).find(
    ([, path]) => path === clean
  );
  return match ? match[0] : null;
}

function LibraryApp() {
  const { authSession, isGerant, books, logout } = useLibrary();

  const isAuthenticated = authSession.isAuthenticated;
  const isStudent = isAuthenticated && authSession.role === 'etudiant';

  const [publicView, setPublicView] = useState<'catalog' | 'login'>(() => {
    if (typeof window !== 'undefined' && isLoginPath(window.location.pathname)) {
      return 'login';
    }
    return 'catalog';
  });

  // Track book selected for reservation while unauthenticated so student resumes seamlessly after login
  const [pendingReserveBookId, setPendingReserveBookId] = useState<string | null>(null);
  const [continuationBookId, setContinuationBookId] = useState<string | null>(null);

  const [activeTab, setActiveTabState] = useState<ActiveTab>(() =>
    isGerant ? parseGerantRoute(window.location.pathname) || 'dashboard' : 'dashboard'
  );
  const [studentSubTab, setStudentSubTabState] = useState<StudentSubTab>(() =>
    isStudent ? parseStudentRoute(window.location.pathname) || 'catalog' : 'catalog'
  );
  const [isSmartBorrowOpen, setIsSmartBorrowOpen] = useState(false);
  const [smartBorrowBook, setSmartBorrowBook] = useState<Book | null>(null);
  const [smartBorrowReservation, setSmartBorrowReservation] = useState<Reservation | null>(null);
  const [isRegistrySyncOpen, setIsRegistrySyncOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const prevAuthRef = useRef<{ isAuthenticated: boolean; role?: string }>({
    isAuthenticated,
    role: authSession.role,
  });

  const navigateToLogin = useCallback((book?: Book) => {
    if (book) {
      setPendingReserveBookId(book.id);
    } else {
      setPendingReserveBookId(null);
    }
    setPublicView('login');
    if (window.location.pathname !== '/login') {
      window.history.pushState({ public: 'login' }, '', '/login');
    }
  }, []);

  const navigateToPublicCatalog = useCallback(() => {
    setPendingReserveBookId(null);
    setPublicView('catalog');
    if (!isPublicCatalogPath(window.location.pathname)) {
      window.history.pushState({ public: 'catalog' }, '', '/');
    }
  }, []);

  const navigateGerantTab = useCallback(
    (tab: ActiveTab, replace = false) => {
      if (!isGerant) return;
      const safeTab = tab === 'registry' ? 'members' : tab;
      setActiveTabState(safeTab);
      const targetPath =
        GERANT_ROUTES[safeTab as Exclude<ActiveTab, 'registry'>] || GERANT_ROUTES.dashboard;
      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState({ role: 'gerant', tab: safeTab }, '', targetPath);
        } else {
          window.history.pushState({ role: 'gerant', tab: safeTab }, '', targetPath);
        }
      }
    },
    [isGerant]
  );

  const navigateStudentSubTab = useCallback(
    (subTab: StudentSubTab, replace = false) => {
      if (!isStudent) return;
      setStudentSubTabState(subTab);
      const targetPath = STUDENT_ROUTES[subTab] || STUDENT_ROUTES.catalog;
      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState({ role: 'etudiant', subTab }, '', targetPath);
        } else {
          window.history.pushState({ role: 'etudiant', subTab }, '', targetPath);
        }
      }
    },
    [isStudent]
  );

  // Sync URL, enforce route guards, and handle post-login routing & deferred reservation continuation
  useEffect(() => {
    const prev = prevAuthRef.current;
    const justLoggedIn = !prev.isAuthenticated && isAuthenticated;
    const roleChanged = prev.isAuthenticated && prev.role !== authSession.role;
    prevAuthRef.current = { isAuthenticated, role: authSession.role };

    if (!isAuthenticated) {
      setIsSmartBorrowOpen(false);
      setSmartBorrowBook(null);
      setSmartBorrowReservation(null);
      setIsRegistrySyncOpen(false);
      setIsSearchOpen(false);
      setActiveTabState('dashboard');
      setStudentSubTabState('catalog');

      const path = window.location.pathname;
      if (isLoginPath(path)) {
        setPublicView('login');
      } else if (isPublicCatalogPath(path)) {
        setPublicView('catalog');
      } else {
        // Any direct attempt to visit an internal protected URL while logged out redirects to /login
        setPublicView('login');
        window.history.replaceState({ public: 'login' }, '', '/login');
      }
      return;
    }

    // Automatic role redirection immediately after login
    if (justLoggedIn || roleChanged) {
      if (isGerant) {
        setPendingReserveBookId(null);
        setContinuationBookId(null);
        setSelectedBookId(null);
        setActiveTabState('dashboard');
        window.history.replaceState({ role: 'gerant', tab: 'dashboard' }, '', GERANT_ROUTES.dashboard);
      } else if (isStudent) {
        if (pendingReserveBookId) {
          const targetId = pendingReserveBookId;
          setPendingReserveBookId(null);
          setContinuationBookId(targetId);
          setSelectedBookId(targetId);
          setStudentSubTabState('catalog');
          window.history.replaceState({ role: 'etudiant', subTab: 'catalog' }, '', STUDENT_ROUTES.catalog);
        } else {
          setStudentSubTabState('catalog');
          window.history.replaceState({ role: 'etudiant', subTab: 'catalog' }, '', STUDENT_ROUTES.catalog);
        }
      }
      return;
    }

    // Direct URL guard if already authenticated
    const path = window.location.pathname;
    if (isGerant) {
      const matched = parseGerantRoute(path);
      if (matched) {
        setActiveTabState(matched);
      } else {
        window.history.replaceState({ role: 'gerant', tab: 'dashboard' }, '', GERANT_ROUTES.dashboard);
        setActiveTabState('dashboard');
      }
    } else if (isStudent) {
      const matched = parseStudentRoute(path);
      if (matched) {
        setStudentSubTabState(matched);
      } else {
        window.history.replaceState({ role: 'etudiant', subTab: 'catalog' }, '', STUDENT_ROUTES.catalog);
        setStudentSubTabState('catalog');
      }
    }
  }, [isAuthenticated, isGerant, isStudent, authSession.role, pendingReserveBookId]);

  // Browser Back/Forward protection
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (!isAuthenticated) {
        if (isPublicCatalogPath(path)) {
          setPublicView('catalog');
        } else if (isLoginPath(path)) {
          setPublicView('login');
        } else {
          // Block Back navigation into internal protected pages
          setPublicView('login');
          window.history.replaceState({ public: 'login' }, '', '/login');
        }
        return;
      }

      if (isGerant) {
        const matched = parseGerantRoute(path);
        if (matched) {
          setActiveTabState(matched);
        } else {
          window.history.replaceState({ role: 'gerant', tab: 'dashboard' }, '', GERANT_ROUTES.dashboard);
          setActiveTabState('dashboard');
        }
      } else if (isStudent) {
        const matched = parseStudentRoute(path);
        if (matched) {
          setStudentSubTabState(matched);
        } else {
          window.history.replaceState({ role: 'etudiant', subTab: 'catalog' }, '', STUDENT_ROUTES.catalog);
          setStudentSubTabState('catalog');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, isGerant, isStudent]);

  // Global Ctrl+K shortcut (works cleanly in public catalog & authenticated views; search scope is role-guarded)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (publicView === 'login' && !isAuthenticated) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, publicView]);

  const handleLogout = () => {
    setIsSmartBorrowOpen(false);
    setSmartBorrowBook(null);
    setSmartBorrowReservation(null);
    setIsRegistrySyncOpen(false);
    setIsSearchOpen(false);
    setSelectedBookId(null);
    setPendingReserveBookId(null);
    setContinuationBookId(null);
    setActiveTabState('dashboard');
    setStudentSubTabState('catalog');
    setPublicView('login');

    logout();

    // Replace current internal history entry & anchor a login barrier
    window.history.replaceState({ public: 'login' }, '', '/login');
    window.history.pushState({ public: 'login' }, '', '/login');
  };

  const handleBorrowBook = (book: Book) => {
    if (!isGerant) return;
    setSmartBorrowReservation(null);
    setSmartBorrowBook(book);
    setIsSmartBorrowOpen(true);
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    if (!isAuthenticated) {
      setPublicView('catalog');
      return;
    }
    if (isStudent) {
      navigateStudentSubTab('catalog');
    } else if (isGerant) {
      navigateGerantTab('catalog');
    }
  };

  const handleNavigateFromNotification = (notif: AppNotification) => {
    if (isStudent) {
      const target = (notif.studentSubTab as StudentSubTab) || 'overview';
      navigateStudentSubTab(target);
    } else if (isGerant) {
      const target = (notif.targetTab as ActiveTab) || 'dashboard';
      navigateGerantTab(target);
    }
  };

  const handleOpenAllNotifications = () => {
    if (isStudent) {
      navigateStudentSubTab('notifications');
    } else if (isGerant) {
      navigateGerantTab('notifications');
    }
  };

  const pendingBook = pendingReserveBookId
    ? books.find((b) => b.id === pendingReserveBookId) || null
    : null;

  // Unauthenticated view: either Login Page or Public Catalog (read-only)
  if (!isAuthenticated && publicView === 'login') {
    return (
      <>
        <LoginPage
          pendingBook={pendingBook}
          onBackToCatalog={navigateToPublicCatalog}
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Institutional Top Bar (Public Catalog, Student Portal without QR, or Full Gérant Workspace) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => navigateGerantTab(tab)}
        onBrandClick={() => {
          if (!isAuthenticated) {
            navigateToPublicCatalog();
          } else if (isStudent) {
            navigateStudentSubTab('catalog');
          } else if (isGerant) {
            navigateGerantTab('dashboard');
          }
        }}
        onOpenSmartBorrow={() => {
          if (!isGerant) return;
          setSmartBorrowBook(null);
          setSmartBorrowReservation(null);
          setIsSmartBorrowOpen(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenRegistrySync={() => {
          if (!isGerant) return;
          setIsRegistrySyncOpen(true);
        }}
        onSelectNotification={handleNavigateFromNotification}
        onOpenAllNotifications={handleOpenAllNotifications}
        onOpenLogin={() => navigateToLogin()}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {!isAuthenticated ? (
          <BookCatalogView
            selectedBookId={selectedBookId}
            onClearSelectedBook={() => setSelectedBookId(null)}
            onRequireLogin={(book) => navigateToLogin(book)}
          />
        ) : isStudent ? (
          <StudentPortalView
            activeSubTab={studentSubTab}
            onChangeSubTab={(sub) => navigateStudentSubTab(sub)}
            selectedBookId={selectedBookId}
            isPendingContinuation={Boolean(continuationBookId && selectedBookId === continuationBookId)}
            onClearSelectedBook={() => {
              setSelectedBookId(null);
              setContinuationBookId(null);
            }}
          />
        ) : isGerant ? (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                setActiveTab={(tab) => navigateGerantTab(tab)}
                onOpenQuickDesk={() => {
                  setSmartBorrowBook(null);
                  setSmartBorrowReservation(null);
                  setIsSmartBorrowOpen(true);
                }}
                onSelectBook={handleSelectBook}
              />
            )}

            {activeTab === 'catalog' && (
              <BookCatalogView
                onBorrowBook={handleBorrowBook}
                selectedBookId={selectedBookId}
                onClearSelectedBook={() => setSelectedBookId(null)}
              />
            )}

            {activeTab === 'loans' && (
              <LoansView
                onOpenQuickDesk={() => {
                  setSmartBorrowBook(null);
                  setSmartBorrowReservation(null);
                  setIsSmartBorrowOpen(true);
                }}
              />
            )}

            {activeTab === 'members' && <MembersView />}

            {activeTab === 'reservations' && (
              <ReservationsView
                onOpenPickupDesk={(res) => {
                  setSmartBorrowBook(null);
                  setSmartBorrowReservation(res);
                  setIsSmartBorrowOpen(true);
                }}
              />
            )}

            {activeTab === 'reports' && <ReportsView />}

            {activeTab === 'notifications' && (
              <NotificationsView
                onNavigateFromNotification={handleNavigateFromNotification}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <School className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-medium text-slate-700">
              Athenaeum · École Supérieure de Technologie de Fès
            </span>
            <span className="text-slate-300">·</span>
            <span>USMBA</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>
              {isGerant
                ? 'Session Gérant · @usmba.ac.ma'
                : isStudent
                ? 'Session Étudiant · @usmba.ac.ma'
                : 'Consultation publique · EST Fès'}
            </span>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="hover:text-slate-900 transition-colors"
            >
              Recherche (Ctrl+K)
            </button>
          </div>
        </div>
      </footer>

      {isGerant && isSmartBorrowOpen && (
        <SmartQrBorrowModal
          initialBook={smartBorrowBook}
          initialReservation={smartBorrowReservation}
          onClose={() => {
            setIsSmartBorrowOpen(false);
            setSmartBorrowBook(null);
            setSmartBorrowReservation(null);
          }}
        />
      )}

      {isGerant && isRegistrySyncOpen && (
        <SchoolRegistrySyncModal onClose={() => setIsRegistrySyncOpen(false)} />
      )}

      {isSearchOpen && (
        <GlobalSearchModal
          onClose={() => setIsSearchOpen(false)}
          onSelectBook={handleSelectBook}
          onNavigateTab={(tab) => {
            if (isGerant) navigateGerantTab(tab);
          }}
        />
      )}

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <LibraryApp />
    </LibraryProvider>
  );
}
