import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Book,
  BookCopy,
  BookCopyStatus,
  Member,
  Loan,
  Reservation,
  ActivityLog,
  StudentRegistration,
  RegistrationStatus,
  AuthSession,
  AppNotification,
  ReminderHistoryEntry,
} from '../types/library';
import { getEnrichedDemoDataset, REFERENCE_DATE } from '../data/enrichedDataset';
import { AcademicRegistryService } from '../services/academicRegistryService';
import { UserRoleService } from '../services/userRoleService';
import {
  generateQrDataUrl,
  buildBookQrPayload,
  buildStudentQrPayload,
} from '../utils/qrHelper';
import { formatCurrentTimestamp, getDaysDifference, getOverdueDays } from '../utils/dateUtils';

const RESERVATION_HOLD_DAYS = 3;

function addIsoDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function compareReservationsFifo(a: Reservation, b: Reservation): number {
  const dateCmp = a.requestDate.localeCompare(b.requestDate);
  if (dateCmp !== 0) return dateCmp;
  if (a.createdAt && b.createdAt) {
    const tsCmp = a.createdAt.localeCompare(b.createdAt);
    if (tsCmp !== 0) return tsCmp;
  }
  if (a.queuePosition !== b.queuePosition) {
    return a.queuePosition - b.queuePosition;
  }
  return a.id.localeCompare(b.id);
}

function recalculateQueueForBooks(list: Reservation[], bookIds: Set<string>): Reservation[] {
  if (bookIds.size === 0) return list;
  const posById = new Map<string, number>();

  bookIds.forEach((bookId) => {
    const waiting = list
      .filter(
        (r) =>
          r.bookId === bookId &&
          (r.status === 'En attente' || r.status === 'Confirmée')
      )
      .sort(compareReservationsFifo);
    waiting.forEach((r, idx) => {
      posById.set(r.id, idx + 1);
    });
  });

  return list.map((r) => {
    if (posById.has(r.id)) {
      return { ...r, queuePosition: posById.get(r.id)! };
    }
    return r;
  });
}

export interface MultiReservationItemOutcome {
  bookId: string;
  bookTitle: string;
  status: 'Prêt pour retrait' | 'En attente' | 'Ignorée';
  queuePosition?: number;
  expiryDate?: string;
  copyBarcode?: string;
  reason?: string;
}

export interface MultiReservationResult {
  success: boolean;
  message: string;
  outcomes: MultiReservationItemOutcome[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
}

export interface OverdueStudentGroup {
  studentKey: string;
  memberId: string;
  studentName: string;
  studentCne: string;
  studentCard: string;
  studentEmail: string;
  department: string;
  alreadyRemindedToday: boolean;
  loans: Array<{
    loanId: string;
    bookTitle: string;
    dueDate: string;
    daysOverdue: number;
    remindersSent: number;
    lastReminderDate?: string;
  }>;
}

export interface CollectiveReminderResult {
  totalStudents: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  entries: ReminderHistoryEntry[];
}

interface LibraryContextType {
  books: Book[];
  members: Member[];
  loans: Loan[];
  reservations: Reservation[];
  activities: ActivityLog[];
  currentDate: string;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;

  // Role permission helper
  isGerant: boolean;

  // 1. Institutional USMBA Auth & Academic Registry
  authSession: AuthSession;
  studentRegistry: StudentRegistration[];
  loginWithAcademicEmail: (email: string) => { success: boolean; message?: string };
  loginWithGoogle: (googleUser: { email: string; name?: string; picture?: string }) => { success: boolean; message?: string };
  loginAsLibrarian: () => void;
  switchRoleDemo: (role: 'gerant' | 'etudiant') => void;
  reserveBookForCurrentStudent: (bookId: string) => { success: boolean; message: string };
  reserveMultipleBooksForCurrentStudent: (bookIds: string[]) => MultiReservationResult;
  logout: () => void;
  syncWithESTRegistry: () => Promise<void>;
  updateStudentRegistrationStatus: (id: string, newStatus: RegistrationStatus) => Promise<void>;
  addNewStudentToRegistry: (student: Omit<StudentRegistration, 'id' | 'qrCodeDataUrl'>) => Promise<StudentRegistration>;

  // 2. Automated Book Addition & Management (Strictly Gérant only)
  addBookFromSearch: (bookData: Omit<Book, 'id' | 'qrCodeDataUrl'>) => Promise<Book>;
  addBook: (bookData: Omit<Book, 'id'>) => Promise<Book>;
  updateBook: (id: string, book: Partial<Book>) => void;
  deleteBook: (id: string) => boolean;
  updateCopyStatus: (bookId: string, copyId: string, newStatus: BookCopyStatus) => boolean;

  // Members Management
  addMember: (member: Omit<Member, 'id' | 'cardNumber'>) => Member | null;
  updateMember: (id: string, member: Partial<Member>) => void;
  deleteMember: (id: string) => boolean;

  // 3. Smart QR Loan System & Quick Loans
  validateSmartLoan: (
    studentIdentifier: string,
    bookIdentifier: string,
    durationDays?: number,
    options?: { reservedCopyId?: string }
  ) => Promise<{ success: boolean; message: string; loan?: Loan }>;
  validateBatchSmartLoan: (
    studentIdentifier: string,
    items: Array<{ bookId: string; copyId?: string; reservationId?: string }>,
    durationDays?: number
  ) => Promise<{ success: boolean; message: string; loans?: Loan[] }>;
  createLoan: (bookId: string, memberId: string, durationDays?: number) => { success: boolean; message: string };

  returnLoan: (loanId: string) => void;
  extendLoan: (loanId: string, days?: number) => { success: boolean; message: string };
  sendReminder: (
    loanId: string,
    options?: { force?: boolean }
  ) => { success: boolean; status: ReminderHistoryEntry['status']; message: string };
  sendStudentReminder: (
    studentCneOrId: string,
    options?: { force?: boolean }
  ) => { success: boolean; status: ReminderHistoryEntry['status']; message: string };
  getOverdueStudentsSummary: () => OverdueStudentGroup[];
  sendCollectiveReminders: (options?: { includeAlreadyRemindedToday?: boolean }) => CollectiveReminderResult;
  reminderHistory: ReminderHistoryEntry[];

  // 4. Internal Notifications Center (Gérant & Étudiant)
  notifications: AppNotification[];
  currentUserNotifications: AppNotification[];
  unreadNotificationCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  // Reservations
  createReservation: (bookId: string, memberId: string) => { success: boolean; message: string };
  cancelReservation: (reservationId: string) => void;
  confirmReservation: (reservationId: string) => void;
  refuseReservation: (reservationId: string, refusalReason?: string) => void;
  fulfillReservation: (reservationId: string) => Promise<{ success: boolean; message: string; loan?: Loan }>;
  processExpiredReservations: () => { expiredCount: number; reassignedCount: number; remindedCount: number };
  sendPickupExpiryReminder: (reservationId: string) => void;

