import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { getOverdueDays } from '../../utils/dateUtils';
import { CollectiveReminderModal } from './CollectiveReminderModal';
import { Pagination } from '../common/Pagination';
import {
  Search,
  CheckCircle2,
  Send,
  Download,
  Clock,
  X,
} from 'lucide-react';

interface LoansViewProps {
  onOpenQuickDesk: () => void;
}

const LOANS_PAGE_SIZE = 20;

export const LoansView: React.FC<LoansViewProps> = () => {
  const {
    loans,
    reminderHistory,
    getOverdueStudentsSummary,
    returnLoan,
    extendLoan,
    sendReminder,
    currentDate,
    exportLoansCSV,
    showToast,
  } = useLibrary();

  const [activeTab, setActiveTab] = useState<'all_active' | 'overdue' | 'returned' | 'reminders'>('all_active');
  const [overdueBucket, setOverdueBucket] = useState<'all' | '1-3' | '4-7' | '8-15' | '15+'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCollectiveModalOpen, setIsCollectiveModalOpen] = useState(false);

  const overdueStudents = useMemo(() => getOverdueStudentsSummary(), [getOverdueStudentsSummary]);

  const filteredLoans = useMemo(() => {
    if (activeTab === 'reminders') return [];
    const q = searchQuery.trim().toLowerCase();
    return loans
      .filter((l) => {
        if (activeTab === 'all_active' && l.status === 'Rendu') return false;
        if (activeTab === 'overdue') {
          if (l.status !== 'En retard') return false;
          if (overdueBucket !== 'all') {
            const d = getOverdueDays(l.dueDate, currentDate);
            if (overdueBucket === '1-3' && !(d >= 1 && d <= 3)) return false;
            if (overdueBucket === '4-7' && !(d >= 4 && d <= 7)) return false;
            if (overdueBucket === '8-15' && !(d >= 8 && d <= 15)) return false;
            if (overdueBucket === '15+' && !(d > 15)) return false;
          }
        }
        if (activeTab === 'returned' && l.status !== 'Rendu') return false;

        if (!q) return true;
        return (
          l.bookTitle.toLowerCase().includes(q) ||
          l.memberName.toLowerCase().includes(q) ||
          l.memberCard.toLowerCase().includes(q) ||
          l.bookIsbn.toLowerCase().includes(q) ||
          l.memberCne.toLowerCase().includes(q) ||
          (l.copyBarcode && l.copyBarcode.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));
  }, [loans, activeTab, overdueBucket, searchQuery, currentDate]);

  const filteredReminders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reminderHistory;
    return reminderHistory.filter(
      (entry) =>
        entry.studentName.toLowerCase().includes(q) ||
        entry.studentEmail.toLowerCase().includes(q) ||
        entry.bookTitles.some((b) => b.toLowerCase().includes(q))
    );
  }, [reminderHistory, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, overdueBucket, searchQuery]);

  const paginatedLoans = useMemo(() => {
    const start = (currentPage - 1) * LOANS_PAGE_SIZE;
    return filteredLoans.slice(start, start + LOANS_PAGE_SIZE);
  }, [filteredLoans, currentPage]);

  const paginatedReminders = useMemo(() => {
    const start = (currentPage - 1) * LOANS_PAGE_SIZE;
    return filteredReminders.slice(start, start + LOANS_PAGE_SIZE);
  }, [filteredReminders, currentPage]);

  const activeCount = loans.filter((l) => l.status !== 'Rendu').length;
  const overdueCount = loans.filter((l) => l.status === 'En retard').length;
  const returnedCount = loans.filter((l) => l.status === 'Rendu').length;

  const handleIndividualReminder = (loanId: string) => {
    const res = sendReminder(loanId);
    if (!res.success && res.status === 'Ignorée (déjà relancé)') {
      showToast({
        type: 'info',
        title: 'Relance déjà effectuée aujourd’hui',
        description: res.message,
      });
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
            Prêts & Retours
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi de la circulation, prolongations, relances de retard et retours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => setIsCollectiveModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Relancer tous les étudiants en retard ({overdueStudents.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportLoansCSV}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
            title="Exporter le registre en CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('all_active')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
                activeTab === 'all_active'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Prêts en cours ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overdue')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
                activeTab === 'overdue'
                  ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              En retard ({overdueCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('returned')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
                activeTab === 'returned'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Retours ({returnedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reminders')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
                activeTab === 'reminders'
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Historique des relances ({reminderHistory.length})
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer par lecteur, CNE, exemplaire..."
              className="w-full text-xs pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Effacer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {activeTab === 'overdue' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Tranche de retard :</span>
            {(
              [
                { id: 'all', label: 'Tous les retards' },
                { id: '1-3', label: '1–3 jours' },
                { id: '4-7', label: '4–7 jours' },
                { id: '8-15', label: '8–15 jours' },
                { id: '15+', label: '> 15 jours' },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setOverdueBucket(b.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  overdueBucket === b.id
                    ? 'bg-rose-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reminder History Tab */}
      {activeTab === 'reminders' ? (
        filteredReminders.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-6">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
            <h3 className="text-sm font-semibold text-slate-800">
              Aucune relance enregistrée
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Les relances individuelles et collectives envoyées apparaîtront ici avec date, heure et statut.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Date & Heure</th>
                      <th className="py-2.5 px-4">Étudiant</th>
                      <th className="py-2.5 px-4">Ouvrage(s) concerné(s)</th>
                      <th className="py-2.5 px-4">Mode</th>
                      <th className="py-2.5 px-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedReminders.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-code text-[11px] text-slate-600 whitespace-nowrap">
                          {entry.date} · {entry.time}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{entry.studentName}</div>
                          <div className="text-[11px] font-code text-slate-500">
                            {entry.studentEmail}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-800">
                            {entry.bookTitles.join(' · ')}
                          </div>
                          {entry.errorReason && (
                            <div className="text-[11px] text-rose-600 mt-0.5">
                              {entry.errorReason}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">{entry.mode}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              entry.status === 'Envoyée'
                                ? 'text-emerald-700'
                                : entry.status === 'Échec'
                                ? 'text-rose-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredReminders.length}
              pageSize={LOANS_PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="relances"
            />
          </div>
        )
      ) : filteredLoans.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-800">Aucun enregistrement trouvé</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'overdue'
              ? 'Aucun retard de restitution ne correspond à ce filtre.'
              : 'Aucun emprunt ne correspond à votre filtre actuel.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Document</th>
                    <th className="py-2.5 px-4">Étudiant</th>
                    <th className="py-2.5 px-4">Date prêt</th>
                    <th className="py-2.5 px-4">Échéance</th>
                    <th className="py-2.5 px-4">Statut</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedLoans.map((loan) => {
                    const isOverdue = loan.status === 'En retard';
                    const isReturned = loan.status === 'Rendu';
                    const daysOverdue = isOverdue ? getOverdueDays(loan.dueDate, currentDate) : 0;

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{loan.bookTitle}</div>
                          <div className="text-[11px] font-code text-slate-500 mt-0.5">
                            {loan.bookIsbn}
                            {loan.copyBarcode && (
                              <span className="text-slate-400"> · {loan.copyBarcode}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{loan.memberName}</div>
                          <div className="text-[11px] font-code text-slate-500">
                            {loan.memberCne} · {loan.memberDepartment || 'EST Fès'}
                          </div>
                          {loan.loanQrCodeDataUrl && (
                            <a
                              href={loan.loanQrCodeDataUrl}
                              download={`ticket_pret_${loan.id}.png`}
                              className="text-[11px] text-indigo-700 hover:underline font-medium inline-block mt-0.5"
                            >
                              Ticket QR
                            </a>
                          )}
                        </td>

                        <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap">
                          {loan.borrowDate}
                        </td>

                        <td className="py-2.5 px-4 font-code whitespace-nowrap">
                          {isReturned ? (
                            <div>
                              <span className="text-slate-400 line-through mr-1.5">{loan.dueDate}</span>
                              <span className="text-emerald-700 font-semibold">
                                Rendu {loan.returnDate}
                              </span>
                            </div>
                          ) : (
                            <div className={isOverdue ? 'text-rose-700 font-semibold' : 'text-slate-900'}>
                              {loan.dueDate}
                              {loan.extensionsCount > 0 && (
                                <span className="ml-1 text-[10px] text-indigo-700 font-normal">
                                  (+{loan.extensionsCount})
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold tabular-nums ${
                              isReturned
                                ? 'text-slate-600'
                                : isOverdue
                                ? 'text-rose-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {isOverdue ? `En retard (${daysOverdue} j)` : loan.status}
                          </span>
                          {isOverdue && loan.lateFee > 0 && (
                            <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                              Pénalité : {loan.lateFee.toFixed(2)} €
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {!isReturned ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {isOverdue && (
                                <button
                                  type="button"
                                  onClick={() => handleIndividualReminder(loan.id)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3 text-slate-500" />
                                  <span className="tabular-nums">Relancer ({loan.remindersSent})</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => extendLoan(loan.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                              >
                                Prolonger
                              </button>

                              <button
                                type="button"
                                onClick={() => returnLoan(loan.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Retour</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Clôturé</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredLoans.length}
            pageSize={LOANS_PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="prêts"
          />
        </div>
      )}

      {isCollectiveModalOpen && (
        <CollectiveReminderModal onClose={() => setIsCollectiveModalOpen(false)} />
      )}
    </div>
  );
};
