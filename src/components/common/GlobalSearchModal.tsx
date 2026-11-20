import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Search, X, BookOpen, Users, RotateCcw } from 'lucide-react';
import { ActiveTab } from '../layout/Navbar';

interface GlobalSearchModalProps {
  onClose: () => void;
  onSelectBook: (bookId: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  onClose,
  onSelectBook,
  onNavigateTab,
}) => {
  const { books, members, loans, isGerant } = useLibrary();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const q = query.toLowerCase().trim();

  const matchingBooks = q
    ? books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q) ||
          b.shelfLocation.toLowerCase().includes(q)
      )
    : [];

  const matchingMembers =
    isGerant && q
      ? members.filter(
          (m) =>
            m.firstName.toLowerCase().includes(q) ||
            m.lastName.toLowerCase().includes(q) ||
            m.cardNumber.toLowerCase().includes(q) ||
            (m.cne && m.cne.toLowerCase().includes(q)) ||
            m.email.toLowerCase().includes(q)
        )
      : [];

  const matchingLoans =
    isGerant && q
      ? loans.filter(
          (l) =>
            l.bookTitle.toLowerCase().includes(q) ||
            l.memberName.toLowerCase().includes(q) ||
            l.memberCard.toLowerCase().includes(q) ||
            l.memberCne.toLowerCase().includes(q)
        )
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 p-4 bg-slate-900/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isGerant
                ? 'Recherche globale : livre, auteur, adhérent, CNE, cote...'
                : 'Rechercher un ouvrage : titre, auteur, cote, ISBN...'
            }
            className="w-full text-sm outline-none placeholder:text-slate-400 text-slate-900"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!q && (
            <div className="py-8 text-center text-xs text-slate-400">
              Tapez au moins un caractère pour lancer la recherche instantanée...
            </div>
          )}

          {q && matchingBooks.length === 0 && matchingMembers.length === 0 && matchingLoans.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-500">
              Aucun résultat correspondant à « {query} ».
            </div>
          )}

          {matchingBooks.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-500 px-2 block mb-2 tabular-nums">
                Ouvrages au catalogue ({matchingBooks.length})
              </span>
              <div className="space-y-1">
                {matchingBooks.slice(0, 6).map((book) => (
                  <div
                    key={book.id}
                    onClick={() => {
                      onSelectBook(book.id);
                      if (isGerant) onNavigateTab('catalog');
                      onClose();
                    }}
                    className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {book.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {book.author} · Cote: {book.shelfLocation}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 font-medium tabular-nums">
                      {book.availableCopies} en rayon
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingMembers.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-500 px-2 block mb-2 tabular-nums">
                Adhérents ({matchingMembers.length})
              </span>
              <div className="space-y-1">
                {matchingMembers.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onNavigateTab('members');
                      onClose();
                    }}
                    className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Users className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {m.firstName} {m.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-code">
                          {m.cardNumber} · {m.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {m.memberType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingLoans.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-500 px-2 block mb-2 tabular-nums">
                Emprunts & Circulation ({matchingLoans.length})
              </span>
              <div className="space-y-1">
                {matchingLoans.slice(0, 4).map((l) => (
                  <div
                    key={l.id}
                    onClick={() => {
                      onNavigateTab('loans');
                      onClose();
                    }}
                    className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {l.bookTitle}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {l.memberName} · Échéance: {l.dueDate}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium ${l.status === 'En retard' ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
