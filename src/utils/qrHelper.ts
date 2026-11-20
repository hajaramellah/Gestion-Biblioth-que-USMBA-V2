import QRCode from 'qrcode';

export interface BookQrPayload {
  type: 'EST_BOOK';
  id: string;
  isbn: string;
  title: string;
  author: string;
  shelfLocation: string;
}

export interface StudentQrPayload {
  type: 'EST_STUDENT';
  cne: string;
  apogee: string;
  fullName: string;
  academicEmail: string;
  department: string;
  status: string;
}

export interface LoanReceiptQrPayload {
  type: 'EST_LOAN_RECEIPT';
  loanId: string;
  studentName: string;
  cne: string;
  apogee: string;
  bookTitle: string;
  isbn: string;
  borrowDate: string;
  dueDate: string;
  hash: string;
}

const qrCache = new Map<string, string>();

export const generateQrDataUrl = async (payload: string | object): Promise<string> => {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const cached = qrCache.get(content);
  if (cached) return cached;

  try {
    const dataUrl = await QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      margin: 1.5,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    if (qrCache.size > 150) {
      const firstKey = qrCache.keys().next().value;
      if (firstKey) qrCache.delete(firstKey);
    }
    qrCache.set(content, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
};

export const buildBookQrPayload = (book: {
  id: string;
  isbn: string;
  title: string;
  author: string;
  shelfLocation: string;
}): BookQrPayload => ({
  type: 'EST_BOOK',
  id: book.id,
  isbn: book.isbn,
  title: book.title,
  author: book.author,
  shelfLocation: book.shelfLocation,
});

export const buildStudentQrPayload = (student: {
  cne: string;
  apogee: string;
  firstName: string;
  lastName: string;
  email?: string;
  academicEmail?: string;
  department: string;
  status?: string;
  registrationStatus?: string;
}): StudentQrPayload => ({
  type: 'EST_STUDENT',
  cne: student.cne,
  apogee: student.apogee,
  fullName: `${student.firstName} ${student.lastName}`,
  academicEmail: student.academicEmail || student.email || '',
  department: student.department,
  status: student.registrationStatus || student.status || 'Inscrit',
});
