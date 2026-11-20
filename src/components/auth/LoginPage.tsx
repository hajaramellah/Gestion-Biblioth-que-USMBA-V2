import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book } from '../../types/library';
import { GoogleIcon } from './AcademicLoginModal';
import {
  School,
  ShieldCheck,
  AlertCircle,
  Lock,
  RefreshCw,
  ChevronRight,
  Plus,
  ArrowLeft,
  BookOpen,
  Compass,
  CheckCircle2,
  Bookmark,
} from 'lucide-react';

interface GoogleAccountOption {
  email: string;
  name: string;
  subtitle: string;
  isRejectedTest?: boolean;
  avatarColor: string;
}

const GOOGLE_ACCOUNTS: GoogleAccountOption[] = [
  {
    name: 'Dr. Hassan Alami',
    email: 'biblio.gerant@usmba.ac.ma',
    subtitle: 'Conservateur en Chef · Service Documentation EST Fès',
    avatarColor: 'bg-slate-800',
  },
  {
    name: 'Karim Bennouna',
    email: 'karim.bennouna@usmba.ac.ma',
    subtitle: 'Responsable Prêts & Acquisitions · EST Fès',
    avatarColor: 'bg-emerald-700',
  },
  {
    name: 'Hajar Amellah',
    email: 'hajar.amellah@usmba.ac.ma',
    subtitle: 'Génie Informatique (LP-GL) · N139045123',
    avatarColor: 'bg-indigo-600',
  },
  {
    name: 'Amine El Idrissi',
    email: 'amine.elidrissi@usmba.ac.ma',
    subtitle: 'DUT Génie Informatique · N134089241',
    avatarColor: 'bg-blue-600',
  },
  {
    name: 'Salma Bennani',
    email: 'salma.bennani@usmba.ac.ma',
    subtitle: 'Techniques de Management · N142078319',
    avatarColor: 'bg-amber-600',
  },
  {
    name: 'Youssef Chraibi',
    email: 'youssef.chraibi@usmba.ac.ma',
    subtitle: 'Génie Électrique · N138091456',
    avatarColor: 'bg-cyan-700',
  },
  {
    name: 'Hajar Amellah (Personnel)',
    email: 'hajaramellah3506@gmail.com',
    subtitle: 'Compte Google personnel (@gmail.com) · Non autorisé',
    isRejectedTest: true,
    avatarColor: 'bg-slate-500',
  },
  {
    name: 'Mehdi Tazi',
    email: 'mehdi.tazi@usmba.ac.ma',
    subtitle: 'Scolarité : Radié · Accès révoqué',
    isRejectedTest: true,
    avatarColor: 'bg-rose-700',
  },
];

