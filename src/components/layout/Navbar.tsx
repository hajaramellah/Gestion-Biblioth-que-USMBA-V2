import React, { useState } from 'react';
import {
  ScanLine,
  Search,
  School,
  LogOut,
  Database,
  Bell,
  LogIn,
} from 'lucide-react';
import { GoogleIcon } from '../auth/AcademicLoginModal';
import { useLibrary } from '../../context/LibraryContext';
import { AppNotification } from '../../types/library';
import { NotificationsPanel } from '../notifications/NotificationsPanel';

export type ActiveTab =
  | 'dashboard'
  | 'catalog'
  | 'loans'
  | 'members'
  | 'reservations'
  | 'registry'
  | 'reports'
  | 'notifications';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onBrandClick?: () => void;
  onOpenSmartBorrow: () => void;
  onOpenSearch: () => void;
  onOpenRegistrySync: () => void;
  onSelectNotification: (notif: AppNotification) => void;
  onOpenAllNotifications: () => void;
  onOpenLogin?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onBrandClick,
  onOpenSmartBorrow,
  onOpenSearch,
  onOpenRegistrySync,
  onSelectNotification,
  onOpenAllNotifications,
  onOpenLogin,
  onLogout,
}) => {
  const {
    authSession,
    logout,
    unreadNotificationCount,
  } = useLibrary();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleLogoutClick = () => {
    setIsNotificationsOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };

  const isStudent = authSession.isAuthenticated && authSession.role === 'etudiant';
  const isGerant =
    authSession.isAuthenticated &&
    (authSession.role === 'gerant' || authSession.userType === 'librarian');

  const gerantNavItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'dashboard', label: "Vue d'ensemble" },
    { id: 'catalog', label: 'Catalogue & Livres' },
    { id: 'loans', label: 'Prêts & Retours' },
    { id: 'reservations', label: 'Réservations' },
    { id: 'members', label: 'Adhérents EST' },
    { id: 'reports', label: 'Statistiques & Rapports' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <button
          type="button"
          onClick={() => (onBrandClick ? onBrandClick() : setActiveTab('dashboard'))}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isStudent ? 'bg-indigo-900 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            <School className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-slate-900 leading-none">
              Athenaeum · EST Fès
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 leading-none">
              {isStudent ? 'Portail Étudiant' : isGerant ? 'Espace Gérant' : 'Catalogue Public'}
            </span>
          </div>
        </button>

        {/* Primary Navigation Links */}
        {isGerant && (
          <nav className="hidden lg:flex items-center gap-1 text-xs font-medium text-slate-600 h-full">
            {gerantNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`h-full px-2.5 flex items-center whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                    isActive
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onOpenRegistrySync}
              className="h-full px-2.5 flex items-center gap-1.5 whitespace-nowrap shrink-0 border-b-2 border-transparent text-slate-600 hover:text-indigo-700 hover:border-indigo-300 transition-colors"
              title="Base Apogée et scolarité en temps réel"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Apogée</span>
            </button>
          </nav>
        )}

        {isStudent && (
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 whitespace-nowrap shrink-0">
            <span className="font-semibold text-slate-900">
              {authSession.student?.firstName} {authSession.student?.lastName}
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-code text-slate-500">{authSession.student?.cne}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{authSession.student?.department}</span>
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden sm:flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
            title="Recherche globale (Ctrl+K)"
            aria-label="Recherche globale"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Notification Bell */}
          {authSession.isAuthenticated && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className={`relative w-8 h-8 flex items-center justify-center rounded-md border transition-colors ${
                  isNotificationsOpen || activeTab === 'notifications'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}
                title="Centre de notifications"
                aria-label="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums border border-white">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <NotificationsPanel
                  onClose={() => setIsNotificationsOpen(false)}
                  onSelectNotification={onSelectNotification}
                  onOpenAllNotifications={onOpenAllNotifications}
                />
              )}
            </div>
          )}

          {/* Account & Déconnexion */}
          {authSession.isAuthenticated && (
            <div className="flex items-center gap-1.5 bg-slate-50 pl-2 pr-1.5 py-1 rounded-md border border-slate-200 text-xs">
              <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline font-medium text-slate-800 truncate max-w-[120px] text-[11px]">
                {isStudent
                  ? `${authSession.student?.firstName} ${authSession.student?.lastName}`
                  : authSession.librarianName || 'Gérant'}
              </span>
              <span className="hidden md:inline text-slate-300" aria-hidden="true">|</span>
              <button
                type="button"
                onClick={handleLogoutClick}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                title="Déconnexion USMBA"
                aria-label="Déconnexion"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          )}

          {/* Primary Action (Strictly Gérant only for QR desk; Login button for visitors) */}
          {isGerant && (
            <button
              type="button"
              onClick={onOpenSmartBorrow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              title="Scanner QR carte étudiant et QR livre au guichet"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guichet Prêt QR</span>
              <span className="sm:hidden">Guichet</span>
            </button>
          )}

          {!authSession.isAuthenticated && onOpenLogin && (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Se connecter</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile/Tablet Navigation Strip for Gérant */}
      {isGerant && (
        <div className="lg:hidden border-t border-slate-200 bg-slate-50 px-4 py-1.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-xs font-medium min-w-max">
            {gerantNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                  activeTab === item.id
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 bg-white border border-slate-200 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === 'notifications'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 bg-white border border-slate-200 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3 h-3" />
              <span>Notifications</span>
              {unreadNotificationCount > 0 && (
                <span className="px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenRegistrySync}
              className="px-2.5 py-1 rounded-md whitespace-nowrap text-slate-700 bg-white border border-slate-200 hover:text-indigo-700 flex items-center gap-1"
            >
              <Database className="w-3 h-3" />
              <span>Apogée</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
