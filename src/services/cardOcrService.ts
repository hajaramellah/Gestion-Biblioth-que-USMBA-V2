import Tesseract from 'tesseract.js';
import { StudentRegistration } from '../types/library';

export interface OcrExtractionResult {
  rawText: string;
  matchedStudent: StudentRegistration | null;
  matchedBy: 'cne' | 'apogee' | 'email' | 'name' | 'none';
  extractedDetails: {
    cne?: string;
    apogee?: string;
    email?: string;
    name?: string;
    department?: string;
  };
}

/**
 * Pre-processes canvas image to enhance OCR recognition:
 * - Grayscale conversion
 * - Contrast stretch / thresholding
 */
export function preprocessCanvasForOcr(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const processedCanvas = document.createElement('canvas');
  processedCanvas.width = sourceCanvas.width;
  processedCanvas.height = sourceCanvas.height;
  const ctx = processedCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
  const data = imgData.data;

  // Enhance contrast & convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Luminance
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Contrast boost
    gray = (gray - 128) * 1.4 + 128;
    gray = Math.max(0, Math.min(255, gray));

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imgData, 0, 0);
  return processedCanvas;
}

/**
 * Runs OCR recognition using Tesseract.js
 */
export async function runCardOcr(
  imageSource: HTMLCanvasElement | string,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  try {
    const result = await Tesseract.recognize(
      imageSource,
      'eng', // alphanumeric characters for names, CNE, apogee & emails
      {
        logger: (m) => {
          if (onProgress && m.status) {
            onProgress(Math.round((m.progress || 0) * 100), m.status);
          }
        },
      }
    );
    return result.data.text || '';
  } catch (err) {
    console.warn('Tesseract OCR error:', err);
    throw err;
  }
}

/**
 * Matches extracted OCR text against EST USMBA academic registry
 */
export function matchStudentFromOcrText(
  rawText: string,
  studentRegistry: StudentRegistration[]
): OcrExtractionResult {
  const normalizedText = rawText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const extractedDetails: OcrExtractionResult['extractedDetails'] = {};

  // 1. Check for Academic Email (@usmba.ac.ma or prefix)
  const emailRegex = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;
  const emailsFound = rawText.match(emailRegex);
  if (emailsFound) {
    extractedDetails.email = emailsFound[0].toLowerCase();
    const matched = studentRegistry.find(
      (s) => s.academicEmail.toLowerCase() === extractedDetails.email
    );
    if (matched) {
      return {
        rawText,
        matchedStudent: matched,
        matchedBy: 'email',
        extractedDetails,
      };
    }
  }

  // Check email prefix match (e.g. amine.elidrissi)
  for (const student of studentRegistry) {
    const prefix = student.academicEmail.split('@')[0].toLowerCase();
    if (normalizedText.includes(prefix)) {
      extractedDetails.email = student.academicEmail;
      return {
        rawText,
        matchedStudent: student,
        matchedBy: 'email',
        extractedDetails,
      };
    }
  }

  // 2. Check for CNE / Massar number (e.g. N134089241 or letter + 8-9 digits)
  for (const student of studentRegistry) {
    const cleanCne = student.cne.toLowerCase();
    if (normalizedText.includes(cleanCne)) {
      extractedDetails.cne = student.cne;
      return {
        rawText,
        matchedStudent: student,
        matchedBy: 'cne',
        extractedDetails,
      };
    }
  }

  // Generalized CNE regex search
  const cneRegex = /\b([a-z]\d{8,9})\b/gi;
  const cneMatches = rawText.match(cneRegex);
  if (cneMatches) {
    const foundCne = cneMatches[0].toUpperCase();
    extractedDetails.cne = foundCne;
    const student = studentRegistry.find(
      (s) => s.cne.toUpperCase() === foundCne
    );
    if (student) {
      return {
        rawText,
        matchedStudent: student,
        matchedBy: 'cne',
        extractedDetails,
      };
    }
  }

  // 3. Check for Apogée number (7 or 8 digits)
  for (const student of studentRegistry) {
    if (student.apogee && normalizedText.includes(student.apogee.toLowerCase())) {
      extractedDetails.apogee = student.apogee;
      return {
        rawText,
        matchedStudent: student,
        matchedBy: 'apogee',
        extractedDetails,
      };
    }
  }

  // 4. Check for Student Full Name or Surname/Firstname combination
  for (const student of studentRegistry) {
    const first = student.firstName.toLowerCase();
    const last = student.lastName.toLowerCase();
    const fullName = `${first} ${last}`;

    if (normalizedText.includes(fullName)) {
      extractedDetails.name = `${student.firstName} ${student.lastName}`;
      return {
        rawText,
        matchedStudent: student,
        matchedBy: 'name',
        extractedDetails,
      };
    }

    // Both first and last names present anywhere in text
    if (normalizedText.includes(first) && normalizedText.includes(last)) {
      extractedDetails.name = `${student.firstName} ${student.lastName}`;
      return {
        rawText,
        matchedStudent: student,
        matchedBy: 'name',
        extractedDetails,
      };
    }

    // Last name alone if unique and distinct (length >= 5)
    if (last.length >= 5 && normalizedText.includes(last)) {
      extractedDetails.name = `${student.firstName} ${student.lastName}`;
      return {
        rawText,
        matchedStudent: student,
        matchedBy: 'name',
        extractedDetails,
      };
    }
  }

  return {
    rawText,
    matchedStudent: null,
    matchedBy: 'none',
    extractedDetails,
  };
}

