import { StudentRegistration, RegistrationStatus } from '../types/library';
import { INITIAL_EST_STUDENTS } from '../data/seedData';
import { getEnrichedDemoDataset } from '../data/enrichedDataset';
import { generateQrDataUrl, buildStudentQrPayload } from '../utils/qrHelper';

export { INITIAL_EST_STUDENTS };

const STORAGE_KEY_ACADEMIC_REGISTRY = 'est_usmba_academic_registry_v3';

export class AcademicRegistryService {
  private static students: StudentRegistration[] = [];

  public static async initialize(): Promise<StudentRegistration[]> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACADEMIC_REGISTRY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 50) {
          this.students = parsed;
          return this.students;
        }
      }
    } catch {
      // ignore
    }

    const demoStudents = getEnrichedDemoDataset().studentRegistry;
    const list: StudentRegistration[] = [];

    // Pre-generate QR codes only for the 6 core showcase students so startup is instant
    for (const s of demoStudents) {
      if (!s.isDemo) {
        const qrCodeDataUrl = await generateQrDataUrl(buildStudentQrPayload(s));
        list.push({ ...s, qrCodeDataUrl });
      } else {
        list.push({ ...s });
      }
    }

    this.students = list;
    this.save();
    return this.students;
  }

  public static getAll(): StudentRegistration[] {
    if (this.students.length === 0) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_ACADEMIC_REGISTRY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.students = parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return this.students;
  }

  public static save() {
    try {
      localStorage.setItem(STORAGE_KEY_ACADEMIC_REGISTRY, JSON.stringify(this.students));
    } catch (e) {
      console.error('Failed to save academic registry:', e);
    }
  }

  public static validateAcademicEmail(email: string): {
    isValidDomain: boolean;
    formatCorrect: boolean;
    cleanEmail: string;
  } {
    const clean = email.trim().toLowerCase();
    const isValidDomain = clean.endsWith('@usmba.ac.ma');
    const parts = clean.split('@');
    const localPart = parts[0] || '';
    const formatCorrect = isValidDomain && localPart.includes('.') && localPart.length >= 4;

    return {
      isValidDomain,
      formatCorrect,
      cleanEmail: clean,
    };
  }

  public static findByEmail(email: string): StudentRegistration | undefined {
    const clean = email.trim().toLowerCase();
    return this.getAll().find((s) => s.academicEmail.toLowerCase() === clean);
  }

  public static findByCneOrApogee(identifier: string): StudentRegistration | undefined {
    const clean = identifier.trim().toLowerCase();
    return this.getAll().find(
      (s) => s.cne.toLowerCase() === clean || s.apogee.toLowerCase() === clean
    );
  }

  public static async addStudent(
    data: Omit<StudentRegistration, 'id' | 'qrCodeDataUrl'>
  ): Promise<StudentRegistration> {
    const id = `reg-${Date.now()}`;
    const qrCodeDataUrl = await generateQrDataUrl(buildStudentQrPayload(data));

    const newStudent: StudentRegistration = {
      ...data,
      id,
      qrCodeDataUrl,
    };

    this.students = [newStudent, ...this.getAll()];
    this.save();
    return newStudent;
  }

  public static async updateStudentStatus(
    id: string,
    newStatus: RegistrationStatus
  ): Promise<boolean> {
    const list = this.getAll();
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) return false;

    const student = list[index];
    student.registrationStatus = newStatus;
    student.qrCodeDataUrl = await generateQrDataUrl(
      buildStudentQrPayload({ ...student, registrationStatus: newStatus })
    );

    list[index] = student;
    this.students = list;
    this.save();
    return true;
  }

  public static deleteStudent(id: string): boolean {
    const initialLen = this.getAll().length;
    this.students = this.getAll().filter((s) => s.id !== id);
    this.save();
    return this.students.length < initialLen;
  }

  public static async reset() {
    localStorage.removeItem(STORAGE_KEY_ACADEMIC_REGISTRY);
    this.students = [];
    await this.initialize();
  }
}
