import React, { useState, useEffect, useRef } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { preprocessCanvasForOcr, runCardOcr, extractNewStudentDataFromOcr, ExtractedNewStudent } from '../../services/cardOcrService';
import { StudentRegistration } from '../../types/library';
import { 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Upload, 
  Lock, 
  Printer, 
  ShieldCheck, 
  GraduationCap,
  ScanLine,
  ArrowRight,
  Database
} from 'lucide-react';

interface StudentOcrEnrollmentModalProps {
  onClose: () => void;
  onStudentEnrolled?: (student: StudentRegistration) => void;
}

export const StudentOcrEnrollmentModal: React.FC<StudentOcrEnrollmentModalProps> = ({ 
  onClose,
  onStudentEnrolled 
}) => {
  const { addNewStudentToRegistry } = useLibrary();

  // Workflow steps:
  // 1: 'capture' (camera preview & target frame)
  // 2: 'ocr_analyzing' (Tesseract OCR running)
  // 3: 'auto_validated' (Form filled automatically & instantly saved into USMBA DB)
  const [currentStep, setCurrentStep] = useState<'capture' | 'ocr_analyzing' | 'auto_validated'>('capture');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('Analyse optique de la carte...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);

  // Extracted and automatically enrolled data
  const [extractedData, setExtractedData] = useState<ExtractedNewStudent | null>(null);
  const [enrolledStudent, setEnrolledStudent] = useState<StudentRegistration | null>(null);

  // Video and canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Start hardware camera
  const startCamera = async () => {
    setCameraPermissionError(null);
    setErrorMessage(null);
    setIsCameraStarting(true);

    stopCamera();

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
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
    } catch (err: any) {
      console.error('Camera stream error:', err);
      setIsCameraActive(false);

      if (err?.name === 'NotAllowedError' || err?.toString().includes('NotAllowedError')) {
        setCameraPermissionError(
          'Accès caméra refusé. Veuillez autoriser l’accès via l’icône de cadenas 🔒 dans la barre d’adresse.'
        );
      } else {
        setCameraPermissionError(`Impossible d’activer la caméra : ${err?.message || 'Périphérique indisponible'}.`);
      }
    } finally {
      setIsCameraStarting(false);
    }
  };

  const stopCamera = () => {
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
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // STEP 1 -> STEP 2 -> STEP 3: Automated capture and registration
  const handleCaptureCard = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCurrentStep('ocr_analyzing');
    setOcrStatusText('Capture HD de la carte d’étudiant...');
    setErrorMessage(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Impossible d’initialiser le canvas 2D');

      ctx.drawImage(video, 0, 0, width, height);
      setCapturedImagePreview(canvas.toDataURL('image/jpeg', 0.9));

      // Optical preprocessing
      setOcrStatusText('Prétraitement optique & rehaussement du contraste...');
      const preprocessed = preprocessCanvasForOcr(canvas);

      // OCR processing
      setOcrStatusText('Reconnaissance optique des caractères (OCR Tesseract)...');
      const rawText = await runCardOcr(preprocessed, (pct, status) => {
        setOcrProgress(pct);
        setOcrStatusText(`Extraction optique en cours : ${status} (${pct}%)`);
      });

      // Automated registration without any manual user typing
      await processAutomatedEnrolment(rawText);
    } catch (err: any) {
      console.error('OCR Enrollment error:', err);
      setErrorMessage(`Erreur lors de la capture OCR : ${err?.message || 'Vérifiez la netteté et la luminosité'}.`);
      setCurrentStep('capture');
    }
  };

  // Alternative: Upload a photo of the card
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCurrentStep('ocr_analyzing');
    setOcrStatusText('Chargement de l’image de la carte...');
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            setCapturedImagePreview(canvas.toDataURL('image/jpeg', 0.9));
            const preprocessed = preprocessCanvasForOcr(canvas);
            setOcrStatusText('Extraction OCR des informations étudiantes...');
            const rawText = await runCardOcr(preprocessed, (pct, status) => {
              setOcrProgress(pct);
              setOcrStatusText(`Extraction optique : ${status} (${pct}%)`);
            });
            await processAutomatedEnrolment(rawText);
          }
        } catch (err: any) {
          setErrorMessage(`Erreur de lecture : ${err?.message}`);
          setCurrentStep('capture');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // STEP 3: Automated Form Filling & Instant Registration
  const processAutomatedEnrolment = async (rawText: string) => {
    if (!rawText.trim()) {
      setErrorMessage(
        'Aucun texte lisible détecté sur la carte. Veuillez bien cadrer l’ensemble de la carte d’étudiant.'
      );
      setCurrentStep('capture');
      return;
    }

    setOcrStatusText('Remplissage automatique du formulaire & Enregistrement dans la base EST USMBA...');

    // 100% Automated extraction of Nom, Prénom, CNE, N° Apogée, Email académique @usmba.ac.ma
    const extracted: ExtractedNewStudent = extractNewStudentDataFromOcr(rawText);
    setExtractedData(extracted);

    // Instant registration into the school enrollment database (Apogée & Library)
    const registered = await addNewStudentToRegistry({
      firstName: extracted.firstName,
      lastName: extracted.lastName,
      cne: extracted.cne,
      apogee: extracted.apogee,
      academicEmail: extracted.academicEmail,
      department: extracted.department,
      studyYear: extracted.studyYear,
      registrationStatus: 'Inscrit',
      phone: '06 00 00 00 00',
      registrationDate: '2026-10-12',
    });

    stopCamera();
    setEnrolledStudent(registered);
    if (onStudentEnrolled) {
      onStudentEnrolled(registered);
    }

    // Move to validated step showing filled form & confirmation
    setCurrentStep('auto_validated');
  };

  const handlePrintCard = () => {
    window.print();
  };

  const handleEnrollAnother = () => {
    setCapturedImagePreview(null);
    setExtractedData(null);
    setEnrolledStudent(null);
    setCurrentStep('capture');
    startCamera();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-2xl w-full max-h-[92vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                  Inscription d’un Étudiant
                </h2>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Automatisé (OCR)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan de la carte, extraction OCR et enregistrement instantané sans saisie manuelle.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual 3-Step Breadcrumb Progress Bar */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-2.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 'capture' 
                ? 'bg-slate-900 text-white ring-2 ring-slate-900/20' 
                : 'bg-emerald-600 text-white'
            }`}>
              {currentStep !== 'capture' ? '✓' : '1'}
            </span>
            <span className={currentStep === 'capture' ? 'font-semibold text-slate-900' : 'text-slate-600'}>
              1. Capture de la carte
            </span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 'ocr_analyzing'
                ? 'bg-slate-900 text-white ring-2 ring-slate-900/20'
                : currentStep === 'auto_validated'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {currentStep === 'auto_validated' ? '✓' : '2'}
            </span>
            <span className={currentStep === 'ocr_analyzing' ? 'font-semibold text-slate-900' : 'text-slate-600'}>
              2. Extraction OCR
            </span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 'auto_validated'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/20'
                : 'bg-slate-200 text-slate-600'
            }`}>
              3
            </span>
            <span className={currentStep === 'auto_validated' ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
              3. Remplissage & Validation
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="p-5 sm:p-6 space-y-5 flex-1">

          {/* ============================================================== */}
          {/* STEP 1 & 2: LIVE CAMERA CAPTURE & OCR EXTRACTION              */}
          {/* ============================================================== */}
          {currentStep !== 'auto_validated' && (
            <div className="space-y-4">
              <div className="text-center max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-slate-900">
                  {currentStep === 'capture' 
                    ? 'Placez la carte d’étudiant dans le rectangle' 
                    : 'Extraction optique des informations étudiantes...'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Le module extrait automatiquement le Nom, Prénom, CNE / Apogée et l'e-mail officiel <span className="font-semibold text-indigo-700">@usmba.ac.ma</span> sans aucune saisie au clavier.
                </p>
              </div>

                {/* Video Viewport with High-Precision Card Guide */}
              <div className="relative bg-slate-950 rounded-lg overflow-hidden aspect-[16/10] max-w-lg mx-auto flex items-center justify-center text-white border border-slate-800">
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${isCameraActive && currentStep !== 'ocr_analyzing' ? 'block' : 'hidden'}`}
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Captured Frame Preview if Analyzing */}
                {currentStep === 'ocr_analyzing' && capturedImagePreview && (
                  <img
                    src={capturedImagePreview}
                    alt="Carte capturée"
                    className="w-full h-full object-cover opacity-60 filter grayscale"
                  />
                )}

                {/* Camera Starting Spinner */}
                {isCameraStarting && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white space-y-2 z-10">
                    <RefreshCw className="w-7 h-7 animate-spin text-amber-300" />
                    <p className="text-xs font-medium">Initialisation de la caméra...</p>
                  </div>
                )}

                {/* OCR Progress Overlay */}
                {currentStep === 'ocr_analyzing' && (
                  <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-white p-6 space-y-3 z-20 text-center">
                    <div className="w-10 h-10 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                      <ScanLine className="w-5 h-5 text-amber-300" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-200">{ocrStatusText}</p>
                      <p className="text-[11px] text-slate-400">
                        Analyse OCR du texte : Nom, Prénom, CNE, Apogée & Email USMBA
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
                      <div
                        className="bg-amber-400 h-full transition-all duration-300"
                        style={{ width: `${Math.max(15, ocrProgress)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Visual Card Guide (Targeting rectangle matching ID-1 card ratio) */}
                {isCameraActive && currentStep === 'capture' && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-4">
                    <div className="w-[88%] max-w-[360px] aspect-[1.58] border-2 border-amber-400 rounded-lg relative bg-amber-400/5">
                      {/* Targeting corner brackets */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-300 rounded-tl-sm" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-300 rounded-tr-sm" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-300 rounded-bl-sm" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-300 rounded-br-sm" />

                      <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-300 bg-slate-950/85 px-2 py-0.5 rounded">
                        <GraduationCap className="w-3 h-3" />
                        <span>Carte Étudiant EST USMBA</span>
                      </div>
                    </div>
                    <span className="mt-2 text-[10px] font-medium text-slate-200 bg-slate-900/90 px-2.5 py-1 rounded border border-white/10">
                      Cadrez la carte entière pour la capture OCR
                    </span>
                  </div>
                )}
              </div>

              {/* Camera permission error guidance */}
              {cameraPermissionError && (
                <div className="max-w-lg mx-auto p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-900">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{cameraPermissionError}</p>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={isCameraStarting}
                      className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCameraStarting ? 'animate-spin' : ''}`} />
                      <span>Relancer la caméra</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons: Capture / Upload */}
              <div className="max-w-lg mx-auto space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleCaptureCard}
                  disabled={currentStep === 'ocr_analyzing' || !isCameraActive}
                  className="w-full py-2.5 px-4 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturer la carte & Extraire automatiquement (Vision OCR)</span>
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1.5 hover:underline"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Ou importer une photo de la carte</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <span className="text-[11px] text-emerald-700 font-medium">
                    Remplissage automatique OCR
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: AUTOMATIC FORM FILLING & INSTANT DATABASE VALIDATION    */}
          {/* ============================================================== */}
          {currentStep === 'auto_validated' && enrolledStudent && (
            <div className="space-y-5">
              {/* Success Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-emerald-900">
                    Remplissage et validation automatiques réussis
                  </h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Les champs ont été extraits par OCR et l’étudiant a été inscrit dans la base EST USMBA.
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded">
                  Validé en base
                </span>
              </div>

              {/* Formulaire Rempli Automatiquement (Lecture Seule, 100% automatisé) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-semibold text-slate-900">
                      Fiche d’inscription générée par OCR
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700">
                    Remplissage automatique sans saisie
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  {/* Prénom */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Prénom de l'étudiant
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={enrolledStudent.firstName}
                      className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-md px-3 py-2 text-xs focus:outline-none cursor-default"
                    />
                  </div>

                  {/* Nom */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nom de famille
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={enrolledStudent.lastName}
                      className="w-full bg-white border border-slate-300 text-slate-900 font-medium rounded-md px-3 py-2 text-xs focus:outline-none cursor-default uppercase"
                    />
                  </div>

                  {/* CNE */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Numéro CNE / Massar
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={enrolledStudent.cne}
                      className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-semibold rounded-md px-3 py-2 text-xs focus:outline-none cursor-default tabular-nums"
                    />
                  </div>

                  {/* N° Apogée */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Numéro Apogée EST
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={enrolledStudent.apogee}
                      className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-semibold rounded-md px-3 py-2 text-xs focus:outline-none cursor-default tabular-nums"
                    />
                  </div>

                  {/* E-mail académique */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      E-mail académique institutionnel USMBA
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={enrolledStudent.academicEmail}
                      className="w-full bg-white border border-slate-300 text-indigo-900 font-mono font-medium rounded-md px-3 py-2 text-xs focus:outline-none cursor-default"
                    />
                  </div>

                  {/* Filière / Département */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Filière / Département EST
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={enrolledStudent.department}
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-md px-3 py-2 text-xs focus:outline-none cursor-default"
                    />
                  </div>

                  {/* Statut officiel */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Statut d'inscription école
                    </label>
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-emerald-700 font-medium rounded-md px-3 py-2 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Inscrit & Autorisé (EST USMBA)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Student Card & Generated QR Code Preview */}
              <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-slate-300 shrink-0" />
                    <span className="text-xs font-medium text-white">
                      École Supérieure de Technologie de Fès — USMBA
                    </span>
                  </div>
                  <span className="font-medium text-[10px] text-emerald-300 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded shrink-0">
                    Dossier Actif
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <div className="text-base font-semibold text-white">
                      {enrolledStudent.firstName} {enrolledStudent.lastName}
                    </div>
                    <div className="flex items-center gap-3 text-slate-300 text-[11px] font-mono tabular-nums">
                      <span>CNE : <strong className="text-amber-300">{enrolledStudent.cne}</strong></span>
                      <span>·</span>
                      <span>Apogée : <strong className="text-slate-100">{enrolledStudent.apogee}</strong></span>
                    </div>
                    <div className="text-slate-300 text-[11px] font-mono">
                      {enrolledStudent.academicEmail}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {enrolledStudent.department} · {enrolledStudent.studyYear}
                    </div>
                  </div>

                  {enrolledStudent.qrCodeDataUrl && (
                    <div className="flex flex-col items-center bg-white p-2 rounded-md shrink-0 text-slate-900">
                      <img
                        src={enrolledStudent.qrCodeDataUrl}
                        alt="QR Code Adhérent"
                        className="w-16 h-16 object-contain"
                      />
                      <span className="text-[8px] font-mono font-semibold mt-1 text-slate-600">
                        {enrolledStudent.cne}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleEnrollAnother}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-600" />
                  <span>Scanner une autre carte</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintCard}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Imprimer la carte</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Terminer & Consulter le fichier
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
