import {
  Book,
  BookCategory,
  BookCondition,
  BookCopy,
  ESTDepartment,
  Member,
  Loan,
  Reservation,
  ReservationStatus,
  StudentRegistration,
  RegistrationStatus,
  ActivityLog,
  AppNotification,
  ReminderHistoryEntry,
} from '../types/library';
import { getDaysDifference, getOverdueDays } from '../utils/dateUtils';

export interface GeneratedUniversityUser {
  id: string;
  academicEmail: string;
  fullName: string;
  role: 'etudiant';
  title: string;
  department: string;
  cne: string;
  apogee: string;
  status: 'Actif' | 'Radié' | 'Suspendu';
  avatarColor: string;
}

export interface DemoDataset {
  books: Book[];
  studentRegistry: StudentRegistration[];
  members: Member[];
  universityUsers: GeneratedUniversityUser[];
  loans: Loan[];
  reservations: Reservation[];
  activities: ActivityLog[];
  notifications: AppNotification[];
  reminderHistory: ReminderHistoryEntry[];
}

export const REFERENCE_DATE = '2026-10-12';

// Deterministic Mulberry32 PRNG so dataset is stable & reproducible
function createRng(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(baseIso: string, offsetDays: number): string {
  const d = new Date(baseIso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

const COVER_BY_CATEGORY: Partial<Record<BookCategory, string[]>> = {
  'Informatique & Réseaux': [
    '/src/assets/images/book_cover_cs_networks_1795002969565.jpg',
    '/src/assets/images/book_cover_science_1791793874836.jpg',
  ],
  'Mathématiques & Algorithmique': [
    '/src/assets/images/book_cover_math_algo_1795002970588.jpg',
  ],
  'Génie Électrique & Électronique': [
    '/src/assets/images/book_cover_elec_ind_1795002970275.jpg',
  ],
  'Génie Industriel & Mécanique': [
    '/src/assets/images/book_cover_elec_ind_1795002970275.jpg',
  ],
  'Management & Économie': [
    '/src/assets/images/book_cover_mgmt_econ_1795002969361.jpg',
  ],
  'Sciences & Physique': [
    '/src/assets/images/book_cover_science_1791793874836.jpg',
  ],
  'Littérature & Langues': [
    '/src/assets/images/book_cover_classic_1791793863213.jpg',
  ],
};

const DEPARTMENTS: ESTDepartment[] = [
  'Génie Informatique (GI)',
  'Génie Électrique (GE)',
  'Génie Industriel et Maintenance (GIM)',
  'Techniques de Management (TM)',
  'Réseaux & Télécommunications (RT)',
  'Bio-analyses et Qualité (BQ)',
];

const STUDY_YEARS = [
  'DUT 1ère année',
  'DUT 2ème année',
  'Licence Professionnelle (LP)',
  'Bachelor Universitaire (BUT)',
];

const FIRST_NAMES_F = [
  'Salma', 'Hajar', 'Oumaima', 'Kenza', 'Zineb', 'Meryem', 'Chaimae', 'Imane',
  'Yasmine', 'Nour', 'Ghita', 'Sara', 'Khadija', 'Amina', 'Fatima-Zahra', 'Wissal',
  'Rania', 'Ines', 'Soukaina', 'Kawtar', 'Lina', 'Dounia', 'Asmae', 'Manal',
  'Houda', 'Nadia', 'Bouchra', 'Ikram', 'Marwa', 'Hiba', 'Aya', 'Malak',
];

const FIRST_NAMES_M = [
  'Amine', 'Youssef', 'Mehdi', 'Omar', 'Hamza', 'Ayoub', 'Zakaria', 'Anas',
  'Tarik', 'Saad', 'Reda', 'Ilyas', 'Nabil', 'Oussama', 'Soufiane', 'Karim',
  'Walid', 'Adil', 'Hicham', 'Rachid', 'Bilal', 'Mouad', 'Achraf', 'Yassine',
  'Ismail', 'Badr', 'Sami', 'Adam', 'Zayd', 'Hatim', 'Khalid', 'Taha',
];

const LAST_NAMES = [
  'El Idrissi', 'Bennani', 'Chraibi', 'Amellah', 'Tazi', 'Fassi', 'Alaoui', 'Berrada',
  'Benjelloun', 'Kettani', 'Lahlou', 'Sefrioui', 'Zniber', 'Benslimane', 'Filali', 'Mernissi',
  'Naciri', 'Ouazzani', 'Skalli', 'Benali', 'Alami', 'Guessous', 'Kabbaj', 'Lazrak',
  'Benkirane', 'Tounsi', 'Kadiri', 'Zemmouri', 'Mansouri', 'Bouhlal', 'El Fassi', 'Chami',
  'El Amrani', 'Tahiri', 'Belhaj', 'Slaoui', 'Rami', 'Hariri', 'Moussaoui', 'Chawki',
  'Bouchaib', 'Darif', 'Ennaji', 'Ghazali', 'Haddad', 'Jazouli', 'Khalifi', 'Lamrani',
  'Mekouar', 'Naji', 'Ouali', 'Qadiri', 'Rhouati', 'Sabiri', 'Talbi', 'Ziani',
];

const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-blue-600',
  'bg-emerald-700',
  'bg-amber-600',
  'bg-cyan-700',
  'bg-slate-700',
  'bg-teal-700',
];

interface BookBlueprint {
  category: BookCategory;
  deptCode: string;
  titles: string[];
  authors: string[];
  publishers: string[];
  languages: string[];
  summaryTemplates: string[];
}

const BOOK_BLUEPRINTS: BookBlueprint[] = [
  {
    category: 'Informatique & Réseaux',
    deptCode: 'GI',
    titles: [
      'Architecture des systèmes distribués',
      'Développement Web moderne avec TypeScript et React',
      'Bases de données relationnelles et SQL avancé',
      'Sécurité des réseaux TCP/IP et pare-feux',
      'Systèmes d’exploitation Unix et Linux',
      'Conception orientée objet et Design Patterns',
      'DevOps, conteneurisation Docker et Kubernetes',
      'Cloud Computing et architectures microservices',
      'Administration systèmes et automatisation Ansible',
      'Programmation Python pour l’ingénierie des données',
      'Réseaux sans fil 5G et protocoles IoT',
      'Ingénierie logicielle agile et tests automatisés',
      'Cryptographie appliquée et sécurité applicative',
      'Java Enterprise Edition et architectures Spring Boot',
      'Administration Cisco CCNA : Routage et commutation',
      'Modélisation UML et bases de données NoSQL',
      'Vision par ordinateur avec OpenCV et Deep Learning',
      'Big Data avec Apache Spark et Hadoop',
      'Développement mobile multiplateforme',
      'Virtualisation et datacenters d’entreprise',
    ],
    authors: [
      'Andrew Tanenbaum', 'Martin Fowler', 'Eric Evans', 'Jean-Luc Hainaut',
      'Claude Delannoy', 'Sam Newman', 'Aurélien Géron', 'Thomas Cormen',
      'Karim El Boukhari', 'Philippe Rigaux', 'Stéphane Bortzmeyer', 'Nadia Mansouri',
      'Olivier Hondermarck', 'Benoît Marchal', 'Youssef Benali', 'Laurent Audibert',
    ],
    publishers: ['Dunod', 'Pearson', 'Eyrolles', "O'Reilly", 'ENI Éditions'],
    languages: ['Français', 'Français', 'Français', 'Anglais'],
    summaryTemplates: [
      'Manuel de référence pour les travaux dirigés et projets tutorés de la filière GI/RT à l’EST Fès.',
      'Approche progressive alliant théorie des systèmes et études de cas industriels contemporains.',
      'Cours complet accompagné d’exercices corrigés pour la préparation aux examens de DUT et LP.',
    ],
  },
  {
    category: 'Mathématiques & Algorithmique',
    deptCode: 'MATH',
    titles: [
      'Algèbre linéaire et géométrie pour l’ingénieur',
      'Analyse numérique et méthodes d’approximation',
      'Probabilités, statistiques et fiabilité',
      'Théorie des graphes et optimisation combinatoire',
      'Mathématiques discrètes et logique formelle',
      'Analyse réelle et séries de Fourier',
      'Recherche opérationnelle et programmation linéaire',
      'Structures de données avancées et algorithmique',
      'Équations différentielles appliquées aux systèmes',
      'Calcul matriciel et méthodes numériques sous Python',
      'Statistique inférentielle et plans d’expériences',
      'Complexité algorithmique et calculabilité',
    ],
    authors: [
      'Jean-Pierre Ramis', 'André Warusfel', 'Gérard Swinnen', 'Michel Gondran',
      'François Cottet', 'Moncef Benjelloun', 'Hervé Lehning', 'Didier Müller',
      'Jean-Marie Monier', 'Philippe Chassaing', 'Claire David',
    ],
    publishers: ['Dunod', 'Ellipses', 'Vuibert', 'De Boeck Supérieur', 'Springer'],
    languages: ['Français', 'Français', 'Anglais'],
    summaryTemplates: [
      'Ouvrage structuré couvrant les fondements mathématiques indispensables aux filières scientifiques et technologiques.',
      'Recueil de cours synthétiques et de problèmes résolus adaptés aux étudiants de 1ère et 2ème année.',
    ],
  },
  {
    category: 'Génie Électrique & Électronique',
    deptCode: 'GE',
    titles: [
      'Électronique de puissance : Convertisseurs et variateurs',
      'Automatique linéaire et régulation PID',
      'Machines électriques tournantes et transformateurs',
      'Microcontrôleurs STM32 et systèmes embarqués',
      'Électrotechnique industrielle et schémas normalisés',
      'Traitement numérique du signal (DSP)',
      'Énergies renouvelables et systèmes photovoltaïques',
      'Automates programmables industriels (API) et Grafcet',
      'Capteurs intelligents et instrumentation industrielle',
      'Électronique analogique et filtrage actif',
      'Compatibilité électromagnétique et circuits imprimés',
      'Distribution électrique haute et basse tension',
    ],
    authors: [
      'Luc Lasne', 'Thomas L. Floyd', 'Pierre Mayé', 'Michel Pinard',
      'Patrick Abati', 'Yves Granjon', 'Rachid Bennis', 'Christian Tavernier',
      'Guy Seguier', 'Jacques Laroche',
    ],
    publishers: ['Dunod', 'De Boeck Supérieur', 'Lavoisier', 'Ellipses'],
    languages: ['Français', 'Français', 'Anglais'],
    summaryTemplates: [
      'Support pédagogique complet pour les laboratoires d’électrotechnique, automatique et systèmes embarqués.',
      'Étude approfondie des composants, schémas de puissance et méthodes de régulation industrielle.',
    ],
  },
  {
    category: 'Génie Industriel & Mécanique',
    deptCode: 'GIM',
    titles: [
      'Maintenance industrielle : Préventive et conditionnelle',
      'Gestion de production, Lean Manufacturing et Six Sigma',
      'Mécanique des fluides et systèmes hydrauliques',
      'Résistance des matériaux et calcul de structures',
      'Thermodynamique appliquée aux machines thermiques',
      'Pneumatique industrielle et robotique manufacturière',
      'Conception assistée par ordinateur (CAO) et tolérancement',
      'Sûreté de fonctionnement, AMDEC et fiabilité',
      'Contrôle non destructif et métrologie industrielle',
      'Logistique industrielle et gestion des stocks',
      'Tribologie, lubrification et transmission de puissance',
      'Qualité, normes ISO 9001 et maîtrise statistique',
    ],
    authors: [
      'François Monchy', 'Jean-Louis Fanchon', 'Georges Khelifati', 'Maurice Pillet',
      'Alain Courtois', 'Driss Kettani', 'Michel Aublin', 'Pierre Agati',
    ],
    publishers: ['Dunod', 'Nathan', 'Foucher', 'Lavoisier', 'AFNOR Éditions'],
    languages: ['Français'],
    summaryTemplates: [
      'Référence pratique pour le diagnostic des pannes, l’ordonnancement et la maintenance des équipements.',
      'Manuel méthodologique intégrant normes ISO, outils Lean et études de cas d’usines marocaines et européennes.',
    ],
  },
  {
    category: 'Management & Économie',
    deptCode: 'TM',
    titles: [
      'Comptabilité générale et analyse financière',
      'Contrôle de gestion et tableaux de bord',
      'Marketing stratégique et digital',
      'Gestion des ressources humaines et droit du travail',
      'Économie générale et macroéconomie contemporaine',
      'Gestion de projet agile et conduite du changement',
      'Entrepreneuriat, business plan et financement',
      'Commerce international et techniques du négoce',
      'Finance d’entreprise et évaluation des investissements',
      'Droit des affaires et fiscalité des sociétés',
      'Communication professionnelle et négociation commerciale',
      'Supply Chain Management et achats responsables',
    ],
    authors: [
      'Michel Barabel', 'Olivier Meier', 'Philip Kotler', 'Henri Bouquin',
      'Pascal Quiry', 'Georges Charreaux', 'Jean-Marc Lehu', 'Laila Berrada',
      'Claude Alazard', 'Sabine Sépari',
    ],
    publishers: ['Dunod', 'Pearson', 'Vuibert', 'Foucher', 'Hachette Supérieur'],
    languages: ['Français', 'Français', 'Anglais'],
    summaryTemplates: [
      'Ouvrage fondamental pour la filière Techniques de Management : outils d’aide à la décision et études de cas.',
      'Synthèse rigoureuse des concepts financiers, organisationnels et commerciaux en environnement concurrentiel.',
    ],
  },
  {
    category: 'Sciences & Physique',
    deptCode: 'SCI',
    titles: [
      'Chimie analytique et méthodes spectroscopiques',
      'Microbiologie alimentaire et contrôle qualité',
      'Biochimie structurale et enzymologie appliquée',
      'Optique géométrique, ondulatoire et photonique',
      'Électromagnétisme dans le vide et la matière',
      'Physique des semi-conducteurs et nanotechnologies',
      'Génie des procédés et opérations unitaires',
      'Sécurité en laboratoire et métrologie chimique',
      'Biotechnologies industrielles et fermentations',
      'Physique statistique et mécanique quantique',
    ],
    authors: [
      'Douglas A. Skoog', 'Donald Voet', 'Eugène Hecht', 'José-Philippe Pérez',
      'Jean-Pierre Prescott', 'Fatima-Zahra Sefrioui', 'Paul Arnaud', 'Jean-François Le Maréchal',
    ],
    publishers: ['De Boeck Supérieur', 'Dunod', 'Lavoisier', 'Ellipses'],
    languages: ['Français', 'Anglais'],
    summaryTemplates: [
      'Manuel de référence pour la filière Bio-analyses et Qualité (BQ) et les modules de sciences fondamentales.',
      'Présentation rigoureuse des protocoles expérimentaux, analyses physico-chimiques et contrôles qualité.',
    ],
  },
  {
    category: 'Littérature & Langues',
    deptCode: 'LANG',
    titles: [
      'Techniques d’expression écrite et orale en entreprise',
      'Technical English for Engineering and IT',
      'La Boîte à Merveilles — Édition annotée',
      'Rédaction de rapports de stage et mémoires PFE',
      'Business English Communication & Presentations',
      'Histoire des sciences et de la pensée technique',
      'Grammaire française avancée et stylistique',
      'Initiation à la communication interculturelle',
    ],
    authors: [
      'Ahmed Sefrioui', 'Michel Serres', 'Mark Ibbotson', 'Raymond Murphy',
      'Chantal de Margerie', 'Tahar Ben Jelloun', 'Jean-Paul Sartre', 'Maurice Grevisse',
    ],
    publishers: ['Gallimard', 'Cambridge University Press', 'Hachette', 'Nathan', 'Dunod'],
    languages: ['Français', 'Anglais'],
    summaryTemplates: [
      'Support recommandé pour les modules de Langues, Communication et Techniques d’Expression (TEC).',
      'Outil indispensable pour structurer les écrits professionnels, présentations orales et rapports PFE.',
    ],
  },
  {
    category: 'Général & Divers',
    deptCode: 'GEN',
    titles: [
      'Méthodologie du travail universitaire',
      'Éthique de l’intelligence artificielle et société',
      'Développement durable et transition écologique',
      'Culture numérique et recherche documentaire',
      'Propriété intellectuelle et brevets d’invention',
      'Gestion du temps et efficacité académique',
    ],
    authors: [
      'Dominique Meda', 'Cédric Villani', 'Edgar Morin', 'Bruno Latour',
      'Jean-Michel Besnier', 'Hélène Lhérété',
    ],
    publishers: ['PUF', 'La Découverte', 'Seuil', 'Eyrolles'],
    languages: ['Français'],
    summaryTemplates: [
      'Essai et guide transversal destiné à l’ensemble des étudiants et enseignants-chercheurs de l’USMBA.',
    ],
  },
];

const EDITIONS_TAG = [
  '', ' — Édition 2024', ' — Cours & Applications', ' — Manuel Pratique',
  ' — Tome I', ' — Tome II', ' — Approche Complète', ' — Guide de Référence',
];

function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

export function generateCoherentDemoDataset(
  baseBooks: Book[],
  baseMembers: Member[],
  baseStudents: Omit<StudentRegistration, 'qrCodeDataUrl'>[],
  baseLoans: Loan[],
  baseReservations: Reservation[]
): DemoDataset {
  const rng = createRng(20261012);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  // =========================================================================
  // 1. STUDENTS & MEMBERS (+312 additional fictional students)
  // =========================================================================
  const studentRegistry: StudentRegistration[] = baseStudents.map((s) => ({
    ...s,
    isDemo: false,
  }));

  const members: Member[] = baseMembers.map((m) => ({
    ...m,
    studyYear:
      baseStudents.find((s) => s.cne === m.cne)?.studyYear ||
      (m.id === 'm-04' ? 'Licence Professionnelle (LP-GL)' : 'DUT'),
    isDemo: false,
  }));

  // Ensure Oumaima Fassi (reg-06) also has a matching Member record
  const reg06 = baseStudents.find((s) => s.id === 'reg-06');
  if (reg06 && !members.some((m) => m.cne === reg06.cne)) {
    members.push({
      id: 'm-06',
      cardNumber: 'EST-2026-006',
      cne: reg06.cne,
      apogee: reg06.apogee,
      firstName: reg06.firstName,
      lastName: reg06.lastName,
      email: reg06.academicEmail,
      phone: reg06.phone,
      department: reg06.department,
      studyYear: reg06.studyYear,
      memberType: 'Étudiant EST',
      status: 'Actif',
      joinDate: reg06.registrationDate,
      expiryDate: '2027-09-30',
      maxAllowedLoans: 5,
      notes: 'DUT RT 1ère année.',
      isDemo: false,
    });
  }

  const universityUsers: GeneratedUniversityUser[] = [];
  const usedEmails = new Set<string>(studentRegistry.map((s) => s.academicEmail.toLowerCase()));
  const usedCnes = new Set<string>(studentRegistry.map((s) => s.cne));
  const usedApogees = new Set<string>(studentRegistry.map((s) => s.apogee));

  const ADDITIONAL_STUDENT_COUNT = 312;
  for (let i = 1; i <= ADDITIONAL_STUDENT_COUNT; i++) {
    const num = i + 6; // reg-007 .. reg-318
    const isFemale = i % 2 === 0;
    const firstName = isFemale
      ? FIRST_NAMES_F[Math.floor(rng() * FIRST_NAMES_F.length)]
      : FIRST_NAMES_M[Math.floor(rng() * FIRST_NAMES_M.length)];
    const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];

    const baseEmailSlug = `${slugifyName(firstName)}.${slugifyName(lastName)}`;
    let email = `${baseEmailSlug}@usmba.ac.ma`;
    let suffix = 1;
    while (usedEmails.has(email)) {
      suffix += 1;
      email = `${baseEmailSlug}${suffix}@usmba.ac.ma`;
    }
    usedEmails.add(email);

    let cne = '';
    do {
      const prefix = rng() > 0.25 ? 'N13' : rng() > 0.5 ? 'N14' : 'D13';
      const digits = String(100000 + Math.floor(rng() * 899999));
      cne = `${prefix}${digits}`;
    } while (usedCnes.has(cne));
    usedCnes.add(cne);

    let apogee = '';
    do {
      const yrPrefix = pick(['21', '22', '23', '24', '25']);
      apogee = `${yrPrefix}0${String(10000 + Math.floor(rng() * 89999))}`;
    } while (usedApogees.has(apogee));
    usedApogees.add(apogee);

    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const studyYear = STUDY_YEARS[Math.floor(rng() * STUDY_YEARS.length)];

    // ~91% Inscrit, ~4% Suspendu, ~3% Radié, ~2% Diplômé
    const rStatus = rng();
    let regStatus: RegistrationStatus = 'Inscrit';
    if (rStatus > 0.98) regStatus = 'Diplômé';
    else if (rStatus > 0.95) regStatus = 'Radié';
    else if (rStatus > 0.91) regStatus = 'Suspendu';

    const joinYear = pick(['2023', '2024', '2025', '2026']);
    const regDate = `${joinYear}-09-${String(4 + Math.floor(rng() * 18)).padStart(2, '0')}`;
    const phone = `0${rng() > 0.35 ? '6' : '7'} ${String(10 + Math.floor(rng() * 89))} ${String(10 + Math.floor(rng() * 89))} ${String(10 + Math.floor(rng() * 89))} ${String(10 + Math.floor(rng() * 89))}`;

    const regId = `reg-${String(num).padStart(3, '0')}`;
    const memId = `m-${String(num).padStart(3, '0')}`;
    const cardNumber = `EST-2026-${String(num).padStart(3, '0')}`;

    const regRecord: StudentRegistration = {
      id: regId,
      cne,
      apogee,
      firstName,
      lastName,
      academicEmail: email,
      department: dept,
      studyYear,
      registrationStatus: regStatus,
      phone,
      registrationDate: regDate,
      isDemo: true,
    };
    studentRegistry.push(regRecord);

    const memberStatus: Member['status'] =
      regStatus === 'Inscrit' ? 'Actif' : regStatus === 'Radié' ? 'Radié' : 'Suspendu';

    members.push({
      id: memId,
      cardNumber,
      cne,
      apogee,
      firstName,
      lastName,
      email,
      phone,
      department: dept,
      studyYear,
      memberType: 'Étudiant EST',
      status: memberStatus,
      joinDate: regDate,
      expiryDate: regStatus === 'Radié' ? '2025-06-30' : '2027-09-30',
      maxAllowedLoans: studyYear.includes('Licence') || studyYear.includes('Bachelor') ? 6 : 5,
      notes: `${studyYear} · ${dept}`,
      isDemo: true,
    });

    universityUsers.push({
      id: `usr-${regId}`,
      academicEmail: email,
      fullName: `${firstName} ${lastName}`,
      role: 'etudiant',
      title: `Étudiant(e) · ${studyYear}`,
      department: dept,
      cne,
      apogee,
      status: memberStatus === 'Actif' ? 'Actif' : memberStatus,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    });
  }

  // =========================================================================
  // 2. BOOKS & EXPLICIT PHYSICAL COPIES (+208 books, +600 copies)
  // =========================================================================
  const books: Book[] = [];
  let copyGlobalSeq = 1;

  const makeCopies = (
    bookId: string,
    count: number,
    defaultCond: BookCondition,
    addedDate: string
  ): BookCopy[] => {
    const list: BookCopy[] = [];
    for (let c = 1; c <= count; c++) {
      list.push({
        id: `cp-${bookId}-${c}`,
        barcode: `EST-EX-${String(copyGlobalSeq++).padStart(4, '0')}`,
        bookId,
        status: 'Disponible',
        condition: defaultCond,
        acquiredDate: addedDate,
      });
    }
    return list;
  };

  // Preserve initial 7 showcase books and enrich with copies
  baseBooks.forEach((b, idx) => {
    const copies = makeCopies(b.id, b.totalCopies, b.condition, `2025-09-${10 + idx}`);
    books.push({
      ...b,
      coverImage: b.coverImage || COVER_BY_CATEGORY[b.category]?.[0],
      copies,
      addedDate: `2026-09-${String(10 + idx).padStart(2, '0')}`,
      isDemo: false,
    });
  });

  const usedIsbns = new Set<string>(books.map((b) => b.isbn));
  const usedCotes = new Set<string>(books.map((b) => b.shelfLocation));
  const CONDITIONS: BookCondition[] = ['Neuf', 'Très bon', 'Bon état', 'Usagé'];

  // Category distribution weights so catalog mirrors an EST engineering & management school
  const weightedBlueprints: BookBlueprint[] = [
    BOOK_BLUEPRINTS[0], BOOK_BLUEPRINTS[0], BOOK_BLUEPRINTS[0], // GI/RT heavy
    BOOK_BLUEPRINTS[1], BOOK_BLUEPRINTS[1], // Math
    BOOK_BLUEPRINTS[2], BOOK_BLUEPRINTS[2], // GE
    BOOK_BLUEPRINTS[3], BOOK_BLUEPRINTS[3], // GIM
    BOOK_BLUEPRINTS[4], BOOK_BLUEPRINTS[4], // TM
    BOOK_BLUEPRINTS[5], // Sciences & Bio
    BOOK_BLUEPRINTS[6], // Langues
    BOOK_BLUEPRINTS[7], // Général
  ];

  const ADDITIONAL_BOOK_COUNT = 208;
  for (let i = 1; i <= ADDITIONAL_BOOK_COUNT; i++) {
    const num = i + 7; // b-008 .. b-215
    const id = `b-${String(num).padStart(3, '0')}`;
    const bp = weightedBlueprints[(i - 1) % weightedBlueprints.length];

    const baseTitle = bp.titles[(i - 1 + Math.floor(rng() * bp.titles.length)) % bp.titles.length];
    const edTag = EDITIONS_TAG[(i + Math.floor(rng() * 3)) % EDITIONS_TAG.length];
    const title = `${baseTitle}${edTag}`;
    const author = pick(bp.authors);
    const publisher = pick(bp.publishers);
    const year = 2008 + Math.floor(rng() * 18); // 2008..2025
    const language = pick(bp.languages);
    const condition = CONDITIONS[Math.floor(rng() * 3)]; // mostly Neuf / Très bon / Bon état
    const pages = 180 + Math.floor(rng() * 750);

    let isbn = '';
    do {
      const part1 = pick(['2100', '2744', '2804', '2412', '2729', '0132', '1491']);
      const part2 = String(100000 + Math.floor(rng() * 899999));
      isbn = `978-${part1}${part2}`.slice(0, 14);
    } while (usedIsbns.has(isbn));
    usedIsbns.add(isbn);

    const authorCode = slugifyName(author.split(' ').pop() || 'EST').slice(0, 3).toUpperCase();
    let shelfLocation = '';
    let coteNum = 40 + i;
    do {
      shelfLocation = `EST-${bp.deptCode}-${String(coteNum).padStart(3, '0')}-${authorCode}`;
      coteNum += 1;
    } while (usedCotes.has(shelfLocation));
    usedCotes.add(shelfLocation);

    const copyCount = 2 + Math.floor(rng() * 4); // 2 to 5 copies (~620+ additional copies!)
    const addedDay = addDays(REFERENCE_DATE, -Math.floor(rng() * 120));

    // Assign real generated cover image to ~42% of books for editorial richness + typographic hardcover to the rest
    const catCovers = COVER_BY_CATEGORY[bp.category];
    const coverImage =
      catCovers && rng() < 0.42 ? catCovers[i % catCovers.length] : undefined;

    const copies = makeCopies(id, copyCount, condition, addedDay);

    books.push({
      id,
      isbn,
      title,
      author,
      category: bp.category,
      publisher,
      year,
      shelfLocation,
      summary: `${pick(bp.summaryTemplates)} Publié chez ${publisher} (${year}).`,
      coverImage,
      totalCopies: copyCount,
      availableCopies: copyCount,
      copies,
      condition,
      pages,
      language,
      addedDate: addedDay,
      isDemo: true,
    });
  }

  // Mark ~18 copies as 'En maintenance' and ~7 copies as 'Perdu' on non-core books
  const maintenanceCandidates = books.slice(12);
  let maintCount = 0;
  let lostCount = 0;
  for (let idx = 0; idx < maintenanceCandidates.length && (maintCount < 18 || lostCount < 7); idx++) {
    const bk = maintenanceCandidates[idx];
    if (!bk.copies || bk.copies.length < 2) continue;
    const lastCopy = bk.copies[bk.copies.length - 1];
    if (idx % 7 === 0 && maintCount < 18) {
      lastCopy.status = 'En maintenance';
      lastCopy.condition = 'Usagé';
      maintCount += 1;
    } else if (idx % 19 === 0 && lostCount < 7) {
      lastCopy.status = 'Perdu';
      lostCount += 1;
    }
  }

  // Helper to claim a physical copy for a loan
  const bookMap = new Map<string, Book>(books.map((b) => [b.id, b]));
  const activeMemberList = members.filter((m) => m.status === 'Actif');

  const claimFreeCopy = (bookId: string, status: 'Emprunté' | 'Réservé'): BookCopy | undefined => {
    const bk = bookMap.get(bookId);
    if (!bk || !bk.copies) return undefined;
    const free = bk.copies.find((c) => c.status === 'Disponible');
    if (!free) return undefined;
    free.status = status;
    return free;
  };

  // =========================================================================
  // 3. LOANS (Coherent active loans, >= 45 overdue students across 4 buckets, due today, returned history)
  // =========================================================================
  const loans: Loan[] = [];

  // Process core loans first and bind active ones to actual copies
  baseLoans.forEach((l) => {
    if (l.status !== 'Rendu') {
      const copy = claimFreeCopy(l.bookId, 'Emprunté');
      loans.push({
        ...l,
        bookCategory: bookMap.get(l.bookId)?.category,
        copyId: copy?.id,
        copyBarcode: copy?.barcode,
        isDemo: false,
      });
    } else {
      loans.push({
        ...l,
        bookCategory: bookMap.get(l.bookId)?.category,
        isDemo: false,
      });
    }
  });

  // Enrich Hajar Amellah (m-04, default student switcher) with 1 due-soon loan + 3 past returned loans
  const hajar = members.find((m) => m.id === 'm-04');
  if (hajar) {
    const dueSoonBook = books.find((b) => b.id === 'b-010') || books[7];
    const hCopy = dueSoonBook ? claimFreeCopy(dueSoonBook.id, 'Emprunté') : undefined;
    if (dueSoonBook && hCopy) {
      loans.push({
        id: 'l-hajar-01',
        bookId: dueSoonBook.id,
        copyId: hCopy.id,
        copyBarcode: hCopy.barcode,
        bookTitle: dueSoonBook.title,
        bookIsbn: dueSoonBook.isbn,
        bookShelfLocation: dueSoonBook.shelfLocation,
        bookCategory: dueSoonBook.category,
        memberId: hajar.id,
        memberName: `${hajar.firstName} ${hajar.lastName}`,
        memberCard: hajar.cardNumber,
        memberCne: hajar.cne,
        memberApogee: hajar.apogee,
        memberDepartment: hajar.department,
        borrowDate: addDays(REFERENCE_DATE, -19),
        dueDate: addDays(REFERENCE_DATE, 2), // Due in 2 days!
        status: 'En cours',
        extensionsCount: 0,
        remindersSent: 0,
        lateFee: 0,
        loanReceiptHash: 'USMBA-EST-HAJ02',
        isDemo: true,
      });
    }

    // 3 completed historical loans for Hajar
    [14, 19, 25].forEach((bIdx, k) => {
      const bk = books[bIdx];
      if (!bk) return;
      const borrowDate = addDays(REFERENCE_DATE, -(95 - k * 24));
      const dueDate = addDays(borrowDate, 21);
      const returnDate = addDays(borrowDate, 15 + k);
      loans.push({
        id: `l-hajar-hist-${k + 1}`,
        bookId: bk.id,
        bookTitle: bk.title,
        bookIsbn: bk.isbn,
        bookShelfLocation: bk.shelfLocation,
        bookCategory: bk.category,
        memberId: hajar.id,
        memberName: `${hajar.firstName} ${hajar.lastName}`,
        memberCard: hajar.cardNumber,
        memberCne: hajar.cne,
        memberApogee: hajar.apogee,
        memberDepartment: hajar.department,
        borrowDate,
        dueDate,
        returnDate,
        status: 'Rendu',
        extensionsCount: k === 1 ? 1 : 0,
        remindersSent: 0,
        lateFee: 0,
        isDemo: true,
      });
    });
  }

  // Track active loan counts per member so quotas are mostly respected
  const activeCountByMember = new Map<string, number>();
  loans.forEach((l) => {
    if (l.status !== 'Rendu') {
      activeCountByMember.set(l.memberId, (activeCountByMember.get(l.memberId) || 0) + 1);
    }
  });

  // Track already-borrowed book IDs per member to avoid same student borrowing 2 copies of the same title simultaneously
  const activeBookByMember = new Set<string>(
    loans.filter((l) => l.status !== 'Rendu').map((l) => `${l.memberId}:${l.bookId}`)
  );

  let loanSeq = 10;

  const createGeneratedActiveLoan = (
    member: Member,
    overdueDays: number, // 0 if not overdue; >0 for overdue; negative or 0 if upcoming
    dueOffsetFromRef: number, // e.g. 0 = due today, -5 = 5 days overdue, +10 = due in 10 days
    forceReminders = 0
  ): boolean => {
    // Pick a book with available copies not already borrowed by this member
    for (let attempt = 0; attempt < 30; attempt++) {
      const bk = books[Math.floor(rng() * books.length)];
      if (!bk.copies) continue;
      if (activeBookByMember.has(`${member.id}:${bk.id}`)) continue;
      const copy = claimFreeCopy(bk.id, 'Emprunté');
      if (!copy) continue;

      const dueDate = addDays(REFERENCE_DATE, dueOffsetFromRef);
      const extCount = dueOffsetFromRef > 5 && rng() < 0.2 ? 1 : 0;
      const borrowDate = addDays(dueDate, -(21 + extCount * 14));
      const isOverdue = dueOffsetFromRef < 0;
      const actualOverdueDays = isOverdue ? getOverdueDays(dueDate, REFERENCE_DATE) : overdueDays;
      const lateFee = isOverdue ? Number((actualOverdueDays * 0.2).toFixed(2)) : 0;

      const id = `l-${String(loanSeq++).padStart(4, '0')}`;
      loans.push({
        id,
        bookId: bk.id,
        copyId: copy.id,
        copyBarcode: copy.barcode,
        bookTitle: bk.title,
        bookIsbn: bk.isbn,
        bookShelfLocation: bk.shelfLocation,
        bookCategory: bk.category,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberCard: member.cardNumber,
        memberCne: member.cne,
        memberApogee: member.apogee,
        memberDepartment: member.department,
        borrowDate,
        dueDate,
        status: isOverdue ? 'En retard' : 'En cours',
        extensionsCount: extCount,
        remindersSent: forceReminders,
        lastReminderDate: forceReminders > 0 ? addDays(REFERENCE_DATE, -2) : undefined,
        lateFee,
        loanReceiptHash: `USMBA-${id.toUpperCase()}`,
        isDemo: true,
      });

      activeBookByMember.add(`${member.id}:${bk.id}`);
      activeCountByMember.set(member.id, (activeCountByMember.get(member.id) || 0) + 1);
      return true;
    }
    return false;
  };

  // A) 45 additional distinct students with overdue loans spanning all 4 delay buckets
  // Already m-01 and m-03 have overdue loans in baseLoans -> total >= 47 distinct overdue students!
  const overdueCandidateMembers = activeMemberList.filter(
    (m) => m.id !== 'm-01' && m.id !== 'm-03' && m.id !== 'm-04'
  );

  // Buckets:
  // 1-3j: offset -1 to -3 (12 students)
  // 4-7j: offset -4 to -7 (12 students)
  // 8-15j: offset -8 to -15 (11 students)
  // >15j: offset -16 to -34 (10 students)
  const overdueOffsets: number[] = [
    -1, -1, -2, -2, -2, -3, -3, -3, -1, -2, -3, -2,
    -4, -4, -5, -5, -6, -6, -7, -7, -4, -5, -6, -7,
    -8, -9, -10, -11, -12, -13, -14, -15, -9, -11, -13,
    -16, -18, -19, -21, -23, -25, -27, -29, -31, -34,
  ];

  overdueOffsets.forEach((offset, idx) => {
    const member = overdueCandidateMembers[idx];
    if (!member) return;
    const reminders = offset <= -8 ? (rng() < 0.65 ? 1 : 2) : offset <= -4 && rng() < 0.4 ? 1 : 0;
    createGeneratedActiveLoan(member, Math.abs(offset), offset, reminders);
    // Give 8 of these students a 2nd overdue book (multi-retard!)
    if (idx % 6 === 0) {
      createGeneratedActiveLoan(member, Math.abs(offset) + 2, offset - 2, reminders);
    }
  });

  // B) 11 loans due TODAY (2026-10-12) -> +1 from base (Salma m-02) = 12 due today
  const nonOverduePool = overdueCandidateMembers.slice(overdueOffsets.length);
  for (let i = 0; i < 11; i++) {
    const m = nonOverduePool[i];
    if (m) createGeneratedActiveLoan(m, 0, 0, 0);
  }

  // C) 17 loans due SOON (+1 or +2 days)
  for (let i = 11; i < 28; i++) {
    const m = nonOverduePool[i];
    if (m) createGeneratedActiveLoan(m, 0, i % 2 === 0 ? 1 : 2, 0);
  }

  // D) 75 healthy active loans due in +3..+21 days (including 3 granted today)
  for (let i = 28; i < 103; i++) {
    const m = nonOverduePool[28 + ((i - 28) % 58)];
    if (!m) continue;
    const current = activeCountByMember.get(m.id) || 0;
    if (current >= m.maxAllowedLoans) continue;
    const offset = i < 31 ? 21 : 3 + Math.floor(rng() * 18);
    createGeneratedActiveLoan(m, 0, offset, 0);
  }

  // E) 125 historical RETURNED loans spread across May–October 2026 (including 3 returned earlier today)
  for (let i = 0; i < 125; i++) {
    const m = activeMemberList[Math.floor(rng() * activeMemberList.length)];
    const bk = books[Math.floor(rng() * books.length)];
    // Spread more heavily in Sept/Oct (start of semester) and May/June (exams)
    const monthBuckets = [-155, -140, -125, -105, -80, -55, -38, -28, -20, -14, -9, -5, -2, -1];
    const returnOffset = pick(monthBuckets) - Math.floor(rng() * 6);
    const returnDate = i < 3 ? REFERENCE_DATE : addDays(REFERENCE_DATE, Math.min(-1, returnOffset));
    const loanDays = 7 + Math.floor(rng() * 16);
    const borrowDate = addDays(returnDate, -loanDays);
    const dueDate = addDays(borrowDate, 21);

    const id = `l-hist-${String(i + 1).padStart(4, '0')}`;
    loans.push({
      id,
      bookId: bk.id,
      copyId: bk.copies?.[0]?.id,
      copyBarcode: bk.copies?.[0]?.barcode,
      bookTitle: bk.title,
      bookIsbn: bk.isbn,
      bookShelfLocation: bk.shelfLocation,
      bookCategory: bk.category,
      memberId: m.id,
      memberName: `${m.firstName} ${m.lastName}`,
      memberCard: m.cardNumber,
      memberCne: m.cne,
      memberApogee: m.apogee,
      memberDepartment: m.department,
      borrowDate,
      dueDate,
      returnDate,
      status: 'Rendu',
      extensionsCount: rng() < 0.15 ? 1 : 0,
      remindersSent: 0,
      lateFee: 0,
      isDemo: true,
    });
  }

  // =========================================================================
  // 4. RESERVATIONS (+58 diversified reservations across all 7 statuses)
  // =========================================================================
  const reservations: Reservation[] = baseReservations.map((r) => ({
    ...r,
    isDemo: false,
  }));

  const resQueueCountByBook = new Map<string, number>();
  reservations.forEach((r) => {
    if (r.status === 'En attente' || r.status === 'Confirmée') {
      resQueueCountByBook.set(r.bookId, (resQueueCountByBook.get(r.bookId) || 0) + 1);
    }
  });

  // Give Hajar Amellah (m-04) 1 ready reservation + 1 pending reservation
  if (hajar) {
    const readyBook = books.find((b) => b.id === 'b-05') || books[4];
    const readyCopy = readyBook ? claimFreeCopy(readyBook.id, 'Réservé') : undefined;
    if (readyBook) {
      reservations.push({
        id: 'r-hajar-01',
        bookId: readyBook.id,
        bookTitle: readyBook.title,
        copyId: readyCopy?.id,
        memberId: hajar.id,
        memberName: `${hajar.firstName} ${hajar.lastName}`,
        memberCard: hajar.cne,
        requestDate: addDays(REFERENCE_DATE, -3),
        expiryDate: addDays(REFERENCE_DATE, 2),
        status: 'Prêt pour retrait',
        queuePosition: 1,
        notes: 'Exemplaire mis de côté au guichet EST.',
        isDemo: true,
      });
    }

    const waitBook = books.find((b) => b.id === 'b-03') || books[2];
    if (waitBook) {
      const qPos = (resQueueCountByBook.get(waitBook.id) || 0) + 1;
      resQueueCountByBook.set(waitBook.id, qPos);
      reservations.push({
        id: 'r-hajar-02',
        bookId: waitBook.id,
        bookTitle: waitBook.title,
        memberId: hajar.id,
        memberName: `${hajar.firstName} ${hajar.lastName}`,
        memberCard: hajar.cne,
        requestDate: addDays(REFERENCE_DATE, -1),
        status: 'En attente',
        queuePosition: qPos,
        isDemo: true,
      });
    }
  }

  const resStatusPlan: ReservationStatus[] = [
    ...Array(16).fill('En attente'),
    ...Array(10).fill('Confirmée'),
    ...Array(11).fill('Prêt pour retrait'),
    ...Array(8).fill('Honorée'),
    ...Array(5).fill('Annulée'),
    ...Array(4).fill('Expirée'),
    ...Array(4).fill('Refusée'),
  ];

  // Prioritize books that currently have 0 free copies for 'En attente'
  const zeroFreeBooks = books.filter(
    (b) => (b.copies || []).filter((c) => c.status === 'Disponible').length === 0
  );
  const availBooks = books.filter(
    (b) => (b.copies || []).filter((c) => c.status === 'Disponible').length > 0
  );

  resStatusPlan.forEach((st, idx) => {
    const member = activeMemberList[(idx * 5 + 3) % activeMemberList.length];
    let bk: Book;
    let reservedCopy: BookCopy | undefined;

    if (st === 'Prêt pour retrait') {
      bk = availBooks[idx % availBooks.length] || books[idx % books.length];
      reservedCopy = claimFreeCopy(bk.id, 'Réservé');
    } else if (st === 'En attente' && zeroFreeBooks.length > 0) {
      bk = zeroFreeBooks[idx % zeroFreeBooks.length];
    } else {
      bk = books[(idx * 9 + 2) % books.length];
    }

    const reqOffset = st === 'Honorée' || st === 'Expirée' || st === 'Annulée'
      ? -(10 + Math.floor(rng() * 30))
      : -(1 + Math.floor(rng() * 6));
    const requestDate = addDays(REFERENCE_DATE, reqOffset);
    const qPos =
      st === 'En attente' || st === 'Confirmée'
        ? (resQueueCountByBook.get(bk.id) || 0) + 1
        : 1;
    if (st === 'En attente' || st === 'Confirmée') {
      resQueueCountByBook.set(bk.id, qPos);
    }

    reservations.push({
      id: `r-${String(idx + 10).padStart(3, '0')}`,
      bookId: bk.id,
      bookTitle: bk.title,
      copyId: reservedCopy?.id,
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      memberCard: member.cardNumber,
      requestDate,
      expiryDate: st === 'Prêt pour retrait' ? addDays(REFERENCE_DATE, 3) : undefined,
      status: st,
      queuePosition: qPos,
      notes:
        st === 'Refusée'
          ? 'Quota simultané ou retard bloquant lors du contrôle.'
          : st === 'Expirée'
          ? 'Délai de retrait de 48h dépassé au guichet.'
          : undefined,
      isDemo: true,
    });
  });

  // =========================================================================
  // 5. FINALIZE PHYSICAL STOCK COUNTS FROM ACTUAL COPIES (100% COHERENT!)
  // =========================================================================
  books.forEach((bk) => {
    if (bk.copies && bk.copies.length > 0) {
      bk.totalCopies = bk.copies.length;
      bk.availableCopies = bk.copies.filter((c) => c.status === 'Disponible').length;
    }
  });

  // =========================================================================
  // 6. COHERENT REMINDER HISTORY, ACTIVITIES & NOTIFICATIONS
  // =========================================================================
  const reminderHistory: ReminderHistoryEntry[] = [];
  const overdueLoansWithReminders = loans.filter(
    (l) => l.status === 'En retard' && l.remindersSent > 0
  );

  overdueLoansWithReminders.slice(0, 28).forEach((l, idx) => {
    const member = members.find((m) => m.id === l.memberId);
    const d = l.lastReminderDate || addDays(REFERENCE_DATE, -2);
    reminderHistory.push({
      id: `rem-seed-${idx + 1}`,
      date: d,
      time: `${String(9 + (idx % 7)).padStart(2, '0')}:${String((idx * 13) % 60).padStart(2, '0')}`,
      isoTimestamp: `${d}T${String(9 + (idx % 7)).padStart(2, '0')}:15:00.000Z`,
      studentName: l.memberName,
      studentCne: l.memberCne,
      studentEmail: member?.email || `${slugifyName(l.memberName)}@usmba.ac.ma`,
      bookTitles: [l.bookTitle],
      overdueCount: 1,
      mode: idx % 3 === 0 ? 'collective' : 'individuelle',
      status: 'Envoyée',
    });
  });

  const activities: ActivityLog[] = [
    {
      id: 'act-01',
      timestamp: `${REFERENCE_DATE} 09:30`,
      type: 'sync',
      description: `Synchronisation Apogée USMBA : ${studentRegistry.length} dossiers étudiants EST Fès vérifiés.`,
      user: 'Scolarité EST',
    },
    {
      id: 'act-02',
      timestamp: `${REFERENCE_DATE} 09:15`,
      type: 'book',
      description: `Inventaire documentaire actualisé : ${books.length} notices et ${books.reduce((s, b) => s + b.totalCopies, 0)} exemplaires physiques indexés.`,
      user: 'Dr. Hassan Alami',
    },
  ];

  // Add recent real loan/return/reservation events to ActivityLog
  loans
    .filter((l) => l.status !== 'Rendu')
    .slice(0, 12)
    .forEach((l, idx) => {
      activities.push({
        id: `act-loan-${idx}`,
        timestamp: `${l.borrowDate} ${String(10 + (idx % 7)).padStart(2, '0')}:${String((idx * 7) % 60).padStart(2, '0')}`,
        type: 'loan',
        description: `Prêt guichet (${l.copyBarcode || l.bookShelfLocation}) : « ${l.bookTitle} » pour ${l.memberName}.`,
        user: 'Comptoir Bibliothèque EST',
      });
    });

  loans
    .filter((l) => l.status === 'Rendu' && l.returnDate)
    .slice(0, 8)
    .forEach((l, idx) => {
      activities.push({
        id: `act-ret-${idx}`,
        timestamp: `${l.returnDate} ${String(11 + (idx % 6)).padStart(2, '0')}:20`,
        type: 'return',
        description: `Retour enregistré : « ${l.bookTitle} » restitué par ${l.memberName}.`,
        user: 'Comptoir Bibliothèque EST',
      });
    });

  // Coherent mixed read/unread notifications for Gérant & Étudiants
  const notifications: AppNotification[] = [];

  // Manager notifications from overdue loans (top 20 + read older ones)
  const overdueLoansAll = loans.filter((l) => l.status === 'En retard');
  overdueLoansAll.slice(0, 22).forEach((loan, idx) => {
    const days = getOverdueDays(loan.dueDate, REFERENCE_DATE);
    notifications.push({
      id: `sys-overdue-gerant-${loan.id}`,
      title: 'Emprunt en retard détecté',
      message: `${loan.memberName} (${loan.memberCne}) accuse ${days} jour(s) de retard pour « ${loan.bookTitle} » (échéance : ${loan.dueDate}).`,
      createdAt: `${REFERENCE_DATE} ${String(8 + (idx % 4)).padStart(2, '0')}:${String((idx * 11) % 60).padStart(2, '0')}`,
      isoTimestamp: `${REFERENCE_DATE}T08:30:00.000Z`,
      isRead: idx >= 8, // 8 unread, rest already reviewed
      targetRole: 'gerant',
      category: 'overdue',
      targetTab: 'loans',
    });
  });

  // Manager notifications from ready/pending reservations
  reservations
    .filter((r) => r.status === 'En attente' || r.status === 'Prêt pour retrait')
    .slice(0, 12)
    .forEach((res, idx) => {
      notifications.push({
        id: `sys-res-gerant-${res.id}`,
        title: res.status === 'Prêt pour retrait' ? 'Réservation prête pour retrait' : 'Réservation en file d’attente',
        message: `${res.memberName} · « ${res.bookTitle} » (${res.status}).`,
        createdAt: `${res.requestDate} 14:10`,
        isoTimestamp: `${res.requestDate}T14:10:00.000Z`,
        isRead: idx >= 4,
        targetRole: 'gerant',
        category: 'reservation',
        targetTab: 'reservations',
      });
    });

  // Student notifications (including Hajar Amellah m-04, Amine m-01, Salma m-02, Youssef m-03)
  loans
    .filter((l) => l.status === 'En retard')
    .slice(0, 25)
    .forEach((loan, idx) => {
      const days = getOverdueDays(loan.dueDate, REFERENCE_DATE);
      const mem = members.find((m) => m.id === loan.memberId);
      notifications.push({
        id: `sys-overdue-student-${loan.id}`,
        title: 'Notification de retard',
        message: `Votre emprunt « ${loan.bookTitle} » a dépassé la date limite (${loan.dueDate}) de ${days} jour(s). Merci de le restituer rapidement.`,
        createdAt: `${REFERENCE_DATE} 09:00`,
        isoTimestamp: `${REFERENCE_DATE}T09:00:00.000Z`,
        isRead: idx % 3 === 0,
        targetRole: 'etudiant',
        recipientCne: loan.memberCne,
        recipientEmail: mem?.email,
        category: 'overdue',
        studentSubTab: 'my_loans',
      });
    });

  // Upcoming / due-today student reminders (especially Hajar & Salma)
  loans
    .filter((l) => l.status === 'En cours')
    .forEach((loan) => {
      const diff = getDaysDifference(REFERENCE_DATE, loan.dueDate);
      if (diff >= 0 && diff <= 2) {
        const mem = members.find((m) => m.id === loan.memberId);
        notifications.push({
          id: `sys-duesoon-${loan.id}`,
          title: diff === 0 ? 'Retour attendu aujourd’hui' : 'Rappel avant la date limite de retour',
          message:
            diff === 0
              ? `Le livre « ${loan.bookTitle} » doit être restitué aujourd’hui (${loan.dueDate}) au guichet de la bibliothèque.`
              : `Votre emprunt « ${loan.bookTitle} » arrive à échéance dans ${diff} jour(s) (${loan.dueDate}).`,
          createdAt: `${REFERENCE_DATE} 08:15`,
          isoTimestamp: `${REFERENCE_DATE}T08:15:00.000Z`,
          isRead: false,
          targetRole: 'etudiant',
          recipientCne: loan.memberCne,
          recipientEmail: mem?.email,
          category: 'reminder',
          studentSubTab: 'my_loans',
        });
      }
    });

    // Ready reservations notifications for students
  reservations
    .filter((r) => r.status === 'Prêt pour retrait')
    .forEach((res) => {
      const mem = members.find((m) => m.id === res.memberId);
      notifications.push({
        id: `sys-res-ready-${res.id}`,
        title: 'Livre réservé disponible pour retrait',
        message: `L’ouvrage « ${res.bookTitle} » est prêt pour retrait au guichet de l’EST jusqu’au ${res.expiryDate || addDays(REFERENCE_DATE, 2)}.`,
        createdAt: `${res.requestDate} 15:20`,
        isoTimestamp: `${res.requestDate}T15:20:00.000Z`,
        isRead: false,
        targetRole: 'etudiant',
        recipientCne: mem?.cne || res.memberCard,
        recipientEmail: mem?.email,
        category: 'reservation',
        studentSubTab: 'my_reservations',
      });
    });

  // Renewal activity logs & notifications tied to loans with extensionsCount > 0
  const extendedLoans = loans.filter((l) => l.extensionsCount > 0);
  extendedLoans.slice(0, 6).forEach((loan, idx) => {
    const mem = members.find((m) => m.id === loan.memberId);
    activities.push({
      id: `act-renew-${idx}`,
      timestamp: `${loan.borrowDate} ${String(12 + (idx % 5)).padStart(2, '0')}:40`,
      type: 'renew',
      description: `Prolongation (+14 j) accordée pour « ${loan.bookTitle} » (${loan.memberName}).`,
      user: loan.memberName,
    });

    notifications.push({
      id: `sys-renew-gerant-${loan.id}`,
      title: 'Prolongation enregistrée',
      message: `${loan.memberName} a prolongé « ${loan.bookTitle} » (nouvelle échéance : ${loan.dueDate}).`,
      createdAt: `${addDays(REFERENCE_DATE, -(idx % 4))} 11:05`,
      isoTimestamp: `${addDays(REFERENCE_DATE, -(idx % 4))}T11:05:00.000Z`,
      isRead: idx >= 2,
      targetRole: 'gerant',
      category: 'renewal',
      targetTab: 'loans',
    });

    notifications.push({
      id: `sys-renew-student-${loan.id}`,
      title: 'Renouvellement accepté',
      message: `Votre emprunt de « ${loan.bookTitle} » a été prolongé de 14 jours (échéance : ${loan.dueDate}).`,
      createdAt: `${addDays(REFERENCE_DATE, -(idx % 4))} 11:05`,
      isoTimestamp: `${addDays(REFERENCE_DATE, -(idx % 4))}T11:05:00.000Z`,
      isRead: true,
      targetRole: 'etudiant',
      recipientCne: loan.memberCne,
      recipientEmail: mem?.email,
      category: 'renewal',
      studentSubTab: 'my_loans',
    });
  });

  // Add historical read return, renewal & loan confirmations for Hajar (m-04) so her notification center feels rich
  if (hajar) {
    notifications.push(
      {
        id: 'notif-hajar-confirm-01',
        title: 'Confirmation d’emprunt',
        message: 'Votre emprunt de « Machine Learning avec Scikit-Learn, Keras et TensorFlow » a été validé. Échéance : 2026-10-23.',
        createdAt: '2026-10-02 11:20',
        isoTimestamp: '2026-10-02T11:20:00.000Z',
        isRead: true,
        targetRole: 'etudiant',
        recipientCne: hajar.cne,
        recipientEmail: hajar.email,
        category: 'loan',
        studentSubTab: 'my_loans',
      },
      {
        id: 'notif-hajar-ret-01',
        title: 'Confirmation de retour',
        message: 'La restitution de « Le Grand Meaulnes » a bien été enregistrée le 2026-10-11. Merci !',
        createdAt: '2026-10-11 16:40',
        isoTimestamp: '2026-10-11T16:40:00.000Z',
        isRead: true,
        targetRole: 'etudiant',
        recipientCne: hajar.cne,
        recipientEmail: hajar.email,
        category: 'return',
        studentSubTab: 'my_loans',
      }
    );
  }

  return {
    books,
    studentRegistry,
    members,
    universityUsers,
    loans,
    reservations,
    activities,
    notifications,
    reminderHistory,
  };
}
