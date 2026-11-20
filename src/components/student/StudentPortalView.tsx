import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary, MultiReservationResult } from '../../context/LibraryContext';
import { Book, Reservation, ReservationStatus } from '../../types/library';
import { BookCover } from '../common/BookCover';
import { Pagination } from '../common/Pagination';
import { BookDetailModal } from '../books/BookDetailModal';
import { NotificationsView } from '../notifications/NotificationsView';
import { getDaysDifference } from '../../utils/dateUtils';
import { generateQrDataUrl, buildStudentQrPayload } from '../../utils/qrHelper';
import {
  BookOpen,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  School,
  BookmarkCheck,
  Info,
  ChevronRight,
  ShieldCheck,
  Library,
  Bell,
  X,
  LayoutGrid,
  List,
  Mail,
  Check,
  Plus,
  QrCode,
  CreditCard,
  Download,
  Printer,
  Copy,
} from 'lucide-react';

export type StudentSubTab =
  | 'overview'
  | 'catalog'
  | 'my_loans'
  | 'my_reservations'
  | 'my_card'
  | 'my_profile'
  | 'notifications'
  | 'guidelines';

interface StudentPortalViewProps {
  activeSubTab?: StudentSubTab;
  onChangeSubTab?: (tab: StudentSubTab) => void;
  selectedBookId?: string | null;
  onClearSelectedBook?: () => void;
  isPendingContinuation?: boolean;
}

const RESERVATION_STATUS_TEXT: Record<ReservationStatus, string> = {
  'En attente': 'text-amber-700',
  Confirmée: 'text-indigo-700',
  'Prêt pour retrait': 'text-emerald-700',
  Refusée: 'text-rose-700',
  Annulée: 'text-slate-500',
  Expirée: 'text-slate-500',
  Honorée: 'text-slate-700',
};

const DEPARTMENT_TO_CATEGORIES: Record<string, string[]> = {
  'Génie Informatique': ['Informatique & Réseaux', 'Mathématiques & Algorithmique'],
  Réseaux: ['Informatique & Réseaux', 'Génie Électrique & Électronique'],
  'Génie Électrique': ['Génie Électrique & Électronique', 'Mathématiques & Algorithmique'],
  'Génie Industriel': ['Génie Industriel & Mécanique', 'Génie Électrique & Électronique'],
  'Techniques de Management': ['Management & Économie', 'Littérature & Langues'],
  'Bio-analyses': ['Sciences & Physique', 'Général & Divers'],
  Biochimie: ['Sciences & Physique', 'Général & Divers'],
};

