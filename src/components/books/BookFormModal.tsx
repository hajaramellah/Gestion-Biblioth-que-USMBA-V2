import React, { useState, useEffect } from 'react';
import { Book, BookCategory, BookCondition } from '../../types/library';
import { X, BookPlus, Save } from 'lucide-react';

interface BookFormModalProps {
  initialBook?: Book | null;
  onClose: () => void;
  onSubmit: (data: Omit<Book, 'id'>) => void;
}

const CATEGORIES: BookCategory[] = [
  'Informatique & Réseaux',
  'Génie Électrique & Électronique',
  'Génie Industriel & Mécanique',
  'Management & Économie',
  'Mathématiques & Algorithmique',
  'Sciences & Physique',
  'Littérature & Langues',
  'Général & Divers',
];

const CONDITIONS: BookCondition[] = ['Neuf', 'Très bon', 'Bon état', 'Usagé'];

export const BookFormModal: React.FC<BookFormModalProps> = ({
  initialBook,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState<BookCategory>('Informatique & Réseaux');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState<number>(2024);
  const [shelfLocation, setShelfLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [totalCopies, setTotalCopies] = useState<number>(3);
  const [condition, setCondition] = useState<BookCondition>('Neuf');
  const [pages, setPages] = useState<number>(280);
  const [language, setLanguage] = useState('Français');

  useEffect(() => {
    if (initialBook) {
      setTitle(initialBook.title);
      setAuthor(initialBook.author);
      setIsbn(initialBook.isbn);
      setCategory(initialBook.category);
      setPublisher(initialBook.publisher);
      setYear(initialBook.year);
      setShelfLocation(initialBook.shelfLocation);
      setSummary(initialBook.summary);
      setTotalCopies(initialBook.totalCopies);
      setCondition(initialBook.condition);
      setPages(initialBook.pages || 250);
      setLanguage(initialBook.language || 'Français');
    }
  }, [initialBook]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !isbn.trim()) return;

    const availableCopies = initialBook
      ? Math.min(initialBook.availableCopies + (totalCopies - initialBook.totalCopies), totalCopies)
      : totalCopies;

    onSubmit({
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      category,
      publisher: publisher.trim() || 'Éditeur indépendant',
      year: Number(year),
      shelfLocation: shelfLocation.trim() || `${category.slice(0, 3).toUpperCase()} ${author.slice(0, 3).toUpperCase()}`,
      summary: summary.trim(),
      totalCopies: Math.max(1, Number(totalCopies)),
      availableCopies: Math.max(0, availableCopies),
      condition,
      pages: Number(pages),
      language,
      coverImage: initialBook?.coverImage,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BookPlus className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              {initialBook ? 'Modifier la notice de l’ouvrage' : 'Cataloguer un nouvel ouvrage'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Titre de l’ouvrage <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex. Mémoires d'Hadrien"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Auteur(e) principal(e) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="ex. Marguerite Yourcenar"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Numéro ISBN <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="ex. 978-2070369218"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-code text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rayon / Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BookCategory)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cote de rangement (Dewey / Salle)
              </label>
              <input
                type="text"
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                placeholder="ex. 843.9 YOU"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-code text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Éditeur
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="ex. Gallimard"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Année de parution
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={1500}
                max={2030}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre d’exemplaires
              </label>
              <input
                type="number"
                value={totalCopies}
                onChange={(e) => setTotalCopies(Number(e.target.value))}
                min={1}
                max={50}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                État matériel
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as BookCondition)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Résumé & Synopsis
              </label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brève description du livre, intrigue ou mots-clés de recherche..."
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{initialBook ? 'Enregistrer les modifications' : 'Ajouter au catalogue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
