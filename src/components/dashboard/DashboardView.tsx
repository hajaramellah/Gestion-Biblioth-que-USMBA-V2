import React, { useMemo, useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { ActiveTab } from '../layout/Navbar';
import { Loan } from '../../types/library';
import { formatCurrentTimestamp, getDaysDifference, getOverdueDays } from '../../utils/dateUtils';
import { CollectiveReminderModal } from '../loans/CollectiveReminderModal';
import { Pagination } from '../common/Pagination';
import {
  Send,
  CheckCircle2,
  Search,
  X,
  ScanLine,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickDesk: () => void;
  onSelectBook: (bookId: string) => void;
}

type LoanStatusFilter = 'all' | 'overdue' | 'due_today' | 'in_progress';
type SortOrder = 'az' | 'za';

interface StudentLoanGroup {
  key: string;
  memberName: string;
  cne: string;
  loans: Loan[];
  overdueCount: number;
  dueTodayCount: number;
  earliestBorrowDate: string;
  earliestDueDate: string;
  remindedToday: boolean;
}

const GROUPS_PAGE_SIZE = 14;

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenQuickDesk,
}) => {
  const {
    loans,
    currentDate,
    getOverdueStudentsSummary,
    returnLoan,
    extendLoan,
    sendStudentReminder,
    showToast,
  } = useLibrary();

  const [isCollectiveModalOpen, setIsCollectiveModalOpen] = useState(false);

  // Single central table filter / search / sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('az');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Helpers to classify each active loan dynamically against currentDate
  const isLoanOverdue = (loan: Loan) =>
    loan.status === 'En retard' || getDaysDifference(currentDate, loan.dueDate) < 0;

  const isLoanDueToday = (loan: Loan) =>
    !isLoanOverdue(loan) && loan.dueDate === currentDate;

  const isLoanInProgress = (loan: Loan) =>
    !isLoanOverdue(loan) && !isLoanDueToday(loan);

  // All currently active loans (status !== 'Rendu')
  const activeLoans = useMemo(
    () =>
      loans
        .filter((l) => l.status !== 'Rendu')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [loans]
  );

  // Independent global overdue students list for collective reminder button
  const overdueStudentsAll = useMemo(
    () => getOverdueStudentsSummary(),
    [getOverdueStudentsSummary]
  );

  // Filter active loans dynamically by status filter and search query (student name, CNE, book title)
  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return activeLoans.filter((loan) => {
      if (statusFilter === 'overdue' && !isLoanOverdue(loan)) return false;
      if (statusFilter === 'due_today' && !isLoanDueToday(loan)) return false;
      if (statusFilter === 'in_progress' && !isLoanInProgress(loan)) return false;

      if (!q) return true;
      return (
        loan.memberName.toLowerCase().includes(q) ||
        loan.memberCne.toLowerCase().includes(q) ||
        loan.memberCard.toLowerCase().includes(q) ||
        loan.bookTitle.toLowerCase().includes(q) ||
        (loan.copyBarcode && loan.copyBarcode.toLowerCase().includes(q))
      );
    });
  }, [activeLoans, statusFilter, searchQuery, currentDate]);

  // Group filtered active loans by student so students without active loans never appear
  const studentGroups = useMemo<StudentLoanGroup[]>(() => {
    const todayKey = formatCurrentTimestamp().dayKey;
    const map = new Map<string, Loan[]>();

    filteredLoans.forEach((loan) => {
      const k = (loan.memberCne || loan.memberId).toUpperCase();
      const existing = map.get(k);
      if (existing) {
        existing.push(loan);
      } else {
        map.set(k, [loan]);
      }
    });

    const groups: StudentLoanGroup[] = [];
    map.forEach((studentLoans, key) => {
      // Order loans inside a student's group: overdue first, then due today, then dueDate asc
      const orderedLoans = [...studentLoans].sort((a, b) => {
        const rankA = isLoanOverdue(a) ? 0 : isLoanDueToday(a) ? 1 : 2;
        const rankB = isLoanOverdue(b) ? 0 : isLoanDueToday(b) ? 1 : 2;
        if (rankA !== rankB) return rankA - rankB;
        return a.dueDate.localeCompare(b.dueDate);
      });

      const first = orderedLoans[0];
      const overdueLoans = orderedLoans.filter(isLoanOverdue);
      const dueTodayCount = orderedLoans.filter(isLoanDueToday).length;

      const earliestBorrowDate = orderedLoans.reduce(
        (min, l) => (l.borrowDate < min ? l.borrowDate : min),
        first.borrowDate
      );
      const earliestDueDate = orderedLoans.reduce(
        (min, l) => (l.dueDate < min ? l.dueDate : min),
        first.dueDate
      );

      groups.push({
        key,
        memberName: first.memberName,
        cne: first.memberCne || first.memberCard,
        loans: orderedLoans,
        overdueCount: overdueLoans.length,
        dueTodayCount,
        earliestBorrowDate,
        earliestDueDate,
        remindedToday:
          overdueLoans.length > 0 &&
          overdueLoans.every((l) => l.lastReminderDate === todayKey),
      });
    });

    return groups.sort((a, b) => {
      const cmp = a.memberName.localeCompare(b.memberName, 'fr', {
        sensitivity: 'base',
      });
      return sortOrder === 'az' ? cmp : -cmp;
    });
  }, [filteredLoans, sortOrder, currentDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOrder]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * GROUPS_PAGE_SIZE;
    return studentGroups.slice(start, start + GROUPS_PAGE_SIZE);
  }, [studentGroups, currentPage]);

  const multiLoanGroupKeys = useMemo(
    () => studentGroups.filter((g) => g.loans.length > 1).map((g) => g.key),
    [studentGroups]
  );

  const allMultiExpanded =
    multiLoanGroupKeys.length > 0 &&
    multiLoanGroupKeys.every((k) => expandedKeys.has(k));

  const toggleExpandAll = () => {
    if (allMultiExpanded) {
      setExpandedKeys(new Set());
    } else {
      setExpandedKeys(new Set(multiLoanGroupKeys));
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleIndividualStudentReminder = (cne: string, memberName: string) => {
    const res = sendStudentReminder(cne);
    if (!res.success && res.status === 'Ignorée (déjà relancé)') {
      showToast({
        type: 'info',
        title: 'Relance déjà envoyée aujourd’hui',
        description: `${memberName} a déjà reçu une relance aujourd’hui.`,
      });
    }
  };


  const renderLoanStatus = (loan: Loan) => {
    if (isLoanOverdue(loan)) {
      const lateDays = getOverdueDays(loan.dueDate, currentDate);
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium bg-rose-50 text-rose-700 border-rose-200 tabular-nums whitespace-nowrap">
          En retard ({lateDays} j)
        </span>
      );
    }
    if (isLoanDueToday(loan)) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold bg-amber-50 text-amber-800 border-amber-200 whitespace-nowrap">
          À retourner aujourd’hui
        </span>
      );
    }
    const daysLeft = getDaysDifference(currentDate, loan.dueDate);
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200 tabular-nums whitespace-nowrap">
        En cours ({daysLeft} j)
      </span>
    );
  };

  const renderGroupSummaryStatus = (group: StudentLoanGroup) => {
    if (group.overdueCount > 0) {
      return (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium bg-rose-50 text-rose-700 border-rose-200 tabular-nums">
            En retard ({group.overdueCount})
          </span>
          {group.remindedToday && (
            <span className="text-[10px] font-medium text-emerald-700">
              Relancé
            </span>
          )}
        </div>
      );
    }
    if (group.dueTodayCount > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold bg-amber-50 text-amber-800 border-amber-200 whitespace-nowrap">
          À retourner aujourd’hui ({group.dueTodayCount})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
        En cours ({group.loans.length})
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-8">
      {/* EN-TÊTE OPÉRATIONNEL COMPACT + ACTIONS PRINCIPALES */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
          Gestion quotidienne
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuickDesk}
            className="px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Accéder au guichet</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollectiveModalOpen(true)}
            disabled={overdueStudentsAll.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Identifier et relancer tous les étudiants ayant au moins un emprunt en retard, indépendamment des filtres actifs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Relancer tous les étudiants en retard</span>
          </button>
        </div>
      </div>

      {/* TABLEAU CENTRAL UNIQUE DES EMPRUNTS ACTIFS */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Barre Recherche + Filtres + Tri */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, CNE ou titre du livre..."
              className="w-full text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Effacer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status filters */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md text-[11px] overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'Tous les emprunts actifs' },
                  { id: 'overdue', label: 'En retard' },
                  { id: 'due_today', label: 'À retourner aujourd’hui' },
                  { id: 'in_progress', label: 'En cours' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Alphabetical sort */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md text-[11px] shrink-0">
              <ArrowUpDown className="w-3 h-3 text-slate-500 ml-1" />
              <button
                type="button"
                onClick={() => setSortOrder('az')}
                className={`px-2 py-1 rounded whitespace-nowrap shrink-0 transition-colors ${
                  sortOrder === 'az'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A–Z
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('za')}
                className={`px-2 py-1 rounded whitespace-nowrap shrink-0 transition-colors ${
                  sortOrder === 'za'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Z–A
              </button>
            </div>

            {multiLoanGroupKeys.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md whitespace-nowrap shrink-0 transition-colors"
              >
                {allMultiExpanded ? 'Tout regrouper' : 'Tout développer'}
              </button>
            )}
          </div>
        </div>

        {/* Table Body */}
        {studentGroups.length === 0 ? (
          <div className="py-10 px-6 text-center text-xs text-slate-500">
            Aucun emprunt actif ne correspond aux critères sélectionnés.
          </div>
        ) : (
          <div className="overflow-x-auto xl:overflow-x-visible">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Étudiant</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">CNE</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Livre emprunté</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Exemplaire</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Emprunt</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Retour prévu</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Statut</th>
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {paginatedGroups.map((group) => {
                  const isSingle = group.loans.length === 1;
                  const firstLoan = group.loans[0];
                  const isExpanded = !isSingle && expandedKeys.has(group.key);

                  if (isSingle) {
                    const loan = firstLoan;
                    const overdue = isLoanOverdue(loan);
                    const dueToday = isLoanDueToday(loan);

                    return (
                      <tr
                        key={group.key}
                        className={`transition-colors hover:bg-slate-50/80 ${
                          dueToday ? 'bg-amber-50/25' : ''
                        }`}
                      >
                        <td
                          className="py-2.5 px-2.5 font-semibold text-slate-900 max-w-[160px] truncate"
                          title={group.memberName}
                        >
                          {group.memberName}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                          {group.cne}
                        </td>
                        <td
                          className="py-2.5 px-2.5 font-medium text-slate-900 max-w-[195px] truncate"
                          title={loan.bookTitle}
                        >
                          {loan.bookTitle}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                          {loan.copyBarcode || '—'}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                          {loan.borrowDate}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] font-medium text-slate-900 tabular-nums whitespace-nowrap">
                          {loan.dueDate}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {renderLoanStatus(loan)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {overdue && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleIndividualStudentReminder(
                                    group.cne,
                                    group.memberName
                                  )
                                }
                                className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                title="Envoyer une relance à cet étudiant"
                              >
                                <Send className="w-3 h-3" />
                                <span>Relancer</span>
                              </button>
                            )}

                            {!overdue && loan.extensionsCount < 2 && (
                              <button
                                type="button"
                                onClick={() => extendLoan(loan.id)}
                                className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
                              >
                                Prolonger
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => returnLoan(loan.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Enregistrer le retour</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Multi-loan student row + expandable individual loans inside the SAME table
                  const extraCount = group.loans.length - 1;
                  return (
                    <React.Fragment key={group.key}>
                      <tr
                        onClick={() => toggleExpand(group.key)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50/90 ${
                          isExpanded ? 'bg-slate-50/80' : ''
                        }`}
                      >
                        <td
                          className="py-2.5 px-2.5 max-w-[160px]"
                          title={group.memberName}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-slate-400 shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {group.memberName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                          {group.cne}
                        </td>
                        <td
                          className="py-2.5 px-2.5 max-w-[195px] truncate"
                          title={group.loans.map((l) => l.bookTitle).join(' · ')}
                        >
                          <span className="font-medium text-slate-900">
                            {firstLoan.bookTitle}
                          </span>
                          <span className="ml-1 text-[11px] font-medium text-indigo-700">
                            (+{extraCount})
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                          {group.loans.length} ex.
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                          {group.earliestBorrowDate}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] font-medium text-slate-900 tabular-nums whitespace-nowrap">
                          {group.earliestDueDate}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {renderGroupSummaryStatus(group)}
                        </td>
                        <td
                          className="py-2.5 px-2.5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            {group.overdueCount > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleIndividualStudentReminder(
                                    group.cne,
                                    group.memberName
                                  )
                                }
                                className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                title={`Envoyer une notification groupée pour les ${group.overdueCount} livres en retard`}
                              >
                                <Send className="w-3 h-3" />
                                <span>Relancer</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleExpand(group.key)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                            >
                              {isExpanded
                                ? 'Regrouper'
                                : `Développer (${group.loans.length})`}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded &&
                        group.loans.map((loan) => {
                          const overdue = isLoanOverdue(loan);
                          const dueToday = isLoanDueToday(loan);

                          return (
                            <tr
                              key={loan.id}
                              className={`bg-slate-50/50 hover:bg-slate-100/60 transition-colors ${
                                dueToday ? 'bg-amber-50/35' : ''
                              }`}
                            >
                              <td className="py-2 px-2.5 pl-6 text-[11px] text-slate-500 whitespace-nowrap">
                                ↳ Ouvrage
                              </td>
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                                {group.cne}
                              </td>
                              <td
                                className="py-2 px-2.5 font-medium text-slate-900 max-w-[195px] truncate"
                                title={loan.bookTitle}
                              >
                                {loan.bookTitle}
                              </td>
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                                {loan.copyBarcode || '—'}
                              </td>
                              <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                                {loan.borrowDate}
                              </td>
                              <td className="py-2 px-2.5 font-mono text-[11px] font-medium text-slate-900 tabular-nums whitespace-nowrap">
                                {loan.dueDate}
                              </td>
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                {renderLoanStatus(loan)}
                              </td>
                              <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  {!overdue && loan.extensionsCount < 2 && (
                                    <button
                                      type="button"
                                      onClick={() => extendLoan(loan.id)}
                                      className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                                    >
                                      Prolonger
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => returnLoan(loan.id)}
                                    className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Enregistrer le retour</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Pagination
        currentPage={currentPage}
        totalItems={studentGroups.length}
        pageSize={GROUPS_PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemLabel="étudiants avec emprunt actif"
      />

      {isCollectiveModalOpen && (
        <CollectiveReminderModal onClose={() => setIsCollectiveModalOpen(false)} />
      )}
    </div>
  );
};
