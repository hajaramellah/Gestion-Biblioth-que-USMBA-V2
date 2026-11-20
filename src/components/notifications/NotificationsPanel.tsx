import React, { useEffect, useRef } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { AppNotification } from '../../types/library';
import {
  Bell,
  Check,
  CheckCheck,
  BookOpen,
  RotateCcw,
  AlertCircle,
  Bookmark,
  Send,
  RefreshCw,
  ArrowRight,
  X,
} from 'lucide-react';

interface NotificationsPanelProps {
  onClose: () => void;
  onSelectNotification: (notif: AppNotification) => void;
  onOpenAllNotifications: () => void;
}

export const getNotificationCategoryMeta = (category: AppNotification['category']) => {
  switch (category) {
    case 'loan':
      return {
        label: 'Emprunt',
        icon: BookOpen,
        iconClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      };
    case 'return':
      return {
        label: 'Retour',
        icon: RotateCcw,
        iconClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      };
    case 'overdue':
      return {
        label: 'Retard',
        icon: AlertCircle,
        iconClass: 'text-rose-700 bg-rose-50 border-rose-200',
      };
    case 'reservation':
      return {
        label: 'Réservation',
        icon: Bookmark,
        iconClass: 'text-amber-700 bg-amber-50 border-amber-200',
      };
    case 'reminder':
      return {
        label: 'Rappel',
        icon: Send,
        iconClass: 'text-slate-700 bg-slate-100 border-slate-200',
      };
    case 'renewal':
      return {
        label: 'Renouvellement',
        icon: RefreshCw,
        iconClass: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      };
  }
};

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  onClose,
  onSelectNotification,
  onOpenAllNotifications,
}) => {
  const {
    currentUserNotifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useLibrary();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const recentNotifications = currentUserNotifications.slice(0, 6);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-900">Notifications</span>
          {unreadNotificationCount > 0 && (
            <span className="text-[11px] font-semibold text-rose-700 tabular-nums">
              · {unreadNotificationCount} non lue{unreadNotificationCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadNotificationCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsAsRead}
              className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tout marquer lu</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
            aria-label="Fermer les notifications"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
        {recentNotifications.length === 0 ? (
          <div className="py-10 px-6 text-center space-y-1.5">
            <Bell className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">
              Aucune notification
            </p>
            <p className="text-[11px] text-slate-500">
              Les alertes de la bibliothèque apparaîtront ici.
            </p>
          </div>
        ) : (
          recentNotifications.map((notif) => {
            const meta = getNotificationCategoryMeta(notif.category);
            const Icon = meta.icon;

            return (
              <div
                key={notif.id}
                onClick={() => {
                  markNotificationAsRead(notif.id);
                  onSelectNotification(notif);
                  onClose();
                }}
                className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                  notif.isRead
                    ? 'bg-white hover:bg-slate-50'
                    : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${meta.iconClass}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs leading-snug ${
                        notif.isRead
                          ? 'font-medium text-slate-800'
                          : 'font-semibold text-slate-900'
                      }`}
                    >
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span className="text-[10px] font-semibold text-indigo-700 shrink-0">
                        Nouveau
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[10px] font-code text-slate-400">
                      {notif.createdAt}
                    </span>

                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markNotificationAsRead(notif.id);
                        }}
                        className="text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Marquer comme lu</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 tabular-nums">
          {currentUserNotifications.length} notification(s)
        </span>
        <button
          type="button"
          onClick={() => {
            onOpenAllNotifications();
            onClose();
          }}
          className="text-xs font-semibold text-slate-900 hover:text-indigo-700 flex items-center gap-1 transition-colors"
        >
          <span>Tout afficher</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
