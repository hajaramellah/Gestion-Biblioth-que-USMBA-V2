export type BookCategory =
  | 'Informatique & Réseaux'
  | 'Génie Électrique & Électronique'
  | 'Génie Industriel & Mécanique'
  | 'Management & Économie'
  | 'Mathématiques & Algorithmique'
  | 'Sciences & Physique'
  | 'Littérature & Langues'
  | 'Général & Divers';

export type BookCondition = 'Neuf' | 'Très bon' | 'Bon état' | 'Usagé';

export type BookCopyStatus =
  | 'Disponible'
  | 'Emprunté'
  | 'Réservé'
  | 'En maintenance'
  | 'Perdu';

export interface BookCopy {
  id: string;
  barcode: string;
  bookId: string;
  status: BookCopyStatus;
  condition: BookCondition;
  acquiredDate?: string;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  category: BookCategory;
  publisher: string;
  year: number;
  shelfLocation: string; // Cote EST-USMBA (ex: "EST-GI-042")
  summary: string;
  coverImage?: string;
  totalCopies: number;
  availableCopies: number;
  copies?: BookCopy[]; // Exemplaires physiques détaillés
  condition: BookCondition;
  pages?: number;
  language: string;
  qrCodeDataUrl?: string; // Generated unique QR code for the book
  googleBooksId?: string;
  addedDate?: string;
  isDemo?: boolean;
}

export type ESTDepartment =
  | 'Génie Informatique (GI)'
  | 'Génie Électrique (GE)'
  | 'Génie Industriel et Maintenance (GIM)'
  | 'Techniques de Management (TM)'
  | 'Réseaux & Télécommunications (RT)'
  | 'Bio-analyses et Qualité (BQ)';

export type RegistrationStatus = 'Inscrit' | 'Radié' | 'Suspendu' | 'Diplômé';

export interface StudentRegistration {
  id: string;
  cne: string; // Code National de l'Étudiant / Massar
  apogee: string; // Numéro Apogée EST Fès
  firstName: string;
  lastName: string;
  academicEmail: string; // format: nom.prenom@usmba.ac.ma
  department: ESTDepartment;
  studyYear: string; // e.g. "DUT 1ère année", "DUT 2ème année", "Licence Professionnelle"
  registrationStatus: RegistrationStatus;
  phone: string;
  registrationDate: string;
  photoUrl?: string;
  qrCodeDataUrl?: string; // QR code containing student identity verification
  isDemo?: boolean;
}

export type MemberType = 'Étudiant EST' | 'Enseignant-Chercheur' | 'Personnel Administratif';

export interface Member {
  id: string;
  cardNumber: string; // Ex: "EST-2026-084"
  cne: string;
  apogee: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: ESTDepartment;
  studyYear?: string;
  memberType: MemberType;
  status: 'Actif' | 'Suspendu' | 'Radié';
  joinDate: string;
  expiryDate: string;
  maxAllowedLoans: number;
  notes?: string;
  qrCodeDataUrl?: string;
  isDemo?: boolean;
}

export type LoanStatus = 'En cours' | 'Rendu' | 'En retard';

export interface Loan {
  id: string;
  bookId: string;
  copyId?: string;
  copyBarcode?: string;
  bookTitle: string;
  bookIsbn: string;
  bookShelfLocation?: string;
  bookCategory?: BookCategory;
  memberId: string;
  memberName: string;
  memberCard: string;
  memberCne: string;
  memberApogee: string;
  memberDepartment?: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  status: LoanStatus;
  extensionsCount: number;
  remindersSent: number;
  lateFee: number;
  loanQrCodeDataUrl?: string; // Generated transaction receipt QR code
  loanReceiptHash?: string;
  lastReminderDate?: string; // YYYY-MM-DD of last reminder sent to avoid redundant reminders
  isDemo?: boolean;
}

export type ReservationStatus =
  | 'En attente'
  | 'Confirmée'
  | 'Prêt pour retrait'
  | 'Refusée'
  | 'Annulée'
  | 'Expirée'
  | 'Honorée';

export interface Reservation {
  id: string;
  bookId: string;
  bookTitle: string;
  copyId?: string;
  copyBarcode?: string;
  memberId: string;
  memberName: string;
  memberCard: string;
  memberCne?: string;
  requestDate: string;
  readyDate?: string;
  expiryDate?: string;
  expiryReminderSent?: boolean;
  createdAt?: string;
  batchId?: string;
  status: ReservationStatus;
  queuePosition: number;
  notes?: string;
  refusalReason?: string;
  isDemo?: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'loan' | 'return' | 'renew' | 'member' | 'book' | 'reservation' | 'reminder' | 'sync';
  description: string;
  user: string;
}

export type NotificationCategory =
  | 'loan'
  | 'return'
  | 'overdue'
  | 'reservation'
  | 'reminder'
  | 'renewal';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string; // Formatted French date & time
  isoTimestamp: string;
  isRead: boolean;
  targetRole: 'gerant' | 'etudiant';
  recipientEmail?: string;
  recipientCne?: string;
  category: NotificationCategory;
  targetTab?: string;
  studentSubTab?: string;
}

export interface ReminderHistoryEntry {
  id: string;
  date: string;
  time: string;
  isoTimestamp: string;
  studentName: string;
  studentCne: string;
  studentEmail: string;
  bookTitles: string[];
  overdueCount: number;
  mode: 'collective' | 'individuelle';
  status: 'Envoyée' | 'Échec' | 'Ignorée (déjà relancé)';
  errorReason?: string;
}

export type UserRole = 'gerant' | 'etudiant';

export interface AuthSession {
  isAuthenticated: boolean;
  userType: 'student' | 'librarian' | null;
  role?: UserRole; // 'gerant' (gestionnaire) or 'etudiant' (consultation)
  student?: StudentRegistration;
  librarianName?: string;
  userTitle?: string;
  department?: string;
  academicEmail?: string;
  photoUrl?: string;
  authProvider?: 'google' | 'academic';
}
