import { BookCategory } from '../types/library';

export interface ExternalBookResult {
  googleId: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedYear: number;
  isbn: string;
  pageCount: number;
  description: string;
  coverImage?: string;
  category: BookCategory;
  suggestedShelf: string;
  language: string;
}

// Fallback curated books when offline or API limit reached
const CURATED_EST_CATALOG: ExternalBookResult[] = [
  {
    googleId: 'est-ref-01',
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    authors: ['Robert C. Martin'],
    publisher: 'Prentice Hall',
    publishedYear: 2008,
    isbn: '978-0132350884',
    pageCount: 464,
    description: 'Guide fondamental pour les ingénieurs en informatique sur la conception de code lisible, maintenable et robuste.',
    coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?w=600&auto=format&fit=crop&q=80',
    category: 'Informatique & Réseaux',
    suggestedShelf: 'EST-GI-014',
    language: 'Anglais',
  },
  {
    googleId: 'est-ref-02',
    title: 'Algorithmique : Cours avec 957 exercices et 158 problèmes',
    authors: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest'],
    publisher: 'Dunod',
    publishedYear: 2010,
    isbn: '978-2100545261',
    pageCount: 1188,
    description: 'La référence internationale en algorithmique et structures de données, indispensable pour les étudiants en DUT Informatique.',
    coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
    category: 'Mathématiques & Algorithmique',
    suggestedShelf: 'EST-GI-022',
    language: 'Français',
  },
  {
    googleId: 'est-ref-03',
    title: 'Réseaux informatiques : Notions fondamentales',
    authors: ['Andrew Tanenbaum', 'David Wetherall'],
    publisher: 'Pearson France',
    publishedYear: 2011,
    isbn: '978-2744075216',
    pageCount: 960,
    description: 'Ouvrage de référence sur les architectures de réseaux, modèles OSI et TCP/IP, routage et sécurité réseau.',
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    category: 'Informatique & Réseaux',
    suggestedShelf: 'EST-RT-008',
    language: 'Français',
  },
  {
    googleId: 'est-ref-04',
    title: 'Électronique : Composants et systèmes d’application',
    authors: ['Thomas L. Floyd'],
    publisher: 'De Boeck Supérieur',
    publishedYear: 2014,
    isbn: '978-2804183806',
    pageCount: 1040,
    description: 'Manuel de référence pour le Génie Électrique : diodes, transistors, amplificateurs opérationnels et traitement du signal.',
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
    category: 'Génie Électrique & Électronique',
    suggestedShelf: 'EST-GE-019',
    language: 'Français',
  },
  {
    googleId: 'est-ref-05',
    title: 'Intelligence Artificielle et Deep Learning avec Python',
    authors: ['Aurélien Géron'],
    publisher: 'Dunod',
    publishedYear: 2023,
    isbn: '978-2100854271',
    pageCount: 680,
    description: 'Concepts fondamentaux et mise en pratique avec Scikit-Learn, Keras et TensorFlow pour l’analyse de données et le Machine Learning.',
    coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
    category: 'Informatique & Réseaux',
    suggestedShelf: 'EST-GI-078',
    language: 'Français',
  },
  {
    googleId: 'est-ref-06',
    title: 'Management des Organisations',
    authors: ['Michel Barabel', 'Olivier Meier'],
    publisher: 'Dunod',
    publishedYear: 2021,
    isbn: '978-2100824052',
    pageCount: 480,
    description: 'Théories du management, stratégie d’entreprise, gouvernance et ressources humaines pour les départements de gestion.',
    coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=80',
    category: 'Management & Économie',
    suggestedShelf: 'EST-TM-033',
    language: 'Français',
  }
];