  // Utilities
  resetToDefault: () => void;
  exportCatalogCSV: () => void;
  exportLoansCSV: () => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const STORAGE_KEYS = {
  BOOKS: 'est_usmba_books_v3',
  MEMBERS: 'est_usmba_members_v3',
  LOANS: 'est_usmba_loans_v3',
  RESERVATIONS: 'est_usmba_reservations_v3',
  ACTIVITIES: 'est_usmba_activities_v3',
  AUTH: 'est_usmba_auth_v3',
  NOTIFICATIONS: 'est_usmba_notifications_v3',
  REMINDER_HISTORY: 'est_usmba_reminder_history_v3',
};

const SESSION_AUTH_KEY = 'est_usmba_session_auth_v4';

const UNAUTHENTICATED_SESSION: AuthSession = {
  isAuthenticated: false,
  userType: null,
  role: undefined,
};

function readStorageArray<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage read error
  }
  return fallback;
}

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentDate = REFERENCE_DATE;
  const initialDemo = useMemo(() => getEnrichedDemoDataset(), []);

  // 1. Auth session state: always start unauthenticated on fresh app open
  const [authSession, setAuthSession] = useState<AuthSession>(() => {
    try {
      // Remove any legacy auto-logged-in localStorage auth key so opening the app always requires login
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      const savedSession = sessionStorage.getItem(SESSION_AUTH_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession) as AuthSession;
        if (parsed && parsed.isAuthenticated && parsed.role) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return UNAUTHENTICATED_SESSION;
  });

  const isGerant = Boolean(
    authSession.isAuthenticated &&
      (authSession.role === 'gerant' || authSession.userType === 'librarian')
  );

  // 2. Academic student registry state
  const [studentRegistry, setStudentRegistry] = useState<StudentRegistration[]>([]);

  // 3. Books state
  const [books, setBooks] = useState<Book[]>(() =>
    readStorageArray<Book>(STORAGE_KEYS.BOOKS, initialDemo.books)
  );

  // 4. Members state
  const [members, setMembers] = useState<Member[]>(() =>
    readStorageArray<Member>(STORAGE_KEYS.MEMBERS, initialDemo.members)
  );

  // 5. Loans state
  const [loans, setLoans] = useState<Loan[]>(() =>
    readStorageArray<Loan>(STORAGE_KEYS.LOANS, initialDemo.loans)
  );

  const [reservations, setReservations] = useState<Reservation[]>(() =>
    readStorageArray<Reservation>(STORAGE_KEYS.RESERVATIONS, initialDemo.reservations)
  );

  const [activities, setActivities] = useState<ActivityLog[]>(() =>
    readStorageArray<ActivityLog>(STORAGE_KEYS.ACTIVITIES, initialDemo.activities)
  );

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    readStorageArray<AppNotification>(STORAGE_KEYS.NOTIFICATIONS, initialDemo.notifications)
  );

  const [reminderHistory, setReminderHistory] = useState<ReminderHistoryEntry[]>(() =>
    readStorageArray<ReminderHistoryEntry>(STORAGE_KEYS.REMINDER_HISTORY, initialDemo.reminderHistory)
  );

  // Initialize academic registry, user role registry, and showcase QR codes cleanly (no 500-QR startup freeze)
  useEffect(() => {
    async function init() {
      UserRoleService.initialize();
      const reg = await AcademicRegistryService.initialize();
      setStudentRegistry(reg);

      // Generate QR codes only for the 7 core showcase books if missing (others generate lazily on-demand)
      let booksChanged = false;
      const updatedBooks = await Promise.all(
        books.map(async (b) => {
          if (!b.isDemo && !b.qrCodeDataUrl) {
            booksChanged = true;
            const qrCodeDataUrl = await generateQrDataUrl(buildBookQrPayload(b));
            return { ...b, qrCodeDataUrl };
          }
          return b;
        })
      );
      if (booksChanged) {
        setBooks(updatedBooks);
      }

      // Generate QR codes only for core non-demo members if missing
      let membersChanged = false;
      const updatedMembers = await Promise.all(
        members.map(async (m) => {
          if (!m.isDemo && !m.qrCodeDataUrl) {
            membersChanged = true;
            const qrCodeDataUrl = await generateQrDataUrl(buildStudentQrPayload(m));
            return { ...m, qrCodeDataUrl };
          }
          return m;
        })
      );
      if (membersChanged) {
        setMembers(updatedMembers);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
    } catch (e) {
      console.warn('Books storage quota warning:', e);
    }
  }, [books]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.warn('Members storage quota warning:', e);
    }
  }, [members]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
    } catch (e) {
      console.warn('Loans storage quota warning:', e);
    }
  }, [loans]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(reservations));
    } catch (e) {
      console.warn('Reservations storage quota warning:', e);
    }
  }, [reservations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities.slice(0, 120)));
    } catch {
      // ignore
    }
  }, [activities]);

  useEffect(() => {
    try {
      if (authSession.isAuthenticated) {
        sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(authSession));
      } else {
        sessionStorage.removeItem(SESSION_AUTH_KEY);
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      }
    } catch {
      // ignore
    }
  }, [authSession]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications.slice(0, 200)));
    } catch {
      // ignore
    }
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REMINDER_HISTORY, JSON.stringify(reminderHistory.slice(0, 150)));
    } catch {
      // ignore
    }
  }, [reminderHistory]);

  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const requireGerant = (actionDescription: string): boolean => {
    if (!isGerant) {
      showToast({
        type: 'error',
        title: 'Action réservée au Gérant',
        description: `Accès refusé : seul un gérant de la bibliothèque peut ${actionDescription}.`,
      });
      return false;
    }
    return true;
  };

  const pushNotification = (
    notif: Omit<AppNotification, 'id' | 'createdAt' | 'isoTimestamp' | 'isRead'>
  ) => {
    const now = formatCurrentTimestamp();
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now.display,
      isoTimestamp: now.iso,
      isRead: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const currentUserNotifications = useMemo(() => {
    if (!authSession.isAuthenticated) return [];
    if (authSession.role === 'etudiant') {
      const cne = authSession.student?.cne?.toLowerCase();
      const email = authSession.academicEmail?.toLowerCase();
      return notifications.filter((n) => {
        if (n.targetRole !== 'etudiant') return false;
        if (!n.recipientCne && !n.recipientEmail) return true;
        if (cne && n.recipientCne?.toLowerCase() === cne) return true;
        if (email && n.recipientEmail?.toLowerCase() === email) return true;
        return false;
      });
    }
    return notifications.filter((n) => n.targetRole === 'gerant');
  }, [notifications, authSession]);

  const unreadNotificationCount = useMemo(
    () => currentUserNotifications.filter((n) => !n.isRead).length,
    [currentUserNotifications]
  );

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    const activeIds = new Set(currentUserNotifications.map((n) => n.id));
    setNotifications((prev) =>
      prev.map((n) => (activeIds.has(n.id) ? { ...n, isRead: true } : n))
    );
  };

  const logActivity = (type: ActivityLog['type'], description: string, user = 'Système EST') => {
    const now = formatCurrentTimestamp();
    const newAct: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: now.display,
      type,
      description,
      user,
    };
    setActivities((prev) => [newAct, ...prev]);
  };

  // =========================================================================
  // 1. INSTITUTIONAL USMBA AUTHENTICATION & DATABASE ROLE SEPARATION
  // =========================================================================
  const loginWithAcademicEmail = (email: string): { success: boolean; message?: string } => {
    const validation = AcademicRegistryService.validateAcademicEmail(email);

    if (!validation.isValidDomain) {
      return {
        success: false,
        message: 'Accès refusé : Seules les adresses institutionnelles de l’Université Sidi Mohamed Ben Abdellah (@usmba.ac.ma) sont autorisées.',
      };
    }

    if (!validation.formatCorrect) {
      return {
        success: false,
        message: 'Format d’e-mail invalide. Utilisez votre identifiant académique officiel (ex. prenom.nom@usmba.ac.ma).',
      };
    }

    return handleDatabaseUserLogin({ email: validation.cleanEmail });
  };

  const loginWithGoogle = (googleUser: {
    email: string;
    name?: string;
    picture?: string;
  }): { success: boolean; message?: string } => {
    const rawEmail = (googleUser.email || '').trim();
    const cleanEmail = rawEmail.toLowerCase();

    if (!cleanEmail) {
      return {
        success: false,
        message: 'Aucun e-mail renvoyé par l’authentification Google.',
      };
    }

    if (!cleanEmail.endsWith('@usmba.ac.ma')) {
      return {
        success: false,
        message: `Accès refusé : Le compte Google "${rawEmail}" n’appartient pas au domaine institutionnel (@usmba.ac.ma). Seules les adresses académiques officielles de l'EST USMBA sont autorisées.`,
      };
    }

    return handleDatabaseUserLogin({
      email: cleanEmail,
      name: googleUser.name,
      picture: googleUser.picture,
    });
  };

  const handleDatabaseUserLogin = (userParams: {
    email: string;
    name?: string;
    picture?: string;
  }): { success: boolean; message?: string } => {
    const cleanEmail = userParams.email.toLowerCase();
    const dbUser = UserRoleService.findByEmail(cleanEmail);

    if (!dbUser) {
      return {
        success: false,
        message: `Accès non autorisé : L'adresse institutionnelle "${cleanEmail}" ne figure ni dans le registre des gérants ni dans la base des étudiants inscrits de l'EST USMBA.`,
      };
    }

    if (dbUser.status === 'Radié') {
      return {
        success: false,
        message: `Accès révoqué : Le compte de ${dbUser.fullName} (${cleanEmail}) a été RADIÉ par le service de scolarité de l'EST Fès.`,
      };
    }

    if (dbUser.status === 'Suspendu') {
      return {
        success: false,
        message: `Accès bloqué : Inscription temporairement suspendue auprès de la scolarité EST.`,
      };
    }

    if (dbUser.role === 'gerant') {
      const gerantSession: AuthSession = {
        isAuthenticated: true,
        userType: 'librarian',
        role: 'gerant',
        librarianName: userParams.name || dbUser.fullName,
        userTitle: dbUser.title,
        department: dbUser.department,
        academicEmail: cleanEmail,
        photoUrl: userParams.picture,
        authProvider: 'google',
      };

      setAuthSession(gerantSession);
      logActivity('sync', `Connexion Gérant validée : ${dbUser.fullName} (${dbUser.title})`, cleanEmail);

      showToast({
        type: 'info',
        title: 'Interface Gérant activée',
        description: `Bienvenue ${dbUser.fullName}. Rôle détecté : Gérant de la bibliothèque EST.`,
      });

      return { success: true };
    }

    if (dbUser.role === 'etudiant') {
      const student = AcademicRegistryService.findByEmail(cleanEmail);

      const studentSession: AuthSession = {
        isAuthenticated: true,
        userType: 'student',
        role: 'etudiant',
        student: student || {
          id: dbUser.id,
          cne: dbUser.cne || 'N139045123',
          apogee: dbUser.apogee || '21017320',
          firstName: dbUser.fullName.split(' ')[0] || 'Étudiant',
          lastName: dbUser.fullName.split(' ').slice(1).join(' ') || 'EST',
          academicEmail: cleanEmail,
          department: (dbUser.department as any) || 'Génie Informatique (GI)',
          studyYear: dbUser.title,
          registrationStatus: 'Inscrit',
          phone: '06 00 00 00 00',
          registrationDate: '2024-09-10',
        },
        academicEmail: cleanEmail,
        userTitle: dbUser.title,
        department: dbUser.department,
        photoUrl: userParams.picture,
        authProvider: 'google',
      };

      setAuthSession(studentSession);
      logActivity('sync', `Connexion Étudiant validée : ${dbUser.fullName} (${dbUser.department})`, cleanEmail);

      showToast({
        type: 'success',
        title: 'Portail Étudiant activé',
        description: `Bienvenue, ${dbUser.fullName}. Rôle détecté : Étudiant EST (Consultation bibliothèque).`,
      });

      return { success: true };
    }

    return {
      success: false,
      message: 'Rôle inconnu pour ce compte académique.',
    };
  };

  const loginAsLibrarian = () => {
    const gerant = UserRoleService.getGerants()[0] || {
      fullName: 'Dr. Hassan Alami',
      title: 'Conservateur en Chef & Gérant de la Bibliothèque',
      department: 'Service Commun de la Documentation EST Fès',
      academicEmail: 'biblio.gerant@usmba.ac.ma',
    };

    const session: AuthSession = {
      isAuthenticated: true,
      userType: 'librarian',
      role: 'gerant',
      librarianName: gerant.fullName,
      userTitle: gerant.title,
      department: gerant.department,
      academicEmail: gerant.academicEmail,
      authProvider: 'academic',
    };
    setAuthSession(session);
    showToast({
      type: 'info',
      title: 'Session Gérant active',
      description: 'Accès complet aux outils de gestion et d’administration de la bibliothèque.',
    });
  };

  const switchRoleDemo = (targetRole: 'gerant' | 'etudiant') => {
    if (targetRole === 'gerant') {
      const gerant = UserRoleService.getGerants()[0];
      setAuthSession({
        isAuthenticated: true,
        userType: 'librarian',
        role: 'gerant',
        librarianName: gerant.fullName,
        userTitle: gerant.title,
        department: gerant.department,
        academicEmail: gerant.academicEmail,
        authProvider: 'google',
      });
      showToast({
        type: 'info',
        title: 'Interface Gérant activée',
        description: `Bascule vers la console de gestion : ${gerant.fullName}.`,
      });
    } else {
      const studentUser =
        UserRoleService.getStudents().find((s) => s.academicEmail === 'hajar.amellah@usmba.ac.ma') ||
        UserRoleService.getStudents().find((s) => s.status === 'Actif') ||
        UserRoleService.getStudents()[0];
      const student = AcademicRegistryService.findByEmail(studentUser.academicEmail);
      setAuthSession({
        isAuthenticated: true,
        userType: 'student',
        role: 'etudiant',
        student,
        academicEmail: studentUser.academicEmail,
        userTitle: studentUser.title,
        department: studentUser.department,
        authProvider: 'google',
      });
      showToast({
        type: 'success',
        title: 'Portail Étudiant activé',
        description: `Bascule vers l'espace de consultation : ${studentUser.fullName} (Étudiant EST).`,
      });
    }
  };

  const reserveMultipleBooksForCurrentStudent = (bookIds: string[]): MultiReservationResult => {
    if (!authSession.isAuthenticated || authSession.role !== 'etudiant') {
      return {
        success: false,
        message: 'Seul un étudiant connecté peut effectuer une réservation.',
        outcomes: [],
      };
    }

    const uniqueBookIds = Array.from(new Set(bookIds.filter(Boolean)));
    if (uniqueBookIds.length === 0) {
      return {
        success: false,
        message: 'Veuillez sélectionner au moins un ouvrage.',
        outcomes: [],
      };
    }

    const studentCne = authSession.student?.cne || authSession.academicEmail || 'EST-ETUD';
    const matchingMember = members.find(
      (m) =>
        m.cne === studentCne ||
        m.email.toLowerCase() === (authSession.academicEmail || '').toLowerCase()
    );
    const studentName = authSession.student
      ? `${authSession.student.firstName} ${authSession.student.lastName}`
      : authSession.academicEmail || 'Étudiant EST';

    if (
      authSession.student?.registrationStatus === 'Radié' ||
      authSession.student?.registrationStatus === 'Suspendu' ||
      matchingMember?.status === 'Radié' ||
      matchingMember?.status === 'Suspendu'
    ) {
      showToast({
        type: 'error',
        title: 'Réservation bloquée',
        description: 'Votre dossier lecteur est actuellement suspendu ou radié.',
      });
      return {
        success: false,
        message: 'Compte lecteur suspendu ou radié.',
        outcomes: [],
      };
    }

    const batchId = uniqueBookIds.length > 1 ? `batch-${Date.now()}` : undefined;
    const expiryDate = addIsoDays(currentDate, RESERVATION_HOLD_DAYS);
    const claimedCopyIds = new Set<string>();
    const claimedPerBook = new Map<string, number>();
    const outcomes: MultiReservationItemOutcome[] = [];
    const createdReservations: Reservation[] = [];
    const touchedBookIds = new Set<string>();

    uniqueBookIds.forEach((bookId, idx) => {
      const book = books.find((b) => b.id === bookId);
      if (!book) {
        outcomes.push({
          bookId,
          bookTitle: 'Ouvrage inconnu',
          status: 'Ignorée',
          reason: 'Ouvrage introuvable dans le catalogue.',
        });
        return;
      }

      const existingRes = reservations.find(
        (r) =>
          r.bookId === bookId &&
          (r.memberCard === studentCne ||
            r.memberCne === studentCne ||
            (matchingMember && r.memberCard === matchingMember.cardNumber)) &&
          (r.status === 'En attente' || r.status === 'Confirmée' || r.status === 'Prêt pour retrait')
      );

      if (existingRes) {
        outcomes.push({
          bookId: book.id,
          bookTitle: book.title,
          status: 'Ignorée',
          reason: 'Vous avez déjà une réservation active pour ce titre.',
        });
        return;
      }

      touchedBookIds.add(book.id);
      const alreadyClaimedCount = claimedPerBook.get(book.id) || 0;
      const freeCopy = book.copies?.find(
        (c) => c.status === 'Disponible' && !claimedCopyIds.has(c.id)
      );
      const isAvailableNow =
        book.copies && book.copies.length > 0
          ? Boolean(freeCopy)
          : book.availableCopies - alreadyClaimedCount > 0;

      const waitingCount = reservations.filter(
        (r) =>
          r.bookId === book.id &&
          (r.status === 'En attente' || r.status === 'Confirmée')
      ).length;

      const createdAt = new Date(Date.now() + idx).toISOString();

      if (isAvailableNow) {
        if (freeCopy) claimedCopyIds.add(freeCopy.id);
        claimedPerBook.set(book.id, alreadyClaimedCount + 1);

        const newRes: Reservation = {
          id: `res-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          bookId: book.id,
          bookTitle: book.title,
          copyId: freeCopy?.id,
          copyBarcode: freeCopy?.barcode,
          memberId: matchingMember?.id || authSession.student?.id || `m-${Date.now()}`,
          memberName: studentName,
          memberCard: studentCne,
          memberCne: studentCne,
          requestDate: currentDate,
          readyDate: currentDate,
          expiryDate,
          expiryReminderSent: false,
          createdAt,
          batchId,
          status: 'Prêt pour retrait',
          queuePosition: 1,
          notes: freeCopy
            ? `Exemplaire ${freeCopy.barcode} attribué automatiquement.`
            : 'Exemplaire mis de côté au guichet EST.',
        };
        createdReservations.push(newRes);
        outcomes.push({
          bookId: book.id,
          bookTitle: book.title,
          status: 'Prêt pour retrait',
          expiryDate,
          copyBarcode: freeCopy?.barcode,
        });
      } else {
        const position = waitingCount + 1;
        const newRes: Reservation = {
          id: `res-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          bookId: book.id,
          bookTitle: book.title,
          memberId: matchingMember?.id || authSession.student?.id || `m-${Date.now()}`,
          memberName: studentName,
          memberCard: studentCne,
          memberCne: studentCne,
          requestDate: currentDate,
          createdAt,
          batchId,
          status: 'En attente',
          queuePosition: position,
          notes: `Inscrit en file d'attente FIFO (position #${position}).`,
        };
        createdReservations.push(newRes);
        outcomes.push({
          bookId: book.id,
          bookTitle: book.title,
          status: 'En attente',
          queuePosition: position,
        });
      }
    });

    if (createdReservations.length === 0) {
      const firstReason = outcomes[0]?.reason || 'Aucune nouvelle réservation n’a pu être enregistrée.';
      showToast({
        type: 'warning',
        title: 'Réservation non enregistrée',
        description: firstReason,
      });
      return { success: false, message: firstReason, outcomes };
    }

    // Atomically lock claimed copies on books
    if (claimedPerBook.size > 0) {
      setBooks((prev) =>
        prev.map((b) => {
          const taken = claimedPerBook.get(b.id) || 0;
          if (taken === 0) return b;
          if (b.copies && b.copies.length > 0) {
            const nextCopies = b.copies.map((c) =>
              claimedCopyIds.has(c.id) ? { ...c, status: 'Réservé' as BookCopyStatus } : c
            );
            return {
              ...b,
              copies: nextCopies,
              availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
            };
          }
          return { ...b, availableCopies: Math.max(0, b.availableCopies - taken) };
        })
      );
    }

    setReservations((prev) => recalculateQueueForBooks([...createdReservations, ...prev], touchedBookIds));

    // Activity & internal notifications
    const readyList = createdReservations.filter((r) => r.status === 'Prêt pour retrait');
    const waitingList = createdReservations.filter((r) => r.status === 'En attente');

    const titlesSummary = createdReservations.map((r) => `« ${r.bookTitle} »`).join(', ');
    logActivity(
      'reservation',
      `Réservation étudiant (${createdReservations.length} ouvrage(s)) : ${titlesSummary} par ${studentName}`,
      authSession.academicEmail || 'Étudiant'
    );

    pushNotification({
      targetRole: 'gerant',
      category: 'reservation',
      title:
        createdReservations.length > 1
          ? `Nouvelles réservations (${createdReservations.length} ouvrages)`
          : 'Nouvelle réservation étudiante',
      message: `${studentName} (${studentCne}) a réservé ${titlesSummary} (${readyList.length} prêt(s) pour retrait, ${waitingList.length} en file d’attente).`,
      targetTab: 'reservations',
    });

    if (readyList.length > 0) {
      const readyTitles = readyList.map((r) => `« ${r.bookTitle} »`).join(', ');
      pushNotification({
        targetRole: 'etudiant',
        recipientCne: studentCne,
        recipientEmail: authSession.academicEmail,
        category: 'reservation',
        title:
          readyList.length > 1
            ? `${readyList.length} livres réservés prêts pour retrait`
            : 'Livre réservé disponible pour retrait',
        message: `Confirmation : ${readyTitles} ${readyList.length > 1 ? 'sont réservés et vous attendent' : 'est réservé et vous attend'} au guichet EST. Date limite de retrait : ${expiryDate}.`,
        studentSubTab: 'my_reservations',
      });
    }

    if (waitingList.length > 0) {
      const waitDetails = waitingList
        .map((r) => `« ${r.bookTitle} » (rang #${r.queuePosition})`)
        .join(', ');
      pushNotification({
        targetRole: 'etudiant',
        recipientCne: studentCne,
        recipientEmail: authSession.academicEmail,
        category: 'reservation',
        title: 'Confirmation de réservation — File d’attente',
        message: `Votre demande pour ${waitDetails} est enregistrée selon l’ordre chronologique. Vous serez notifié dès qu’un exemplaire sera disponible.`,
        studentSubTab: 'my_reservations',
      });
    }

    showToast({
      type: 'success',
      title:
        createdReservations.length > 1
          ? `${createdReservations.length} réservations enregistrées`
          : 'Réservation enregistrée',
      description:
        readyList.length > 0 && waitingList.length === 0
          ? `Ouvrage(s) prêt(s) pour retrait avant le ${expiryDate}.`
          : readyList.length > 0 && waitingList.length > 0
          ? `${readyList.length} prêt(s) pour retrait, ${waitingList.length} en file d’attente.`
          : `Ajouté en file d’attente (rang #${waitingList[0]?.queuePosition || 1}).`,
    });

    return {
      success: true,
      message: `${createdReservations.length} réservation(s) enregistrée(s).`,
      outcomes,
    };
  };

  const reserveBookForCurrentStudent = (bookId: string): { success: boolean; message: string } => {
    const res = reserveMultipleBooksForCurrentStudent([bookId]);
    return { success: res.success, message: res.message };
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      localStorage.removeItem(STORAGE_KEYS.AUTH);
    } catch {
      // ignore
    }
    setAuthSession(UNAUTHENTICATED_SESSION);

    showToast({
      type: 'info',
      title: 'Déconnexion effectuée',
      description: 'Votre session institutionnelle a été clôturée.',
    });
  };

  const syncWithESTRegistry = async () => {
    const freshList = AcademicRegistryService.getAll();
    setStudentRegistry([...freshList]);

    setMembers((prev) =>
      prev.map((m) => {
        const match = freshList.find((s) => s.cne === m.cne || s.apogee === m.apogee);
        if (match) {
          return {
            ...m,
            status:
              match.registrationStatus === 'Inscrit'
                ? 'Actif'
                : match.registrationStatus === 'Radié'
                ? 'Radié'
                : 'Suspendu',
            department: match.department,
            studyYear: match.studyYear,
          };
        }
        return m;
      })
    );

    logActivity('sync', 'Synchronisation en temps réel avec la base Apogée / Scolarité de l’EST Fès', 'Service Scolarité');
    showToast({
      type: 'success',
      title: 'Base de scolarité synchronisée',
      description: `${freshList.length} fiches étudiantes de l’EST vérifiées et mises à jour.`,
    });
  };

  const updateStudentRegistrationStatus = async (id: string, newStatus: RegistrationStatus) => {
    if (!requireGerant('modifier le statut d’un étudiant')) return;
    await AcademicRegistryService.updateStudentStatus(id, newStatus);
    await syncWithESTRegistry();

    if (authSession.student && authSession.student.id === id) {
      if (newStatus === 'Radié' || newStatus === 'Suspendu') {
        logout();
        showToast({
          type: 'error',
          title: 'Session révoquée',
          description: 'Votre statut d’inscription a été modifié par l’administration de l’école.',
        });
      } else {
        setAuthSession((prev) => ({
          ...prev,
          student: prev.student ? { ...prev.student, registrationStatus: newStatus } : undefined,
        }));
      }
    }
  };

  const addNewStudentToRegistry = async (data: Omit<StudentRegistration, 'id' | 'qrCodeDataUrl'>) => {
    if (!requireGerant('inscrire un nouvel étudiant')) {
      throw new Error('Action réservée au Gérant.');
    }
    const created = await AcademicRegistryService.addStudent(data);
    await syncWithESTRegistry();

    UserRoleService.addUser({
      id: `usr-${created.id}`,
      academicEmail: created.academicEmail,
      fullName: `${created.firstName} ${created.lastName}`,
      role: 'etudiant',
      title: `Étudiant(e) · ${created.studyYear}`,
      department: created.department,
      cne: created.cne,
      apogee: created.apogee,
      status: created.registrationStatus === 'Inscrit' ? 'Actif' : 'Suspendu',
      avatarColor: 'bg-emerald-600',
    });

    const nextNum = members.length + 1;
    const memberCard = `EST-2026-${String(nextNum).padStart(3, '0')}`;
    const newMember: Member = {
      id: `m-${Date.now()}`,
      cardNumber: memberCard,
      cne: created.cne,
      apogee: created.apogee,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.academicEmail,
      phone: created.phone,
      department: created.department,
      studyYear: created.studyYear,
      memberType: 'Étudiant EST',
      status: created.registrationStatus === 'Inscrit' ? 'Actif' : 'Suspendu',
      joinDate: created.registrationDate,
      expiryDate: '2027-09-30',
      maxAllowedLoans: 5,
      qrCodeDataUrl: created.qrCodeDataUrl,
    };
    setMembers((prev) => [newMember, ...prev]);

    showToast({
      type: 'success',
      title: 'Étudiant inscrit au registre EST',
      description: `${created.firstName} ${created.lastName} (${created.cne}) ajouté(e) avec succès.`,
    });

    return created;
  };

  // ==========================================
  // 2. AUTOMATED BOOK ADDITION & MANAGEMENT (STRICTLY GÉRANT ONLY)
  // ==========================================
  const addBookFromSearch = async (bookData: Omit<Book, 'id' | 'qrCodeDataUrl'>): Promise<Book> => {
    if (!requireGerant('ajouter un livre au catalogue')) {
      throw new Error('Permission refusée : seul le gérant peut ajouter un livre.');
    }

    const id = `b-${Date.now()}`;
    const qrCodeDataUrl = await generateQrDataUrl(
      buildBookQrPayload({
        id,
        isbn: bookData.isbn,
        title: bookData.title,
        author: bookData.author,
        shelfLocation: bookData.shelfLocation,
      })
    );

    const total = Math.max(1, bookData.totalCopies || 1);
    const copies: BookCopy[] =
      bookData.copies && bookData.copies.length > 0
        ? bookData.copies
        : Array.from({ length: total }, (_, idx) => ({
            id: `cp-${id}-${idx + 1}`,
            barcode: `EST-NEW-${String(Date.now()).slice(-5)}-${idx + 1}`,
            bookId: id,
            status: 'Disponible' as BookCopyStatus,
            condition: bookData.condition || 'Neuf',
            acquiredDate: currentDate,
          }));

    const newBook: Book = {
      ...bookData,
      id,
      qrCodeDataUrl,
      copies,
      totalCopies: copies.length,
      availableCopies: copies.filter((c) => c.status === 'Disponible').length,
      addedDate: currentDate,
    };

    setBooks((prev) => [newBook, ...prev]);
    logActivity(
      'book',
      `Ajout automatisé au fonds documentaire : "${newBook.title}" (Cote : ${newBook.shelfLocation})`,
      authSession.librarianName || 'Gérant EST'
    );

    showToast({
      type: 'success',
      title: 'Livre catalogué avec QR Code',
      description: `« ${newBook.title} » enregistré avec ${copies.length} exemplaire(s) dans le fonds EST.`,
    });

    return newBook;
  };

  const addBook = async (bookData: Omit<Book, 'id'>): Promise<Book> => {
    return addBookFromSearch(bookData);
  };

  const updateBook = (id: string, updated: Partial<Book>) => {
    if (!requireGerant('modifier une notice bibliographique')) return;
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updated } : b))
    );
    showToast({
      type: 'info',
      title: 'Notice mise à jour',
      description: 'Les modifications de la notice ont été enregistrées.',
    });
  };

  const deleteBook = (id: string): boolean => {
    if (!requireGerant('supprimer un livre du catalogue')) return false;

    const hasActiveLoan = loans.some((l) => l.bookId === id && l.status !== 'Rendu');
    if (hasActiveLoan) {
      showToast({
        type: 'error',
        title: 'Suppression impossible',
        description: 'Cet ouvrage possède actuellement des exemplaires empruntés.',
      });
      return false;
    }
    const book = books.find((b) => b.id === id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    logActivity('book', `Retrait de l'ouvrage "${book?.title || id}" du fonds EST`, authSession.librarianName || 'Gérant EST');
    showToast({
      type: 'warning',
      title: 'Ouvrage retiré',
      description: 'Le livre a été retiré du catalogue.',
    });
    return true;
  };

  const updateCopyStatus = (bookId: string, copyId: string, newStatus: BookCopyStatus): boolean => {
    if (!requireGerant('modifier l’état d’un exemplaire physique')) return false;

    const targetBook = books.find((b) => b.id === bookId);
    const targetCopy = targetBook?.copies?.find((c) => c.id === copyId);
    if (!targetBook || !targetCopy) return false;

    if (targetCopy.status === 'Emprunté' && newStatus !== 'Emprunté') {
      const activeLoan = loans.find((l) => l.copyId === copyId && l.status !== 'Rendu');
      if (activeLoan) {
        showToast({
          type: 'warning',
          title: 'Exemplaire actuellement emprunté',
          description: `Enregistrez d'abord le retour du prêt de ${activeLoan.memberName}.`,
        });
        return false;
      }
    }

    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== bookId || !b.copies) return b;
        const nextCopies = b.copies.map((c) => (c.id === copyId ? { ...c, status: newStatus } : c));
        return {
          ...b,
          copies: nextCopies,
          totalCopies: nextCopies.length,
          availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
        };
      })
    );

    logActivity(
      'book',
      `Exemplaire ${targetCopy.barcode} (« ${targetBook.title} ») passé à l'état : ${newStatus}`,
      authSession.librarianName || 'Gérant EST'
    );
    showToast({
      type: 'info',
      title: 'Statut exemplaire actualisé',
      description: `${targetCopy.barcode} est désormais marqué « ${newStatus} ».`,
    });
    return true;
  };

  const addMember = (memberData: Omit<Member, 'id' | 'cardNumber'>): Member | null => {
    if (!requireGerant('ajouter un adhérent')) return null;
    const nextNum = members.length + 1;
    const cardNumber = `EST-2026-${String(nextNum).padStart(3, '0')}`;
    const newMember: Member = {
      ...memberData,
      id: `m-${Date.now()}`,
      cardNumber,
    };
    setMembers((prev) => [newMember, ...prev]);
    showToast({
      type: 'success',
      title: 'Adhérent enregistré',
      description: `${newMember.firstName} ${newMember.lastName} ajouté(e) au fichier des usagers.`,
    });
    return newMember;
  };

  const updateMember = (id: string, updated: Partial<Member>) => {
    if (!requireGerant('modifier une fiche adhérent')) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
    );
    showToast({
      type: 'info',
      title: 'Fiche adhérent mise à jour',
      description: 'Les informations ont été actualisées.',
    });
  };

  const deleteMember = (id: string): boolean => {
    if (!requireGerant('supprimer un adhérent')) return false;
    const hasActiveLoan = loans.some((l) => l.memberId === id && l.status !== 'Rendu');
    if (hasActiveLoan) {
      showToast({
        type: 'error',
        title: 'Suppression impossible',
        description: 'L’étudiant a des emprunts en cours.',
      });
      return false;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
    showToast({
      type: 'warning',
      title: 'Adhérent retiré',
      description: 'Le dossier a été supprimé.',
    });
    return true;
  };

  const createLoan = (bookId: string, memberId: string, durationDays = 21): { success: boolean; message: string } => {
    if (!requireGerant('enregistrer un prêt')) {
      return { success: false, message: 'Action réservée au Gérant.' };
    }
    const member = members.find((m) => m.id === memberId);
    if (!member) return { success: false, message: 'Adhérent introuvable' };
    validateSmartLoan(member.cne || member.email, bookId, durationDays);
    return { success: true, message: 'Prêt enregistré' };
  };

  // ==========================================
  // 3. INTELLIGENT SMART QR LOAN SYSTEM
  // ==========================================
  const validateSmartLoan = async (
    studentIdentifier: string,
    bookIdentifier: string,
    durationDays = 21,
    options?: { reservedCopyId?: string }
  ): Promise<{ success: boolean; message: string; loan?: Loan }> => {
    if (!requireGerant('valider un prêt au guichet')) {
      return { success: false, message: 'Action réservée au Gérant.' };
    }

    const cleanStudentId = studentIdentifier.trim().toLowerCase();
    const cleanBookId = bookIdentifier.trim().toLowerCase();

    const allStudents = AcademicRegistryService.getAll();
    const student = allStudents.find(
      (s) =>
        s.cne.toLowerCase() === cleanStudentId ||
        s.apogee.toLowerCase() === cleanStudentId ||
        s.academicEmail.toLowerCase() === cleanStudentId ||
        `${s.firstName} ${s.lastName}`.toLowerCase() === cleanStudentId
    );

    if (!student) {
      return {
        success: false,
        message: `Étudiant introuvable dans la base de scolarité de l’EST USMBA (Identifiant testé : "${studentIdentifier}").`,
      };
    }

    if (student.registrationStatus === 'Radié') {
      return {
        success: false,
        message: `Prêt refusé : L’étudiant ${student.firstName} ${student.lastName} (CNE : ${student.cne}) a été RADIÉ de l’EST Fès.`,
      };
    }

    if (student.registrationStatus === 'Suspendu') {
      return {
        success: false,
        message: `Prêt refusé : L'inscription de ${student.firstName} ${student.lastName} est suspendue.`,
      };
    }

    const book = books.find(
      (b) =>
        b.id.toLowerCase() === cleanBookId ||
        b.isbn.toLowerCase() === cleanBookId ||
        b.title.toLowerCase().includes(cleanBookId) ||
        b.shelfLocation.toLowerCase() === cleanBookId
    );

    if (!book) {
      return {
        success: false,
        message: `Document introuvable dans le catalogue (Identifiant : "${bookIdentifier}").`,
      };
    }

    const reservedCopy = options?.reservedCopyId
      ? book.copies?.find((c) => c.id === options.reservedCopyId && c.status === 'Réservé')
      : undefined;

    if (book.availableCopies <= 0 && !reservedCopy) {
      return {
        success: false,
        message: `Tous les exemplaires de « ${book.title} » sont actuellement empruntés ou indisponibles.`,
      };
    }

    let member = members.find((m) => m.cne === student.cne || m.email === student.academicEmail);
    if (!member) {
      const nextNum = members.length + 1;
      member = {
        id: `m-${Date.now()}`,
        cardNumber: `EST-2026-${String(nextNum).padStart(3, '0')}`,
        cne: student.cne,
        apogee: student.apogee,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.academicEmail,
        phone: student.phone,
        department: student.department,
        studyYear: student.studyYear,
        memberType: 'Étudiant EST',
        status: 'Actif',
        joinDate: currentDate,
        expiryDate: '2027-09-30',
        maxAllowedLoans: 5,
        qrCodeDataUrl: student.qrCodeDataUrl,
      };
      setMembers((prev) => [member!, ...prev]);
    }

    const activeStudentLoans = loans.filter(
      (l) => (l.memberCne === student.cne || l.memberId === member!.id) && l.status !== 'Rendu'
    );
    if (activeStudentLoans.length >= member.maxAllowedLoans) {
      return {
        success: false,
        message: `Quota d'emprunt atteint pour ${student.firstName} ${student.lastName} (${activeStudentLoans.length}/${member.maxAllowedLoans} documents en cours).`,
      };
    }

    const hasOverdue = activeStudentLoans.some((l) => l.status === 'En retard');
    if (hasOverdue) {
      return {
        success: false,
        message: `Prêt bloqué : L’étudiant a des documents en retard non restitués.`,
      };
    }

    const borrowDate = currentDate;
    const due = new Date(currentDate);
    due.setDate(due.getDate() + durationDays);
    const dueDate = due.toISOString().split('T')[0];
    const loanId = `loan-est-${Date.now()}`;
    const hash = `USMBA-EST-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const availableCopy = reservedCopy || book.copies?.find((c) => c.status === 'Disponible');

    const receiptPayload = {
      type: 'EST_LOAN_RECEIPT',
      loanId,
      studentName: `${student.firstName} ${student.lastName}`,
      cne: student.cne,
      apogee: student.apogee,
      department: student.department,
      bookTitle: book.title,
      isbn: book.isbn,
      shelfLocation: book.shelfLocation,
      copyBarcode: availableCopy?.barcode,
      borrowDate,
      dueDate,
      receiptHash: hash,
    };

    const loanQrCodeDataUrl = await generateQrDataUrl(receiptPayload);

    const newLoan: Loan = {
      id: loanId,
      bookId: book.id,
      copyId: availableCopy?.id,
      copyBarcode: availableCopy?.barcode,
      bookTitle: book.title,
      bookIsbn: book.isbn,
      bookShelfLocation: book.shelfLocation,
      bookCategory: book.category,
      memberId: member.id,
      memberName: `${student.firstName} ${student.lastName}`,
      memberCard: member.cardNumber,
      memberCne: student.cne,
      memberApogee: student.apogee,
      memberDepartment: student.department,
      borrowDate,
      dueDate,
      status: 'En cours',
      extensionsCount: 0,
      remindersSent: 0,
      lateFee: 0,
      loanQrCodeDataUrl,
      loanReceiptHash: hash,
    };

    // Decrease available copies & mark specific physical copy as Emprunté
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== book.id) return b;
        if (b.copies && availableCopy) {
          const nextCopies = b.copies.map((c) =>
            c.id === availableCopy.id ? { ...c, status: 'Emprunté' as BookCopyStatus } : c
          );
          return {
            ...b,
            copies: nextCopies,
            availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
          };
        }
        return { ...b, availableCopies: Math.max(0, b.availableCopies - 1) };
      })
    );

    setLoans((prev) => [newLoan, ...prev]);

    logActivity(
      'loan',
      `Prêt intelligent QR validé : "${book.title}" pour ${student.firstName} ${student.lastName} (CNE : ${student.cne})`,
      'Comptoir QR EST'
    );

    pushNotification({
      targetRole: 'gerant',
      category: 'loan',
      title: 'Nouvel emprunt enregistré',
      message: `${student.firstName} ${student.lastName} (${student.cne}) a emprunté « ${book.title} ». Retour prévu le ${dueDate}.`,
      targetTab: 'loans',
    });

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: student.cne,
      recipientEmail: student.academicEmail,
      category: 'loan',
      title: 'Confirmation d’emprunt',
      message: `Votre emprunt de « ${book.title} » a été validé. Date de retour prévue : ${dueDate}.`,
      studentSubTab: 'my_loans',
    });

    showToast({
      type: 'success',
      title: 'Emprunt intelligent validé',
      description: `Fiche de prêt générée et QR Code émis pour ${student.firstName} ${student.lastName}.`,
    });

    return {
      success: true,
      message: 'Fiche de prêt enregistrée avec succès.',
      loan: newLoan,
    };
  };

  // Atomic multi-book batch checkout for a single student
  const validateBatchSmartLoan = async (
    studentIdentifier: string,
    items: Array<{ bookId: string; copyId?: string; reservationId?: string }>,
    durationDays = 21
  ): Promise<{ success: boolean; message: string; loans?: Loan[] }> => {
    if (!requireGerant('valider un emprunt multiple au guichet')) {
      return { success: false, message: 'Action réservée au Gérant.' };
    }

    if (!items || items.length === 0) {
      return { success: false, message: 'Aucun exemplaire sélectionné pour cette opération.' };
    }

    const cleanStudentId = studentIdentifier.trim().toLowerCase();
    const allStudents = AcademicRegistryService.getAll();
    const student = allStudents.find(
      (s) =>
        s.cne.toLowerCase() === cleanStudentId ||
        s.apogee.toLowerCase() === cleanStudentId ||
        s.academicEmail.toLowerCase() === cleanStudentId ||
        `${s.firstName} ${s.lastName}`.toLowerCase() === cleanStudentId
    );

    if (!student) {
      return {
        success: false,
        message: `Étudiant introuvable dans la base de scolarité de l’EST USMBA (« ${studentIdentifier} »).`,
      };
    }

    if (student.registrationStatus === 'Radié') {
      return {
        success: false,
        message: `Opération refusée : l’étudiant ${student.firstName} ${student.lastName} (CNE : ${student.cne}) est radié.`,
      };
    }

    if (student.registrationStatus === 'Suspendu') {
      return {
        success: false,
        message: `Opération bloquée : l’inscription de ${student.firstName} ${student.lastName} est suspendue.`,
      };
    }

    const existingMember = members.find(
      (m) => m.cne === student.cne || m.email.toLowerCase() === student.academicEmail.toLowerCase()
    );
    const memberIdToUse = existingMember?.id || `m-${Date.now()}`;
    const memberCardToUse =
      existingMember?.cardNumber || `EST-2026-${String(members.length + 1).padStart(3, '0')}`;
    const maxAllowed = existingMember?.maxAllowedLoans || 5;

    const activeStudentLoans = loans.filter(
      (l) => (l.memberCne === student.cne || l.memberId === memberIdToUse) && l.status !== 'Rendu'
    );

    if (activeStudentLoans.some((l) => l.status === 'En retard')) {
      return {
        success: false,
        message: `Prêt bloqué : ${student.firstName} ${student.lastName} possède déjà des documents en retard non restitués.`,
      };
    }

    if (activeStudentLoans.length + items.length > maxAllowed) {
      return {
        success: false,
        message: `Quota dépassé : ${activeStudentLoans.length} emprunt(s) en cours + ${items.length} demandé(s) excède la limite de ${maxAllowed} ouvrages.`,
      };
    }

    // Phase 1: Complete dry-run validation & copy reservation before any mutation
    const allocatedCopyIds = new Set<string>();
    const allocatedPerBook = new Map<string, number>();
    const fulfilledReservationIds = new Set<string>();
    const resolvedItems: Array<{ book: Book; copy?: BookCopy }> = [];

    const isReservationOwnedByStudent = (r: Reservation) =>
      r.memberCne?.toLowerCase() === student.cne.toLowerCase() ||
      r.memberCard.toLowerCase() === student.cne.toLowerCase() ||
      (existingMember &&
        (r.memberId === existingMember.id ||
          r.memberCard.toLowerCase() === existingMember.cardNumber.toLowerCase()));

    for (const item of items) {
      const book = books.find((b) => b.id === item.bookId);
      if (!book) {
        return {
          success: false,
          message: `Transaction annulée : un ouvrage sélectionné est introuvable dans le catalogue.`,
        };
      }

      const studentActiveResForBook = reservations.find(
        (r) =>
          (item.reservationId ? r.id === item.reservationId : r.bookId === book.id) &&
          (r.status === 'Prêt pour retrait' || r.status === 'Confirmée') &&
          isReservationOwnedByStudent(r)
      );

      if (item.reservationId && !studentActiveResForBook) {
        return {
          success: false,
          message: `Transaction annulée : la réservation sélectionnée n’appartient pas à ${student.firstName} ${student.lastName} (${student.cne}).`,
        };
      }

      const targetCopyId = item.copyId || studentActiveResForBook?.copyId;

      if (targetCopyId) {
        if (allocatedCopyIds.has(targetCopyId)) {
          return {
            success: false,
            message: `Transaction annulée : l’exemplaire de « ${book.title} » figure en double dans la sélection.`,
          };
        }
        const targetCopy = book.copies?.find((c) => c.id === targetCopyId);
        const canClaimReserved =
          targetCopy?.status === 'Réservé' &&
          Boolean(studentActiveResForBook && (!studentActiveResForBook.copyId || studentActiveResForBook.copyId === targetCopy.id));

        if (!targetCopy || (targetCopy.status !== 'Disponible' && !canClaimReserved)) {
          return {
            success: false,
            message: `Transaction annulée : l’exemplaire « ${targetCopy?.barcode || targetCopyId} » de « ${book.title} » n’est pas disponible pour cet étudiant.`,
          };
        }
        allocatedCopyIds.add(targetCopy.id);
        allocatedPerBook.set(book.id, (allocatedPerBook.get(book.id) || 0) + 1);
        if (studentActiveResForBook) fulfilledReservationIds.add(studentActiveResForBook.id);
        resolvedItems.push({ book, copy: targetCopy });
      } else {
        const alreadyTakenCount = allocatedPerBook.get(book.id) || 0;
        const canUseUnlinkedReservation = Boolean(studentActiveResForBook && !studentActiveResForBook.copyId);
        if (!canUseUnlinkedReservation && book.availableCopies - alreadyTakenCount <= 0) {
          return {
            success: false,
            message: `Transaction annulée : stock insuffisant pour « ${book.title} ».`,
          };
        }
        const nextCopy =
          book.copies?.find((c) => c.status === 'Disponible' && !allocatedCopyIds.has(c.id)) ||
          (canUseUnlinkedReservation
            ? book.copies?.find((c) => c.status === 'Réservé' && !allocatedCopyIds.has(c.id))
            : undefined);
        if (book.copies && book.copies.length > 0 && !nextCopy) {
          return {
            success: false,
            message: `Transaction annulée : aucun exemplaire disponible restant pour « ${book.title} ».`,
          };
        }
        if (nextCopy) allocatedCopyIds.add(nextCopy.id);
        allocatedPerBook.set(book.id, alreadyTakenCount + 1);
        if (studentActiveResForBook) fulfilledReservationIds.add(studentActiveResForBook.id);
        resolvedItems.push({ book, copy: nextCopy });
      }
    }

    // Phase 2: Generate all loan records & QR receipts before committing state
    const borrowDate = currentDate;
    const due = new Date(currentDate);
    due.setDate(due.getDate() + durationDays);
    const dueDate = due.toISOString().split('T')[0];

    const createdLoans: Loan[] = [];
    const batchTs = Date.now();

    try {
      for (let i = 0; i < resolvedItems.length; i++) {
        const { book, copy } = resolvedItems[i];
        const loanId = `loan-est-${batchTs}-${i}`;
        const hash = `USMBA-EST-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        const receiptPayload = {
          type: 'EST_LOAN_RECEIPT',
          loanId,
          studentName: `${student.firstName} ${student.lastName}`,
          cne: student.cne,
          apogee: student.apogee,
          department: student.department,
          bookTitle: book.title,
          isbn: book.isbn,
          shelfLocation: book.shelfLocation,
          copyBarcode: copy?.barcode,
          borrowDate,
          dueDate,
          receiptHash: hash,
        };

        const loanQrCodeDataUrl = await generateQrDataUrl(receiptPayload);

        createdLoans.push({
          id: loanId,
          bookId: book.id,
          copyId: copy?.id,
          copyBarcode: copy?.barcode,
          bookTitle: book.title,
          bookIsbn: book.isbn,
          bookShelfLocation: book.shelfLocation,
          bookCategory: book.category,
          memberId: memberIdToUse,
          memberName: `${student.firstName} ${student.lastName}`,
          memberCard: memberCardToUse,
          memberCne: student.cne,
          memberApogee: student.apogee,
          memberDepartment: student.department,
          borrowDate,
          dueDate,
          status: 'En cours',
          extensionsCount: 0,
          remindersSent: 0,
          lateFee: 0,
          loanQrCodeDataUrl,
          loanReceiptHash: hash,
        });
      }
    } catch {
      return {
        success: false,
        message: 'Erreur lors de la préparation des tickets de prêt. Aucun emprunt n’a été enregistré.',
      };
    }

    // Phase 3: Atomic state commit across members, books, and loans
    if (!existingMember) {
      const newMember: Member = {
        id: memberIdToUse,
        cardNumber: memberCardToUse,
        cne: student.cne,
        apogee: student.apogee,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.academicEmail,
        phone: student.phone,
        department: student.department,
        studyYear: student.studyYear,
        memberType: 'Étudiant EST',
        status: 'Actif',
        joinDate: currentDate,
        expiryDate: '2027-09-30',
        maxAllowedLoans: 5,
        qrCodeDataUrl: student.qrCodeDataUrl,
      };
      setMembers((prev) => [newMember, ...prev]);
    }

    setBooks((prev) =>
      prev.map((b) => {
        const countForBook = allocatedPerBook.get(b.id) || 0;
        if (countForBook === 0) return b;
        if (b.copies && b.copies.length > 0) {
          const nextCopies = b.copies.map((c) =>
            allocatedCopyIds.has(c.id) ? { ...c, status: 'Emprunté' as BookCopyStatus } : c
          );
          return {
            ...b,
            copies: nextCopies,
            availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
          };
        }
        return { ...b, availableCopies: Math.max(0, b.availableCopies - countForBook) };
      })
    );

    setLoans((prev) => [...createdLoans, ...prev]);

    if (fulfilledReservationIds.size > 0) {
      const touchedBooks = new Set<string>(
        reservations.filter((r) => fulfilledReservationIds.has(r.id)).map((r) => r.bookId)
      );
      setReservations((prev) =>
        recalculateQueueForBooks(
          prev.map((r) =>
            fulfilledReservationIds.has(r.id) ? { ...r, status: 'Honorée' } : r
          ),
          touchedBooks
        )
      );
    }

    const titlesSummary = createdLoans.map((l) => `« ${l.bookTitle} »`).join(', ');
    logActivity(
      'loan',
      `Prêt multiple validé (${createdLoans.length} ouvrage(s)) pour ${student.firstName} ${student.lastName} (${student.cne}) : ${titlesSummary}`,
      'Comptoir QR EST'
    );

    pushNotification({
      targetRole: 'gerant',
      category: 'loan',
      title: `Emprunt multiple enregistré (${createdLoans.length})`,
      message: `${student.firstName} ${student.lastName} (${student.cne}) a emprunté ${createdLoans.length} ouvrage(s) : ${titlesSummary}. Retour prévu le ${dueDate}.`,
      targetTab: 'loans',
    });

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: student.cne,
      recipientEmail: student.academicEmail,
      category: 'loan',
      title: `Confirmation d’emprunt (${createdLoans.length} ouvrage${createdLoans.length > 1 ? 's' : ''})`,
      message: `Vos emprunts ont été validés : ${titlesSummary}. Date de retour prévue : ${dueDate}.`,
      studentSubTab: 'my_loans',
    });

    showToast({
      type: 'success',
      title: `${createdLoans.length} emprunt${createdLoans.length > 1 ? 's' : ''} validé${createdLoans.length > 1 ? 's' : ''}`,
      description: `Opération enregistrée pour ${student.firstName} ${student.lastName}.`,
    });

    return {
      success: true,
      message: `${createdLoans.length} emprunt(s) enregistré(s) avec succès.`,
      loans: createdLoans,
    };
  };

  const returnLoan = (loanId: string) => {
    if (!requireGerant('enregistrer le retour d’un livre')) return;
    const loan = loans.find((l) => l.id === loanId);
    if (!loan || loan.status === 'Rendu') return;

    const member = members.find((m) => m.id === loan.memberId || m.cne === loan.memberCne);

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId ? { ...l, status: 'Rendu', returnDate: currentDate } : l
      )
    );

    // Promote first pending/confirmed reservation in strict chronological FIFO order
    const nextPendingRes = reservations
      .filter((r) => r.bookId === loan.bookId && (r.status === 'En attente' || r.status === 'Confirmée'))
      .sort(compareReservationsFifo)[0];

    const newCopyStatus: BookCopyStatus = nextPendingRes ? 'Réservé' : 'Disponible';
    const returnedBook = books.find((b) => b.id === loan.bookId);
    const matchedReturnedCopy = returnedBook?.copies?.find(
      (c) => (loan.copyId && c.id === loan.copyId) || c.status === 'Emprunté'
    );

    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== loan.bookId) return b;
        if (b.copies && b.copies.length > 0) {
          let updatedOne = false;
          const nextCopies = b.copies.map((c) => {
            if (!updatedOne && ((loan.copyId && c.id === loan.copyId) || c.status === 'Emprunté')) {
              updatedOne = true;
              return { ...c, status: newCopyStatus };
            }
            return c;
          });
          return {
            ...b,
            copies: nextCopies,
            availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
          };
        }
        return {
          ...b,
          availableCopies: nextPendingRes ? b.availableCopies : Math.min(b.totalCopies, b.availableCopies + 1),
        };
      })
    );

    if (nextPendingRes) {
      const pickupDeadline = addIsoDays(currentDate, RESERVATION_HOLD_DAYS);
      const assignedCopyId = matchedReturnedCopy?.id || loan.copyId || nextPendingRes.copyId;
      const assignedCopyBarcode = matchedReturnedCopy?.barcode || loan.copyBarcode || nextPendingRes.copyBarcode;

      setReservations((prev) =>
        recalculateQueueForBooks(
          prev.map((r) =>
            r.id === nextPendingRes.id
              ? {
                  ...r,
                  status: 'Prêt pour retrait',
                  copyId: assignedCopyId,
                  copyBarcode: assignedCopyBarcode,
                  readyDate: currentDate,
                  expiryDate: pickupDeadline,
                  expiryReminderSent: false,
                  queuePosition: 1,
                }
              : r
          ),
          new Set([loan.bookId])
        )
      );

      const resMember = members.find(
        (m) =>
          m.id === nextPendingRes.memberId ||
          m.cne === nextPendingRes.memberCard ||
          m.cardNumber === nextPendingRes.memberCard
      );

      pushNotification({
        targetRole: 'etudiant',
        recipientCne: nextPendingRes.memberCne || resMember?.cne || nextPendingRes.memberCard,
        recipientEmail: resMember?.email,
        category: 'reservation',
        title: 'Attribution automatique — Livre disponible pour retrait !',
        message: `Bonne nouvelle : suite à un retour, « ${loan.bookTitle} » vous a été attribué automatiquement. Retrait au guichet avant le ${pickupDeadline}.`,
        studentSubTab: 'my_reservations',
      });

      pushNotification({
        targetRole: 'gerant',
        category: 'reservation',
        title: 'Attribution automatique suite à retour',
        message: `« ${loan.bookTitle} » attribué à ${nextPendingRes.memberName} (limite de retrait : ${pickupDeadline}).`,
        targetTab: 'reservations',
      });
    }

    logActivity('return', `Retour de document : "${loan.bookTitle}" restitué par ${loan.memberName}`, 'Comptoir EST');

    pushNotification({
      targetRole: 'gerant',
      category: 'return',
      title: 'Retour de livre enregistré',
      message: `« ${loan.bookTitle} » a été restitué par ${loan.memberName} (${loan.memberCne}).`,
      targetTab: 'loans',
    });

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: loan.memberCne,
      recipientEmail: member?.email,
      category: 'return',
      title: 'Confirmation de retour',
      message: `La restitution de « ${loan.bookTitle} » a bien été enregistrée. Merci !`,
      studentSubTab: 'my_loans',
    });

    showToast({
      type: 'success',
      title: 'Restitution enregistrée',
      description: `Le document « ${loan.bookTitle} » a été réintégré dans le fonds de l'EST.`,
    });
  };

  const extendLoan = (loanId: string, days = 14): { success: boolean; message: string } => {
    if (!authSession.isAuthenticated) {
      showToast({
        type: 'error',
        title: 'Authentification requise',
        description: 'Veuillez vous connecter pour prolonger un emprunt.',
      });
      return { success: false, message: 'Authentification requise.' };
    }

    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return { success: false, message: 'Emprunt introuvable' };

    const member = members.find((m) => m.id === loan.memberId || m.cne === loan.memberCne);

    if (!isGerant) {
      const studentCne = authSession.student?.cne;
      const isOwner =
        (studentCne && loan.memberCne === studentCne) ||
        (member?.email &&
          authSession.academicEmail &&
          member.email.toLowerCase() === authSession.academicEmail.toLowerCase());
      if (!isOwner) {
        showToast({
          type: 'error',
          title: 'Action non autorisée',
          description: 'Vous ne pouvez prolonger que vos propres emprunts.',
        });
        return { success: false, message: 'Action non autorisée.' };
      }
      if (loan.status === 'En retard') {
        showToast({
          type: 'warning',
          title: 'Prolongation impossible en cas de retard',
          description: 'Veuillez vous présenter au guichet pour régulariser cet emprunt.',
        });
        return { success: false, message: 'Prolongation impossible en cas de retard.' };
      }
    }

    if (loan.status === 'Rendu') {
      return { success: false, message: 'Document déjà retourné.' };
    }

    if (loan.extensionsCount >= 2) {
      pushNotification({
        targetRole: 'etudiant',
        recipientCne: loan.memberCne,
        recipientEmail: member?.email,
        category: 'renewal',
        title: 'Renouvellement refusé',
        message: `La prolongation pour « ${loan.bookTitle} » n'a pas pu être accordée : quota maximal de 2 renouvellements atteint.`,
        studentSubTab: 'my_loans',
      });

      showToast({
        type: 'warning',
        title: 'Quota de prolongation atteint',
        description: 'Maximum 2 prolongations autorisées selon le règlement de l’EST.',
      });
      return { success: false, message: 'Maximum 2 prolongations autorisées.' };
    }

    const currentDue = new Date(loan.dueDate);
    currentDue.setDate(currentDue.getDate() + days);
    const newDueDate = currentDue.toISOString().split('T')[0];

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              dueDate: newDueDate,
              extensionsCount: l.extensionsCount + 1,
              status: newDueDate >= currentDate ? 'En cours' : 'En retard',
            }
          : l
      )
    );

    logActivity('renew', `Prolongation accordée pour "${loan.bookTitle}" (+${days}j)`);

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: loan.memberCne,
      recipientEmail: member?.email,
      category: 'renewal',
      title: 'Renouvellement accepté',
      message: `Votre emprunt de « ${loan.bookTitle} » a été prolongé jusqu'au ${newDueDate}.`,
      studentSubTab: 'my_loans',
    });

    pushNotification({
      targetRole: 'gerant',
      category: 'renewal',
      title: 'Prolongation enregistrée',
      message: `${loan.memberName} a prolongé « ${loan.bookTitle} » (nouvelle échéance : ${newDueDate}).`,
      targetTab: 'loans',
    });

    showToast({
      type: 'success',
      title: 'Prêt prolongé',
      description: `Nouvelle échéance fixée au ${newDueDate}.`,
    });

    return { success: true, message: `Prolongé jusqu'au ${newDueDate}` };
  };

  const getOverdueStudentsSummary = (): OverdueStudentGroup[] => {
    const todayKey = formatCurrentTimestamp().dayKey;
    const overdueLoansList = loans.filter((l) => l.status === 'En retard');
    const groupedMap = new Map<string, OverdueStudentGroup>();

    overdueLoansList.forEach((loan) => {
      const member = members.find(
        (m) => m.id === loan.memberId || m.cne === loan.memberCne
      );
      const regStudent = AcademicRegistryService.findByCneOrApogee(loan.memberCne);
      const studentKey = loan.memberCne || loan.memberId;
      const email = member?.email || regStudent?.academicEmail || '';
      const daysOverdue = getOverdueDays(loan.dueDate, currentDate);

      const loanEntry = {
        loanId: loan.id,
        bookTitle: loan.bookTitle,
        dueDate: loan.dueDate,
        daysOverdue,
        remindersSent: loan.remindersSent,
        lastReminderDate: loan.lastReminderDate,
      };

      const existing = groupedMap.get(studentKey);
      if (existing) {
        existing.loans.push(loanEntry);
        if (loan.lastReminderDate !== todayKey) {
          existing.alreadyRemindedToday = false;
        }
      } else {
        groupedMap.set(studentKey, {
          studentKey,
          memberId: loan.memberId,
          studentName: loan.memberName,
          studentCne: loan.memberCne,
          studentCard: loan.memberCard,
          studentEmail: email,
          department: loan.memberDepartment || member?.department || 'EST Fès',
          alreadyRemindedToday: loan.lastReminderDate === todayKey,
          loans: [loanEntry],
        });
      }
    });

    return Array.from(groupedMap.values());
  };

  const sendReminder = (
    loanId: string,
    options?: { force?: boolean }
  ): { success: boolean; status: ReminderHistoryEntry['status']; message: string } => {
    if (!requireGerant('envoyer une relance')) {
      return { success: false, status: 'Échec', message: 'Action réservée au Gérant.' };
    }

    const now = formatCurrentTimestamp();
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) {
      return { success: false, status: 'Échec', message: 'Emprunt introuvable.' };
    }

    const member = members.find((m) => m.id === loan.memberId || m.cne === loan.memberCne);
    const regStudent = AcademicRegistryService.findByCneOrApogee(loan.memberCne);
    const email = member?.email || regStudent?.academicEmail || '';

    if (!options?.force && loan.lastReminderDate === now.dayKey) {
      const skippedEntry: ReminderHistoryEntry = {
        id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: now.date,
        time: now.time,
        isoTimestamp: now.iso,
        studentName: loan.memberName,
        studentCne: loan.memberCne,
        studentEmail: email || 'Non renseigné',
        bookTitles: [loan.bookTitle],
        overdueCount: 1,
        mode: 'individuelle',
        status: 'Ignorée (déjà relancé)',
        errorReason: 'Une relance a déjà été envoyée aujourd’hui pour cet emprunt.',
      };
      setReminderHistory((prev) => [skippedEntry, ...prev]);

      showToast({
        type: 'warning',
        title: 'Relance déjà effectuée aujourd’hui',
        description: `${loan.memberName} a déjà reçu une relance pour « ${loan.bookTitle} » aujourd’hui.`,
      });

      return {
        success: false,
        status: 'Ignorée (déjà relancé)',
        message: 'Déjà relancé aujourd’hui.',
      };
    }

    if (!email || !email.includes('@')) {
      const failedEntry: ReminderHistoryEntry = {
        id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: now.date,
        time: now.time,
        isoTimestamp: now.iso,
        studentName: loan.memberName,
        studentCne: loan.memberCne,
        studentEmail: 'Adresse manquante',
        bookTitles: [loan.bookTitle],
        overdueCount: 1,
        mode: 'individuelle',
        status: 'Échec',
        errorReason: 'Adresse académique USMBA introuvable pour cet étudiant.',
      };
      setReminderHistory((prev) => [failedEntry, ...prev]);
      showToast({
        type: 'error',
        title: 'Échec de la relance',
        description: `Adresse académique introuvable pour ${loan.memberName}.`,
      });
      return { success: false, status: 'Échec', message: 'Adresse académique introuvable.' };
    }

    const days = getOverdueDays(loan.dueDate, currentDate);

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? { ...l, remindersSent: l.remindersSent + 1, lastReminderDate: now.dayKey }
          : l
      )
    );

    const sentEntry: ReminderHistoryEntry = {
      id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: now.date,
      time: now.time,
      isoTimestamp: now.iso,
      studentName: loan.memberName,
      studentCne: loan.memberCne,
      studentEmail: email,
      bookTitles: [loan.bookTitle],
      overdueCount: 1,
      mode: 'individuelle',
      status: 'Envoyée',
    };
    setReminderHistory((prev) => [sentEntry, ...prev]);

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: loan.memberCne,
      recipientEmail: email,
      category: 'reminder',
      title: 'Rappel de retour — Emprunt en retard',
      message: `Bonjour ${loan.memberName}, votre emprunt « ${loan.bookTitle} » (échéance : ${loan.dueDate}) accuse ${days} jour(s) de retard. Merci de le retourner au guichet.`,
      studentSubTab: 'my_loans',
    });

    logActivity('reminder', `Relance individuelle envoyée à ${loan.memberName} (${email}) pour « ${loan.bookTitle} »`, 'Gérant EST');
    showToast({
      type: 'info',
      title: 'Avis de rappel envoyé',
      description: `Notification transmise à ${loan.memberName} (${email}).`,
    });

    return { success: true, status: 'Envoyée', message: 'Relance envoyée avec succès.' };
  };

  // Grouped single notification reminder for a specific student (even with multiple overdue books)
  const sendStudentReminder = (
    studentCneOrId: string,
    options?: { force?: boolean }
  ): { success: boolean; status: ReminderHistoryEntry['status']; message: string } => {
    if (!requireGerant('relancer un étudiant en retard')) {
      return { success: false, status: 'Échec', message: 'Action réservée au Gérant.' };
    }

    const now = formatCurrentTimestamp();
    const studentOverdueLoans = loans.filter(
      (l) =>
        l.status === 'En retard' &&
        (l.memberCne === studentCneOrId || l.memberId === studentCneOrId)
    );

    if (studentOverdueLoans.length === 0) {
      return { success: false, status: 'Échec', message: 'Aucun emprunt en retard pour cet étudiant.' };
    }

    const firstLoan = studentOverdueLoans[0];
    const member = members.find(
      (m) => m.id === firstLoan.memberId || m.cne === firstLoan.memberCne
    );
    const regStudent = AcademicRegistryService.findByCneOrApogee(firstLoan.memberCne);
    const email = member?.email || regStudent?.academicEmail || '';
    const bookTitles = studentOverdueLoans.map((l) => l.bookTitle);

    const allRemindedToday = studentOverdueLoans.every(
      (l) => l.lastReminderDate === now.dayKey
    );

    if (!options?.force && allRemindedToday) {
      const skippedEntry: ReminderHistoryEntry = {
        id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: now.date,
        time: now.time,
        isoTimestamp: now.iso,
        studentName: firstLoan.memberName,
        studentCne: firstLoan.memberCne,
        studentEmail: email || 'Non renseigné',
        bookTitles,
        overdueCount: studentOverdueLoans.length,
        mode: 'individuelle',
        status: 'Ignorée (déjà relancé)',
        errorReason: 'Une relance a déjà été envoyée aujourd’hui à cet étudiant.',
      };
      setReminderHistory((prev) => [skippedEntry, ...prev]);
      showToast({
        type: 'info',
        title: 'Relance déjà envoyée aujourd’hui',
        description: `${firstLoan.memberName} a déjà été relancé(e) aujourd’hui.`,
      });
      return {
        success: false,
        status: 'Ignorée (déjà relancé)',
        message: 'Déjà relancé aujourd’hui.',
      };
    }

    if (!email || !email.includes('@')) {
      const failedEntry: ReminderHistoryEntry = {
        id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: now.date,
        time: now.time,
        isoTimestamp: now.iso,
        studentName: firstLoan.memberName,
        studentCne: firstLoan.memberCne,
        studentEmail: 'Adresse manquante',
        bookTitles,
        overdueCount: studentOverdueLoans.length,
        mode: 'individuelle',
        status: 'Échec',
        errorReason: 'Adresse académique USMBA introuvable pour cet étudiant.',
      };
      setReminderHistory((prev) => [failedEntry, ...prev]);
      showToast({
        type: 'error',
        title: 'Échec de la relance',
        description: `Adresse académique introuvable pour ${firstLoan.memberName}.`,
      });
      return { success: false, status: 'Échec', message: 'Adresse académique introuvable.' };
    }

    const loanIdSet = new Set(studentOverdueLoans.map((l) => l.id));
    setLoans((prev) =>
      prev.map((l) =>
        loanIdSet.has(l.id)
          ? { ...l, remindersSent: l.remindersSent + 1, lastReminderDate: now.dayKey }
          : l
      )
    );

    const booksSummary = studentOverdueLoans
      .map(
        (l) =>
          `• « ${l.bookTitle} » (échéance : ${l.dueDate}, ${getOverdueDays(l.dueDate, currentDate)} j de retard)`
      )
      .join(' | ');

    const groupedMessage =
      studentOverdueLoans.length > 1
        ? `Bonjour ${firstLoan.memberName}, vous avez ${studentOverdueLoans.length} livres en retard : ${booksSummary}. Merci de les restituer rapidement au guichet.`
        : `Bonjour ${firstLoan.memberName}, votre emprunt « ${firstLoan.bookTitle} » (échéance : ${firstLoan.dueDate}, ${getOverdueDays(firstLoan.dueDate, currentDate)} j de retard) doit être restitué au guichet.`;

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: firstLoan.memberCne,
      recipientEmail: email,
      category: 'reminder',
      title:
        studentOverdueLoans.length > 1
          ? `Rappel de retour : ${studentOverdueLoans.length} livres en retard`
          : 'Rappel de retour — Emprunt en retard',
      message: groupedMessage,
      studentSubTab: 'my_loans',
    });

    const sentEntry: ReminderHistoryEntry = {
      id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: now.date,
      time: now.time,
      isoTimestamp: now.iso,
      studentName: firstLoan.memberName,
      studentCne: firstLoan.memberCne,
      studentEmail: email,
      bookTitles,
      overdueCount: studentOverdueLoans.length,
      mode: 'individuelle',
      status: 'Envoyée',
    };
    setReminderHistory((prev) => [sentEntry, ...prev]);

    logActivity(
      'reminder',
      `Relance groupée envoyée à ${firstLoan.memberName} (${email}) pour ${studentOverdueLoans.length} ouvrage(s) en retard`,
      'Gérant EST'
    );

    showToast({
      type: 'success',
      title: 'Relance envoyée',
      description: `Une notification unique (${studentOverdueLoans.length} ouvrage${studentOverdueLoans.length > 1 ? 's' : ''}) a été transmise à ${firstLoan.memberName}.`,
    });

    return { success: true, status: 'Envoyée', message: 'Relance envoyée avec succès.' };
  };

  const sendCollectiveReminders = (options?: {
    includeAlreadyRemindedToday?: boolean;
  }): CollectiveReminderResult => {
    if (!requireGerant('exécuter une relance collective')) {
      return { totalStudents: 0, sentCount: 0, failedCount: 0, skippedCount: 0, entries: [] };
    }

    const now = formatCurrentTimestamp();
    const groups = getOverdueStudentsSummary();

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const entries: ReminderHistoryEntry[] = [];
    const remindedLoanIds = new Set<string>();

    groups.forEach((group, idx) => {
      const baseId = `rem-col-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;
      const bookTitles = group.loans.map((l) => l.bookTitle);

      if (!options?.includeAlreadyRemindedToday && group.alreadyRemindedToday) {
        skippedCount += 1;
        entries.push({
          id: baseId,
          date: now.date,
          time: now.time,
          isoTimestamp: now.iso,
          studentName: group.studentName,
          studentCne: group.studentCne,
          studentEmail: group.studentEmail || 'Non renseigné',
          bookTitles,
          overdueCount: group.loans.length,
          mode: 'collective',
          status: 'Ignorée (déjà relancé)',
          errorReason: 'Déjà relancé aujourd’hui (protection anti-doublon).',
        });
        return;
      }

      try {
        if (!group.studentEmail || !group.studentEmail.endsWith('@usmba.ac.ma')) {
          throw new Error('Adresse académique @usmba.ac.ma absente ou invalide.');
        }

        const booksSummary = group.loans
          .map(
            (l) =>
              `• « ${l.bookTitle} » (échéance : ${l.dueDate}, ${l.daysOverdue} j de retard)`
          )
          .join(' | ');

        const message =
          group.loans.length > 1
            ? `Bonjour ${group.studentName}, vous avez ${group.loans.length} livres en retard : ${booksSummary}. Merci de les restituer rapidement au guichet.`
            : `Bonjour ${group.studentName}, votre emprunt « ${group.loans[0].bookTitle} » (échéance : ${group.loans[0].dueDate}, ${group.loans[0].daysOverdue} j de retard) doit être restitué au guichet.`;

        pushNotification({
          targetRole: 'etudiant',
          recipientCne: group.studentCne,
          recipientEmail: group.studentEmail,
          category: 'reminder',
          title:
            group.loans.length > 1
              ? `Rappel urgent : ${group.loans.length} livres en retard`
              : 'Rappel urgent : Emprunt en retard',
          message,
          studentSubTab: 'my_loans',
        });

        group.loans.forEach((l) => remindedLoanIds.add(l.loanId));
        sentCount += 1;
        entries.push({
          id: baseId,
          date: now.date,
          time: now.time,
          isoTimestamp: now.iso,
          studentName: group.studentName,
          studentCne: group.studentCne,
          studentEmail: group.studentEmail,
          bookTitles,
          overdueCount: group.loans.length,
          mode: 'collective',
          status: 'Envoyée',
        });
      } catch (err) {
        failedCount += 1;
        entries.push({
          id: baseId,
          date: now.date,
          time: now.time,
          isoTimestamp: now.iso,
          studentName: group.studentName,
          studentCne: group.studentCne,
          studentEmail: group.studentEmail || 'Inconnue',
          bookTitles,
          overdueCount: group.loans.length,
          mode: 'collective',
          status: 'Échec',
          errorReason: err instanceof Error ? err.message : 'Erreur lors de la notification.',
        });
      }
    });

    if (remindedLoanIds.size > 0) {
      setLoans((prev) =>
        prev.map((l) =>
          remindedLoanIds.has(l.id)
            ? { ...l, remindersSent: l.remindersSent + 1, lastReminderDate: now.dayKey }
            : l
        )
      );
    }

    if (entries.length > 0) {
      setReminderHistory((prev) => [...entries, ...prev]);
    }

    pushNotification({
      targetRole: 'gerant',
      category: 'reminder',
      title: 'Résultat de la relance collective',
      message: `${sentCount} notification(s) envoyée(s) avec succès${failedCount > 0 ? `, ${failedCount} échec(s)` : ''}${skippedCount > 0 ? `, ${skippedCount} ignorée(s) (déjà relancés)` : ''}.`,
      targetTab: 'loans',
    });

    logActivity(
      'reminder',
      `Relance collective exécutée : ${sentCount} envoyé(s), ${failedCount} échec(s), ${skippedCount} ignoré(s).`,
      'Gérant EST'
    );

    if (sentCount > 0) {
      showToast({
        type: failedCount > 0 ? 'warning' : 'success',
        title: 'Relance collective terminée',
        description: `${sentCount} étudiant(s) relancé(s) avec succès${failedCount > 0 ? `, ${failedCount} échec(s)` : ''}.`,
      });
    } else if (skippedCount > 0 && failedCount === 0) {
      showToast({
        type: 'info',
        title: 'Aucune nouvelle relance nécessaire',
        description: `Les ${skippedCount} étudiant(s) en retard ont déjà été relancés aujourd’hui.`,
      });
    }

    return {
      totalStudents: groups.length,
      sentCount,
      failedCount,
      skippedCount,
      entries,
    };
  };

  // Reservations
  const createReservation = (bookId: string, memberId: string): { success: boolean; message: string } => {
    if (!requireGerant('enregistrer une réservation pour un adhérent')) {
      return { success: false, message: 'Action réservée au Gérant.' };
    }
    const book = books.find((b) => b.id === bookId);
    const member = members.find((m) => m.id === memberId);
    if (!book || !member) return { success: false, message: 'Données invalides' };

    const isAvailable = book.availableCopies > 0;
    const newRes: Reservation = {
      id: `r-${Date.now()}`,
      bookId,
      bookTitle: book.title,
      memberId,
      memberName: `${member.firstName} ${member.lastName}`,
      memberCard: member.cardNumber,
      requestDate: currentDate,
      status: isAvailable ? 'Prêt pour retrait' : 'En attente',
      queuePosition:
        reservations.filter((r) => r.bookId === bookId && (r.status === 'En attente' || r.status === 'Confirmée')).length + 1,
    };

    if (isAvailable && book.copies && book.copies.length > 0) {
      const targetCopy = book.copies.find((c) => c.status === 'Disponible');
      if (targetCopy) {
        newRes.copyId = targetCopy.id;
        setBooks((prev) =>
          prev.map((b) => {
            if (b.id !== book.id || !b.copies) return b;
            const nextCopies = b.copies.map((c) =>
              c.id === targetCopy.id ? { ...c, status: 'Réservé' as BookCopyStatus } : c
            );
            return {
              ...b,
              copies: nextCopies,
              availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
            };
          })
        );
      }
    }

    setReservations((prev) => [newRes, ...prev]);
    logActivity('reservation', `Réservation enregistrée : "${book.title}" pour ${member.firstName} ${member.lastName}`);

    pushNotification({
      targetRole: 'gerant',
      category: 'reservation',
      title: 'Nouvelle réservation enregistrée',
      message: `${member.firstName} ${member.lastName} a réservé « ${book.title} » (rang #${newRes.queuePosition}).`,
      targetTab: 'reservations',
    });

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: member.cne,
      recipientEmail: member.email,
      category: 'reservation',
      title: isAvailable ? 'Livre réservé disponible' : 'Confirmation de réservation',
      message: isAvailable
        ? `Votre réservation pour « ${book.title} » est prête pour retrait au guichet.`
        : `Votre réservation pour « ${book.title} » est enregistrée (rang #${newRes.queuePosition}).`,
      studentSubTab: 'my_reservations',
    });

    showToast({
      type: 'success',
      title: 'Réservation enregistrée',
      description: `Rang #${newRes.queuePosition} pour « ${book.title} ».`,
    });

    return { success: true, message: 'Réservation enregistrée' };
  };

  const releaseReservedCopy = (res: Reservation) => {
    if (!res.copyId) return;
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== res.bookId || !b.copies) return b;
        const nextCopies = b.copies.map((c) =>
          c.id === res.copyId && c.status === 'Réservé'
            ? { ...c, status: 'Disponible' as BookCopyStatus }
            : c
        );
        return {
          ...b,
          copies: nextCopies,
          availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
        };
      })
    );
  };

  const releaseOrReassignReservedCopy = (
    targetRes: Reservation,
    closingStatus: 'Annulée' | 'Refusée',
    closingNotes?: string,
    refusalReason?: string
  ) => {
    const nextInQueue = reservations
      .filter(
        (r) =>
          r.id !== targetRes.id &&
          r.bookId === targetRes.bookId &&
          (r.status === 'En attente' || r.status === 'Confirmée')
      )
      .sort(compareReservationsFifo)[0];

    const hadHeldCopy = targetRes.status === 'Prêt pour retrait' || Boolean(targetRes.copyId);
    const book = books.find((b) => b.id === targetRes.bookId);
    const heldCopy =
      targetRes.copyId && book?.copies
        ? book.copies.find((c) => c.id === targetRes.copyId)
        : undefined;

    if (hadHeldCopy && nextInQueue) {
      const pickupDeadline = addIsoDays(currentDate, RESERVATION_HOLD_DAYS);
      const assignedCopyId = heldCopy?.id || targetRes.copyId;
      const assignedBarcode = heldCopy?.barcode || targetRes.copyBarcode;

      setReservations((prev) =>
        recalculateQueueForBooks(
          prev.map((r) => {
            if (r.id === targetRes.id) {
              return {
                ...r,
                status: closingStatus,
                notes: closingNotes || r.notes,
                ...(refusalReason ? { refusalReason } : {}),
              };
            }
            if (r.id === nextInQueue.id) {
              return {
                ...r,
                status: 'Prêt pour retrait',
                copyId: assignedCopyId,
                copyBarcode: assignedBarcode,
                readyDate: currentDate,
                expiryDate: pickupDeadline,
                expiryReminderSent: false,
                queuePosition: 1,
                notes: 'Exemplaire attribué automatiquement suite à désistement.',
              };
            }
            return r;
          }),
          new Set([targetRes.bookId])
        )
      );

      const nextMember = members.find(
        (m) =>
          m.id === nextInQueue.memberId ||
          m.cne === nextInQueue.memberCard ||
          m.cardNumber === nextInQueue.memberCard
      );
      pushNotification({
        targetRole: 'etudiant',
        recipientCne: nextInQueue.memberCne || nextMember?.cne || nextInQueue.memberCard,
        recipientEmail: nextMember?.email,
        category: 'reservation',
        title: 'Attribution automatique d’un exemplaire !',
        message: `Bonne nouvelle : un exemplaire de « ${nextInQueue.bookTitle} » vient de se libérer et vous a été attribué. Retrait avant le ${pickupDeadline}.`,
        studentSubTab: 'my_reservations',
      });
      pushNotification({
        targetRole: 'gerant',
        category: 'reservation',
        title: 'Exemplaire réattribué automatiquement',
        message: `Suite à la clôture de la réservation de ${targetRes.memberName}, « ${nextInQueue.bookTitle} » a été attribué à ${nextInQueue.memberName}.`,
        targetTab: 'reservations',
      });
      return;
    }

    // No waiting student (or closed reservation didn't hold a copy): free copy if held
    if (targetRes.copyId) {
      releaseReservedCopy(targetRes);
    } else if (hadHeldCopy && book && (!book.copies || book.copies.length === 0)) {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === book.id
            ? { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) }
            : b
        )
      );
    }

    setReservations((prev) =>
      recalculateQueueForBooks(
        prev.map((r) =>
          r.id === targetRes.id
            ? {
                ...r,
                status: closingStatus,
                notes: closingNotes || r.notes,
                ...(refusalReason ? { refusalReason } : {}),
              }
            : r
        ),
        new Set([targetRes.bookId])
      )
    );
  };

  const cancelReservation = (reservationId: string) => {
    if (!authSession.isAuthenticated) {
      showToast({
        type: 'error',
        title: 'Authentification requise',
        description: 'Veuillez vous connecter pour annuler une réservation.',
      });
      return;
    }

    const targetRes = reservations.find((r) => r.id === reservationId);
    if (!targetRes) return;

    const member = members.find(
      (m) => m.id === targetRes.memberId || m.cne === targetRes.memberCard || m.cardNumber === targetRes.memberCard
    );

    if (!isGerant) {
      const studentCne = authSession.student?.cne;
      const isOwner =
        (studentCne && (targetRes.memberCne === studentCne || targetRes.memberCard === studentCne || member?.cne === studentCne)) ||
        (member?.email &&
          authSession.academicEmail &&
          member.email.toLowerCase() === authSession.academicEmail.toLowerCase());
      if (!isOwner) {
        showToast({
          type: 'error',
          title: 'Action non autorisée',
          description: 'Vous ne pouvez annuler que vos propres réservations.',
        });
        return;
      }
    }

    releaseOrReassignReservedCopy(targetRes, 'Annulée', 'Annulée.');

    pushNotification({
      targetRole: 'etudiant',
      recipientCne: targetRes.memberCne || member?.cne || targetRes.memberCard,
      recipientEmail: member?.email,
      category: 'reservation',
      title: 'Réservation annulée',
      message: `La réservation pour « ${targetRes.bookTitle} » a été annulée.`,
      studentSubTab: 'my_reservations',
    });

    showToast({
      type: 'info',
      title: 'Réservation annulée',
      description: 'La file d’attente a été mise à jour automatiquement.',
    });
  };

  const confirmReservation = (reservationId: string) => {
    if (!requireGerant('confirmer une réservation')) return;
    const targetRes = reservations.find((r) => r.id === reservationId);
    if (!targetRes) return;

    const book = books.find((b) => b.id === targetRes.bookId);
    const hasFreeCopy = Boolean(book && book.availableCopies > 0);
    const nextStatus = hasFreeCopy ? 'Prêt pour retrait' : 'Confirmée';
    const pickupDeadline = hasFreeCopy ? addIsoDays(currentDate, RESERVATION_HOLD_DAYS) : targetRes.expiryDate;

    let reservedCopyId = targetRes.copyId;
    let reservedCopyBarcode = targetRes.copyBarcode;
    if (hasFreeCopy && book?.copies) {
      const freeCopy = book.copies.find((c) => c.status === 'Disponible');
      if (freeCopy) {
        reservedCopyId = freeCopy.id;
        reservedCopyBarcode = freeCopy.barcode;
        setBooks((prev) =>
          prev.map((b) => {
            if (b.id !== book.id || !b.copies) return b;
            const nextCopies = b.copies.map((c) =>
              c.id === freeCopy.id ? { ...c, status: 'Réservé' as BookCopyStatus } : c
            );
            return {
              ...b,
              copies: nextCopies,
              availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
            };
          })
        );
      }
    }

    setReservations((prev) =>
      recalculateQueueForBooks(
        prev.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                status: nextStatus,
                copyId: reservedCopyId,
                copyBarcode: reservedCopyBarcode,
                readyDate: hasFreeCopy ? currentDate : r.readyDate,
                expiryDate: pickupDeadline,
                expiryReminderSent: false,
              }
            : r
        ),
        new Set([targetRes.bookId])
      )
    );

    const member = members.find(
      (m) => m.id === targetRes.memberId || m.cne === targetRes.memberCard || m.cardNumber === targetRes.memberCard
    );
    pushNotification({
      targetRole: 'etudiant',
      recipientCne: targetRes.memberCne || member?.cne || targetRes.memberCard,
      recipientEmail: member?.email,
      category: 'reservation',
      title: hasFreeCopy ? 'Exemplaire prêt pour retrait' : 'Réservation confirmée',
      message: hasFreeCopy
        ? `Votre réservation pour « ${targetRes.bookTitle} » est prête pour retrait au guichet EST (avant le ${pickupDeadline}).`
        : `Votre demande pour « ${targetRes.bookTitle} » a été confirmée (rang #${targetRes.queuePosition}).`,
      studentSubTab: 'my_reservations',
    });

    showToast({
      type: 'success',
      title: hasFreeCopy ? 'Exemplaire bloqué pour retrait' : 'Réservation confirmée',
      description: `« ${targetRes.bookTitle} » — ${targetRes.memberName}.`,
    });
  };

  const refuseReservation = (reservationId: string, refusalReason?: string) => {
    if (!requireGerant('refuser une réservation')) return;
    const targetRes = reservations.find((r) => r.id === reservationId);
    if (!targetRes) return;

    const cleanReason = refusalReason?.trim() || 'Refusée lors du contrôle au guichet.';
    releaseOrReassignReservedCopy(targetRes, 'Refusée', cleanReason, cleanReason);

    const member = members.find(
      (m) => m.id === targetRes.memberId || m.cne === targetRes.memberCard || m.cardNumber === targetRes.memberCard
    );
    pushNotification({
      targetRole: 'etudiant',
      recipientCne: targetRes.memberCne || member?.cne || targetRes.memberCard,
      recipientEmail: member?.email,
      category: 'reservation',
      title: 'Réservation refusée',
      message: `Votre demande pour « ${targetRes.bookTitle} » a été refusée. Motif : ${cleanReason}`,
      studentSubTab: 'my_reservations',
    });

    showToast({
      type: 'warning',
      title: 'Réservation refusée',
      description: `Demande de ${targetRes.memberName} refusée avec motif enregistré.`,
    });
  };

  const fulfillReservation = async (reservationId: string) => {
    if (!requireGerant('transformer une réservation en prêt')) {
      return { success: false, message: 'Action réservée au Gérant.' };
    }
    const res = reservations.find((r) => r.id === reservationId);
    if (!res) return { success: false, message: 'Réservation introuvable' };

    const member = members.find(
      (m) => m.id === res.memberId || m.cne === res.memberCard || m.cardNumber === res.memberCard
    );
    const identifier = res.memberCne || member?.cne || member?.email || res.memberCard;
    if (!identifier) return { success: false, message: 'Adhérent introuvable' };

    const result = await validateBatchSmartLoan(
      identifier,
      [{ bookId: res.bookId, copyId: res.copyId, reservationId: res.id }],
      21
    );
    return {
      success: result.success,
      message: result.message,
      loan: result.loans?.[0],
    };
  };

  const sendPickupExpiryReminder = (reservationId: string) => {
    const res = reservations.find((r) => r.id === reservationId);
    if (!res || res.status !== 'Prêt pour retrait') return;

    const member = members.find(
      (m) => m.id === res.memberId || m.cne === res.memberCard || m.cardNumber === res.memberCard
    );
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, expiryReminderSent: true } : r))
    );
    pushNotification({
      targetRole: 'etudiant',
      recipientCne: res.memberCne || member?.cne || res.memberCard,
      recipientEmail: member?.email,
      category: 'reservation',
      title: 'Rappel — Délai de retrait bientôt expiré',
      message: `Votre ouvrage réservé « ${res.bookTitle} » vous attend au guichet EST. Date limite de retrait : ${res.expiryDate || currentDate}.`,
      studentSubTab: 'my_reservations',
    });
    showToast({
      type: 'info',
      title: 'Rappel de retrait envoyé',
      description: `Notification transmise à ${res.memberName}.`,
    });
  };

  const processExpiredReservations = (): {
    expiredCount: number;
    reassignedCount: number;
    remindedCount: number;
  } => {
    let workingRes = [...reservations];
    let workingBooks = [...books];
    const touchedBookIds = new Set<string>();
    let expiredCount = 0;
    let reassignedCount = 0;
    let remindedCount = 0;

    // 1. Handle expired 'Prêt pour retrait' reservations
    const expiredReady = workingRes.filter(
      (r) => r.status === 'Prêt pour retrait' && r.expiryDate && r.expiryDate < currentDate
    );

    expiredReady.forEach((expRes) => {
      expiredCount += 1;
      touchedBookIds.add(expRes.bookId);

      const expMember = members.find(
        (m) => m.id === expRes.memberId || m.cne === expRes.memberCard || m.cardNumber === expRes.memberCard
      );

      // Find next FIFO student waiting for the same book
      const nextWaiting = workingRes
        .filter(
          (r) =>
            r.id !== expRes.id &&
            r.bookId === expRes.bookId &&
            (r.status === 'En attente' || r.status === 'Confirmée')
        )
        .sort(compareReservationsFifo)[0];

      const book = workingBooks.find((b) => b.id === expRes.bookId);
      const freedCopy = expRes.copyId
        ? book?.copies?.find((c) => c.id === expRes.copyId)
        : undefined;

      if (nextWaiting) {
        reassignedCount += 1;
        const newDeadline = addIsoDays(currentDate, RESERVATION_HOLD_DAYS);

        workingRes = workingRes.map((r) => {
          if (r.id === expRes.id) {
            return {
              ...r,
              status: 'Expirée',
              notes: `Expirée le ${expRes.expiryDate} — exemplaire réattribué à ${nextWaiting.memberName}.`,
            };
          }
          if (r.id === nextWaiting.id) {
            return {
              ...r,
              status: 'Prêt pour retrait',
              copyId: freedCopy?.id || expRes.copyId,
              copyBarcode: freedCopy?.barcode || expRes.copyBarcode,
              readyDate: currentDate,
              expiryDate: newDeadline,
              expiryReminderSent: false,
              queuePosition: 1,
              notes: 'Attribution automatique après expiration de la réservation précédente.',
            };
          }
          return r;
        });

        const nextMember = members.find(
          (m) => m.id === nextWaiting.memberId || m.cne === nextWaiting.memberCard || m.cardNumber === nextWaiting.memberCard
        );

        pushNotification({
          targetRole: 'etudiant',
          recipientCne: nextWaiting.memberCne || nextMember?.cne || nextWaiting.memberCard,
          recipientEmail: nextMember?.email,
          category: 'reservation',
          title: 'Attribution automatique d’un exemplaire !',
          message: `Bonne nouvelle : « ${nextWaiting.bookTitle} » vient de se libérer et vous a été attribué automatiquement. Retrait au guichet avant le ${newDeadline}.`,
          studentSubTab: 'my_reservations',
        });

        pushNotification({
          targetRole: 'gerant',
          category: 'reservation',
          title: 'Expiration & réattribution automatique',
          message: `Réservation expirée de ${expRes.memberName} pour « ${expRes.bookTitle} » ; exemplaire réattribué à ${nextWaiting.memberName}.`,
          targetTab: 'reservations',
        });
      } else {
        // Free the copy back to Disponible
        workingRes = workingRes.map((r) =>
          r.id === expRes.id
            ? {
                ...r,
                status: 'Expirée',
                notes: `Délai de retrait dépassé (${expRes.expiryDate}) — exemplaire remis en rayon.`,
              }
            : r
        );

        if (book) {
          workingBooks = workingBooks.map((b) => {
            if (b.id !== book.id) return b;
            if (b.copies && b.copies.length > 0 && expRes.copyId) {
              const nextCopies = b.copies.map((c) =>
                c.id === expRes.copyId && c.status === 'Réservé'
                  ? { ...c, status: 'Disponible' as BookCopyStatus }
                  : c
              );
              return {
                ...b,
                copies: nextCopies,
                availableCopies: nextCopies.filter((c) => c.status === 'Disponible').length,
              };
            }
            return { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) };
          });
        }

        pushNotification({
          targetRole: 'gerant',
          category: 'reservation',
          title: 'Réservation expirée — Exemplaire libéré',
          message: `La réservation de ${expRes.memberName} pour « ${expRes.bookTitle} » a expiré ; l’exemplaire est remis disponible.`,
          targetTab: 'reservations',
        });
      }

      pushNotification({
        targetRole: 'etudiant',
        recipientCne: expRes.memberCne || expMember?.cne || expRes.memberCard,
        recipientEmail: expMember?.email,
        category: 'reservation',
        title: 'Réservation expirée',
        message: `Le délai de retrait de « ${expRes.bookTitle} » (limite : ${expRes.expiryDate}) est dépassé. Votre réservation a expiré.`,
        studentSubTab: 'my_reservations',
      });
    });

    // 2. Send pre-expiry reminder for ready reservations expiring today or tomorrow (0..1 day)
    workingRes = workingRes.map((r) => {
      if (r.status !== 'Prêt pour retrait' || !r.expiryDate || r.expiryReminderSent) return r;
      const daysLeft = getDaysDifference(currentDate, r.expiryDate);
      if (daysLeft >= 0 && daysLeft <= 1) {
        remindedCount += 1;
        const member = members.find(
          (m) => m.id === r.memberId || m.cne === r.memberCard || m.cardNumber === r.memberCard
        );
        pushNotification({
          targetRole: 'etudiant',
          recipientCne: r.memberCne || member?.cne || r.memberCard,
          recipientEmail: member?.email,
          category: 'reservation',
          title: 'Rappel — Retrait avant expiration',
          message:
            daysLeft === 0
              ? `Dernier jour pour retirer « ${r.bookTitle} » au guichet EST (expiration ce soir : ${r.expiryDate}).`
              : `Rappel : votre ouvrage réservé « ${r.bookTitle} » expire demain (${r.expiryDate}). Pensez à le retirer au guichet.`,
          studentSubTab: 'my_reservations',
        });
        return { ...r, expiryReminderSent: true };
      }
      return r;
    });

    if (expiredCount > 0 || remindedCount > 0) {
      if (touchedBookIds.size > 0) {
        workingRes = recalculateQueueForBooks(workingRes, touchedBookIds);
      }
      setBooks(workingBooks);
      setReservations(workingRes);
    }

    return { expiredCount, reassignedCount, remindedCount };
  };

  // Run automatic reservation expiration & reminder check once on mount / date change
  const lastMaintenanceDateRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (lastMaintenanceDateRef.current === currentDate) return;
    lastMaintenanceDateRef.current = currentDate;
    processExpiredReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  // Utilities
  const resetToDefault = () => {
    if (!requireGerant('réinitialiser les données de démonstration')) return;
    localStorage.removeItem(STORAGE_KEYS.BOOKS);
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.LOANS);
    localStorage.removeItem(STORAGE_KEYS.RESERVATIONS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.REMINDER_HISTORY);

    const fresh = getEnrichedDemoDataset();
    AcademicRegistryService.reset();
    setBooks(fresh.books);
    setMembers(fresh.members);
    setLoans(fresh.loans);
    setReservations(fresh.reservations);
    setActivities(fresh.activities);
    setNotifications(fresh.notifications);
    setReminderHistory(fresh.reminderHistory);

    showToast({
      type: 'info',
      title: 'Système réinitialisé',
      description: 'L’ensemble du jeu de données enrichi EST Fès a été restauré.',
    });
  };

  const exportCatalogCSV = () => {
    const headers = ['ID', 'ISBN', 'Titre', 'Auteur', 'Filiere/Rayon', 'Editeur', 'Annee', 'Cote EST', 'Total', 'Dispo'];
    const rows = books.map((b) => [
      b.id,
      b.isbn,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.author.replace(/"/g, '""')}"`,
      `"${b.category}"`,
      `"${b.publisher}"`,
      b.year,
      `"${b.shelfLocation}"`,
      b.totalCopies,
      b.availableCopies,
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogue_est_usmba_${currentDate}.csv`;
    a.click();
  };

  const exportLoansCSV = () => {
    const headers = ['ID Pret', 'Exemplaire', 'Ouvrage', 'ISBN', 'Etudiant', 'CNE', 'Apogee', 'Filiere', 'Date Pret', 'Echeance', 'Statut'];
    const rows = loans.map((l) => [
      l.id,
      l.copyBarcode || 'EST-EX',
      `"${l.bookTitle.replace(/"/g, '""')}"`,
      l.bookIsbn,
      `"${l.memberName}"`,
      l.memberCne,
      l.memberApogee,
      `"${l.memberDepartment || ''}"`,
      l.borrowDate,
      l.dueDate,
      l.status,
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prets_est_usmba_${currentDate}.csv`;
    a.click();
  };

  return (
    <LibraryContext.Provider
      value={{
        books,
        members,
        loans,
        reservations,
        activities,
        currentDate,
        toasts,
        dismissToast,
        showToast,
        isGerant,
        authSession,
        studentRegistry,
        loginWithAcademicEmail,
        loginWithGoogle,
        loginAsLibrarian,
        switchRoleDemo,
        reserveBookForCurrentStudent,
        reserveMultipleBooksForCurrentStudent,
        logout,
        syncWithESTRegistry,
        updateStudentRegistrationStatus,
        addNewStudentToRegistry,
        addBookFromSearch,
        addBook,
        updateBook,
        deleteBook,
        updateCopyStatus,
        addMember,
        updateMember,
        deleteMember,
        validateSmartLoan,
        validateBatchSmartLoan,
        createLoan,
        returnLoan,
        extendLoan,
        sendReminder,
        sendStudentReminder,
        getOverdueStudentsSummary,
        sendCollectiveReminders,
        reminderHistory,
        notifications,
        currentUserNotifications,
        unreadNotificationCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        createReservation,
        cancelReservation,
        confirmReservation,
        refuseReservation,
        fulfillReservation,
        processExpiredReservations,
        sendPickupExpiryReminder,
        resetToDefault,
        exportCatalogCSV,
        exportLoansCSV,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
};
