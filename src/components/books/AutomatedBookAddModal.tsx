import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { ExternalBookResult, searchBooksAutomatically } from '../../services/bookSearchService';
import { BookCategory } from '../../types/library';
import { 
  X, 
  Search, 
  BookOpen, 
  Loader2, 
  Globe, 
  QrCode, 
  Plus
} from 'lucide-react';

interface AutomatedBookAddModalProps {
  onClose: () => void;
}

export const AutomatedBookAddModal: React.FC<AutomatedBookAddModalProps> = ({ onClose }) => {
  const { addBookFromSearch } = useLibrary();

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ExternalBookResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState<ExternalBookResult | null>(null);
  const [copiesCount, setCopiesCount] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    setSelectedBook(null);

    try {
      const data = await searchBooksAutomatically(query);
      setResults(data);
      if (data.length > 0) {
        setSelectedBook(data[0]); // auto-select first result for preview
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSuggestion = async (title: string) => {
    setQuery(title);
    setIsLoading(true);
    setHasSearched(true);
    setSelectedBook(null);
    try {
      const data = await searchBooksAutomatically(title);
      setResults(data);
      if (data.length > 0) setSelectedBook(data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAdd = async () => {
    if (!selectedBook) return;
    setIsSubmitting(true);

    try {
      await addBookFromSearch({
        title: selectedBook.title,
        author: selectedBook.authors.join(', '),
        isbn: selectedBook.isbn,
        category: selectedBook.category,
        publisher: selectedBook.publisher,
        year: selectedBook.publishedYear,
        shelfLocation: selectedBook.suggestedShelf,
        summary: selectedBook.description,
        coverImage: selectedBook.coverImage,
        totalCopies: copiesCount,
        availableCopies: copiesCount,
        condition: 'Neuf',
        pages: selectedBook.pageCount,
        language: selectedBook.language,
        googleBooksId: selectedBook.googleId,
      });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Ajout Automatisé de Livre (Google Books & API)
              </h2>
              <p className="text-xs text-slate-500">
                Saisissez uniquement le nom ou titre du livre : les métadonnées et le QR code sont extraits automatiquement.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Search Input (Title only) */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Nom ou titre de l'ouvrage à rechercher en ligne :
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ex. Clean Code, Algorithmique Cormen, Deep Learning, Réseaux Tanenbaum..."
                  className="w-full text-xs sm:text-sm pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors flex items-center justify-center gap-1.5 shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Recherche API...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    <span>Rechercher en ligne</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Suggestions for EST Curriculum */}
            <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500 flex-wrap">
              <span className="text-[11px] text-slate-400">Exemples fréquents EST :</span>
              {['Clean Code', 'Algorithmique Cormen', 'Réseaux Tanenbaum', 'Deep Learning Python', 'Management Barabel'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleQuickSuggestion(s)}
                  className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </form>

          {/* Results split view */}
          {isLoading && (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-800" />
              <p className="text-xs">Interrogation de l'API Google Books et extraction des métadonnées...</p>
            </div>
          )}

          {!isLoading && hasSearched && results.length === 0 && (
            <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">Aucun résultat trouvé pour « {query} »</p>
              <p className="text-xs text-slate-400 mt-1">Vérifiez l'orthographe du titre ou essayez un mot-clé plus générique.</p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Results List (Left 5 Cols) */}
              <div className="md:col-span-5 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                <span className="text-[11px] font-medium text-slate-500 block mb-1">
                  {results.length} résultats trouvés via l’API :
                </span>
                {results.map((r) => {
                  const isSelected = selectedBook?.googleId === r.googleId;
                  return (
                    <div
                      key={r.googleId}
                      onClick={() => setSelectedBook(r)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors flex gap-3 ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-900'
                      }`}
                    >
                      <div className="w-11 h-16 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {r.coverImage ? (
                          <img
                            src={r.coverImage}
                            alt={r.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800 text-slate-200 flex items-center justify-center p-1 text-[8px] text-center">
                            LIVRE
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-semibold line-clamp-2 leading-snug">
                            {r.title}
                          </h4>
                          <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {r.authors.join(', ')}
                          </p>
                        </div>
                        <div className={`text-[10px] flex items-center justify-between tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                          <span>{r.publishedYear}</span>
                          <span className="font-mono">{r.isbn}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Book Preview & Confirmation (Right 7 Cols) */}
              {selectedBook && (
                <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-28 rounded-md bg-white border border-slate-200 overflow-hidden shrink-0">
                        {selectedBook.coverImage ? (
                          <img
                            src={selectedBook.coverImage}
                            alt={selectedBook.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-900 text-slate-100 flex items-center justify-center p-2 text-center text-[10px]">
                            {selectedBook.title}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {selectedBook.category}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900 mt-1.5 leading-snug">
                          {selectedBook.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Par <strong>{selectedBook.authors.join(', ')}</strong>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Éditeur : {selectedBook.publisher} ({selectedBook.publishedYear})
                        </p>
                      </div>
                    </div>

                    {/* Metadata pills / table extracted automatically */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[10px]">ISBN (Extrait auto)</span>
                        <span className="font-code font-semibold text-slate-800 text-[11px]">{selectedBook.isbn}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Cote EST générée</span>
                        <span className="font-code font-bold text-indigo-700 text-[11px]">{selectedBook.suggestedShelf}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Pagination</span>
                        <span className="font-semibold text-slate-800 text-[11px]">{selectedBook.pageCount} pages</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Langue</span>
                        <span className="font-semibold text-slate-800 text-[11px]">{selectedBook.language}</span>
                      </div>
                    </div>

                    {/* Auto-extracted summary */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Résumé extrait automatiquement :
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 line-clamp-3">
                        {selectedBook.description}
                      </p>
                    </div>

                    {/* Copies & QR Notice */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-2 text-xs">
                        <label className="font-semibold text-slate-700">Nombre d'exemplaires :</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={copiesCount}
                          onChange={(e) => setCopiesCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-16 text-center text-xs p-1.5 bg-white border border-slate-300 rounded-md font-semibold"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Code unique généré</span>
                      </div>
                    </div>
                  </div>

                    {/* Submit CTA */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAdd}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter au catalogue EST Fès</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
