import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book } from '../../types/library';
import { BookDetailModal } from './BookDetailModal';
import { BookFormModal } from './BookFormModal';
import { AutomatedBookAddModal } from './AutomatedBookAddModal';
import { BookCover } from '../common/BookCover';
import { Pagination } from '../common/Pagination';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  BookOpen,
  RotateCcw,
  Bookmark,
  X,
  ArrowUpDown,
} from 'lucide-react';

interface BookCatalogViewProps {
  onBorrowBook?: (book: Book) => void;
  selectedBookId?: string | null;
  onClearSelectedBook?: () => void;
  onRequireLogin?: (book?: Book) => void;
}

type SortOption = 'default' | 'title_asc' | 'year_desc' | 'availability_desc';

export const BookCatalogView: React.FC<BookCatalogViewProps> = ({
  onBorrowBook,
  selectedBookId,
  onClearSelectedBook,
  onRequireLogin,
}) => {
  const {
    books,
    isGerant,
    authSession,
    addBook,
    updateBook,
    reserveBookForCurrentStudent,
  } = useLibrary();

  const isStudent = authSession.isAuthenticated && authSession.role === 'etudiant';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'borrowed'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'grid' ? 24 : 20;

  const [activeDetailBook, setActiveDetailBook] = useState<Book | null>(() => {
    if (selectedBookId) {
      return books.find((b) => b.id === selectedBookId) || null;
    }
    return null;
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  useEffect(() => {
    if (selectedBookId) {
      const match = books.find((b) => b.id === selectedBookId);
      if (match) setActiveDetailBook(match);
    }
  }, [selectedBookId, books]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = books.filter((b) => {
      const matchSearch =
        q === '' ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.shelfLocation.toLowerCase().includes(q) ||
        b.publisher.toLowerCase().includes(q);

      const matchCategory = selectedCategory === 'all' || b.category === selectedCategory;

      const matchAvail =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && b.availableCopies > 0) ||
        (availabilityFilter === 'borrowed' && b.availableCopies === 0);

      return matchSearch && matchCategory && matchAvail;
    });

    if (sortBy === 'title_asc') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    }
    if (sortBy === 'year_desc') {
      return [...list].sort((a, b) => b.year - a.year);
    }
    if (sortBy === 'availability_desc') {
      return [...list].sort((a, b) => b.availableCopies - a.availableCopies);
    }
    return list;
  }, [books, searchQuery, selectedCategory, availabilityFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, availabilityFilter, sortBy, viewMode]);

  const paginatedBooks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBooks.slice(start, start + pageSize);
  }, [filteredBooks, currentPage, pageSize]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => set.add(b.category));
    return Array.from(set);
  }, [books]);

  const totalPhysicalCopies = useMemo(
    () => books.reduce((acc, b) => acc + b.totalCopies, 0),
    [books]
  );

  const totalAvailableCopies = useMemo(
    () => books.reduce((acc, b) => acc + b.availableCopies, 0),
    [books]
  );

  const handleEditBook = (book: Book) => {
    if (!isGerant) return;
    setActiveDetailBook(null);
    setEditingBook(book);
  };

  const handleSaveBook = (bookData: Omit<Book, 'id'>) => {
    if (!isGerant) return;
    if (editingBook) {
      updateBook(editingBook.id, bookData);
      setEditingBook(null);
    } else {
      addBook(bookData);
      setIsAddModalOpen(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Editorial Catalog Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Catalogue & Fonds Documentaire
          </h1>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            <span className="font-semibold text-slate-800">{books.length}</span> notices bibliographiques ·{' '}
            <span className="font-semibold text-slate-800">{totalPhysicalCopies}</span> exemplaires physiques ·{' '}
            <span className="text-emerald-700 font-medium">{totalAvailableCopies} disponibles en rayon</span>
          </p>
        </div>

        {/* Strict Permission Guard: "Ajouter un livre" ONLY visible to Gérant */}
        {isGerant && (
          <button
            type="button"
            onClick={() => {
              setEditingBook(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un livre</span>
          </button>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, auteur, éditeur, cote EST ou ISBN..."
              className="w-full text-xs pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-slate-400 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Effacer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Availability segmented control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setAvailabilityFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
                availabilityFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({books.length})
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('available')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                availabilityFilter === 'available'
                  ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Disponibles
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('borrowed')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                availabilityFilter === 'borrowed'
                  ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous empruntés
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 text-slate-700 focus:outline-none focus:bg-white focus:border-slate-400"
              aria-label="Trier par"
            >
              <option value="default">Ordre du fonds</option>
              <option value="title_asc">Titre (A–Z)</option>
              <option value="year_desc">Édition la plus récente</option>
              <option value="availability_desc">Exemplaires disponibles</option>
            </select>
          </div>

          {/* Grid / Table toggle */}
          <div className="hidden sm:flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Vue en grille"
              aria-label="Vue en grille"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Vue en tableau"
              aria-label="Vue en tableau"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white font-medium'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous les rayons
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="text-xs text-slate-500 flex items-center justify-between">
        <span className="tabular-nums">
          {filteredBooks.length} ouvrage{filteredBooks.length > 1 ? 's' : ''} correspondant{filteredBooks.length > 1 ? 's' : ''}
        </span>
        {(searchQuery || selectedCategory !== 'all' || availabilityFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setAvailabilityFilter('all');
            }}
            className="text-indigo-700 hover:underline font-medium"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Content */}
      {filteredBooks.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200 p-6">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-800">Aucun ouvrage correspondant</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isGerant
              ? 'Modifiez vos critères de recherche ou ajoutez une nouvelle notice au catalogue.'
              : 'Modifiez vos critères de recherche pour explorer le fonds documentaire.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedBooks.map((book) => {
            const isAvail = book.availableCopies > 0;
            return (
              <div
                key={book.id}
                onClick={() => setActiveDetailBook(book)}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-150 flex flex-col justify-between overflow-hidden cursor-pointer group"
              >
                <div>
                  <div className="h-48 bg-slate-100 overflow-hidden relative border-b border-slate-200">
                    <BookCover
                      title={book.title}
                      author={book.author}
                      category={book.category}
                      shelfLocation={book.shelfLocation}
                      coverImage={book.coverImage}
                      className="w-full h-full"
                    />
                  </div>

                  <div className="p-4 space-y-1.5">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                      <span className="truncate font-medium text-amber-800">{book.category}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-code text-slate-600">{book.shelfLocation}</span>
                    </div>

                    <h3 className="font-serif-display text-[15px] font-semibold text-slate-900 group-hover:text-indigo-800 transition-colors line-clamp-2 leading-snug">
                      {book.title}
                    </h3>

                    <p className="text-xs text-slate-600 truncate">
                      {book.author} · <span className="font-code">{book.year}</span>
                    </p>

                    <p className="text-[11px] text-slate-500 line-clamp-2 pt-0.5 leading-relaxed">
                      {book.summary}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-[#fafaf8] border-t border-slate-200 flex items-center justify-between text-xs">
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      isAvail ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {isAvail
                      ? `${book.availableCopies}/${book.totalCopies} disponible${book.availableCopies > 1 ? 's' : ''}`
                      : 'Indisponible'}
                  </span>

                  {isGerant ? (
                    isAvail && onBorrowBook ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBorrowBook(book);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500" />
                        <span>Prêter</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDetailBook(book);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors flex items-center gap-1"
                      >
                        <Bookmark className="w-3 h-3 text-amber-700" />
                        <span>Réserver</span>
                      </button>
                    )
                  ) : isStudent ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        reserveBookForCurrentStudent(book.id);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
                    >
                      <Bookmark className="w-3 h-3" />
                      <span>{isAvail ? 'Réserver' : 'File'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRequireLogin) onRequireLogin(book);
                        else setActiveDetailBook(book);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
                    >
                      <Bookmark className="w-3 h-3" />
                      <span>{isAvail ? 'Réserver' : 'File'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Ouvrage & Auteur</th>
                  <th className="py-2.5 px-4">Cote</th>
                  <th className="py-2.5 px-4">Rayon</th>
                  <th className="py-2.5 px-4">ISBN</th>
                  <th className="py-2.5 px-4 text-right">Disponibilité</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedBooks.map((book) => (
                  <tr
                    key={book.id}
                    onClick={() => setActiveDetailBook(book)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-11 rounded overflow-hidden border border-slate-200 shrink-0">
                          <BookCover
                            title={book.title}
                            author={book.author}
                            category={book.category}
                            coverImage={book.coverImage}
                            compact
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate max-w-xs">
                            {book.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {book.author} · <span className="font-code">{book.year}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-code text-[11px] font-medium text-slate-800 whitespace-nowrap">
                      {book.shelfLocation}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{book.category}</td>
                    <td className="py-2.5 px-4 font-code text-[11px] text-slate-500 whitespace-nowrap">
                      {book.isbn}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          book.availableCopies > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {book.availableCopies} / {book.totalCopies}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {isGerant ? (
                        book.availableCopies > 0 && onBorrowBook ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onBorrowBook(book);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                            Prêter
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDetailBook(book);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded transition-colors"
                          >
                            Réserver
                          </button>
                        )
                      ) : isStudent ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            reserveBookForCurrentStudent(book.id);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                        >
                          Réserver
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onRequireLogin) onRequireLogin(book);
                            else setActiveDetailBook(book);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                        >
                          {book.availableCopies > 0 ? 'Réserver' : 'File'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredBooks.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        itemLabel="ouvrages"
      />

      {activeDetailBook && (
        <BookDetailModal
          book={activeDetailBook}
          onClose={() => {
            setActiveDetailBook(null);
            if (onClearSelectedBook) onClearSelectedBook();
          }}
          onEdit={isGerant ? handleEditBook : undefined}
          onBorrow={
            isGerant && onBorrowBook
              ? (b) => {
                  setActiveDetailBook(null);
                  onBorrowBook(b);
                }
              : undefined
          }
          onRequireLogin={
            !authSession.isAuthenticated && onRequireLogin
              ? (b) => {
                  setActiveDetailBook(null);
                  onRequireLogin(b);
                }
              : undefined
          }
        />
      )}

      {/* Gérant-only Modals */}
      {isGerant && isAddModalOpen && (
        <AutomatedBookAddModal onClose={() => setIsAddModalOpen(false)} />
      )}

      {isGerant && editingBook && (
        <BookFormModal
          initialBook={editingBook}
          onClose={() => setEditingBook(null)}
          onSubmit={handleSaveBook}
        />
      )}
    </div>
  );
};
