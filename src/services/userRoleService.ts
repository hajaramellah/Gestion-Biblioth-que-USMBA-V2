import { AcademicRegistryService } from './academicRegistryService';
import { getEnrichedDemoDataset } from '../data/enrichedDataset';

export type UserRole = 'gerant' | 'etudiant';

export interface UniversityUser {
  id: string;
  academicEmail: string; // @usmba.ac.ma
  fullName: string;
  role: UserRole;
  title: string;
  department: string;
  cne?: string;
  apogee?: string;
  status: 'Actif' | 'Radié' | 'Suspendu';
  avatarColor: string;
  photoUrl?: string;
}

const STORAGE_KEY_USERS = 'est_usmba_users_registry_v3';

export const INITIAL_UNIVERSITY_USERS: UniversityUser[] = [
  {
    id: 'usr-gerant-01',
    academicEmail: 'biblio.gerant@usmba.ac.ma',
    fullName: 'Dr. Hassan Alami',
    role: 'gerant',
    title: 'Conservateur en Chef & Gérant de la Bibliothèque',
    department: 'Service Commun de la Documentation EST Fès',
    status: 'Actif',
    avatarColor: 'bg-emerald-700',
  },
  {
    id: 'usr-gerant-02',
    academicEmail: 'karim.bennouna@usmba.ac.ma',
    fullName: 'Karim Bennouna',
    role: 'gerant',
    title: 'Gérant Adjoint & Responsable des Prêts & Acquisitions',
    department: 'Médiathèque & Bibliothèque EST Fès',
    status: 'Actif',
    avatarColor: 'bg-teal-700',
  },
  {
    id: 'usr-gerant-03',
    academicEmail: 'admin.est@usmba.ac.ma',
    fullName: 'Administration Bibliothèque',
    role: 'gerant',
    title: 'Direction de la Documentation & Systèmes',
    department: 'Administration EST Fès',
    status: 'Actif',
    avatarColor: 'bg-slate-800',
  },
  {
    id: 'usr-etud-01',
    academicEmail: 'hajar.amellah@usmba.ac.ma',
    fullName: 'Hajar Amellah',
    role: 'etudiant',
    title: 'Étudiante · Licence Professionnelle (LP-GL)',
    department: 'Génie Informatique (GI)',
    cne: 'N139045123',
    apogee: '21017320',
    status: 'Actif',
    avatarColor: 'bg-indigo-600',
  },
  {
    id: 'usr-etud-02',
    academicEmail: 'amine.elidrissi@usmba.ac.ma',
    fullName: 'Amine El Idrissi',
    role: 'etudiant',
    title: 'Étudiant · DUT 2ème année',
    department: 'Génie Informatique (GI)',
    cne: 'N134089241',
    apogee: '22019485',
    status: 'Actif',
    avatarColor: 'bg-blue-600',
  },
  {
    id: 'usr-etud-03',
    academicEmail: 'salma.bennani@usmba.ac.ma',
    fullName: 'Salma Bennani',
    role: 'etudiant',
    title: 'Étudiante · DUT 1ère année',
    department: 'Techniques de Management (TM)',
    cne: 'N142078319',
    apogee: '23014592',
    status: 'Actif',
    avatarColor: 'bg-amber-600',
  },
  {
    id: 'usr-etud-04',
    academicEmail: 'youssef.chraibi@usmba.ac.ma',
    fullName: 'Youssef Chraibi',
    role: 'etudiant',
    title: 'Étudiant · DUT 2ème année',
    department: 'Génie Électrique (GE)',
    cne: 'N138091456',
    apogee: '22018841',
    status: 'Actif',
    avatarColor: 'bg-cyan-600',
  },
  {
    id: 'usr-etud-05',
    academicEmail: 'oumaima.fassi@usmba.ac.ma',
    fullName: 'Oumaima Fassi',
    role: 'etudiant',
    title: 'Étudiante · DUT 1ère année',
    department: 'Réseaux & Télécommunications (RT)',
    cne: 'N146056789',
    apogee: '23019844',
    status: 'Actif',
    avatarColor: 'bg-purple-600',
  },
  {
    id: 'usr-etud-06',
    academicEmail: 'mehdi.tazi@usmba.ac.ma',
    fullName: 'Mehdi Tazi',
    role: 'etudiant',
    title: 'Étudiant Radié par la scolarité',
    department: 'Génie Industriel et Maintenance (GIM)',
    cne: 'N135012398',
    apogee: '22016590',
    status: 'Radié',
    avatarColor: 'bg-rose-700',
  },
];

export class UserRoleService {
  private static users: UniversityUser[] = [];

  public static initialize(): UniversityUser[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 50) {
          this.users = parsed;
          return this.users;
        }
      }
    } catch {
      // ignore
    }

    const generatedStudents = getEnrichedDemoDataset().universityUsers;
    this.users = [...INITIAL_UNIVERSITY_USERS, ...generatedStudents];
    this.save();
    return this.users;
  }

  public static getAll(): UniversityUser[] {
    if (this.users.length === 0) {
      this.initialize();
    }
    return this.users;
  }

  public static save() {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.users));
    } catch (e) {
      console.error('Failed to save user role registry:', e);
    }
  }

  public static findByEmail(email: string): UniversityUser | undefined {
    const clean = email.trim().toLowerCase();
    const list = this.getAll();
    const found = list.find((u) => u.academicEmail.toLowerCase() === clean);
    if (found) return found;

    const enrolledStudent = AcademicRegistryService.findByEmail(clean);
    if (enrolledStudent) {
      const newUser: UniversityUser = {
        id: `usr-${enrolledStudent.id}`,
        academicEmail: enrolledStudent.academicEmail,
        fullName: `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        role: 'etudiant',
        title: `Étudiant(e) · ${enrolledStudent.studyYear}`,
        department: enrolledStudent.department,
        cne: enrolledStudent.cne,
        apogee: enrolledStudent.apogee,
        status: enrolledStudent.registrationStatus === 'Radié' ? 'Radié' : 'Actif',
        avatarColor: 'bg-emerald-600',
      };
      this.addUser(newUser);
      return newUser;
    }

    return undefined;
  }

  public static addUser(user: UniversityUser) {
    const list = this.getAll();
    const existingIndex = list.findIndex(
      (u) => u.academicEmail.toLowerCase() === user.academicEmail.toLowerCase()
    );
    if (existingIndex >= 0) {
      list[existingIndex] = user;
    } else {
      list.push(user);
    }
    this.users = list;
    this.save();
  }

  public static updateRole(email: string, newRole: UserRole): boolean {
    const list = this.getAll();
    const index = list.findIndex(
      (u) => u.academicEmail.toLowerCase() === email.trim().toLowerCase()
    );
    if (index === -1) return false;
    list[index].role = newRole;
    this.users = list;
    this.save();
    return true;
  }

  public static getGerants(): UniversityUser[] {
    return this.getAll().filter((u) => u.role === 'gerant');
  }

  public static getStudents(): UniversityUser[] {
    return this.getAll().filter((u) => u.role === 'etudiant');
  }
}
