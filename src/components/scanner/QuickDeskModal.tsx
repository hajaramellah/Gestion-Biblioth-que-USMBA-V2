import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book, Member } from '../../types/library';
import { 
  X, 
  RotateCcw, 
  ScanLine, 
  CheckCircle2, 
  UserCheck, 
  BookOpen, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface QuickDeskModalProps {
  initialBook?: Book | null;
  onClose: () => void;
}

export const QuickDeskModal: React.FC<QuickDeskModalProps> = ({
  initialBook,
  onClose,
}) => {
  const { books, members, loans, createLoan, returnLoan } = useLibrary();

  const [mode, setMode] = useState<'borrow' | 'return'>('borrow');

  // Borrow state
  const [selectedBookId, setSelectedBookId] = useState<string>(initialBook?.id || '');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(21);

  // Return state
  const [returnSearch, setReturnSearch] = useState('');

  const activeLoans = loans.filter((l) => l.status !== 'Rendu');

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const selectedBook = books.find((b) => b.id === selectedBookId);

  const memberActiveLoansCount = selectedMember
    ? loans.filter((l) => l.memberId === selectedMember.id && l.status !== 'Rendu').length
    : 0;

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId || !selectedMemberId) return;

    const result = createLoan(selectedBookId, selectedMemberId, durationDays);
    if (result.success) {
      onClose();
    }
  };

  const filteredReturnLoans = activeLoans.filter((l) => {
    if (!returnSearch) return true;
    const q = returnSearch.toLowerCase();
    return (
      l.bookTitle.toLowerCase().includes(q) ||
      l.memberName.toLowerCase().includes(q) ||
      l.bookIsbn.toLowerCase().includes(q) ||
      l.memberCard.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Comptoir d’accueil & Circulation express
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
            <button
              onClick={() => setMode('borrow')}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'borrow'
                  ? 'bg-white text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Enregistrer un prêt
            </button>
            <button
              onClick={() => setMode('return')}
              className={`py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'return'
                  ? 'bg-white text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Enregistrer un retour ({activeLoans.length})
            </button>
          </div>
        </div>

        {/* Borrow Mode Form */}
        {mode === 'borrow' ? (
          <form onSubmit={handleCreateLoan} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1. Sélectionner l'adhérent emprunteur <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Sélectionner un adhérent...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.status === 'Suspendu'}>
                    {m.firstName} {m.lastName} ({m.cardNumber}) — {m.memberType} {m.status === 'Suspendu' ? '[SUSPENDU]' : ''}
                  </option>
                ))}
              </select>

              {selectedMember && (
                <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                  <span className="text-slate-600">
                    Statut: <strong className="text-slate-900">{selectedMember.status}</strong>
                  </span>
                  <span className="text-slate-600 tabular-nums">
                    Prêts actifs: <strong>{memberActiveLoansCount}/{selectedMember.maxAllowedLoans}</strong>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                2. Sélectionner l’ouvrage à emprunter <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Sélectionner un titre du fonds...</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id} disabled={b.availableCopies <= 0}>
                    {b.title} — {b.author} ({b.availableCopies > 0 ? `${b.availableCopies} dispo` : 'ÉPUISÉ'}) [Cote: {b.shelfLocation}]
                  </option>
                ))}
              </select>

              {selectedBook && (
                <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                  <span className="text-slate-600">
                    Cote de rangement: <strong className="font-code text-slate-900">{selectedBook.shelfLocation}</strong>
                  </span>
                  <span className={`font-medium ${selectedBook.availableCopies > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {selectedBook.availableCopies} en rayon
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                3. Durée du prêt
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[14, 21, 28].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDurationDays(days)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                      durationDays === days
                        ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {days} jours
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!selectedBookId || !selectedMemberId || (selectedBook?.availableCopies || 0) <= 0}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Valider l'emprunt</span>
              </button>
            </div>
          </form>
        ) : (
          /* Return Mode */
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scanner ou rechercher le document retourné
              </label>
              <input
                type="text"
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                placeholder="Titre, nom de l'adhérent, code-barres ISBN..."
                className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {filteredReturnLoans.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucun prêt actif trouvé pour cette recherche.
                </div>
              ) : (
                filteredReturnLoans.map((loan) => (
                  <div key={loan.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {loan.bookTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Emprunté par <strong className="text-slate-700">{loan.memberName}</strong> ({loan.memberCard})
                      </div>
                      <div className={`text-[10px] mt-0.5 tabular-nums ${loan.status === 'En retard' ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                        Échéance : {loan.dueDate} {loan.status === 'En retard' && `(Retard - ${loan.lateFee.toFixed(2)} €)`}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        returnLoan(loan.id);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors flex items-center gap-1 shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Valider retour</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
