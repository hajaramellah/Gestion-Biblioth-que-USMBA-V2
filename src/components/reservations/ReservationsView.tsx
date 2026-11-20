import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Reservation, ReservationStatus } from '../../types/library';
import { Pagination } from '../common/Pagination';
import { getDaysDifference } from '../../utils/dateUtils';
import {
  Bookmark,
  CheckCircle2,
  Search,
  X,
  Clock,
  Users,
  AlertTriangle,
  Eye,
  Bell,
  ScanLine,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';

interface ReservationsViewProps {
  onOpenPickupDesk?: (reservation: Reservation) => void;
}

type ReservationSection = 'demandes' | 'files' | 'pretes' | 'expirees';
type SortOption = 'date_desc' | 'date_asc' | 'student_asc' | 'book_asc';

const RESERVATIONS_PAGE_SIZE = 15;

const STATUS_TEXT_STYLE: Record<ReservationStatus, string> = {
  'En attente': 'text-amber-700',
  Confirmée: 'text-amber-700',
  'Prêt pour retrait': 'text-emerald-700',
  Honorée: 'text-slate-600',
  Refusée: 'text-rose-700',
  Annulée: 'text-slate-500',
  Expirée: 'text-orange-700',
};

const STATUS_DOT_STYLE: Record<ReservationStatus, string> = {
  'En attente': 'bg-amber-500',
  Confirmée: 'bg-amber-500',
  'Prêt pour retrait': 'bg-emerald-600',
  Honorée: 'bg-slate-400',
  Refusée: 'bg-rose-600',
  Annulée: 'bg-slate-400',
  Expirée: 'bg-orange-500',
};

const ALLOWED_MANAGEMENT_STATUSES: ReservationStatus[] = [
  'En attente',
  'Prêt pour retrait',
  'Annulée',
  'Expirée',
  'Refusée',
];

function normalizeDisplayStatus(status: ReservationStatus): ReservationStatus {
  return status === 'Confirmée' ? 'En attente' : status;
}

function compareFifo(a: Reservation, b: Reservation): number {
  const dateCmp = a.requestDate.localeCompare(b.requestDate);
  if (dateCmp !== 0) return dateCmp;
  if (a.createdAt && b.createdAt) {
    const tsCmp = a.createdAt.localeCompare(b.createdAt);
    if (tsCmp !== 0) return tsCmp;
  }
  if (a.queuePosition !== b.queuePosition) return a.queuePosition - b.queuePosition;
  return a.id.localeCompare(b.id);
}

export const ReservationsView: React.FC<ReservationsViewProps> = ({ onOpenPickupDesk }) => {
  const {
    reservations,
    books,
    members,
    currentDate,
    confirmReservation,
    refuseReservation,
    cancelReservation,
    fulfillReservation,
    processExpiredReservations,
    sendPickupExpiryReminder,
    showToast,
  } = useLibrary();

  const [activeSection, setActiveSection] = useState<ReservationSection>('demandes');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetail, setSelectedDetail] = useState<Reservation | null>(null);
  const [refusalTarget, setRefusalTarget] = useState<Reservation | null>(null);
  const [refusalReasonInput, setRefusalReasonInput] = useState('');
  const [refusalError, setRefusalError] = useState('');

  const openRefusalModal = (res: Reservation) => {
    setRefusalTarget(res);
    setRefusalReasonInput('');
    setRefusalError('');
  };

  const handleConfirmRefusal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refusalTarget) return;
    const trimmed = refusalReasonInput.trim();
    if (trimmed.length < 3) {
      setRefusalError('Veuillez saisir un motif de refus explicite (au moins 3 caractères).');
      return;
    }
    refuseReservation(refusalTarget.id, trimmed);
    setRefusalTarget(null);
    setRefusalReasonInput('');
    setRefusalError('');
    if (selectedDetail?.id === refusalTarget.id) {
      setSelectedDetail(null);
    }
  };

  const resolveMember = (res: Reservation) =>
    members.find(
      (m) =>
        m.id === res.memberId ||
        (res.memberCne && m.cne === res.memberCne) ||
        m.cne === res.memberCard ||
        m.cardNumber === res.memberCard
    );

  const resolveMemberCne = (res: Reservation): string => {
    if (res.memberCne) return res.memberCne;
    const member = resolveMember(res);
    return member?.cne || res.memberCard || '—';
  };

  const resolveBook = (res: Reservation) => books.find((b) => b.id === res.bookId);

  const isWaitingStatus = (status: ReservationStatus) =>
    status === 'En attente' || status === 'Confirmée';

  const matchesSearch = (res: Reservation, q: string) => {
    if (!q) return true;
    const cne = resolveMemberCne(res).toLowerCase();
    const book = resolveBook(res);
    return (
      res.memberName.toLowerCase().includes(q) ||
      cne.includes(q) ||
      res.memberCard.toLowerCase().includes(q) ||
      res.bookTitle.toLowerCase().includes(q) ||
      (book?.shelfLocation || '').toLowerCase().includes(q) ||
      (res.copyBarcode || '').toLowerCase().includes(q)
    );
  };

  const sortReservationsList = (list: Reservation[]) => {
    const copy = [...list];
    if (sortBy === 'date_asc') {
      return copy.sort((a, b) => a.requestDate.localeCompare(b.requestDate));
    }
    if (sortBy === 'student_asc') {
      return copy.sort((a, b) => a.memberName.localeCompare(b.memberName, 'fr'));
    }
    if (sortBy === 'book_asc') {
      return copy.sort((a, b) => a.bookTitle.localeCompare(b.bookTitle, 'fr'));
    }
    return copy.sort((a, b) => b.requestDate.localeCompare(a.requestDate));
  };

  // Section A: Demandes de réservation (5 statuts uniquement)
  const demandesList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = reservations.filter((r) => {
      const effectiveStatus = normalizeDisplayStatus(r.status);
      if (!ALLOWED_MANAGEMENT_STATUSES.includes(effectiveStatus)) return false;
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
        return false;
      }
      return matchesSearch(r, q);
    });
    return sortReservationsList(filtered);
  }, [reservations, statusFilter, searchQuery, sortBy, members, books]);

  // Section B: Files d'attente (grouped by book, strict FIFO order)
  const queueGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const waiting = reservations.filter((r) => isWaitingStatus(r.status));
    const byBook = new Map<string, Reservation[]>();

    waiting.forEach((r) => {
      const list = byBook.get(r.bookId) || [];
      list.push(r);
      byBook.set(r.bookId, list);
    });

    const groups = Array.from(byBook.entries())
      .map(([bookId, items]) => {
        const sortedQueue = [...items].sort(compareFifo);
        const book = books.find((b) => b.id === bookId);
        return {
          bookId,
          bookTitle: book?.title || sortedQueue[0]?.bookTitle || 'Ouvrage',
          author: book?.author || '',
          shelfLocation: book?.shelfLocation || '',
          availableCopies: book?.availableCopies ?? 0,
          totalCopies: book?.totalCopies ?? 0,
          queue: sortedQueue,
        };
      })
      .filter((g) => {
        if (!q) return true;
        return (
          g.bookTitle.toLowerCase().includes(q) ||
          g.shelfLocation.toLowerCase().includes(q) ||
          g.queue.some((r) => matchesSearch(r, q))
        );
      });

    if (sortBy === 'book_asc') {
      groups.sort((a, b) => a.bookTitle.localeCompare(b.bookTitle, 'fr'));
    } else if (sortBy === 'date_asc') {
      groups.sort((a, b) =>
        (a.queue[0]?.requestDate || '').localeCompare(b.queue[0]?.requestDate || '')
      );
    } else {
      groups.sort((a, b) => b.queue.length - a.queue.length);
    }

    return groups;
  }, [reservations, books, searchQuery, sortBy, members]);

  // Section C: Prêtes pour retrait
  const readyList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reservations.filter(
      (r) => r.status === 'Prêt pour retrait' && matchesSearch(r, q)
    );
    return sortReservationsList(list);
  }, [reservations, searchQuery, sortBy, members, books]);

  // Section D: Réservations expirées
  const expiredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reservations.filter(
      (r) => r.status === 'Expirée' && matchesSearch(r, q)
    );
    return sortReservationsList(list);
  }, [reservations, searchQuery, sortBy, members, books]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSection, statusFilter, searchQuery, sortBy]);

  const activeTableItems =
    activeSection === 'demandes'
      ? demandesList
      : activeSection === 'pretes'
      ? readyList
      : expiredList;

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * RESERVATIONS_PAGE_SIZE;
    return activeTableItems.slice(start, start + RESERVATIONS_PAGE_SIZE);
  }, [activeTableItems, currentPage]);

  const handleRunExpiryCheck = () => {
    const result = processExpiredReservations();
    if (result.expiredCount === 0 && result.remindedCount === 0) {
      showToast({
        type: 'info',
        title: 'Contrôle des délais terminé',
        description: 'Aucune réservation prête pour retrait n’est arrivée à expiration.',
      });
    } else {
      showToast({
        type: 'success',
        title: 'Expirations & file d’attente traitées',
        description: `${result.expiredCount} expirée(s), ${result.reassignedCount} réattribuée(s) automatiquement, ${result.remindedCount} rappel(s) envoyé(s).`,
      });
    }
  };

  const handlePickup = async (res: Reservation) => {
    if (onOpenPickupDesk) {
      onOpenPickupDesk(res);
      return;
    }
    await fulfillReservation(res.id);
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
            Gestion des réservations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Demandes étudiantes, files d’attente FIFO et retraits au guichet.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunExpiryCheck}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Vérifier expirations &amp; réattribuer</span>
        </button>
      </div>

      {/* 4 Clear Section Tabs (Sans compteurs) + Shared Search, Status Filter & Sort Bar */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 border-b border-slate-200 bg-slate-50/70 flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveSection('demandes')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              activeSection === 'demandes'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Demandes de réservation
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('files')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              activeSection === 'files'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Files d’attente
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('pretes')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              activeSection === 'pretes'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Prêtes pour retrait
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('expirees')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
              activeSection === 'expirees'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Réservations expirées
          </button>
        </div>

        <div className="p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom étudiant, CNE ou titre du livre..."
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeSection === 'demandes' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrer par statut"
                className="text-xs border border-slate-200 bg-slate-50 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:bg-white focus:border-slate-400"
              >
                <option value="all">Tous les statuts</option>
                <option value="En attente">En attente</option>
                <option value="Prêt pour retrait">Prêt pour retrait</option>
                <option value="Annulée">Annulée</option>
                <option value="Expirée">Expirée</option>
                <option value="Refusée">Refusée</option>
              </select>
            )}

            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Trier par"
                className="text-xs border border-slate-200 bg-slate-50 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:bg-white focus:border-slate-400"
              >
                <option value="date_desc">Date : récentes d’abord</option>
                <option value="date_asc">Date : anciennes d’abord</option>
                <option value="student_asc">Étudiant : A → Z</option>
                <option value="book_asc">Livre : A → Z</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION A: DEMANDES DE RÉSERVATION */}
      {activeSection === 'demandes' && (
        <>
          {demandesList.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-6">
              <Bookmark className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-800">Aucune demande trouvée</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aucune réservation ne correspond aux critères de recherche ou au statut sélectionné.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Étudiant</th>
                        <th className="py-2.5 px-4">CNE</th>
                        <th className="py-2.5 px-4">Livre demandé</th>
                        <th className="py-2.5 px-4">Date de réservation</th>
                        <th className="py-2.5 px-4">Statut</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedItems.map((res) => {
                        const cne = resolveMemberCne(res);
                        const book = resolveBook(res);
                        const isReady = res.status === 'Prêt pour retrait';
                        const isWaiting = isWaitingStatus(res.status);
                        return (
                          <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                              {res.memberName}
                            </td>
                            <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap tabular-nums">
                              {cne}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-slate-900">{res.bookTitle}</div>
                              {book?.shelfLocation && (
                                <div className="text-[11px] font-code text-slate-500">
                                  Cote {book.shelfLocation}
                                  {res.copyBarcode ? ` · ${res.copyBarcode}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap tabular-nums">
                              <div>{res.requestDate}</div>
                              {res.expiryDate && (
                                <div className="text-[10px] text-slate-400">
                                  Limite {res.expiryDate}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {(() => {
                                const effective = normalizeDisplayStatus(res.status);
                                return (
                                  <>
                                    <span
                                      className={`inline-flex items-center gap-1.5 font-semibold ${
                                        STATUS_TEXT_STYLE[effective] || 'text-slate-600'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          STATUS_DOT_STYLE[effective] || 'bg-slate-400'
                                        }`}
                                      />
                                      <span>{effective}</span>
                                    </span>
                                    {isWaiting && (
                                      <div className="text-[10px] text-slate-500 tabular-nums">
                                        Position #{res.queuePosition}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDetail(res)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Détails</span>
                                </button>
                                {isReady && (
                                  <button
                                    type="button"
                                    onClick={() => handlePickup(res)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <ScanLine className="w-3 h-3 text-emerald-400" />
                                    <span>Remettre au guichet</span>
                                  </button>
                                )}
                                {(isReady || isWaiting) && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openRefusalModal(res)}
                                      className="px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors whitespace-nowrap"
                                    >
                                      Refuser
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cancelReservation(res.id)}
                                      className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                                    >
                                      Annuler
                                    </button>
                                  </>
                                )}
                              </div>
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
                totalItems={demandesList.length}
                pageSize={RESERVATIONS_PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemLabel="réservations"
              />
            </div>
          )}
        </>
      )}

      {/* SECTION B: FILES D'ATTENTE (GROUPÉES PAR LIVRE, ORDRE FIFO) */}
      {activeSection === 'files' && (
        <>
          {queueGroups.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-6">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-800">Aucune file d’attente active</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aucun étudiant n’est actuellement en attente d’un retour d’ouvrage.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {queueGroups.map((group) => (
                <div
                  key={group.bookId}
                  className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {group.bookTitle}
                        </h3>
                        {group.shelfLocation && (
                          <span className="text-[11px] font-code text-slate-500">
                            ({group.shelfLocation})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {group.author ? `${group.author} · ` : ''}
                        <span className="tabular-nums">
                          {group.availableCopies}/{group.totalCopies} disponible(s) en rayon
                        </span>
                      </div>
                    </div>

                    <div className="text-xs font-medium text-slate-500 shrink-0">
                      Ordre d’attribution FIFO
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white border-b border-slate-100 text-slate-500 font-semibold">
                        <tr>
                          <th className="py-2 px-4 w-20">Ordre</th>
                          <th className="py-2 px-4">Étudiant</th>
                          <th className="py-2 px-4">CNE</th>
                          <th className="py-2 px-4">Date demande</th>
                          <th className="py-2 px-4">Statut</th>
                          <th className="py-2 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {group.queue.map((res, idx) => {
                          const effective = normalizeDisplayStatus(res.status);
                          return (
                            <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-4 font-code font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                                #{idx + 1}
                                {idx === 0 && (
                                  <span className="ml-1.5 text-[10px] font-sans font-semibold text-indigo-700">
                                    Prochain
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                                {res.memberName}
                              </td>
                              <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap tabular-nums">
                                {resolveMemberCne(res)}
                              </td>
                              <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap tabular-nums">
                                {res.requestDate}
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 font-semibold ${
                                    STATUS_TEXT_STYLE[effective] || 'text-slate-600'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      STATUS_DOT_STYLE[effective] || 'bg-slate-400'
                                    }`}
                                  />
                                  <span>{effective}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDetail(res)}
                                    className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Détails</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openRefusalModal(res)}
                                    className="px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors whitespace-nowrap"
                                  >
                                    Refuser
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelReservation(res.id)}
                                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* SECTION C: RÉSERVATIONS PRÊTES POUR RETRAIT */}
      {activeSection === 'pretes' && (
        <>
          {readyList.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-6">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-800">
                Aucun ouvrage en attente de retrait
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Dès qu’un ouvrage disponible est réservé ou attribué à un étudiant, il apparaît ici pour le contrôle au guichet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Étudiant</th>
                        <th className="py-2.5 px-4">CNE</th>
                        <th className="py-2.5 px-4">Livre &amp; Exemplaire</th>
                        <th className="py-2.5 px-4">Disponibilité</th>
                        <th className="py-2.5 px-4">Date limite retrait</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedItems.map((res) => {
                        const book = resolveBook(res);
                        const daysLeft = res.expiryDate
                          ? getDaysDifference(currentDate, res.expiryDate)
                          : null;
                        const isOverdueHold = daysLeft !== null && daysLeft < 0;
                        const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 1;

                        return (
                          <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                              {res.memberName}
                            </td>
                            <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap tabular-nums">
                              {resolveMemberCne(res)}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-slate-900">{res.bookTitle}</div>
                              <div className="text-[11px] font-code text-slate-500">
                                {res.copyBarcode || res.copyId || book?.shelfLocation || 'Exemplaire réservé'}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-code text-slate-700 whitespace-nowrap tabular-nums">
                              {res.readyDate || res.requestDate}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap tabular-nums">
                              {res.expiryDate ? (
                                <div>
                                  <span
                                    className={`font-code font-semibold ${
                                      isOverdueHold
                                        ? 'text-rose-700'
                                        : isExpiringSoon
                                        ? 'text-amber-700'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {res.expiryDate}
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    {isOverdueHold
                                      ? `Dépassée (${Math.abs(daysLeft!)} j)`
                                      : daysLeft === 0
                                      ? 'Expire aujourd’hui'
                                      : `${daysLeft} j restant(s)`}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePickup(res)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  <ScanLine className="w-3 h-3 text-emerald-400" />
                                  <span>Remettre au guichet</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => sendPickupExpiryReminder(res.id)}
                                  className="px-2 py-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                  title="Envoyer un rappel avant expiration"
                                >
                                  <Bell className="w-3 h-3" />
                                  <span>Rappel</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDetail(res)}
                                  className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                                >
                                  Détails
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openRefusalModal(res)}
                                  className="px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors whitespace-nowrap"
                                >
                                  Refuser
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelReservation(res.id)}
                                  className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                                >
                                  Annuler
                                </button>
                              </div>
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
                totalItems={readyList.length}
                pageSize={RESERVATIONS_PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemLabel="retraits en attente"
              />
            </div>
          )}
        </>
      )}

      {/* SECTION D: RÉSERVATIONS EXPIRÉES */}
      {activeSection === 'expirees' && (
        <>
          {expiredList.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-6">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-semibold text-slate-800">
                Aucune réservation expirée
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Lorsqu’un délai de retrait est dépassé, l’exemplaire est automatiquement libéré ou réattribué au suivant et la réservation est archivée ici.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Étudiant</th>
                        <th className="py-2.5 px-4">CNE</th>
                        <th className="py-2.5 px-4">Livre</th>
                        <th className="py-2.5 px-4">Disponible le</th>
                        <th className="py-2.5 px-4">Date limite dépassée</th>
                        <th className="py-2.5 px-4">Suite automatique</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedItems.map((res) => (
                        <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                            {res.memberName}
                          </td>
                          <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap tabular-nums">
                            {resolveMemberCne(res)}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {res.bookTitle}
                          </td>
                          <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap tabular-nums">
                            {res.readyDate || res.requestDate}
                          </td>
                          <td className="py-2.5 px-4 font-code text-rose-700 font-semibold whitespace-nowrap tabular-nums">
                            {res.expiryDate || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-600 max-w-xs truncate">
                            {res.notes || 'Exemplaire libéré automatiquement.'}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedDetail(res)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Détails</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Pagination
                currentPage={currentPage}
                totalItems={expiredList.length}
                pageSize={RESERVATIONS_PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemLabel="réservations expirées"
              />
            </div>
          )}
        </>
      )}

      {/* RESERVATION DETAIL MODAL */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          onClick={() => setSelectedDetail(null)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Détails de la réservation
                </h3>
                <p className="text-[11px] font-code text-slate-500 mt-0.5">
                  Réf. {selectedDetail.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const member = resolveMember(selectedDetail);
              const book = resolveBook(selectedDetail);
              const liveRes =
                reservations.find((r) => r.id === selectedDetail.id) || selectedDetail;
              const isReady = liveRes.status === 'Prêt pour retrait';
              const isWaiting = isWaitingStatus(liveRes.status);

              return (
                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Étudiant</span>
                      <span className="font-semibold text-slate-900">{liveRes.memberName}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">CNE / Carte</span>
                      <span className="font-code font-semibold text-slate-900">
                        {resolveMemberCne(liveRes)}
                      </span>
                    </div>
                    {member?.department && (
                      <div>
                        <span className="text-[11px] text-slate-500 block">Filière</span>
                        <span className="text-slate-800">{member.department}</span>
                      </div>
                    )}
                    {member?.email && (
                      <div>
                        <span className="text-[11px] text-slate-500 block">E-mail USMBA</span>
                        <span className="font-code text-slate-800 truncate block">
                          {member.email}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 border border-slate-200 rounded-lg p-3.5">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Ouvrage demandé</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {liveRes.bookTitle}
                      </span>
                      {book && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {book.author} · Cote <span className="font-code">{book.shelfLocation}</span> ·{' '}
                          <span className="tabular-nums">
                            {book.availableCopies}/{book.totalCopies} disponible(s)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Statut</span>
                        {(() => {
                          const effective = normalizeDisplayStatus(liveRes.status);
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 font-semibold ${
                                STATUS_TEXT_STYLE[effective] || 'text-slate-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  STATUS_DOT_STYLE[effective] || 'bg-slate-400'
                                }`}
                              />
                              <span>{effective}</span>
                            </span>
                          );
                        })()}
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Date demande</span>
                        <span className="font-code text-slate-800">{liveRes.requestDate}</span>
                      </div>
                      {isWaiting && (
                        <div>
                          <span className="text-[11px] text-slate-500 block">Rang FIFO</span>
                          <span className="font-code font-semibold text-amber-700 tabular-nums">
                            #{liveRes.queuePosition}
                          </span>
                        </div>
                      )}
                      {liveRes.readyDate && (
                        <div>
                          <span className="text-[11px] text-slate-500 block">Disponibilité</span>
                          <span className="font-code text-slate-800">{liveRes.readyDate}</span>
                        </div>
                      )}
                      {liveRes.expiryDate && (
                        <div>
                          <span className="text-[11px] text-slate-500 block">Date limite retrait</span>
                          <span className="font-code font-semibold text-slate-900">
                            {liveRes.expiryDate}
                          </span>
                        </div>
                      )}
                      {(liveRes.copyBarcode || liveRes.copyId) && (
                        <div>
                          <span className="text-[11px] text-slate-500 block">Exemplaire attribué</span>
                          <span className="font-code text-slate-900">
                            {liveRes.copyBarcode || liveRes.copyId}
                          </span>
                        </div>
                      )}
                    </div>

                    {liveRes.status === 'Refusée' && (liveRes.refusalReason || liveRes.notes) && (
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-rose-700 bg-rose-50/70 rounded p-2.5">
                        <span className="font-semibold">Motif du refus : </span>
                        {liveRes.refusalReason || liveRes.notes}
                      </div>
                    )}

                    {liveRes.status !== 'Refusée' && liveRes.notes && (
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                        <span className="font-medium text-slate-700">Note : </span>
                        {liveRes.notes}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                    {normalizeDisplayStatus(liveRes.status) === 'En attente' &&
                      book &&
                      book.availableCopies > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            confirmReservation(liveRes.id);
                            setSelectedDetail(null);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md"
                        >
                          Attribuer l’exemplaire disponible
                        </button>
                      )}
                    {isReady && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetail(null);
                          handlePickup(liveRes);
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md inline-flex items-center gap-1.5"
                      >
                        <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Remettre au guichet</span>
                      </button>
                    )}
                    {(isReady || isWaiting) && (
                      <>
                        <button
                          type="button"
                          onClick={() => openRefusalModal(liveRes)}
                          className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md"
                        >
                          Refuser
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cancelReservation(liveRes.id);
                            setSelectedDetail(null);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                        >
                          Annuler la réservation
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(null)}
                      className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* REFUSAL JUSTIFICATION MODAL */}
      {refusalTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50"
          onClick={() => setRefusalTarget(null)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Refuser la réservation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {refusalTarget.memberName} ({resolveMemberCne(refusalTarget)}) · {refusalTarget.bookTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRefusalTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRefusal} className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="refusal-reason-input"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Motif du refus <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="refusal-reason-input"
                  rows={3}
                  value={refusalReasonInput}
                  onChange={(e) => {
                    setRefusalReasonInput(e.target.value);
                    if (refusalError) setRefusalError('');
                  }}
                  placeholder="Ex. Quota d'emprunts atteint, dossier étudiant suspendu, exemplaire en réparation..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400 resize-none"
                  required
                  autoFocus
                />
                {refusalError && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    {refusalError}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Cette justification sera enregistrée et consultable par l’étudiant concerné depuis son espace.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRefusalTarget(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={refusalReasonInput.trim().length < 3}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-md transition-colors"
                >
                  Confirmer le refus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
