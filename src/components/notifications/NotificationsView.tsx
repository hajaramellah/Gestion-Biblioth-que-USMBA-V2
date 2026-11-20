import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { AppNotification, NotificationCategory } from '../../types/library';
import { getNotificationCategoryMeta } from './NotificationsPanel';
import { Pagination } from '../common/Pagination';
import {
  Bell,
  Check,
  CheckCheck,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface NotificationsViewProps {
  onNavigateFromNotification: (notif: AppNotification) => void;
}

const NOTIF_PAGE_SIZE = 15;

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onNavigateFromNotification,
}) => {
  const {
    authSession,
    currentUserNotifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useLibrary();

  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | NotificationCategory>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredNotifications = useMemo(() => {
    return currentUserNotifications.filter((n) => {
      if (readFilter === 'unread' && n.isRead) return false;
      if (readFilter === 'read' && !n.isRead) return false;
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      return true;
    });
  }, [currentUserNotifications, readFilter, categoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [readFilter, categoryFilter]);

  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * NOTIF_PAGE_SIZE;
    return filteredNotifications.slice(start, start + NOTIF_PAGE_SIZE);
  }, [filteredNotifications, currentPage]);

  const isStudent = authSession.role === 'etudiant';

  const categoryOptions: Array<{ value: 'all' | NotificationCategory; label: string }> = isStudent
    ? [
        { value: 'all', label: 'Toutes les catégories' },
        { value: 'loan', label: 'Emprunts' },
        { value: 'reminder', label: 'Rappels' },
        { value: 'overdue', label: 'Retards' },
        { value: 'reservation', label: 'Réservations' },
        { value: 'return', label: 'Retours' },
        { value: 'renewal', label: 'Renouvellements' },
      ]
    : [
        { value: 'all', label: 'Toutes les catégories' },
        { value: 'loan', label: 'Nouveaux emprunts' },
        { value: 'overdue', label: 'Retards' },
        { value: 'return', label: 'Retours' },
        { value: 'reservation', label: 'Réservations' },
        { value: 'reminder', label: 'Relances' },
        { value: 'renewal', label: 'Prolongations' },
      ];

  return (
    <div className="space-y-5 pb-10">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStudent
              ? 'Suivi de vos emprunts, rappels d’échéance, retards, retours et réservations.'
              : 'Alertes opérationnelles sur les emprunts, retards, retours, réservations et relances.'}
          </p>
        </div>

        {unreadNotificationCount > 0 && (
          <button
            type="button"
            onClick={markAllNotificationsAsRead}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0 tabular-nums"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Tout marquer comme lu ({unreadNotificationCount})</span>
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setReadFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
              readFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Toutes ({currentUserNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setReadFilter('unread')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
              readFilter === 'unread'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Non lues ({unreadNotificationCount})
          </button>
          <button
            type="button"
            onClick={() => setReadFilter('read')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
              readFilter === 'read'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lues ({currentUserNotifications.length - unreadNotificationCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | NotificationCategory)}
            className="text-xs border border-slate-200 bg-slate-50 rounded-md px-3 py-1.5 text-slate-700 focus:outline-none focus:bg-white focus:border-slate-400 w-full sm:w-auto"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="py-12 px-6 text-center bg-white rounded-lg border border-slate-200">
          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-800">
            Aucune notification trouvée
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {readFilter === 'unread'
              ? 'Toutes vos notifications ont été lues.'
              : 'Les notifications liées aux activités de la bibliothèque apparaîtront ici.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {paginatedNotifications.map((notif) => {
              const meta = getNotificationCategoryMeta(notif.category);
              const Icon = meta.icon;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    markNotificationAsRead(notif.id);
                    onNavigateFromNotification(notif);
                  }}
                  className={`p-4 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    notif.isRead
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-indigo-50/35 hover:bg-indigo-50/60'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${meta.iconClass}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span
                          className={
                            notif.isRead
                              ? 'font-medium text-slate-800'
                              : 'font-semibold text-slate-900'
                          }
                        >
                          {notif.title}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-[11px] text-slate-500">{meta.label}</span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-[11px] font-code text-slate-400">
                          {notif.createdAt}
                        </span>
                        {!notif.isRead && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="text-[11px] font-semibold text-indigo-700">
                              Non lu
                            </span>
                          </>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markNotificationAsRead(notif.id);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Marquer comme lu</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markNotificationAsRead(notif.id);
                        onNavigateFromNotification(notif);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors flex items-center gap-1"
                    >
                      <span>Ouvrir</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredNotifications.length}
            pageSize={NOTIF_PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="notifications"
          />
        </div>
      )}
    </div>
  );
};
