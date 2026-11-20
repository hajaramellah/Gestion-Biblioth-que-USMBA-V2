import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book, BookCopy, StudentRegistration, Loan, Reservation } from '../../types/library';
import { preprocessCanvasForOcr, runCardOcr, matchStudentFromOcrText } from '../../services/cardOcrService';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ScanLine,
  Camera,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  UserCheck,
  BookOpen,
  Printer,
  Download,
  RefreshCw,
  Lock,
  Upload,
  Search,
  Trash2,
  Plus,
  Pause,
  Play,
  ArrowLeft,
  QrCode,
  ShieldAlert,
} from 'lucide-react';

interface SmartQrBorrowModalProps {
  initialBook?: Book | null;
  initialReservation?: Reservation | null;
  onClose: () => void;
}

interface SelectedCopyItem {
  key: string;
  book: Book;
  copy?: BookCopy;
  copyLabel: string;
  addedVia: 'qr' | 'manual';
  reservationId?: string;
}

interface ScanFeedback {
  type: 'success' | 'warning' | 'error';
  message: string;
  ts: number;
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(isoDate + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export const SmartQrBorrowModal: React.FC<SmartQrBorrowModalProps> = ({
  initialBook,
  initialReservation,
  onClose,
}) => {
  const {
    books,
    members,
    loans,
    reservations,
    studentRegistry,
    validateBatchSmartLoan,
    currentDate,
  } = useLibrary();

  // Step state: 1. select_student -> 2. scan_books (continuous) -> 3. review -> 4. completed
  const [activeStep, setActiveStep] = useState<'select_student' | 'scan_books' | 'review' | 'completed'>('select_student');
  const [studentIdMode, setStudentIdMode] = useState<'search' | 'ocr'>('search');
  const [studentQuery, setStudentQuery] = useState('');

  // Session state
  const [scannedStudent, setScannedStudent] = useState<StudentRegistration | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedCopyItem[]>([]);
  const [loanDuration, setLoanDuration] = useState<number>(21);
  const [createdLoans, setCreatedLoans] = useState<Loan[]>([]);

  // Feedback & Scanner status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [bookCameraError, setBookCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedOcrText, setExtractedOcrText] = useState<string | null>(null);
  const [bookFilterQuery, setBookFilterQuery] = useState('');
  const [isContinuousScannerActive, setIsContinuousScannerActive] = useState(true);
  const [isBookScannerRunning, setIsBookScannerRunning] = useState(false);

  // Refs for OCR card camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Refs for continuous book QR scanner
  const bookScannerRef = useRef<Html5Qrcode | null>(null);
  const bookReaderId = 'book-qr-continuous-scanner';
  const lastScanRef = useRef<{ raw: string; ts: number }>({ raw: '', ts: 0 });
  const initialBookAppliedRef = useRef(false);

  // Sound/haptic feedback
  const playSuccessFeedback = () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(100);
      }
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // Ignore AudioContext restriction errors
    }
  };

  // Helper: get student loan eligibility and quota info
  const getStudentLoanProfile = (student: StudentRegistration) => {
    const member = members.find(
      (m) =>
        m.cne.toLowerCase() === student.cne.toLowerCase() ||
        m.email.toLowerCase() === student.academicEmail.toLowerCase()
    );
    const activeLoans = loans.filter(
      (l) =>
        l.status !== 'Rendu' &&
        (l.memberCne.toLowerCase() === student.cne.toLowerCase() ||
          (member && l.memberId === member.id))
    );
    const overdueCount = activeLoans.filter((l) => l.status === 'En retard').length;
    const maxAllowed = member?.maxAllowedLoans || 5;
    const remainingQuota = Math.max(0, maxAllowed - activeLoans.length);
    const isBlockedStatus =
      student.registrationStatus === 'Radié' ||
      student.registrationStatus === 'Suspendu' ||
      member?.status === 'Radié' ||
      member?.status === 'Suspendu';

    let blockReason: string | null = null;
    if (student.registrationStatus === 'Radié' || member?.status === 'Radié') {
      blockReason = `Étudiant radié (${student.firstName} ${student.lastName}) — emprunt interdit.`;
    } else if (student.registrationStatus === 'Suspendu' || member?.status === 'Suspendu') {
      blockReason = `Compte suspendu (${student.firstName} ${student.lastName}) — emprunt bloqué.`;
    } else if (overdueCount > 0) {
      blockReason = `${student.firstName} ${student.lastName} possède ${overdueCount} emprunt(s) en retard non restitué(s).`;
    } else if (remainingQuota <= 0) {
      blockReason = `Quota maximal atteint (${activeLoans.length}/${maxAllowed} ouvrages empruntés).`;
    }

    return {
      member,
      activeCount: activeLoans.length,
      overdueCount,
      maxAllowed,
      remainingQuota,
      isEligible: !isBlockedStatus && overdueCount === 0 && remainingQuota > 0,
      blockReason,
    };
  };

  const selectedStudentProfile = useMemo(
    () => (scannedStudent ? getStudentLoanProfile(scannedStudent) : null),
    [scannedStudent, members, loans]
  );

  // Filtered students for direct search
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const list = studentRegistry.filter((s) => {
      if (!q) return true;
      return (
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        `${s.lastName} ${s.firstName}`.toLowerCase().includes(q) ||
        s.cne.toLowerCase().includes(q) ||
        s.apogee.toLowerCase().includes(q) ||
        s.academicEmail.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
      );
    });
    return list.slice(0, 25);
  }, [studentRegistry, studentQuery]);

  // ==========================================
  // CAMERA STREAM LIFECYCLE FOR OCR CARD SCAN
  // ==========================================
  const startCardCamera = async () => {
    setCameraPermissionError(null);
    setErrorMessage(null);
    setIsCameraStarting(true);
    stopCardCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: unknown) {
      setIsCameraActive(false);
      const errName = (err as { name?: string })?.name || '';
      const errText = String(err || '');
      if (errName === 'NotAllowedError' || errText.includes('NotAllowedError') || errText.includes('Permission')) {
        setCameraPermissionError(
          'Permission d’accès à la caméra refusée. Autorisez la caméra dans votre navigateur ou utilisez la recherche directe.'
        );
      } else if (errName === 'NotFoundError') {
        setCameraPermissionError('Aucune caméra détectée sur ce poste. Utilisez la recherche directe ci-contre.');
      } else {
        setCameraPermissionError('Flux caméra indisponible. Vous pouvez sélectionner l’étudiant par recherche directe.');
      }
    } finally {
      setIsCameraStarting(false);
    }
  };

  const stopCardCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (activeStep === 'select_student' && studentIdMode === 'ocr') {
      const timer = setTimeout(() => {
        startCardCamera();
      }, 200);
      return () => clearTimeout(timer);
    } else {
      stopCardCamera();
    }
  }, [activeStep, studentIdMode]);

  useEffect(() => {
    return () => {
      stopCardCamera();
      stopBookScanner();
    };
  }, []);

  const doesStudentMatchReservation = (student: StudentRegistration, res: Reservation) => {
    const resMember = members.find(
      (m) => m.id === res.memberId || m.cne === res.memberCard || m.cardNumber === res.memberCard
    );
    const targetCne = (res.memberCne || resMember?.cne || '').toLowerCase();
    const targetEmail = (resMember?.email || '').toLowerCase();
    if (targetCne && student.cne.toLowerCase() === targetCne) return true;
    if (targetEmail && student.academicEmail.toLowerCase() === targetEmail) return true;
    if (res.memberCard && student.cne.toLowerCase() === res.memberCard.toLowerCase()) return true;
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    return fullName === res.memberName.toLowerCase();
  };

  // Select student and open borrowing session
  const handleSelectStudent = (student: StudentRegistration, viaOcr = false) => {
    if (initialReservation && !doesStudentMatchReservation(student, initialReservation)) {
      setErrorMessage(
        `Vérification d’identité : cette réservation appartient à ${initialReservation.memberName} (${initialReservation.memberCne || initialReservation.memberCard}), et non à ${student.firstName} ${student.lastName}.`
      );
      return;
    }

    const profile = getStudentLoanProfile(student);
    if (!profile.isEligible) {
      setErrorMessage(profile.blockReason || 'Cet étudiant ne peut pas emprunter pour le moment.');
      return;
    }

    if (viaOcr) {
      playSuccessFeedback();
    }
    setErrorMessage(null);
    setScanFeedback(null);
    stopCardCamera();
    setScannedStudent(student);
    setSelectedItems([]);
    initialBookAppliedRef.current = false;
    setIsContinuousScannerActive(true);
    setActiveStep('scan_books');
  };

  // Pre-add initialReservation or initialBook on entering scan_books once per student selection
  useEffect(() => {
    if (
      activeStep === 'scan_books' &&
      scannedStudent &&
      initialReservation &&
      !initialBookAppliedRef.current
    ) {
      initialBookAppliedRef.current = true;
      const latestBook = books.find((b) => b.id === initialReservation.bookId);
      if (latestBook) {
        const reservedCopy =
          (initialReservation.copyId
            ? latestBook.copies?.find((c) => c.id === initialReservation.copyId)
            : undefined) ||
          latestBook.copies?.find((c) => c.status === 'Réservé') ||
          latestBook.copies?.find((c) => c.status === 'Disponible');
        const key = reservedCopy
          ? `copy-${reservedCopy.id}`
          : `res-${initialReservation.id}`;
        const copyLabel =
          reservedCopy?.barcode ||
          initialReservation.copyBarcode ||
          `${latestBook.shelfLocation} (Réservé)`;
        setSelectedItems([
          {
            key,
            book: latestBook,
            copy: reservedCopy,
            copyLabel,
            addedVia: 'manual',
            reservationId: initialReservation.id,
          },
        ]);
        setScanFeedback({
          type: 'success',
          message: `Réservation vérifiée : « ${latestBook.title} » (${copyLabel}). Vous pouvez scanner d’autres livres ou valider la remise.`,
          ts: Date.now(),
        });
      }
      return;
    }

    if (
      activeStep === 'scan_books' &&
      scannedStudent &&
      initialBook &&
      !initialBookAppliedRef.current
    ) {
      initialBookAppliedRef.current = true;
      const latestBook = books.find((b) => b.id === initialBook.id) || initialBook;
      const firstAvailCopy = latestBook.copies?.find((c) => c.status === 'Disponible');
      if (latestBook.availableCopies > 0 && (!latestBook.copies?.length || firstAvailCopy)) {
        const key = firstAvailCopy ? `copy-${firstAvailCopy.id}` : `book-${latestBook.id}-1`;
        setSelectedItems([
          {
            key,
            book: latestBook,
            copy: firstAvailCopy,
            copyLabel: firstAvailCopy?.barcode || `${latestBook.shelfLocation} (Std)`,
            addedVia: 'manual',
          },
        ]);
        setScanFeedback({
          type: 'success',
          message: `Pré-sélectionné : « ${latestBook.title} » (${firstAvailCopy?.barcode || latestBook.shelfLocation}). Scannez d'autres ouvrages ou validez.`,
          ts: Date.now(),
        });
      }
    }
  }, [activeStep, scannedStudent, initialBook, initialReservation, books]);

  // ==========================================
  // OCR CARD CAPTURE & VISION PROCESSING
  // ==========================================
  const handleCaptureAndAnalyzeCard = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsOcrProcessing(true);
    setOcrProgressText('Capture haute résolution de la carte...');
    setErrorMessage(null);
    setExtractedOcrText(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Impossible de créer le contexte 2D');

      ctx.drawImage(video, 0, 0, width, height);
      setOcrProgressText('Prétraitement d’image & Contraste...');
      const preprocessed = preprocessCanvasForOcr(canvas);

      setOcrProgressText('Reconnaissance Optique des Caractères (OCR)...');
      const rawText = await runCardOcr(preprocessed, (pct, status) => {
        setOcrProgressText(`Analyse OCR : ${status} (${pct}%)`);
      });

      setExtractedOcrText(rawText);
      processOcrResult(rawText);
    } catch (err: unknown) {
      setErrorMessage(
        `Échec de la lecture optique : ${(err as { message?: string })?.message || 'Vérifiez la netteté et la luminosité'}.`
      );
    } finally {
      setIsOcrProcessing(false);
      setOcrProgressText('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    setOcrProgressText('Chargement de l’image de la carte...');
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const preprocessed = preprocessCanvasForOcr(canvas);
            setOcrProgressText('Reconnaissance optique du texte (OCR)...');
            const rawText = await runCardOcr(preprocessed, (pct, status) => {
              setOcrProgressText(`Analyse : ${status} (${pct}%)`);
            });
            setExtractedOcrText(rawText);
            processOcrResult(rawText);
          }
        } catch (err: unknown) {
          setErrorMessage(`Erreur de traitement de l’image : ${(err as { message?: string })?.message || ''}`);
        } finally {
          setIsOcrProcessing(false);
          setOcrProgressText('');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processOcrResult = (rawText: string) => {
    if (!rawText.trim()) {
      setErrorMessage(
        'Aucun texte lisible détecté sur la carte. Rapprochez la carte de l’objectif ou utilisez la recherche directe.'
      );
      return;
    }

    const ocrMatch = matchStudentFromOcrText(rawText, studentRegistry);
    if (!ocrMatch.matchedStudent) {
      setErrorMessage(
        'Texte lu, mais aucun étudiant correspondant n’a été trouvé dans le registre EST Fès.'
      );
      return;
    }

    handleSelectStudent(ocrMatch.matchedStudent, true);
  };

  // ==========================================
  // STEP 2: CONTINUOUS MULTI-SCAN QR PIPELINE
  // ==========================================
  const addScannedBookOrCopy = (
    rawData: string,
    source: 'qr' | 'manual',
    explicitCopyId?: string
  ) => {
    if (!scannedStudent || !selectedStudentProfile) return;

    const trimmedRaw = rawData.trim();
    if (!trimmedRaw) return;

    // Anti-double-scan cooldown for continuous camera stream (same payload within 2.2s)
    if (source === 'qr') {
      const now = Date.now();
      if (
        lastScanRef.current.raw === trimmedRaw &&
        now - lastScanRef.current.ts < 2200
      ) {
        return;
      }
      lastScanRef.current = { raw: trimmedRaw, ts: now };
    }

    // Parse QR payload (JSON EST_BOOK / EST_COPY or raw barcode / ID / ISBN / Cote)
    let bookIdentifier = trimmedRaw;
    let payloadCopyId: string | undefined = explicitCopyId;
    let payloadBarcode: string | undefined;

    if (trimmedRaw.startsWith('{') && trimmedRaw.endsWith('}')) {
      try {
        const payload = JSON.parse(trimmedRaw) as Record<string, unknown>;
        if (payload.type === 'EST_COPY') {
          bookIdentifier = String(payload.bookId || payload.isbn || payload.barcode || '');
          payloadCopyId = payloadCopyId || (payload.copyId ? String(payload.copyId) : undefined);
          payloadBarcode = payload.barcode ? String(payload.barcode) : undefined;
        } else if (payload.type === 'EST_BOOK') {
          bookIdentifier = String(payload.id || payload.isbn || payload.shelfLocation || '');
          if (payload.copyId) payloadCopyId = String(payload.copyId);
          if (payload.copyBarcode) payloadBarcode = String(payload.copyBarcode);
        } else if (payload.type === 'EST_LOAN_RECEIPT' || payload.type === 'EST_STUDENT') {
          setScanFeedback({
            type: 'warning',
            message: 'Ce QR Code ne correspond pas à un ouvrage du catalogue (utilisez le QR du livre ou de son exemplaire).',
            ts: Date.now(),
          });
          return;
        }
      } catch {
        // Fallback to raw identifier matching
      }
    }

    const clean = bookIdentifier.toLowerCase();
    const cleanBarcode = (payloadBarcode || trimmedRaw).toLowerCase();

    // 1. Find matching book (also check individual copy barcode/id across all books)
    let matchedCopy: BookCopy | undefined;
    let book = books.find((b) => {
      const copyHit = b.copies?.find(
        (c) =>
          (payloadCopyId && c.id === payloadCopyId) ||
          c.barcode.toLowerCase() === cleanBarcode ||
          c.id.toLowerCase() === clean
      );
      if (copyHit) {
        matchedCopy = copyHit;
        return true;
      }
      return (
        b.id.toLowerCase() === clean ||
        b.isbn.toLowerCase() === clean ||
        b.shelfLocation.toLowerCase() === clean ||
        b.title.toLowerCase() === clean
      );
    });

    if (!book && source === 'qr') {
      // Secondary fuzzy title match only if unambiguous
      book = books.find((b) => clean.length >= 4 && b.title.toLowerCase().includes(clean));
    }

    if (!book) {
      setScanFeedback({
        type: 'error',
        message: `QR Code non reconnu dans le catalogue EST (${trimmedRaw.slice(0, 36)}).`,
        ts: Date.now(),
      });
      return;
    }

    // 2. Check student remaining quota BEFORE adding
    if (selectedStudentProfile.activeCount + selectedItems.length >= selectedStudentProfile.maxAllowed) {
      setScanFeedback({
        type: 'warning',
        message: `Quota atteint : ${scannedStudent.firstName} ${scannedStudent.lastName} ne peut pas emprunter plus de ${selectedStudentProfile.maxAllowed} ouvrages simultanément.`,
        ts: Date.now(),
      });
      return;
    }

    // 3. Resolve target copy and check availability & deduplication
    const alreadySelectedCopyIds = new Set(
      selectedItems.filter((it) => it.copy).map((it) => it.copy!.id)
    );
    const alreadySelectedCountForBook = selectedItems.filter(
      (it) => it.book.id === book!.id
    ).length;

    let matchedReservationId: string | undefined;

    if (matchedCopy) {
      if (alreadySelectedCopyIds.has(matchedCopy.id)) {
        setScanFeedback({
          type: 'warning',
          message: `Exemplaire déjà sélectionné : « ${book.title} » (${matchedCopy.barcode}).`,
          ts: Date.now(),
        });
        return;
      }
      if (matchedCopy.status === 'Réservé') {
        const matchingReadyRes = reservations.find(
          (r) =>
            r.bookId === book!.id &&
            (r.status === 'Prêt pour retrait' || r.status === 'Confirmée') &&
            (!r.copyId || r.copyId === matchedCopy!.id) &&
            doesStudentMatchReservation(scannedStudent, r)
        );
        if (!matchingReadyRes) {
          setScanFeedback({
            type: 'warning',
            message: `Exemplaire réservé : ${matchedCopy.barcode} (« ${book.title} ») est réservé pour un autre étudiant.`,
            ts: Date.now(),
          });
          return;
        }
        matchedReservationId = matchingReadyRes.id;
      } else if (matchedCopy.status !== 'Disponible') {
        setScanFeedback({
          type: 'warning',
          message: `Exemplaire indisponible : ${matchedCopy.barcode} (« ${book.title} ») est actuellement « ${matchedCopy.status} ».`,
          ts: Date.now(),
        });
        return;
      }
    } else if (book.copies && book.copies.length > 0) {
      const nextAvailableCopy = book.copies.find(
        (c) => c.status === 'Disponible' && !alreadySelectedCopyIds.has(c.id)
      );
      if (!nextAvailableCopy) {
        const studentReadyRes = reservations.find(
          (r) =>
            r.bookId === book!.id &&
            (r.status === 'Prêt pour retrait' || r.status === 'Confirmée') &&
            doesStudentMatchReservation(scannedStudent, r)
        );
        const reservedCopy =
          studentReadyRes?.copyId
            ? book.copies.find(
                (c) => c.id === studentReadyRes.copyId && !alreadySelectedCopyIds.has(c.id)
              )
            : book.copies.find(
                (c) => c.status === 'Réservé' && !alreadySelectedCopyIds.has(c.id)
              );
        if (studentReadyRes && reservedCopy) {
          matchedCopy = reservedCopy;
          matchedReservationId = studentReadyRes.id;
        } else {
          const reason =
            alreadySelectedCountForBook > 0
              ? `Tous les exemplaires disponibles de « ${book.title} » sont déjà dans votre sélection.`
              : `Aucun exemplaire disponible en rayon pour « ${book.title} ».`;
          setScanFeedback({
            type: 'warning',
            message: reason,
            ts: Date.now(),
          });
          return;
        }
      } else {
        matchedCopy = nextAvailableCopy;
      }
    } else {
      if (book.availableCopies - alreadySelectedCountForBook <= 0) {
        setScanFeedback({
          type: 'warning',
          message:
            alreadySelectedCountForBook > 0
              ? `Tous les exemplaires disponibles de « ${book.title} » sont déjà sélectionnés.`
              : `Stock épuisé pour « ${book.title} ».`,
          ts: Date.now(),
        });
        return;
      }
    }

    const newItem: SelectedCopyItem = {
      key: matchedCopy
        ? `copy-${matchedCopy.id}`
        : `book-${book.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      book,
      copy: matchedCopy,
      copyLabel: matchedCopy?.barcode || `${book.shelfLocation} (Ex. ${alreadySelectedCountForBook + 1})`,
      addedVia: source,
      reservationId: matchedReservationId,
    };

    playSuccessFeedback();
    setSelectedItems((prev) => [...prev, newItem]);
    setErrorMessage(null);
    setScanFeedback({
      type: 'success',
      message: `Ajouté : « ${book.title} » — Exemplaire ${newItem.copyLabel}.`,
      ts: Date.now(),
    });
  };

  // Keep a fresh ref to the continuous scan handler so Html5Qrcode never calls a stale closure
  const scanHandlerRef = useRef<(raw: string) => void>(() => {});
  scanHandlerRef.current = (raw: string) => {
    addScannedBookOrCopy(raw, 'qr');
  };

  const startBookScanner = async () => {
    await stopBookScanner();
    setBookCameraError(null);
    try {
      const scanner = new Html5Qrcode(bookReaderId);
      bookScannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          scanHandlerRef.current(decodedText);
        },
        () => {}
      );
      setIsBookScannerRunning(true);
    } catch (e: unknown) {
      setIsBookScannerRunning(false);
      const errText = String(e || '');
      if (errText.includes('NotAllowedError') || errText.includes('Permission')) {
        setBookCameraError(
          'Caméra non autorisée : vous pouvez sélectionner les exemplaires directement dans la liste ci-dessous.'
        );
      } else {
        setBookCameraError(
          'Caméra QR indisponible sur ce poste : utilisez la sélection directe des exemplaires en rayon ci-dessous.'
        );
      }
    }
  };

  const stopBookScanner = async () => {
    setIsBookScannerRunning(false);
    if (bookScannerRef.current) {
      try {
        if (bookScannerRef.current.isScanning) {
          await bookScannerRef.current.stop();
        }
        bookScannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      bookScannerRef.current = null;
    }
  };

  useEffect(() => {
    if (activeStep === 'scan_books' && isContinuousScannerActive) {
      const timer = setTimeout(() => {
        startBookScanner();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopBookScanner();
      };
    } else {
      stopBookScanner();
    }
  }, [activeStep, isContinuousScannerActive]);

  const handleRemoveSelectedItem = (key: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.key !== key));
  };

  // ==========================================
  // STEP 3 & 4: ATOMIC BATCH LOAN CONFIRMATION
  // ==========================================
  const calculatedDueDate = useMemo(
    () => addDaysToIsoDate(currentDate, loanDuration),
    [currentDate, loanDuration]
  );

  const handleConfirmBatchLoan = async () => {
    if (!scannedStudent || selectedItems.length === 0) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const payload = selectedItems.map((item) => ({
      bookId: item.book.id,
      copyId: item.copy?.id,
      reservationId: item.reservationId,
    }));

    const result = await validateBatchSmartLoan(
      scannedStudent.cne,
      payload,
      loanDuration
    );

    setIsProcessing(false);

    if (result.success && result.loans && result.loans.length > 0) {
      setCreatedLoans(result.loans);
      setActiveStep('completed');
    } else {
      setErrorMessage(result.message);
    }
  };

  const handleStartNewOperation = () => {
    stopBookScanner();
    stopCardCamera();
    setScannedStudent(null);
    setSelectedItems([]);
    setCreatedLoans([]);
    setErrorMessage(null);
    setScanFeedback(null);
    setBookFilterQuery('');
    setStudentQuery('');
    initialBookAppliedRef.current = false;
    setIsContinuousScannerActive(true);
    setActiveStep('select_student');
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-[1px]">
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Guichet d’Emprunt QR — Scan multiple
              </h2>
              <p className="text-xs text-slate-500">
                Sélection de l’étudiant, scan continu des exemplaires et validation groupée.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCardCamera();
              stopBookScanner();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0 overflow-x-auto gap-2">
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap ${
              scannedStudent
                ? 'text-emerald-700 font-semibold'
                : activeStep === 'select_student'
                ? 'text-slate-900 font-bold'
                : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                scannedStudent
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {scannedStudent ? '✓' : '1'}
            </span>
            <span>Identification étudiant</span>
          </div>
          <span className="text-slate-300">→</span>

          <div
            className={`flex items-center gap-1.5 whitespace-nowrap ${
              activeStep === 'review' || activeStep === 'completed'
                ? 'text-emerald-700 font-semibold'
                : activeStep === 'scan_books'
                ? 'text-slate-900 font-bold'
                : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                activeStep === 'review' || activeStep === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activeStep === 'review' || activeStep === 'completed' ? '✓' : '2'}
            </span>
            <span>
              Scan multiple des livres ({selectedItems.length})
            </span>
          </div>
          <span className="text-slate-300">→</span>

          <div
            className={`flex items-center gap-1.5 whitespace-nowrap ${
              activeStep === 'review'
                ? 'text-slate-900 font-bold'
                : activeStep === 'completed'
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                activeStep === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activeStep === 'completed' ? '✓' : '3'}
            </span>
            <span>Validation globale & Tickets</span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto">
          {errorMessage && (
            <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ==========================================
              STEP 1: SÉLECTION DE L'ÉTUDIANT (RECHERCHE DIRECTE OU OCR)
             ========================================== */}
          {activeStep === 'select_student' && (
            <div className="p-5 space-y-5">
              {initialReservation && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 space-y-1">
                  <div className="font-semibold text-emerald-900">
                    Retrait de réservation au guichet — Vérification de l’étudiant requise
                  </div>
                  <div className="text-emerald-800">
                    Ouvrage réservé : <strong>{initialReservation.bookTitle}</strong>
                    {initialReservation.copyBarcode ? ` (${initialReservation.copyBarcode})` : ''} · Demandeur attendu :{' '}
                    <strong>{initialReservation.memberName}</strong> ({initialReservation.memberCne || initialReservation.memberCard})
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Sélectionnez cet étudiant ci-dessous ou scannez sa carte universitaire (Vision OCR Carte) pour valider le prêt.
                  </div>
                </div>
              )}

              {/* Identification Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Sélectionner l’étudiant emprunteur
                  </h3>
                  <p className="text-xs text-slate-500">
                    Recherchez directement un étudiant inscrit à l’EST Fès ou scannez sa carte.
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStudentIdMode('search');
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      studentIdMode === 'search'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Recherche directe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStudentIdMode('ocr');
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                      studentIdMode === 'ocr'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Vision OCR Carte</span>
                  </button>
                </div>
              </div>

              {studentIdMode === 'search' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Rechercher par nom, prénom, CNE, N° Apogée ou email @usmba.ac.ma..."
                      autoFocus
                      className="w-full pl-9 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
                    />
                    {studentQuery && (
                      <button
                        type="button"
                        onClick={() => setStudentQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Aucun étudiant trouvé pour « {studentQuery} ».
                      </div>
                    ) : (
                      filteredStudents.map((student) => {
                        const profile = getStudentLoanProfile(student);
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleSelectStudent(student, false)}
                            className={`w-full px-4 py-3 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                              profile.isEligible
                                ? 'hover:bg-slate-50 bg-white'
                                : 'bg-slate-50/70 hover:bg-rose-50/40'
                            }`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                                  {student.lastName} {student.firstName}
                                </span>
                                <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {student.cne}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500">
                                  Apogée {student.apogee}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {student.department} · {student.studyYear} · {student.academicEmail}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-medium text-slate-600 tabular-nums">
                                {profile.activeCount}/{profile.maxAllowed} prêts
                              </span>
                              {profile.isEligible ? (
                                <span className="px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                                  Sélectionner →
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 rounded-md flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3" />
                                  {profile.overdueCount > 0
                                    ? `${profile.overdueCount} retard`
                                    : student.registrationStatus !== 'Inscrit'
                                    ? student.registrationStatus
                                    : 'Quota max'}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative bg-slate-950 rounded-lg overflow-hidden aspect-video max-w-md mx-auto flex items-center justify-center text-white border border-slate-800">
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {isCameraStarting && (
                      <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white space-y-2 z-10">
                        <RefreshCw className="w-7 h-7 animate-spin text-amber-300" />
                        <p className="text-xs font-medium">Initialisation du flux caméra HD...</p>
                      </div>
                    )}

                    {isOcrProcessing && (
                      <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white space-y-2.5 z-20">
                        <RefreshCw className="w-7 h-7 animate-spin text-amber-300" />
                        <p className="text-xs font-semibold text-amber-200">{ocrProgressText}</p>
                        <span className="text-[11px] text-slate-400">
                          Reconnaissance optique en cours...
                        </span>
                      </div>
                    )}

                    {isCameraActive && !isOcrProcessing && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-4">
                        <div className="w-[84%] max-w-[340px] aspect-[1.58] border-2 border-amber-400 rounded-lg relative bg-amber-400/5">
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-300 rounded-tl-sm" />
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-300 rounded-tr-sm" />
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-300 rounded-bl-sm" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-300 rounded-br-sm" />
                          <div className="absolute top-2 left-2 text-[10px] font-semibold text-amber-300 bg-slate-950/85 px-2 py-0.5 rounded">
                            Carte Étudiant EST Fès
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {cameraPermissionError && (
                    <div className="max-w-md mx-auto p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                      <div className="flex items-start gap-2 text-xs text-amber-900">
                        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <p>{cameraPermissionError}</p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={startCardCamera}
                          disabled={isCameraStarting}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isCameraStarting ? 'animate-spin' : ''}`} />
                          <span>Relancer</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="max-w-md mx-auto space-y-2.5">
                    <button
                      type="button"
                      onClick={handleCaptureAndAnalyzeCard}
                      disabled={isOcrProcessing || isCameraStarting || !isCameraActive}
                      className="w-full py-2.5 px-4 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capturer & Analyser la carte (Vision OCR)</span>
                    </button>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1.5 hover:underline"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Charger une photo de la carte</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <span className="text-[11px] text-slate-400">OCR Tesseract.js</span>
                    </div>

                    {extractedOcrText && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 font-mono line-clamp-2">
                        {extractedOcrText.replace(/\n+/g, ' ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              STEP 2: SESSION D'EMPRUNT — SCAN CONTINU DES QR CODES
             ========================================== */}
          {activeStep === 'scan_books' && scannedStudent && selectedStudentProfile && (
            <div className="p-5 space-y-4">
              {/* Active Student Session Header */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-900">
                      {scannedStudent.firstName} {scannedStudent.lastName}{' '}
                      <span className="font-mono text-xs font-normal text-slate-500">
                        ({scannedStudent.cne})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {scannedStudent.department} · En cours :{' '}
                      <strong className="text-slate-700">{selectedStudentProfile.activeCount}</strong> ·
                      Sélectionnés :{' '}
                      <strong className="text-indigo-700">{selectedItems.length}</strong> / Quota max{' '}
                      <strong className="text-slate-700">{selectedStudentProfile.maxAllowed}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    stopBookScanner();
                    setScannedStudent(null);
                    setSelectedItems([]);
                    setScanFeedback(null);
                    setActiveStep('select_student');
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white px-2.5 py-1.5 rounded-md self-start sm:self-auto"
                >
                  Changer d’étudiant
                </button>
              </div>

              {/* Real-time Non-Blocking Scan Feedback Banner */}
              {scanFeedback && (
                <div
                  className={`p-3 rounded-lg border flex items-start gap-2 text-xs ${
                    scanFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : scanFeedback.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {scanFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : scanFeedback.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium flex-1">{scanFeedback.message}</span>
                </div>
              )}

              {/* Split Workspace: Continuous Scanner + Quick Add (Left) | Selected Exemplars List (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column: Continuous QR Scanner + Shelf Lookup */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Continuous Camera Container */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                        <QrCode className="w-4 h-4 text-indigo-600" />
                        <span>Scanner QR continu</span>
                        {isBookScannerRunning && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Actif
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsContinuousScannerActive((prev) => !prev)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1"
                      >
                        {isContinuousScannerActive ? (
                          <>
                            <Pause className="w-3 h-3" />
                            <span>Mettre en pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Activer le scan continu</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isContinuousScannerActive ? (
                      <div className="relative bg-slate-950 aspect-video flex items-center justify-center text-white">
                        <div
                          id={bookReaderId}
                          className="w-full h-full overflow-hidden flex items-center justify-center"
                        />
                        {!bookCameraError && (
                          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                            <div className="w-40 h-40 border-2 border-indigo-400 rounded-lg relative">
                              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-300" />
                              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-300" />
                              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-300" />
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-300" />
                            </div>
                            <span className="mt-2.5 text-[10px] font-medium text-indigo-100 bg-slate-900/90 px-2.5 py-1 rounded border border-indigo-400/30">
                              Présentez successivement les QR Codes des livres à emprunter
                            </span>
                          </div>
                        )}
                        {bookCameraError && (
                          <div className="absolute inset-0 bg-slate-900/95 p-4 flex flex-col items-center justify-center text-center gap-2 z-20">
                            <Lock className="w-5 h-5 text-amber-300" />
                            <p className="text-xs text-slate-200 max-w-xs">{bookCameraError}</p>
                            <button
                              type="button"
                              onClick={() => startBookScanner()}
                              className="px-3 py-1.5 text-xs font-medium bg-white text-slate-900 rounded-md hover:bg-slate-100"
                            >
                              Réessayer la caméra
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500 bg-slate-50">
                        Scanner en pause. Cliquez sur « Activer le scan continu » pour scanner à la caméra ou ajoutez des livres depuis la liste ci-dessous.
                      </div>
                    )}
                  </div>

                  {/* Direct Catalog / Copy Selection Fallback */}
                  <div className="border border-slate-200 rounded-lg p-3.5 space-y-2.5 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Ajout direct depuis le rayon (ou code-barres exemplaire)
                      </span>
                      <div className="relative w-full sm:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bookFilterQuery}
                          onChange={(e) => setBookFilterQuery(e.target.value)}
                          placeholder="Titre, cote, ISBN, EX-..."
                          className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-slate-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {books
                        .filter((b) => {
                          const q = bookFilterQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            b.title.toLowerCase().includes(q) ||
                            b.author.toLowerCase().includes(q) ||
                            b.shelfLocation.toLowerCase().includes(q) ||
                            b.isbn.toLowerCase().includes(q) ||
                            b.copies?.some((c) => c.barcode.toLowerCase().includes(q))
                          );
                        })
                        .slice(0, 25)
                        .map((b) => {
                          const selectedForThisBook = selectedItems.filter(
                            (it) => it.book.id === b.id
                          ).length;
                          const remainingStock = Math.max(0, b.availableCopies - selectedForThisBook);
                          return (
                            <div
                              key={b.id}
                              className="px-2.5 py-2 rounded-md border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-slate-900 truncate">
                                  {b.title}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                  <span className="font-mono">{b.shelfLocation}</span>
                                  <span>·</span>
                                  <span
                                    className={
                                      remainingStock > 0
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-rose-600 font-medium'
                                    }
                                  >
                                    {remainingStock > 0
                                      ? `${remainingStock} dispo.`
                                      : 'Épuisé / Sélectionné'}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={remainingStock <= 0}
                                onClick={() => addScannedBookOrCopy(b.id, 'manual')}
                                className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 bg-white hover:bg-slate-900 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 shrink-0"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Ajouter</span>
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Real-Time List of Selected Exemplars */}
                <div className="lg:col-span-5 flex flex-col border border-slate-200 rounded-lg bg-slate-50/70 overflow-hidden">
                  <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-slate-700" />
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                        Exemplaires sélectionnés
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded tabular-nums">
                      {selectedItems.length}
                    </span>
                  </div>

                  <div className="flex-1 p-3 space-y-2 max-h-[340px] overflow-y-auto">
                    {selectedItems.length === 0 ? (
                      <div className="py-10 px-4 text-center space-y-2">
                        <ScanLine className="w-7 h-7 text-slate-300 mx-auto" />
                        <p className="text-xs font-medium text-slate-600">
                          Aucun livre scanné pour le moment
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Pointez la caméra vers le QR Code d’un ouvrage pour l’ajouter automatiquement à cette liste.
                        </p>
                      </div>
                    ) : (
                      selectedItems.map((item, idx) => (
                        <div
                          key={item.key}
                          className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-start justify-between gap-2 shadow-2xs"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                #{idx + 1}
                              </span>
                              <span className="text-xs font-semibold text-slate-900 line-clamp-1">
                                {item.book.title}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                ID : {item.copyLabel}
                              </span>
                              <span className="font-mono text-indigo-700">
                                {item.book.shelfLocation}
                              </span>
                              <span
                                className={`font-medium px-1.5 py-0.5 rounded ${
                                  item.reservationId
                                    ? 'text-indigo-700 bg-indigo-50'
                                    : 'text-emerald-700 bg-emerald-50'
                                }`}
                              >
                                {item.reservationId ? 'Réservé (retrait)' : 'Disponible'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedItem(item.key)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0"
                            title="Retirer de la sélection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Summary Action Footer */}
                  <div className="p-3.5 bg-white border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Total sélectionné</span>
                      <strong className="text-slate-900 tabular-nums">
                        {selectedItems.length} ouvrage{selectedItems.length > 1 ? 's' : ''}
                      </strong>
                    </div>
                    <button
                      type="button"
                      disabled={selectedItems.length === 0}
                      onClick={() => {
                        stopBookScanner();
                        setErrorMessage(null);
                        setActiveStep('review');
                      }}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>
                        Récapituler et valider ({selectedItems.length})
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 3: VALIDATION GLOBALE DE L'EMPRUNT
             ========================================== */}
          {activeStep === 'review' && scannedStudent && selectedStudentProfile && (
            <div className="p-5 space-y-5">
              {/* Student & Loan Terms Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-500 block">
                    Emprunteur
                  </span>
                  <div className="text-sm font-semibold text-slate-900">
                    {scannedStudent.firstName} {scannedStudent.lastName}
                  </div>
                  <div className="text-xs text-slate-600 font-mono space-y-0.5 tabular-nums">
                    <div>CNE : <strong className="text-slate-900">{scannedStudent.cne}</strong></div>
                    <div>N° Apogée : <strong className="text-slate-900">{scannedStudent.apogee}</strong></div>
                  </div>
                  <div className="text-[11px] text-indigo-700 font-medium pt-0.5">
                    {scannedStudent.department} · {scannedStudent.studyYear}
                  </div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-lg flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Date d’emprunt</span>
                      <span className="font-mono font-semibold tabular-nums">{currentDate}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-300 block text-[10px]">Retour prévu le</span>
                      <span className="font-mono font-semibold text-amber-300 tabular-nums">
                        {calculatedDueDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-2.5 text-xs">
                    <span className="text-slate-300">Durée du prêt :</span>
                    <div className="flex items-center gap-1.5">
                      {[14, 21].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setLoanDuration(days)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            loanDuration === days
                              ? 'bg-amber-400 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {days} jours
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete List of Selected Books */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    Récapitulatif des ouvrages ({selectedItems.length})
                  </span>
                  <span className="text-slate-500">
                    Quota après validation :{' '}
                    <strong className="text-slate-900">
                      {selectedStudentProfile.activeCount + selectedItems.length}/
                      {selectedStudentProfile.maxAllowed}
                    </strong>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/60 border-b border-slate-200 text-[11px] text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">#</th>
                        <th className="py-2.5 px-3 font-medium">Titre de l’ouvrage</th>
                        <th className="py-2.5 px-3 font-medium">Exemplaire</th>
                        <th className="py-2.5 px-3 font-medium">Cote</th>
                        <th className="py-2.5 px-3 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedItems.map((item, idx) => (
                        <tr key={item.key} className="bg-white">
                          <td className="py-2.5 px-3 text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{item.book.title}</div>
                            <div className="text-[11px] text-slate-500">{item.book.author}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{item.copyLabel}</td>
                          <td className="py-2.5 px-3 font-mono text-indigo-700">
                            {item.book.shelfLocation}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                              Prêt à valider
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Validation Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setActiveStep('scan_books');
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Continuer le scan</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBatchLoan}
                  disabled={isProcessing || selectedItems.length === 0}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                      <span>Validation transactionnelle...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Confirmer l’emprunt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 4: CONFIRMATION GLOBALE & REÇUS QR
             ========================================== */}
          {activeStep === 'completed' && createdLoans.length > 0 && (
            <div className="p-5 space-y-5">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {createdLoans.length > 1
                    ? `${createdLoans.length} emprunts enregistrés avec succès`
                    : 'Emprunt enregistré avec succès'}
                </h3>
                <p className="text-xs text-slate-500">
                  Bénéficiaire : <strong className="text-slate-800">{createdLoans[0].memberName}</strong> ({createdLoans[0].memberCne}) · Retour prévu le{' '}
                  <strong className="text-slate-800">{createdLoans[0].dueDate}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {createdLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-3.5 bg-slate-900 text-white rounded-lg border border-slate-800 flex items-center gap-3"
                  >
                    {loan.loanQrCodeDataUrl && (
                      <div className="bg-white p-1.5 rounded shrink-0">
                        <img
                          src={loan.loanQrCodeDataUrl}
                          alt={`QR ${loan.bookTitle}`}
                          className="w-20 h-20 object-contain"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1 text-xs">
                      <div className="font-semibold text-white line-clamp-2">
                        {loan.bookTitle}
                      </div>
                      <div className="font-mono text-[10px] text-amber-300">
                        {loan.copyBarcode || loan.bookShelfLocation || 'EST-DOC'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 truncate">
                        {loan.loanReceiptHash}
                      </div>
                      {loan.loanQrCodeDataUrl && (
                        <a
                          href={loan.loanQrCodeDataUrl}
                          download={`ticket_pret_${loan.id}.png`}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-200 hover:text-white underline pt-0.5"
                        >
                          <Download className="w-3 h-3" />
                          <span>Ticket QR</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Imprimer</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartNewOperation}
                  className="px-4 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-md flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Nouvelle opération d’emprunt</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