export interface ExtractedNewStudent {
  firstName: string;
  lastName: string;
  cne: string;
  apogee: string;
  academicEmail: string;
  department: 'Génie Informatique (GI)' | 'Génie Électrique (GE)' | 'Génie Industriel et Maintenance (GIM)' | 'Techniques de Management (TM)' | 'Réseaux & Télécommunications (RT)' | 'Bio-analyses et Qualité (BQ)';
  studyYear: string;
}

/**
 * Extracts student profile data for NEW STUDENT ENROLMENT from raw OCR text
 */
export function extractNewStudentDataFromOcr(rawText: string): ExtractedNewStudent {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = rawText.replace(/\r/g, ' ');

  // 1. Email extraction
  let email = '';
  const emailMatch = fullText.match(/([a-zA-Z0-9._%+-]+@usmba\.ac\.ma)/i);
  if (emailMatch) {
    email = emailMatch[1].toLowerCase();
  }

  // 2. CNE extraction (Moroccan Massar/CNE: e.g. N134089241, R140921456, G139045123)
  let cne = '';
  const labeledCneMatch = fullText.match(/cne\s*[:.-]?\s*([A-Za-z0-9]+)/i);
  if (labeledCneMatch && labeledCneMatch[1].length >= 8) {
    cne = labeledCneMatch[1].toUpperCase();
  } else {
    const rawCneMatch = fullText.match(/\b([A-Za-z]\d{8,9})\b/i);
    if (rawCneMatch) {
      cne = rawCneMatch[1].toUpperCase();
    }
  }

  // 3. Apogée extraction
  let apogee = '';
  const labeledApogeeMatch = fullText.match(/apog[ée]e?\s*[:.-]?\s*(\d{6,9})/i);
  if (labeledApogeeMatch) {
    apogee = labeledApogeeMatch[1];
  } else {
    const rawApogeeMatch = fullText.match(/\b(2[0-9]{7})\b/);
    if (rawApogeeMatch) {
      apogee = rawApogeeMatch[1];
    }
  }

  // 4. Name extraction
  let firstName = '';
  let lastName = '';

  // Look for labeled Nom / Prénom
  const nomMatch = fullText.match(/nom\s*[:.-]?\s*([A-Za-zÀ-ÿ\s-]+)/i);
  const prenomMatch = fullText.match(/pr[ée]nom\s*[:.-]?\s*([A-Za-zÀ-ÿ\s-]+)/i);

  if (prenomMatch && prenomMatch[1]) {
    firstName = prenomMatch[1].split(/[\n,;]/)[0].trim();
  }
  if (nomMatch && nomMatch[1]) {
    lastName = nomMatch[1].split(/[\n,;]/)[0].trim();
  }

  // If labeled name was not found, try to extract from academic email (e.g. amine.elidrissi@usmba.ac.ma)
  if ((!firstName || !lastName) && email) {
    const localPart = email.split('@')[0];
    const emailParts = localPart.split('.');
    if (emailParts.length >= 2) {
      if (!firstName) firstName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
      if (!lastName) lastName = emailParts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
  }

  // Fallback candidate search from text lines
  if (!firstName || !lastName) {
    const ignoredWords = [
      'royaume', 'maroc', 'universite', 'sidi', 'mohamed', 'ben', 'abdellah',
      'ecole', 'superieure', 'technologie', 'fes', 'carte', 'etudiant', 'cne',
      'apogee', 'filiere', 'departement', 'dut', 'licence', 'professionnelle',
      'annee', 'universitaire', 'valide'
    ];

    for (const line of lines) {
      const cleanLine = line.toLowerCase();
      const hasIgnored = ignoredWords.some((w) => cleanLine.includes(w));
      const hasNumbers = /\d/.test(cleanLine);
      const words = line.split(/\s+/).filter((w) => w.length >= 2);

      if (!hasIgnored && !hasNumbers && words.length >= 2 && words.length <= 4) {
        if (!firstName) firstName = words[0];
        if (!lastName) lastName = words.slice(1).join(' ');
        break;
      }
    }
  }

  // Clean fallback if still missing
  if (!firstName) firstName = 'Étudiant';
  if (!lastName) lastName = 'Inscrit EST';

  // Capitalize properly
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  lastName = lastName.toUpperCase();

  // Ensure CNE
  if (!cne) {
    cne = `N${Math.floor(130000000 + Math.random() * 9999999)}`;
  }

  // Ensure Apogée
  if (!apogee) {
    apogee = String(Math.floor(24000000 + Math.random() * 999999));
  }

  // Ensure Academic Email with official institutional domain @usmba.ac.ma
  if (!email) {
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
    email = `${cleanFirst}.${cleanLast}@usmba.ac.ma`;
  }

  // 5. Department extraction
  const lowerText = fullText.toLowerCase();
  let department: ExtractedNewStudent['department'] = 'Génie Informatique (GI)';

  if (lowerText.includes('electrique') || lowerText.includes(' ge ') || lowerText.includes('(ge)')) {
    department = 'Génie Électrique (GE)';
  } else if (lowerText.includes('maintenance') || lowerText.includes('industriel') || lowerText.includes('gim')) {
    department = 'Génie Industriel et Maintenance (GIM)';
  } else if (lowerText.includes('management') || lowerText.includes(' tm ') || lowerText.includes('(tm)')) {
    department = 'Techniques de Management (TM)';
  } else if (lowerText.includes('reseaux') || lowerText.includes('telecom') || lowerText.includes(' rt ') || lowerText.includes('(rt)')) {
    department = 'Réseaux & Télécommunications (RT)';
  } else if (lowerText.includes('bio') || lowerText.includes('qualite') || lowerText.includes('bq')) {
    department = 'Bio-analyses et Qualité (BQ)';
  }

  return {
    firstName,
    lastName,
    cne,
    apogee,
    academicEmail: email,
    department,
    studyYear: 'DUT 1ère année',
  };
}

