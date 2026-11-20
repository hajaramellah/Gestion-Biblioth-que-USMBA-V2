import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { 
  ShieldCheck, 
  AlertCircle, 
  X, 
  School,
  Lock,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  User,
  Plus
} from 'lucide-react';

interface AcademicLoginModalProps {
  onClose: () => void;
}

interface GoogleMockAccount {
  email: string;
  name: string;
  roleType: 'gerant' | 'etudiant' | 'rejected';
  roleBadge: string;
  tag: string;
  isAuthorized: boolean;
  avatarColor: string;
}

// Google official 4-color G icon
export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AcademicLoginModal: React.FC<AcademicLoginModalProps> = ({ onClose }) => {
  const { loginWithGoogle, loginAsLibrarian, studentRegistry } = useLibrary();

  // State: 'main' (Login page with Google Sign-In button) or 'google_popup' (Google Account Chooser dialog)
  const [view, setView] = useState<'main' | 'google_popup'>('main');
  const [accountFilter, setAccountFilter] = useState<'all' | 'gerant' | 'etudiant'>('all');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Available Google accounts in selector, clearly separated by their database role
  const availableAccounts: GoogleMockAccount[] = [
    // --- GÉRANTS (GESTION DE LA BIBLIOTHÈQUE) ---
    {
      name: 'Dr. Hassan Alami',
      email: 'biblio.gerant@usmba.ac.ma',
      roleType: 'gerant',
      roleBadge: 'Rôle BDD : Gérant',
      tag: 'Conservateur en Chef · Accès Interface Gestion',
      isAuthorized: true,
      avatarColor: 'bg-emerald-700',
    },
    {
      name: 'Karim Bennouna',
      email: 'karim.bennouna@usmba.ac.ma',
      roleType: 'gerant',
      roleBadge: 'Rôle BDD : Gérant',
      tag: 'Responsable Prêts & Acquisitions · Interface Gestion',
      isAuthorized: true,
      avatarColor: 'bg-teal-700',
    },

    // --- ÉTUDIANTS (CONSULTATION DE LA BIBLIOTHÈQUE) ---
    {
      name: 'Hajar Amellah',
      email: 'hajar.amellah@usmba.ac.ma',
      roleType: 'etudiant',
      roleBadge: 'Rôle BDD : Étudiant',
      tag: 'Génie Informatique (LP-GL) · Portail Consultation',
      isAuthorized: true,
      avatarColor: 'bg-indigo-600',
    },
    {
      name: 'Amine El Idrissi',
      email: 'amine.elidrissi@usmba.ac.ma',
      roleType: 'etudiant',
      roleBadge: 'Rôle BDD : Étudiant',
      tag: 'DUT Génie Informatique · Portail Consultation',
      isAuthorized: true,
      avatarColor: 'bg-blue-600',
    },
    {
      name: 'Salma Bennani',
      email: 'salma.bennani@usmba.ac.ma',
      roleType: 'etudiant',
      roleBadge: 'Rôle BDD : Étudiant',
      tag: 'Techniques de Management · Portail Consultation',
      isAuthorized: true,
      avatarColor: 'bg-amber-600',
    },
    {
      name: 'Youssef Chraibi',
      email: 'youssef.chraibi@usmba.ac.ma',
      roleType: 'etudiant',
      roleBadge: 'Rôle BDD : Étudiant',
      tag: 'Génie Électrique · Portail Consultation',
      isAuthorized: true,
      avatarColor: 'bg-cyan-600',
    },

    // --- COMPTES DE TEST REJETÉS ---
    {
      name: 'Hajar Amellah (Personnel)',
      email: 'hajaramellah3506@gmail.com',
      roleType: 'rejected',
      roleBadge: 'Domaine non-USMBA',
      tag: 'Compte personnel Google (@gmail.com) · Rejeté',
      isAuthorized: false,
      avatarColor: 'bg-slate-600',
    },
    {
      name: 'Mehdi Tazi',
      email: 'mehdi.tazi@usmba.ac.ma',
      roleType: 'rejected',
      roleBadge: 'Statut Radié',
      tag: 'Étudiant RADIÉ par la scolarité · Accès révoqué',
      isAuthorized: false,
      avatarColor: 'bg-rose-700',
    },
  ];


  // Trigger Google Sign-In: Opens Google popup / account chooser
  const handleOpenGoogleSignIn = () => {
    setErrorMsg(null);
    setView('google_popup');
  };

  // Process chosen Google Account returned by Google OAuth
  const handleSelectGoogleAccount = (account: { email: string; name?: string }) => {
    setIsVerifying(true);
    setErrorMsg(null);

    // Realistic OAuth verification delay
    setTimeout(() => {
      const res = loginWithGoogle({
        email: account.email,
        name: account.name,
      });

      setIsVerifying(false);

      if (res.success) {
        onClose();
      } else {
        // Return to main login view showing access refusal error
        setErrorMsg(res.message || 'Authentification Google refusée.');
        setView('main');
      }
    }, 450);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.trim()) return;
    handleSelectGoogleAccount({ email: customGoogleEmail.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      {/* ============================================================== */}
      {/* 1. MAIN LOGIN SCREEN: ONLY GOOGLE SIGN-IN (ZERO MANUAL FIELDS)  */}
      {/* ============================================================== */}
      {view === 'main' && (
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* USMBA Header */}
          <div className="bg-slate-900 text-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-white/10 border border-white/15 flex items-center justify-center text-amber-300 shrink-0">
                  <School className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-white">
                    Portail Bibliothèque EST Fès
                  </h3>
                  <p className="text-xs text-slate-300">
                    Université Sidi Mohamed Ben Abdellah
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Authentification institutionnelle sécurisée Google Workspace</span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Error Banner when non-authorized or non-USMBA email is rejected */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-rose-950">Accès non autorisé</div>
                  <div className="leading-relaxed text-[11px] text-rose-800">{errorMsg}</div>
                </div>
              </div>
            )}

            <div className="text-center space-y-1">
              <h4 className="text-sm font-semibold text-slate-900">
                Connexion avec votre compte académique
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Accédez à votre espace lecteur en vous connectant avec votre compte Google institutionnel EST USMBA.
              </p>
            </div>

            {/* Standard "Se connecter avec Google" Button (Zero manual typing) */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleOpenGoogleSignIn}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 hover:border-slate-400 rounded-md transition-colors flex items-center justify-center gap-2.5 text-slate-800 font-medium text-xs sm:text-sm"
              >
                <GoogleIcon className="w-4 h-4 shrink-0" />
                <span className="font-semibold text-slate-800">Se connecter avec Google</span>
              </button>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-700">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>Restriction de sécurité @usmba.ac.ma</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Seuls les étudiants régulièrement inscrits à l'EST USMBA sont autorisés. Les comptes personnels (@gmail.com) sont systématiquement rejetés.
                </p>
              </div>
            </div>

            {/* Staff / Librarian option */}
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  loginAsLibrarian();
                  onClose();
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Accès Bibliothécaire / Administration de l'école
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. GOOGLE OAUTH POPUP / ACCOUNT CHOOSER (Authentic Google UI)   */}
      {/* ============================================================== */}
      {view === 'google_popup' && (
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Google Window Top Bar */}
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GoogleIcon className="w-4 h-4" />
              <span className="text-xs font-semibold text-slate-700">Connexion avec Google</span>
            </div>
            <button
              onClick={() => setView('main')}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-8 h-8 mx-auto flex items-center justify-center">
                <GoogleIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Choisir un compte
              </h3>
              <p className="text-xs text-slate-500">
                pour accéder à <strong className="text-slate-700">Bibliothèque EST USMBA</strong>
              </p>
            </div>

            {isVerifying && (
              <div className="py-6 flex flex-col items-center justify-center space-y-2 text-slate-600">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-700" />
                <span className="text-xs font-medium">Validation Google OAuth & Registre EST...</span>
              </div>
            )}

            {/* Filter tabs to test Gérant vs Étudiant easily */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md text-xs">
              <button
                type="button"
                onClick={() => setAccountFilter('all')}
                className={`flex-1 py-1 px-2 rounded font-medium transition-colors ${
                  accountFilter === 'all' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({availableAccounts.length})
              </button>
              <button
                type="button"
                onClick={() => setAccountFilter('gerant')}
                className={`flex-1 py-1 px-2 rounded font-medium transition-colors ${
                  accountFilter === 'gerant' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gérants (2)
              </button>
              <button
                type="button"
                onClick={() => setAccountFilter('etudiant')}
                className={`flex-1 py-1 px-2 rounded font-medium transition-colors ${
                  accountFilter === 'etudiant' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Étudiants (4)
              </button>
            </div>

            {!isVerifying && (
              <div className="space-y-0 max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {availableAccounts
                  .filter((acc) => {
                    if (accountFilter === 'gerant') return acc.roleType === 'gerant';
                    if (accountFilter === 'etudiant') return acc.roleType === 'etudiant';
                    return true;
                  })
                  .map((acc, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectGoogleAccount(acc)}
                      className="w-full p-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full ${acc.avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs`}>
                          {acc.name.charAt(0)}
                        </div>
                        <div className="min-w-0 truncate space-y-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {acc.name}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className={`text-[11px] font-medium shrink-0 ${
                              acc.roleType === 'gerant'
                                ? 'text-emerald-700'
                                : acc.roleType === 'etudiant'
                                ? 'text-indigo-700'
                                : 'text-rose-700'
                            }`}>
                              {acc.roleBadge}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate font-mono">
                            {acc.email}
                          </div>
                          <div className={`text-[10px] font-medium truncate ${acc.isAuthorized ? 'text-slate-600' : 'text-rose-600'}`}>
                            {acc.tag}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                    </button>
                  ))}


                {/* Custom Google Account Option */}
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
                      Adresse e-mail du compte Google
                    </label>
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="nom.prenom@usmba.ac.ma"
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
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

            <div className="pt-2 text-center text-[10px] text-slate-400">
              Pour poursuivre, Google partagera votre nom, votre adresse e-mail et votre photo de profil avec l'application de la Bibliothèque EST.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