const CATALOG_PAGE_SIZE = 18;
const LOANS_PAGE_SIZE = 12;

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  activeSubTab: controlledSubTab,
  onChangeSubTab,
  selectedBookId,
  onClearSelectedBook,
  isPendingContinuation = false,
}) => {
  const {
    authSession,
    books,
    loans,
    members,
    reservations,
    currentDate,
    extendLoan,
    cancelReservation,
    reserveBookForCurrentStudent,
    reserveMultipleBooksForCurrentStudent,
    unreadNotificationCount,
  } = useLibrary();

  const [internalSubTab, setInternalSubTab] = useState<StudentSubTab>('catalog');
  const activeSubTab = controlledSubTab ?? internalSubTab;
  const setActiveSubTab = (tab: StudentSubTab) => {
    setInternalSubTab(tab);
    onChangeSubTab?.(tab);
  };

  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'title' | 'availability'>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [catalogPage, setCatalogPage] = useState(1);

  const [selectedReserveIds, setSelectedReserveIds] = useState<string[]>([]);
  const [isConfirmReserveModalOpen, setIsConfirmReserveModalOpen] = useState(false);
  const [lastMultiReserveResult, setLastMultiReserveResult] = useState<MultiReservationResult | null>(null);

  const [loansFilter, setLoansFilter] = useState<'all' | 'active' | 'returned'>('all');
  const [loansPage, setLoansPage] = useState(1);

  const [selectedBookForModal, setSelectedBookForModal] = useState<Book | null>(null);
  const [intentBookId, setIntentBookId] = useState<string | null>(null);
  const [selectedRefusalRes, setSelectedRefusalRes] = useState<Reservation | null>(null);

  useEffect(() => {
    if (selectedBookId) {
      const found = books.find((b) => b.id === selectedBookId);
      if (found) {
        setSelectedBookForModal(found);
        if (isPendingContinuation) {
          setIntentBookId(found.id);
        }
      }
      onClearSelectedBook?.();
    }
  }, [selectedBookId, books, onClearSelectedBook, isPendingContinuation]);

  const student = authSession.student;
  const studentCne = student?.cne || '';
  const studentEmail = authSession.academicEmail || '';

  const matchingMember = useMemo(() => {
    return members.find(
      (m) =>
        (studentCne && m.cne === studentCne) ||
        (studentEmail && m.email.toLowerCase() === studentEmail.toLowerCase())
    );
  }, [members, studentCne, studentEmail]);

  const [studentQrUrl, setStudentQrUrl] = useState<string>(
    student?.qrCodeDataUrl || matchingMember?.qrCodeDataUrl || ''
  );
  const [copiedCardId, setCopiedCardId] = useState(false);

  useEffect(() => {
    let active = true;
    const existing = student?.qrCodeDataUrl || matchingMember?.qrCodeDataUrl;
    if (existing) {
      setStudentQrUrl(existing);
      return () => {
        active = false;
      };
    }
    if (student || matchingMember) {
      const payload = buildStudentQrPayload({
        cne: student?.cne || matchingMember?.cne || '',
        apogee: student?.apogee || matchingMember?.apogee || '',
        firstName: student?.firstName || matchingMember?.firstName || 'Étudiant',
        lastName: student?.lastName || matchingMember?.lastName || 'EST',
        academicEmail: studentEmail || matchingMember?.email || '',
        department: student?.department || matchingMember?.department || 'EST Fès',
        registrationStatus: student?.registrationStatus || matchingMember?.status || 'Inscrit',
      });
      generateQrDataUrl(payload).then((url) => {
        if (active && url) setStudentQrUrl(url);
      });
    }
    return () => {
      active = false;
    };
  }, [student, matchingMember, studentEmail]);

  const studentCardNumber = matchingMember?.cardNumber || (student ? `EST-2026-${student.apogee?.slice(-3) || '001'}` : 'EST-2026');
  const cardExpiryDate = matchingMember?.expiryDate || '2027-09-30';

  const handleCopyCardIdentifier = () => {
    const value = `${student?.cne || ''} · ${studentCardNumber}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopiedCardId(true);
    setTimeout(() => setCopiedCardId(false), 2000);
  };

  const maxAllowedLoans = matchingMember?.maxAllowedLoans || 3;

  const studentLoans = useMemo(() => {
    return loans
      .filter((l) => {
        if (studentCne && l.memberCne === studentCne) return true;
        if (studentEmail && l.memberId.toLowerCase().includes(studentEmail.toLowerCase())) return true;
        if (student?.firstName && student?.lastName) {
          const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
          if (l.memberName.toLowerCase() === fullName) return true;
        }
        return false;
      })
      .sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));
  }, [loans, studentCne, studentEmail, student]);

  const activeLoans = useMemo(
    () => studentLoans.filter((l) => l.status === 'En cours' || l.status === 'En retard'),
    [studentLoans]
  );
  const returnedLoans = useMemo(
    () => studentLoans.filter((l) => l.status === 'Rendu'),
    [studentLoans]
  );

  const studentReservations = useMemo(() => {
    return reservations
      .filter((r) => {
        if (studentCne && (r.memberCne === studentCne || r.memberCard === studentCne)) return true;
        if (matchingMember && (r.memberId === matchingMember.id || r.memberCard === matchingMember.cardNumber)) {
          return true;
        }
        if (
          studentEmail &&
          (r.memberCard === studentEmail ||
            (student?.firstName &&
              student?.lastName &&
              r.memberName.toLowerCase() ===
                `${student.firstName} ${student.lastName}`.toLowerCase()))
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) => b.requestDate.localeCompare(a.requestDate));
  }, [reservations, studentCne, studentEmail, student, matchingMember]);

  const activeReservationsList = useMemo(
    () =>
      studentReservations.filter(
        (r) =>
          r.status === 'En attente' ||
          r.status === 'Confirmée' ||
          r.status === 'Prêt pour retrait'
      ),
    [studentReservations]
  );

  const activeReservedBookIds = useMemo(
    () => new Set(activeReservationsList.map((r) => r.bookId)),
    [activeReservationsList]
  );

  const selectedBooksForReservation = useMemo(
    () =>
      selectedReserveIds
        .map((id) => books.find((b) => b.id === id))
        .filter((b): b is Book => Boolean(b)),
    [selectedReserveIds, books]
  );

  const toggleBookSelection = (bookId: string) => {
    if (activeReservedBookIds.has(bookId)) return;
    setSelectedReserveIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const getBookWaitingQueueCount = (bookId: string) =>
    reservations.filter(
      (r) => r.bookId === bookId && (r.status === 'En attente' || r.status === 'Confirmée')
    ).length;

  const getLiveFifoInfo = (resId: string, bookId: string) => {
    const waiting = reservations
      .filter(
        (r) => r.bookId === bookId && (r.status === 'En attente' || r.status === 'Confirmée')
      )
      .sort((a, b) => {
        const d = a.requestDate.localeCompare(b.requestDate);
        if (d !== 0) return d;
        if (a.createdAt && b.createdAt) {
          const c = a.createdAt.localeCompare(b.createdAt);
          if (c !== 0) return c;
        }
        if (a.queuePosition !== b.queuePosition) return a.queuePosition - b.queuePosition;
        return a.id.localeCompare(b.id);
      });
    const idx = waiting.findIndex((r) => r.id === resId);
    return {
      position: idx >= 0 ? idx + 1 : undefined,
      totalWaiting: waiting.length,
    };
  };

  const handleConfirmMultiReservation = () => {
    if (selectedReserveIds.length === 0) return;
    const result = reserveMultipleBooksForCurrentStudent(selectedReserveIds);
    setLastMultiReserveResult(result);
    if (result.success) {
      setSelectedReserveIds([]);
    }
  };

  const readyReservationsCount = useMemo(
    () => studentReservations.filter((r) => r.status === 'Prêt pour retrait').length,
    [studentReservations]
  );

  const recommendedBooks = useMemo(() => {
    const dept = student?.department || '';
    const preferredCats =
      Object.entries(DEPARTMENT_TO_CATEGORIES).find(([key]) =>
        dept.toLowerCase().includes(key.toLowerCase())
      )?.[1] || ['Informatique & Réseaux', 'Mathématiques & Algorithmique'];

    const prioritized = books.filter((b) => preferredCats.includes(b.category));
    const pool = prioritized.length >= 4 ? prioritized : books;
    return [...pool]
      .sort((a, b) => b.availableCopies - a.availableCopies)
      .slice(0, 4);
  }, [books, student]);

  const filteredBooks = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const list = books.filter((b) => {
      const matchSearch =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.shelfLocation.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);

      const matchCategory = selectedCategory === 'all' || b.category === selectedCategory;
      const matchAvailable = !onlyAvailable || b.availableCopies > 0;
      return matchSearch && matchCategory && matchAvailable;
    });

    if (sortBy === 'newest') {
      return [...list].sort((a, b) =>
        (b.addedDate || `${b.year}-01-01`).localeCompare(a.addedDate || `${a.year}-01-01`)
      );
    }
    if (sortBy === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    }
    if (sortBy === 'availability') {
      return [...list].sort((a, b) => b.availableCopies - a.availableCopies);
    }
    return list;
  }, [books, catalogSearch, selectedCategory, onlyAvailable, sortBy]);

  useEffect(() => {
    setCatalogPage(1);
  }, [catalogSearch, selectedCategory, onlyAvailable, sortBy]);

  const paginatedBooks = useMemo(() => {
    const start = (catalogPage - 1) * CATALOG_PAGE_SIZE;
    return filteredBooks.slice(start, start + CATALOG_PAGE_SIZE);
  }, [filteredBooks, catalogPage]);

  const filteredStudentLoans = useMemo(() => {
    if (loansFilter === 'active') return activeLoans;
    if (loansFilter === 'returned') return returnedLoans;
    return studentLoans;
  }, [studentLoans, activeLoans, returnedLoans, loansFilter]);

  useEffect(() => {
    setLoansPage(1);
  }, [loansFilter]);

  const paginatedStudentLoans = useMemo(() => {
    const start = (loansPage - 1) * LOANS_PAGE_SIZE;
    return filteredStudentLoans.slice(start, start + LOANS_PAGE_SIZE);
  }, [filteredStudentLoans, loansPage]);

  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category));
    return ['all', ...Array.from(set)];
  }, [books]);

  const getLoanTimeline = (borrowDate: string, dueDate: string) => {
    const totalDays = Math.max(1, getDaysDifference(borrowDate, dueDate));
    const elapsedDays = Math.max(0, getDaysDifference(borrowDate, currentDate));
    const daysLeft = getDaysDifference(currentDate, dueDate);
    const pct = Math.min(100, Math.max(5, Math.round((elapsedDays / totalDays) * 100)));
    return { totalDays, elapsedDays, daysLeft, pct };
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Compact Institutional Student Identity & Sub-Navigation Card */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 overflow-hidden">
              {student?.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.firstName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate">
                {student ? `${student.firstName} ${student.lastName}` : 'Espace Étudiant'}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                <span className="font-code text-slate-700">CNE : {student?.cne || 'N139045123'}</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="font-code text-slate-700">Apogée : {student?.apogee || '21017320'}</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span>{student?.department || 'Génie Informatique'}</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span>{student?.studyYear || 'Étudiant EST'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 shrink-0">
            <ShieldCheck className="w-4 h-4" />
            <span>Compte USMBA vérifié</span>
          </div>
        </div>

        {/* Sub-navigation Tabs (Catalogue first as default home) */}
        <div className="px-4 border-t border-slate-200 bg-slate-50/70 flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeSubTab === 'catalog'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Catalogue</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeSubTab === 'overview'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>Mon Espace</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('my_loans')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeSubTab === 'my_loans'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Mes Emprunts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('my_reservations')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeSubTab === 'my_reservations'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Mes Réservations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('my_card')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeSubTab === 'my_card'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Carte numérique</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('my_profile')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeSubTab === 'my_profile'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Mon Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('notifications')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors tabular-nums ${
              activeSubTab === 'notifications'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>
              Notifications{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('guidelines')}
            className={`px-3 py-2.5 font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeSubTab === 'guidelines'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Horaires & Règlement</span>
          </button>
        </div>
      </div>

      {/* TAB: MON ESPACE (Simple, sans statistiques ni cartes de comptage) */}
      {activeSubTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Left 2 Cols: Mes emprunts en cours + Mes ouvrages réservés + Recommandés pour votre filière */}
            <div className="lg:col-span-2 space-y-5">
              {/* 1. Mes emprunts en cours */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Mes emprunts en cours
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('my_loans')}
                    className="text-xs text-indigo-700 hover:underline font-medium flex items-center gap-1"
                  >
                    <span>Historique complet</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {activeLoans.length === 0 ? (
                  <div className="py-10 px-6 text-center space-y-2.5">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="text-sm font-medium text-slate-800">
                      Aucun emprunt en cours
                    </div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Consultez le catalogue pour réserver un ouvrage en ligne ou présentez votre carte d’étudiant au guichet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('catalog')}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md inline-flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Parcourir le catalogue</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {activeLoans.map((loan) => {
                      const { daysLeft, pct } = getLoanTimeline(loan.borrowDate, loan.dueDate);
                      const isLate = daysLeft < 0;
                      const isUrgent = !isLate && daysLeft <= 2;

                      return (
                        <div key={loan.id} className="px-5 py-4 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900 truncate">
                                  {loan.bookTitle}
                                </span>
                                <span className="text-[11px] font-code text-slate-500 shrink-0">
                                  {loan.bookShelfLocation || 'EST'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                                <span>
                                  Emprunté : <span className="font-code text-slate-700">{loan.borrowDate}</span>
                                </span>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span>
                                  Échéance :{' '}
                                  <span
                                    className={`font-code font-semibold ${
                                      isLate ? 'text-rose-700' : isUrgent ? 'text-amber-700' : 'text-slate-800'
                                    }`}
                                  >
                                    {loan.dueDate}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className={`text-xs font-semibold tabular-nums flex items-center gap-1 ${
                                  isLate
                                    ? 'text-rose-700'
                                    : isUrgent
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {isLate ? (
                                  <>
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Retard ({Math.abs(daysLeft)} j)</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{daysLeft} j restant(s)</span>
                                  </>
                                )}
                              </span>

                              <button
                                type="button"
                                onClick={() => extendLoan(loan.id)}
                                disabled={loan.extensionsCount >= 2 || isLate}
                                title={isLate ? 'Prolongation impossible en cas de retard' : 'Prolonger de 14 jours'}
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                              >
                                Prolonger
                              </button>
                            </div>
                          </div>

                          {/* Deadline Progress Bar */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isLate ? 'bg-rose-600' : isUrgent ? 'bg-amber-500' : 'bg-slate-800'
                              }`}
                              style={{ width: `${isLate ? 100 : pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Mes ouvrages réservés (titres uniquement, sans statistiques ni compteurs) */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Mes ouvrages réservés
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('my_reservations')}
                    className="text-xs text-indigo-700 hover:underline font-medium flex items-center gap-1"
                  >
                    <span>Gérer mes réservations</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {activeReservationsList.length === 0 ? (
                  <div className="px-5 py-6 text-xs text-slate-500">
                    Aucun ouvrage réservé actuellement.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {activeReservationsList.map((res) => (
                      <li key={res.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {res.bookTitle}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 3. Recommandés pour votre filière */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Recommandés pour votre filière
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {student?.department || 'Génie Informatique'} · Sélection disponible en rayon
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('catalog')}
                    className="text-xs text-indigo-700 hover:underline font-medium"
                  >
                    Tout le catalogue
                  </button>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recommendedBooks.map((book) => (
                    <div
                      key={book.id}
                      onClick={() => setSelectedBookForModal(book)}
                      className="p-3 rounded-md border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer flex gap-3 group"
                    >
                      <BookCover
                        title={book.title}
                        author={book.author}
                        category={book.category}
                        shelfLocation={book.shelfLocation}
                        coverImage={book.coverImage}
                        compact
                        className="w-12 h-16 rounded shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-1">
                          {book.title}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {book.author}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-code pt-1">
                          <span className="text-slate-500">{book.shelfLocation}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span
                            className={
                              book.availableCopies > 0
                                ? 'text-emerald-700 font-semibold'
                                : 'text-rose-700 font-semibold'
                            }
                          >
                            {book.availableCopies > 0
                              ? `${book.availableCopies} dispo`
                              : 'Emprunté'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: 4. Carte numérique étudiant */}
            <div className="space-y-5">
              <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-300" />
                    <span className="text-xs font-semibold tracking-wide text-slate-100">
                      Carte numérique étudiant
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      matchingMember?.status === 'Suspendu' || student?.registrationStatus === 'Suspendu'
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {matchingMember?.status === 'Suspendu' ? 'Suspendu' : 'Actif'}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {student ? `${student.firstName} ${student.lastName}` : 'Étudiant EST'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {student?.department || 'Génie Informatique'} · {student?.studyYear || 'EST Fès'}
                    </div>
                    <div className="text-[11px] font-code text-amber-300 pt-1">
                      {studentCardNumber}
                    </div>
                  </div>

                  {studentQrUrl && (
                    <div className="bg-white p-1.5 rounded-md shrink-0 flex flex-col items-center">
                      <img
                        src={studentQrUrl}
                        alt="QR Code Carte Étudiant"
                        className="w-16 h-16 object-contain"
                      />
                      <span className="text-[7px] font-code text-slate-600 tracking-wider mt-0.5">
                        EST-USMBA
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-md p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">CNE</span>
                    <span className="font-code text-slate-200">{student?.cne || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Apogée</span>
                    <span className="font-code text-slate-200">{student?.apogee || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">E-mail</span>
                    <span className="font-code text-slate-200 truncate max-w-[165px]">
                      {studentEmail || '—'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('my_card')}
                  className="w-full py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Ouvrir ma carte numérique QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATALOG (Read-only & Reserve — Zero Add/Edit/Delete controls) */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Rechercher par titre, auteur, cote, domaine ou ISBN..."
                  className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-slate-400"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Effacer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs border border-slate-200 bg-slate-50 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:bg-white focus:border-slate-400"
                  aria-label="Trier par"
                >
                  <option value="relevance">Tri : Pertinence</option>
                  <option value="newest">Tri : Nouveautés</option>
                  <option value="title">Tri : Titre A–Z</option>
                  <option value="availability">Tri : Disponibilité</option>
                </select>

                <label className="flex items-center gap-2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-slate-900"
                  />
                  <span className="font-medium text-slate-700">Disponibles uniquement</span>
                </label>

                <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Vue grille"
                    aria-label="Vue grille"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'table'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Vue tableau"
                    aria-label="Vue tableau"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 transition-colors font-medium ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'Tous les domaines' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
            <span>{filteredBooks.length} ouvrage(s) répertorié(s)</span>
            <span>Sélectionnez un ou plusieurs ouvrages pour effectuer une réservation groupée</span>
          </div>

          {/* Multi-Book Selection Action Bar */}
          {selectedReserveIds.length > 0 && (
            <div className="bg-slate-900 text-white rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 text-xs">
                <div className="font-semibold tabular-nums">
                  {selectedReserveIds.length} ouvrage(s) sélectionné(s) pour réservation
                </div>
                <div className="text-[11px] text-slate-300 tabular-nums">
                  {selectedBooksForReservation.filter((b) => b.availableCopies > 0).length} disponible(s) immédiatement ·{' '}
                  {selectedBooksForReservation.filter((b) => b.availableCopies <= 0).length} en file d’attente FIFO
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedReserveIds([])}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white border border-slate-700 rounded-md transition-colors whitespace-nowrap"
                >
                  Effacer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLastMultiReserveResult(null);
                    setIsConfirmReserveModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Vérifier & Confirmer ({selectedReserveIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {paginatedBooks.length === 0 ? (
            <div className="py-12 px-6 text-center bg-white rounded-lg border border-slate-200 space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">Aucun ouvrage trouvé</div>
              <p className="text-xs text-slate-500">
                Essayez d’élargir vos filtres ou modifiez votre recherche.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedBooks.map((book) => {
                const isAvailable = book.availableCopies > 0;
                const isSelected = selectedReserveIds.includes(book.id);
                const isAlreadyReserved = activeReservedBookIds.has(book.id);
                const waitingCount = getBookWaitingQueueCount(book.id);
                return (
                  <div
                    key={book.id}
                    className={`bg-white rounded-lg border transition-colors overflow-hidden flex flex-col justify-between group ${
                      isSelected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      onClick={() => setSelectedBookForModal(book)}
                      className="p-4 space-y-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <BookCover
                          title={book.title}
                          author={book.author}
                          category={book.category}
                          shelfLocation={book.shelfLocation}
                          coverImage={book.coverImage}
                          compact
                          className="w-14 h-20 rounded shrink-0"
                        />

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-[11px] text-slate-500 truncate">
                            {book.category} · <span className="font-code">{book.shelfLocation}</span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-2 leading-snug">
                            {book.title}
                          </h3>
                          <div className="text-xs text-slate-600 truncate">
                            {book.author}
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {book.summary || 'Aucun résumé disponible pour cet ouvrage.'}
                      </p>
                    </div>

                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`text-[11px] font-semibold tabular-nums ${
                          isAvailable ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isAvailable
                          ? `${book.availableCopies}/${book.totalCopies} en rayon`
                          : waitingCount > 0
                          ? `Indisponible · ${waitingCount} en attente`
                          : 'Tous empruntés'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedBookForModal(book)}
                          className="px-1.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                        >
                          Détails
                        </button>

                        {!isAlreadyReserved && (
                          <button
                            type="button"
                            onClick={() => toggleBookSelection(book.id)}
                            className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                              isSelected
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                            title={isSelected ? 'Retirer de la sélection multiple' : 'Ajouter à la sélection multiple'}
                          >
                            {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            <span>{isSelected ? 'Sélectionné' : 'Sélection'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isAlreadyReserved}
                          onClick={() => reserveBookForCurrentStudent(book.id)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                            isAlreadyReserved
                              ? 'bg-slate-200 text-slate-600'
                              : isAvailable
                              ? 'bg-slate-900 hover:bg-slate-800 text-white'
                              : 'bg-indigo-700 hover:bg-indigo-800 text-white'
                          }`}
                        >
                          {isAlreadyReserved ? 'Déjà réservé' : isAvailable ? 'Réserver' : 'File d’attente'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 w-10">Sél.</th>
                      <th className="py-2.5 px-4">Ouvrage</th>
                      <th className="py-2.5 px-4">Domaine</th>
                      <th className="py-2.5 px-4">Cote</th>
                      <th className="py-2.5 px-4">Stock</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedBooks.map((book) => {
                      const isAvailable = book.availableCopies > 0;
                      const isSelected = selectedReserveIds.includes(book.id);
                      const isAlreadyReserved = activeReservedBookIds.has(book.id);
                      return (
                        <tr
                          key={book.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isAlreadyReserved}
                              onChange={() => toggleBookSelection(book.id)}
                              aria-label={`Sélectionner ${book.title}`}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-40"
                            />
                          </td>
                          <td
                            onClick={() => setSelectedBookForModal(book)}
                            className="py-2.5 px-4 cursor-pointer"
                          >
                            <div className="font-semibold text-slate-900 hover:text-indigo-700">
                              {book.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {book.author} · <span className="font-code">{book.isbn}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                            {book.category}
                          </td>
                          <td className="py-2.5 px-4 font-code text-slate-700 whitespace-nowrap">
                            {book.shelfLocation}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap tabular-nums">
                            <span
                              className={`font-semibold ${
                                isAvailable ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {book.availableCopies}/{book.totalCopies}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => setSelectedBookForModal(book)}
                              className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
                            >
                              Détails
                            </button>
                            <button
                              type="button"
                              disabled={isAlreadyReserved}
                              onClick={() => reserveBookForCurrentStudent(book.id)}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white transition-colors"
                            >
                              {isAlreadyReserved ? 'Réservé' : isAvailable ? 'Réserver' : 'Attente'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Pagination
            currentPage={catalogPage}
            totalItems={filteredBooks.length}
            pageSize={CATALOG_PAGE_SIZE}
            onPageChange={setCatalogPage}
            itemLabel="ouvrages"
          />
        </div>
      )}

      {/* TAB 3: MY LOANS HISTORY */}
      {activeSubTab === 'my_loans' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Historique de mes emprunts
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {activeLoans.length} en cours · {returnedLoans.length} restitué(s)
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
                <button
                  type="button"
                  onClick={() => setLoansFilter('all')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors tabular-nums ${
                    loansFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tous ({studentLoans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLoansFilter('active')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors tabular-nums ${
                    loansFilter === 'active'
                      ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  En cours ({activeLoans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLoansFilter('returned')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors tabular-nums ${
                    loansFilter === 'returned'
                      ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Restitués ({returnedLoans.length})
                </button>
              </div>
            </div>

            {paginatedStudentLoans.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2.5">
                <Library className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-sm font-medium text-slate-800">Aucun emprunt enregistré</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Vos emprunts effectués au guichet apparaîtront automatiquement ici.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Ouvrage</th>
                      <th className="py-2.5 px-4">Cote en rayon</th>
                      <th className="py-2.5 px-4">Emprunté le</th>
                      <th className="py-2.5 px-4">Échéance</th>
                      <th className="py-2.5 px-4">Statut</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedStudentLoans.map((loan) => {
                      const { daysLeft } = getLoanTimeline(loan.borrowDate, loan.dueDate);
                      const isLate = daysLeft < 0 && loan.status !== 'Rendu';
                      const isReturned = loan.status === 'Rendu';

                      return (
                        <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{loan.bookTitle}</div>
                            <div className="text-[11px] font-code text-slate-500">{loan.bookIsbn}</div>
                          </td>
                          <td className="py-2.5 px-4 font-code text-slate-700 whitespace-nowrap">
                            <div>{loan.bookShelfLocation || 'EST'}</div>
                          </td>
                          <td className="py-2.5 px-4 font-code text-slate-600 whitespace-nowrap">
                            {loan.borrowDate}
                          </td>
                          <td className="py-2.5 px-4 font-code whitespace-nowrap">
                            {isReturned ? `Rendu ${loan.returnDate || currentDate}` : loan.dueDate}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span
                              className={`font-semibold tabular-nums ${
                                isReturned
                                  ? 'text-slate-600'
                                  : isLate
                                  ? 'text-rose-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {isReturned
                                ? 'Restitué'
                                : isLate
                                ? `Retard (${Math.abs(daysLeft)} j)`
                                : `${daysLeft} j restant(s)`}
                            </span>
                            {isLate && loan.lateFee > 0 && (
                              <div className="text-[11px] text-rose-600 tabular-nums">
                                Pénalité : {loan.lateFee.toFixed(2)} €
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            {!isReturned ? (
                              <button
                                type="button"
                                onClick={() => extendLoan(loan.id)}
                                disabled={loan.extensionsCount >= 2 || isLate}
                                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                              >
                                Prolonger
                              </button>
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
            )}
          </div>

          <Pagination
            currentPage={loansPage}
            totalItems={filteredStudentLoans.length}
            pageSize={LOANS_PAGE_SIZE}
            onPageChange={setLoansPage}
            itemLabel="emprunts"
          />
        </div>
      )}

      {/* TAB 4: MY RESERVATIONS */}
      {activeSubTab === 'my_reservations' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Mes réservations
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {activeReservationsList.length} active(s) · {readyReservationsCount} prête(s) pour retrait · {studentReservations.length} au total
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('catalog')}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Réserver un ou plusieurs ouvrages</span>
            </button>
          </div>

          {studentReservations.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-2.5">
              <BookmarkCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-medium text-slate-800">Aucune réservation enregistrée</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Sélectionnez un ou plusieurs ouvrages dans le catalogue pour effectuer votre réservation.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {studentReservations.map((res) => {
                const isReady = res.status === 'Prêt pour retrait';
                const isWaiting = res.status === 'En attente' || res.status === 'Confirmée';
                const isCancellable = isReady || isWaiting;
                const isRefused = res.status === 'Refusée';
                const displayStatus: ReservationStatus =
                  res.status === 'Confirmée' ? 'En attente' : res.status;
                const bookMeta = books.find((b) => b.id === res.bookId);
                const fifo = isWaiting ? getLiveFifoInfo(res.id, res.bookId) : null;
                const daysUntilExpiry =
                  isReady && res.expiryDate ? getDaysDifference(currentDate, res.expiryDate) : null;

                return (
                  <div
                    key={res.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span
                          className={`text-xs font-semibold ${
                            RESERVATION_STATUS_TEXT[displayStatus] || 'text-slate-600'
                          }`}
                        >
                          {displayStatus}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {res.bookTitle}
                        </h3>
                        {bookMeta?.shelfLocation && (
                          <span className="text-[11px] font-code text-slate-500">
                            ({bookMeta.shelfLocation})
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          Demandé le <span className="font-code text-slate-700">{res.requestDate}</span>
                        </span>

                        {isReady && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span>
                              Disponible depuis{' '}
                              <span className="font-code text-slate-700">
                                {res.readyDate || res.requestDate}
                              </span>
                            </span>
                            {res.copyBarcode && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span>
                                  Exemplaire :{' '}
                                  <span className="font-code text-slate-800">{res.copyBarcode}</span>
                                </span>
                              </>
                            )}
                            {res.expiryDate && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">·</span>
                                <span
                                  className={`font-semibold ${
                                    daysUntilExpiry !== null && daysUntilExpiry <= 1
                                      ? 'text-amber-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  Retrait avant le{' '}
                                  <span className="font-code">{res.expiryDate}</span>
                                  {daysUntilExpiry === 0
                                    ? ' (Expire aujourd’hui)'
                                    : daysUntilExpiry === 1
                                    ? ' (Demain)'
                                    : ''}
                                </span>
                              </>
                            )}
                          </>
                        )}

                        {isWaiting && fifo && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="font-semibold text-amber-700 tabular-nums">
                              Position #{fifo.position ?? res.queuePosition} en file d’attente (FIFO sur {fifo.totalWaiting})
                            </span>
                          </>
                        )}

                        {!isCancellable && res.expiryDate && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span>
                              Échéance : <span className="font-code">{res.expiryDate}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {isReady && (
                        <p className="text-[11px] text-emerald-700">
                          Présentez votre carte d’étudiant USMBA au guichet de la bibliothèque pour retirer cet ouvrage.
                        </p>
                      )}
                      {res.notes && !isReady && !isRefused && (
                        <p className="text-[11px] text-slate-500">{res.notes}</p>
                      )}
                    </div>

                    {isCancellable ? (
                      <button
                        type="button"
                        onClick={() => cancelReservation(res.id)}
                        className="px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-md font-medium transition-colors self-start sm:self-auto shrink-0 whitespace-nowrap"
                      >
                        Annuler
                      </button>
                    ) : isRefused ? (
                      <button
                        type="button"
                        onClick={() => setSelectedRefusalRes(res)}
                        className="px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md font-medium transition-colors self-start sm:self-auto shrink-0 whitespace-nowrap inline-flex items-center gap-1.5"
                      >
                        <Info className="w-3.5 h-3.5 text-rose-600" />
                        <span>Voir le motif</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 shrink-0">Clôturée</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CARTE NUMÉRIQUE ÉTUDIANT (Avec QR Code & Impression / Téléchargement) */}
      {activeSubTab === 'my_card' && (
        <div className="max-w-3xl space-y-5">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Carte numérique étudiant — EST Fès
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Présentez votre carte et son QR Code au guichet pour emprunter ou retirer vos ouvrages réservés.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyCardIdentifier}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors inline-flex items-center gap-1.5"
                >
                  {copiedCardId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copier CNE / N°</span>
                    </>
                  )}
                </button>

                {studentQrUrl && (
                  <a
                    href={studentQrUrl}
                    download={`carte_etudiant_${student?.cne || 'EST'}.png`}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Télécharger QR</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer la carte</span>
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {/* Carte de lecteur numérique institutionnelle EST Fès */}
              <div className="rounded-xl bg-slate-900 text-white p-6 border border-slate-800 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                      <School className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold tracking-wide text-white">
                        ÉCOLE SUPÉRIEURE DE TECHNOLOGIE
                      </h3>
                      <span className="text-[11px] text-slate-400 block">
                        Université Sidi Mohamed Ben Abdellah · Fès
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/10 text-slate-200 border border-white/15">
                      {student?.department ? student.department.split(' ')[0] : 'EST FÈS'}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        matchingMember?.status === 'Suspendu' || student?.registrationStatus === 'Suspendu'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      }`}
                    >
                      {matchingMember?.status === 'Suspendu' ? 'Suspendu' : 'Actif'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-slate-300 shrink-0 overflow-hidden">
                    {student?.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={student.firstName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-7 h-7" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
                      Carte d’Étudiant &amp; Lecteur Numérique
                    </span>
                    <div className="text-lg font-semibold tracking-tight text-white mt-0.5">
                      {student ? `${student.firstName} ${student.lastName}` : 'Étudiant EST Fès'}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      {student?.department || 'Génie Informatique'} · {student?.studyYear || 'EST Fès'}
                    </div>
                    <div className="text-xs text-slate-300 font-code tabular-nums mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>CNE : <strong className="text-white">{student?.cne || '—'}</strong></span>
                      <span>·</span>
                      <span>Apogée : <strong className="text-white">{student?.apogee || '—'}</strong></span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-code truncate">
                      {studentEmail || '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Identifiant Carte Lecteur
                    </span>
                    <span className="text-sm font-code font-semibold tracking-wider text-amber-300 tabular-nums block">
                      {studentCardNumber}
                    </span>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      Valide jusqu’au : <span className="text-slate-200 font-code">{cardExpiryDate}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      Quota autorisé : <span className="text-slate-200 font-semibold">{activeLoans.length} / {maxAllowedLoans} ouvrages</span>
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-lg flex flex-col items-center shrink-0 self-start sm:self-end">
                    {studentQrUrl ? (
                      <img
                        src={studentQrUrl}
                        alt="QR Code Carte Étudiant EST Fès"
                        className="w-28 h-28 object-contain"
                      />
                    ) : (
                      <div className="w-28 h-28 bg-slate-100 flex items-center justify-center text-slate-500 text-[10px]">
                        Génération QR...
                      </div>
                    )}
                    <span className="text-[8px] font-code text-slate-700 tracking-wider mt-1 font-semibold">
                      EST-USMBA · {student?.cne || 'LECTEUR'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Identité vérifiée USMBA · Valide pour l’emprunt au guichet QR et le retrait des réservations.
                  </span>
                </div>
                <span className="font-code text-[11px] text-slate-500 shrink-0">
                  Année 2026/2027
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5B: MON PROFIL ACADÉMIQUE */}
      {activeSubTab === 'my_profile' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <School className="w-5 h-5 text-slate-300" />
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    École Supérieure de Technologie de Fès
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Université Sidi Mohamed Ben Abdellah · Fiche lecteur
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-emerald-400">
                {matchingMember?.status === 'Suspendu' ? 'Suspendu' : 'Compte actif'}
              </span>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 overflow-hidden">
                  {student?.photoUrl ? (
                    <img
                      src={student.photoUrl}
                      alt={student.firstName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {student ? `${student.firstName} ${student.lastName}` : 'Étudiant EST Fès'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {student?.department || 'Génie Informatique'} · {student?.studyYear || 'EST Fès'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 block">Code National Étudiant (CNE)</span>
                  <span className="font-code font-semibold text-slate-900">{student?.cne || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Numéro Apogée</span>
                  <span className="font-code font-semibold text-slate-900">{student?.apogee || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Adresse académique USMBA</span>
                  <span className="font-code font-medium text-slate-900 inline-flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{studentEmail || '—'}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Quota d’emprunt autorisé</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {activeLoans.length} / {maxAllowedLoans} ouvrages en cours
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Pour emprunter physiquement un ouvrage, présentez votre carte d’étudiant universitaire USMBA au comptoir de prêt de la bibliothèque.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: NOTIFICATIONS */}
      {activeSubTab === 'notifications' && (
        <NotificationsView
          onNavigateFromNotification={(notif) => {
            const target = (notif.studentSubTab as StudentSubTab) || 'overview';
            setActiveSubTab(target);
          }}
        />
      )}

      {/* TAB 7: GUIDELINES */}
      {activeSubTab === 'guidelines' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-w-3xl">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Règlement intérieur & Horaires — Bibliothèque EST Fès
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Université Sidi Mohamed Ben Abdellah · Année 2026/2027
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs text-slate-600 leading-relaxed">
            <div className="p-5 space-y-1">
              <h3 className="font-semibold text-slate-900">1. Accès & Horaires</h3>
              <p>
                Ouvert du lundi au vendredi de 08h30 à 18h00 et le samedi de 09h00 à 13h00. L’accès au portail est réservé aux étudiants inscrits via leur compte institutionnel{' '}
                <span className="font-code text-slate-800">@usmba.ac.ma</span>.
              </p>
            </div>

            <div className="p-5 space-y-1">
              <h3 className="font-semibold text-slate-900">2. Quotas et durée de prêt</h3>
              <p>
                Jusqu’à {maxAllowedLoans} ouvrages simultanés pour une durée de 14 à 21 jours, renouvelable jusqu’à 2 fois s’il n’existe aucune réservation en attente sur le titre.
              </p>
            </div>

            <div className="p-5 space-y-1">
              <h3 className="font-semibold text-slate-900">3. Emprunt et retrait au guichet</h3>
              <p>
                Réservez vos ouvrages en ligne puis présentez votre carte d’étudiant USMBA au guichet de la bibliothèque lors du retrait pour enregistrer l’emprunt à votre dossier.
              </p>
            </div>

            <div className="p-5 space-y-1">
              <h3 className="font-semibold text-slate-900">4. Retards et restitution</h3>
              <p>
                En cas de dépassement d’échéance, des alertes sont transmises sur votre espace et votre adresse académique. Tout retard prolongé suspend temporairement le droit d’emprunt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MULTI-BOOK RESERVATION CONFIRMATION MODAL */}
      {isConfirmReserveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          onClick={() => setIsConfirmReserveModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                  {lastMultiReserveResult
                    ? 'Récapitulatif de votre demande'
                    : 'Vérifier la disponibilité & Confirmer la réservation'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chaque ouvrage conserve son propre statut (attribution directe ou file d’attente FIFO).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmReserveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {lastMultiReserveResult ? (
                <div className="space-y-2.5">
                  {lastMultiReserveResult.outcomes.map((o) => (
                    <div
                      key={o.bookId}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-slate-900 truncate">{o.bookTitle}</div>
                        <div className="text-[11px] text-slate-500">
                          {o.status === 'Prêt pour retrait'
                            ? `Exemplaire bloqué (${o.copyBarcode || 'rayon'}) · Retrait avant le ${o.expiryDate}`
                            : o.status === 'En attente'
                            ? `Ajouté en file d’attente FIFO · Position #${o.queuePosition}`
                            : o.reason || 'Non retenu'}
                        </div>
                      </div>
                      <span
                        className={`font-semibold whitespace-nowrap ${
                          o.status === 'Prêt pour retrait'
                            ? 'text-emerald-700'
                            : o.status === 'En attente'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : selectedBooksForReservation.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Aucun ouvrage sélectionné.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {selectedBooksForReservation.map((book) => {
                    const isAvailable = book.availableCopies > 0;
                    const estimatedQueuePos = getBookWaitingQueueCount(book.id) + 1;
                    return (
                      <div
                        key={book.id}
                        className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-semibold text-slate-900 truncate">{book.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {book.author} · <span className="font-code">{book.shelfLocation}</span>
                          </div>
                          <div
                            className={`text-[11px] font-medium ${
                              isAvailable ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {isAvailable
                              ? `Disponible (${book.availableCopies}/${book.totalCopies} en rayon) → Prêt pour retrait (3 jours)`
                              : `Indisponible (0/${book.totalCopies}) → File d’attente FIFO (position estimée #${estimatedQueuePos})`}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleBookSelection(book.id)}
                          className="text-[11px] font-medium text-slate-500 hover:text-rose-700 self-start sm:self-center whitespace-nowrap"
                        >
                          Retirer
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              {lastMultiReserveResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsConfirmReserveModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                  >
                    Rester au catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmReserveModalOpen(false);
                      setActiveSubTab('my_reservations');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                  >
                    Voir mes réservations
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsConfirmReserveModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={selectedBooksForReservation.length === 0}
                    onClick={handleConfirmMultiReservation}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-md"
                  >
                    Confirmer la réservation ({selectedBooksForReservation.length})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOOK DETAIL MODAL (Read + Reserve only — zero manager actions, zero QR) */}
      {selectedBookForModal && (
        <BookDetailModal
          book={selectedBookForModal}
          highlightedIntent={intentBookId === selectedBookForModal.id}
          onClose={() => {
            setSelectedBookForModal(null);
            setIntentBookId(null);
          }}
        />
      )}

      {/* DISCREET REFUSAL REASON MODAL (Visible only to the concerned student) */}
      {selectedRefusalRes && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          onClick={() => setSelectedRefusalRes(null)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Motif du refus de réservation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                  {selectedRefusalRes.bookTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRefusalRes(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Demande du{' '}
                  <span className="font-code text-slate-700">{selectedRefusalRes.requestDate}</span>
                </span>
                <span className="font-semibold text-rose-700">Refusée</span>
              </div>

              <div className="p-3.5 rounded-lg bg-rose-50/70 border border-rose-200/80 text-slate-800 leading-relaxed">
                {selectedRefusalRes.refusalReason ||
                  selectedRefusalRes.notes ||
                  'Aucun motif précisé par le guichet de la bibliothèque.'}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRefusalRes(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
