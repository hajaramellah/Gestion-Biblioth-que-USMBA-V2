import React, { useState, useEffect } from 'react';
import { Book, BookCopyStatus } from '../../types/library';
import { useLibrary } from '../../context/LibraryContext';
import { BookCover } from '../common/BookCover';
import { generateQrDataUrl, buildBookQrPayload } from '../../utils/qrHelper';
import {
  X,
  Trash2,
  Edit3,
  RotateCcw,
  Bookmark,
  AlertCircle,
  Barcode,
  Download,
  BookOpen,
  LogIn,
  CheckCircle2,
} from 'lucide-react';

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onEdit?: (book: Book) => void;
  onBorrow?: (book: Book) => void;
  onRequireLogin?: (book: Book) => void;
  highlightedIntent?: boolean;
}

const COPY_STATUS_STYLES: Record<BookCopyStatus, string> = {
  Disponible: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Emprunté: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  Réservé: 'text-amber-800 bg-amber-50 border-amber-200',
  'En maintenance': 'text-slate-700 bg-slate-100 border-slate-300',
  Perdu: 'text-rose-700 bg-rose-50 border-rose-200',
};

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book: initialBook,
  onClose,
  onEdit,
  onBorrow,
  onRequireLogin,
  highlightedIntent = false,
}) => {
  const {
    books,
    authSession,
    isGerant,
    deleteBook,
    updateCopyStatus,
    reservations,
    members,
    createReservation,
    reserveBookForCurrentStudent,
    loans,
  } = useLibrary();

  // Always reflect latest live state of this book from context
  const book = books.find((b) => b.id === initialBook.id) || initialBook;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedMemberForRes, setSelectedMemberForRes] = useState('');
  const [showResForm, setShowResForm] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>(isGerant ? book.qrCodeDataUrl || '' : '');

  // Strict RBAC: Only generate or load QR Code payloads when authenticated as Gérant
  useEffect(() => {
    if (!isGerant) {
      setQrUrl('');
      return;
    }
    let active = true;
    if (!book.qrCodeDataUrl) {
      generateQrDataUrl(buildBookQrPayload(book)).then((url) => {
        if (active && url) setQrUrl(url);
      });
    } else {
      setQrUrl(book.qrCodeDataUrl);
    }
    return () => {
      active = false;
    };
  }, [book, isGerant]);

  const isStudent = authSession.isAuthenticated && authSession.role === 'etudiant';
  const isVisitor = !authSession.isAuthenticated;

  const bookReservations = reservations.filter(
    (r) =>
      r.bookId === book.id &&
      (r.status === 'En attente' || r.status === 'Confirmée' || r.status === 'Prêt pour retrait')
  );

  const activeLoansForBook = loans.filter((l) => l.bookId === book.id && l.status !== 'Rendu');

  const handleDelete = () => {
    if (!isGerant) return;
    const success = deleteBook(book.id);
    if (success) {
      onClose();
    }
  };

  const handleMakeReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGerant || !selectedMemberForRes) return;
    const res = createReservation(book.id, selectedMemberForRes);
    if (res.success) {
      setShowResForm(false);
      setSelectedMemberForRes('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#fafaf8]">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-800">Notice bibliographique</span>
            <span className="text-slate-300">·</span>
            <span className="font-code text-slate-500 tabular-nums">{book.isbn}</span>
            <span className="text-slate-300">·</span>
            <span className="font-code text-slate-700 font-medium">{book.shelfLocation}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6">
          {isStudent && highlightedIntent && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Connexion confirmée. Vous pouvez finaliser votre demande de réservation pour cet ouvrage ci-dessous.
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Editorial Book Cover */}
            <div className="w-40 sm:w-44 h-60 mx-auto sm:mx-0 rounded-lg shrink-0 overflow-hidden border border-slate-200 shadow-sm">
              <BookCover
                title={book.title}
                author={book.author}
                category={book.category}
                shelfLocation={book.shelfLocation}
                coverImage={book.coverImage}
                className="w-full h-full"
              />
            </div>

            {/* Info & Actions */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <div className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                  <span>{book.category}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{book.language}</span>
                  {book.pages && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500 tabular-nums">{book.pages} pages</span>
                    </>
                  )}
                </div>
                <h2 className="font-serif-display text-xl font-semibold text-slate-900 mt-1.5 leading-snug">
                  {book.title}
                </h2>
                <p className="text-xs font-medium text-slate-600 mt-1">
                  Par <span className="text-slate-900">{book.author}</span>
                </p>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-[#fafaf8] p-3.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Cote de rangement</span>
                  <span className="font-semibold text-slate-900 font-code">{book.shelfLocation}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Éditeur & Année</span>
                  <span className="font-semibold text-slate-900">
                    {book.publisher} ({book.year})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">État de collection</span>
                  <span className="font-semibold text-slate-900">{book.condition}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Disponibilité en rayon</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      book.availableCopies > 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {book.availableCopies} sur {book.totalCopies} exemplaire{book.totalCopies > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* QR Code Block (STRICTLY Gérant only) */}
              {isGerant && qrUrl && (
                <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                  <div className="w-14 h-14 bg-white p-1 rounded border border-slate-200 shrink-0">
                    <img
                      src={qrUrl}
                      alt={`QR Code ${book.title}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <span className="text-[11px] font-semibold text-slate-800 block">
                      Étiquette QR Code EST Fès
                    </span>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-snug">
                      Cote {book.shelfLocation} · Scannable au comptoir de prêt.
                    </p>
                    <a
                      href={qrUrl}
                      download={`qr_livre_${book.isbn}.png`}
                      className="text-[11px] font-semibold text-indigo-700 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Télécharger PNG</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Role-Aware Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {isGerant && (
                  <>
                    {book.availableCopies > 0 && onBorrow ? (
                      <button
                        type="button"
                        onClick={() => onBorrow(book)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Prêter cet ouvrage</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowResForm(true)}
                        className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md transition-colors flex items-center gap-1.5"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-amber-700" />
                        <span>Mettre en réservation</span>
                      </button>
                    )}

                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(book)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Modifier</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  </>
                )}

                {isStudent && (
                  <button
                    type="button"
                    onClick={() => reserveBookForCurrentStudent(book.id)}
                    className={`px-4 py-2 text-xs font-semibold text-white rounded-md transition-colors flex items-center gap-1.5 ${
                      book.availableCopies > 0
                        ? 'bg-slate-900 hover:bg-slate-800'
                        : 'bg-indigo-700 hover:bg-indigo-800'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>
                      {book.availableCopies > 0
                        ? 'Réserver un exemplaire'
                        : 'Rejoindre la file d’attente'}
                    </span>
                  </button>
                )}

                {isVisitor && onRequireLogin && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onRequireLogin(book)}
                      className={`px-4 py-2 text-xs font-semibold text-white rounded-md transition-colors inline-flex items-center gap-1.5 ${
                        book.availableCopies > 0
                          ? 'bg-slate-900 hover:bg-slate-800'
                          : 'bg-indigo-700 hover:bg-indigo-800'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>
                        {book.availableCopies > 0
                          ? 'Réserver cet ouvrage'
                          : 'Rejoindre la file d’attente'}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-500">
                      Authentification académique <span className="font-code">@usmba.ac.ma</span> requise pour réserver.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Reservation Form (Gérant only) */}
          {isGerant && showResForm && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900">
                  Ajouter un adhérent à la file de réservation
                </span>
                <button
                  type="button"
                  onClick={() => setShowResForm(false)}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium"
                >
                  Fermer
                </button>
              </div>
              <form onSubmit={handleMakeReservation} className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedMemberForRes}
                  onChange={(e) => setSelectedMemberForRes(e.target.value)}
                  className="flex-1 text-xs border border-amber-300 rounded-md px-3 py-2 bg-white"
                  required
                >
                  <option value="">Sélectionner un adhérent...</option>
                  {members.slice(0, 120).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.cardNumber} · {m.cne})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                >
                  Confirmer
                </button>
              </form>
            </div>
          )}

          {/* Summary / Synopsis */}
          <div>
            <h3 className="text-xs font-semibold text-slate-900 mb-1.5">
              Résumé & Thématique
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-[#fafaf8] p-3.5 rounded-lg border border-slate-200">
              {book.summary || 'Aucun résumé renseigné pour cet ouvrage.'}
            </p>
          </div>

          {/* Physical Copies Inventory */}
          {book.copies && book.copies.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  {isGerant ? (
                    <Barcode className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Exemplaires physiques ({book.copies.length})</span>
                </h3>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="px-3 py-2">{isGerant ? 'Code-barres' : 'Exemplaire'}</th>
                      <th className="px-3 py-2">État physique</th>
                      <th className="px-3 py-2">Statut en rayon</th>
                      {isGerant && <th className="px-3 py-2 text-right">Gestion</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {book.copies.map((cp, idx) => (
                      <tr key={cp.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-code font-medium text-slate-800 tabular-nums">
                          {isGerant ? cp.barcode : `Exemplaire #${idx + 1}`}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{cp.condition}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${
                              COPY_STATUS_STYLES[cp.status]
                            }`}
                          >
                            {cp.status}
                          </span>
                        </td>
                        {isGerant && (
                          <td className="px-3 py-2 text-right">
                            {cp.status !== 'Emprunté' ? (
                              <select
                                value={cp.status}
                                onChange={(e) =>
                                  updateCopyStatus(book.id, cp.id, e.target.value as BookCopyStatus)
                                }
                                className="text-[11px] border border-slate-200 rounded px-2 py-1 bg-white text-slate-700"
                              >
                                <option value="Disponible">Disponible</option>
                                <option value="Réservé">Réservé</option>
                                <option value="En maintenance">En maintenance</option>
                                <option value="Perdu">Perdu</option>
                              </select>
                            ) : (
                              <span className="text-[11px] text-slate-400">Sorti en prêt</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active loans table for this book (Gérant only for privacy) */}
          {isGerant && activeLoansForBook.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-900 mb-1.5">
                Exemplaires actuellement sortis ({activeLoansForBook.length})
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="px-3 py-2">Adhérent</th>
                      <th className="px-3 py-2">Exemplaire</th>
                      <th className="px-3 py-2">Date d'emprunt</th>
                      <th className="px-3 py-2">Date d'échéance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeLoansForBook.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 font-medium text-slate-800">{l.memberName}</td>
                        <td className="px-3 py-2 font-code text-slate-500">
                          {l.copyBarcode || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-code tabular-nums">
                          {l.borrowDate}
                        </td>
                        <td
                          className={`px-3 py-2 font-semibold font-code tabular-nums ${
                            l.status === 'En retard' ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          {l.dueDate} {l.status === 'En retard' && '(En retard)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reservations Queue */}
          {isGerant && bookReservations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-900 mb-1.5">
                File d'attente des réservations ({bookReservations.length})
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {bookReservations.map((r) => (
                  <div key={r.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-800">
                        Rang #{r.queuePosition} : {r.memberName}
                      </span>
                      <span className="text-slate-400 ml-2 tabular-nums">
                        demandé le {r.requestDate}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        r.status === 'Prêt pour retrait'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete confirmation dialog (Gérant only) */}
          {isGerant && showDeleteConfirm && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Confirmer le désherbage / retrait définitif de cet ouvrage ?</span>
              </div>
              <p className="text-xs text-rose-700">
                Cette action supprimera la notice du catalogue Athenaeum.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors"
                >
                  Oui, supprimer la notice
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