function mapGoogleCategoriesToEST(categories?: string[], title = ''): BookCategory {
  const text = ((categories?.join(' ') || '') + ' ' + title).toLowerCase();
  
  if (text.includes('comput') || text.includes('program') || text.includes('software') || text.includes('informati') || text.includes('web') || text.includes('python') || text.includes('java')) {
    return 'Informatique & Réseaux';
  }
  if (text.includes('electr') || text.includes('circuit') || text.includes('signal') || text.includes('energie')) {
    return 'Génie Électrique & Électronique';
  }
  if (text.includes('mecanic') || text.includes('industr') || text.includes('maintenan') || text.includes('automati')) {
    return 'Génie Industriel & Mécanique';
  }
  if (text.includes('manage') || text.includes('econom') || text.includes('financ') || text.includes('compta') || text.includes('market')) {
    return 'Management & Économie';
  }
  if (text.includes('math') || text.includes('algo') || text.includes('statist')) {
    return 'Mathématiques & Algorithmique';
  }
  if (text.includes('physi') || text.includes('chimie') || text.includes('scien')) {
    return 'Sciences & Physique';
  }
  if (text.includes('litt') || text.includes('roman') || text.includes('angl') || text.includes('franc') || text.includes('poesie')) {
    return 'Littérature & Langues';
  }
  return 'Informatique & Réseaux';
}

function generateESTShelfCode(category: BookCategory, author: string): string {
  const prefixMap: Record<BookCategory, string> = {
    'Informatique & Réseaux': 'EST-GI',
    'Génie Électrique & Électronique': 'EST-GE',
    'Génie Industriel & Mécanique': 'EST-GIM',
    'Management & Économie': 'EST-TM',
    'Mathématiques & Algorithmique': 'EST-MATH',
    'Sciences & Physique': 'EST-PHYS',
    'Littérature & Langues': 'EST-LANG',
    'Général & Divers': 'EST-GEN',
  };
  const prefix = prefixMap[category] || 'EST-DOC';
  const num = Math.floor(100 + Math.random() * 899);
  const authorPart = (author.split(' ').pop() || 'REF').slice(0, 3).toUpperCase();
  return `${prefix}-${num}-${authorPart}`;
}

export async function searchBooksAutomatically(query: string): Promise<ExternalBookResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}&maxResults=8`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Books API status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      // Fallback filter on local catalog
      return CURATED_EST_CATALOG.filter(
        (b) =>
          b.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
          b.authors.some((a) => a.toLowerCase().includes(cleanQuery.toLowerCase()))
      );
    }

    const results: ExternalBookResult[] = data.items.map((item: any) => {
      const info = item.volumeInfo || {};
      const isbnObj = info.industryIdentifiers?.find(
        (id: any) => id.type === 'ISBN_13' || id.type === 'ISBN_10'
      );
      const isbn = isbnObj ? isbnObj.identifier : `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const authors = info.authors || ['Auteur inconnu'];
      const publishedYear = info.publishedDate ? parseInt(info.publishedDate.substring(0, 4), 10) || 2022 : 2022;
      const category = mapGoogleCategoriesToEST(info.categories, info.title);
      const suggestedShelf = generateESTShelfCode(category, authors[0]);

      let coverImage: string | undefined = undefined;
      if (info.imageLinks) {
        coverImage = (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '').replace('http://', 'https://');
      }

      return {
        googleId: item.id || `gb-${Date.now()}`,
        title: info.title || cleanQuery,
        authors,
        publisher: info.publisher || 'Éditions Universitaires',
        publishedYear,
        isbn,
        pageCount: info.pageCount || 320,
        description: info.description || 'Notice bibliographique indexée automatiquement pour le fonds documentaire de l’EST Fès.',
        coverImage,
        category,
        suggestedShelf,
        language: info.language === 'en' ? 'Anglais' : info.language === 'ar' ? 'Arabe' : 'Français',
      };
    });

    return results;
  } catch (err) {
    console.warn('API error, falling back to curated EST catalog:', err);
    // Return filtered curated list matching search
    const matches = CURATED_EST_CATALOG.filter(
      (b) =>
        b.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
        b.authors.some((a) => a.toLowerCase().includes(cleanQuery.toLowerCase()))
    );
    return matches.length > 0 ? matches : CURATED_EST_CATALOG.slice(0, 4);
  }
}