interface LoginPageProps {
  pendingBook?: Book | null;
  onBackToCatalog?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  pendingBook = null,
  onBackToCatalog,
}) => {
  const { loginWithGoogle } = useLibrary();

  const [view, setView] = useState<'main' | 'google_chooser'>('main');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  const handleOpenGoogleChooser = () => {
    setErrorMsg(null);
    setView('google_chooser');
  };

  const handleSelectAccount = (account: { email: string; name?: string }) => {
    setIsVerifying(true);
    setErrorMsg(null);

    setTimeout(() => {
      const res = loginWithGoogle({
        email: account.email,
        name: account.name,
      });

      setIsVerifying(false);

      if (!res.success) {
        setErrorMsg(res.message || 'Authentification Google refusée.');
        setView('main');
      }
    }, 380);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    handleSelectAccount({ email: customEmail.trim() });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8f9fb] text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      {/* Left Editorial Brand Showcase */}
      <aside className="relative lg:w-[46%] xl:w-[44%] bg-slate-950 text-white flex flex-col justify-between overflow-hidden min-h-[260px] lg:min-h-screen">
        <img
          src="/src/assets/images/hero_library_hall_1791793851439.jpg"
          alt="Bibliothèque Universitaire EST Fès"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/85 to-slate-950/90" />

        {/* Brand Header */}
        <div className="relative z-10 px-6 sm:px-10 pt-8 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-amber-300 shrink-0">
            <School className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">
              Athenaeum · EST Fès
            </div>
            <div className="text-xs text-slate-300">
              Université Sidi Mohamed Ben Abdellah
            </div>
          </div>
        </div>

        {/* Central Editorial Statement */}
        <div className="relative z-10 px-6 sm:px-10 py-8 lg:py-12 max-w-xl space-y-5">
          <div className="text-xs font-medium uppercase tracking-widest text-amber-300">
            Portail Documentaire Institutionnel
          </div>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-semibold text-white leading-tight tracking-tight text-balance">
            Le savoir universitaire, orchestré avec précision.
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            Plateforme unifiée de la bibliothèque de l’École Supérieure de Technologie de Fès. Accédez à votre espace personnel dès votre authentification académique.
          </p>

          <div className="pt-2 space-y-3 text-xs text-slate-200">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Accès sécurisé réservé aux comptes @usmba.ac.ma</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Compass className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span>Orientation automatique selon votre rôle (Gérant ou Étudiant)</span>
            </div>
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
              <span>Consultation du catalogue, réservations, prêts et suivi des échéances</span>
            </div>
          </div>
        </div>

        {/* Subtle Bottom Institutional Line */}
        <div className="relative z-10 px-6 sm:px-10 py-6 border-t border-white/10 hidden lg:flex items-center justify-between text-[11px] text-slate-400">
          <span>Service Commun de la Documentation · EST Fès</span>
          <span className="font-code text-slate-300">@usmba.ac.ma</span>
        </div>
      </aside>

      {/* Right Authentication Workspace */}
      <main className="flex-1 flex flex-col justify-between px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-3">
          {onBackToCatalog ? (
            <button
              type="button"
              onClick={onBackToCatalog}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-md hover:bg-slate-200/60 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour au catalogue public</span>
            </button>
          ) : (
            <span />
          )}
          <span className="text-xs font-medium text-slate-500">
            Authentification requise
          </span>
        </div>

        <div className="w-full max-w-md mx-auto my-auto">
          {view === 'main' ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 pt-7 pb-5 border-b border-slate-100 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Connexion unifiée USMBA</span>
                </div>
                <h2 className="font-serif-display text-2xl font-semibold text-slate-900 tracking-tight">
                  Accéder à Athenaeum
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Connectez-vous avec votre compte Google académique. Votre interface (Espace Gérant ou Portail Étudiant) s’ouvrira automatiquement selon votre profil.
                </p>
              </div>

              <div className="p-6 space-y-5">
                {pendingBook && (
                  <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-2.5 text-xs text-indigo-950">
                    <Bookmark className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-semibold">Réservation en attente</div>
                      <p className="text-[11px] text-indigo-900 leading-relaxed">
                        Connectez-vous avec votre compte étudiant pour réserver{' '}
                        <span className="font-semibold">« {pendingBook.title} »</span>.
                      </p>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-semibold text-rose-950">Accès non autorisé</div>
                      <div className="leading-relaxed text-[11px] text-rose-800">{errorMsg}</div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleOpenGoogleChooser}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg transition-colors flex items-center justify-center gap-3 text-xs sm:text-sm font-semibold shadow-xs"
                >
                  <span className="w-6 h-6 rounded bg-white flex items-center justify-center shrink-0">
                    <GoogleIcon className="w-4 h-4" />
                  </span>
                  <span>Se connecter avec Google</span>
                </button>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Vérification automatique du domaine et du registre</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Seules les adresses <span className="font-code text-slate-700">@usmba.ac.ma</span> actives au registre de l’EST Fès sont autorisées. Les comptes personnels externes sont refusés.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Google Chooser Header */}
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GoogleIcon className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-800">
                    Connexion avec Google
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setView('main');
                    setShowCustomInput(false);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour</span>
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">
                    Choisir un compte Google
                  </h3>
                  <p className="text-xs text-slate-500">
                    pour accéder à <strong className="text-slate-700">Athenaeum · EST Fès</strong>
                  </p>
                </div>

                {isVerifying ? (
                  <div className="py-10 flex flex-col items-center justify-center space-y-2.5 text-slate-600">
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-800" />
                    <span className="text-xs font-medium">
                      Vérification du compte @usmba.ac.ma et redirection...
                    </span>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {GOOGLE_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleSelectAccount(acc)}
                        className="w-full p-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full ${acc.avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0`}
                          >
                            {acc.name.charAt(0)}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {acc.name}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate font-code">
                              {acc.email}
                            </div>
                            <div
                              className={`text-[10px] truncate ${
                                acc.isRejectedTest ? 'text-rose-600 font-medium' : 'text-slate-500'
                              }`}
                            >
                              {acc.subtitle}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-700 shrink-0" />
                      </button>
                    ))}

                    {!showCustomInput ? (
                      <button
                        type="button"
                        onClick={() => setShowCustomInput(true)}
                        className="w-full p-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-xs text-slate-700 font-medium"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span>Utiliser un autre compte Google...</span>
                      </button>
                    ) : (
                      <form onSubmit={handleCustomSubmit} className="p-3 bg-slate-50 space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Adresse e-mail Google académique
                        </label>
                        <input
                          type="email"
                          required
                          autoFocus
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          placeholder="nom.prenom@usmba.ac.ma"
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-code"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowCustomInput(false)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                          >
                            Continuer
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                <p className="text-center text-[10px] text-slate-400 leading-relaxed">
                  Votre rôle (Gérant ou Étudiant) est détecté automatiquement à partir de votre compte enregistré dans la base USMBA.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center lg:text-right text-[11px] text-slate-400 pt-6">
          Athenaeum · École Supérieure de Technologie de Fès · USMBA
        </footer>
      </main>
    </div>
  );
};
