import React, { useState, useEffect } from 'react';
import { Member, MemberType, ESTDepartment } from '../../types/library';
import { X, UserPlus, Save } from 'lucide-react';

interface MemberFormModalProps {
  initialMember?: Member | null;
  onClose: () => void;
  onSubmit: (data: Omit<Member, 'id' | 'cardNumber'>) => void;
}

const MEMBER_TYPES: MemberType[] = ['Étudiant EST', 'Enseignant-Chercheur', 'Personnel Administratif'];
const DEPARTMENTS: ESTDepartment[] = [
  'Génie Informatique (GI)',
  'Génie Électrique (GE)',
  'Génie Industriel et Maintenance (GIM)',
  'Techniques de Management (TM)',
  'Réseaux & Télécommunications (RT)',
  'Bio-analyses et Qualité (BQ)',
];

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  initialMember,
  onClose,
  onSubmit,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cne, setCne] = useState('');
  const [apogee, setApogee] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<ESTDepartment>('Génie Informatique (GI)');
  const [memberType, setMemberType] = useState<MemberType>('Étudiant EST');
  const [status, setStatus] = useState<'Actif' | 'Suspendu' | 'Radié'>('Actif');
  const [joinDate, setJoinDate] = useState('2026-10-12');
  const [expiryDate, setExpiryDate] = useState('2027-10-12');
  const [maxAllowedLoans, setMaxAllowedLoans] = useState(5);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialMember) {
      setFirstName(initialMember.firstName);
      setLastName(initialMember.lastName);
      setCne(initialMember.cne || '');
      setApogee(initialMember.apogee || '');
      setEmail(initialMember.email);
      setPhone(initialMember.phone);
      setDepartment(initialMember.department || 'Génie Informatique (GI)');
      setMemberType(initialMember.memberType);
      setStatus(initialMember.status);
      setJoinDate(initialMember.joinDate);
      setExpiryDate(initialMember.expiryDate);
      setMaxAllowedLoans(initialMember.maxAllowedLoans);
      setNotes(initialMember.notes || '');
    }
  }, [initialMember]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      cne: cne.trim() || `N${Math.floor(130000000 + Math.random() * 9999999)}`,
      apogee: apogee.trim() || String(Math.floor(22000000 + Math.random() * 999999)),
      email: email.trim(),
      phone: phone.trim() || 'Non renseigné',
      department,
      memberType,
      status,
      joinDate,
      expiryDate,
      maxAllowedLoans: Number(maxAllowedLoans),
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Modifier le profil lecteur EST
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="ex. Amine"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de famille <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="ex. El Idrissi"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CNE (Code National Étudiant) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={cne}
                onChange={(e) => setCne(e.target.value)}
                placeholder="ex. N134089241"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-code text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Numéro Apogée EST
              </label>
              <input
                type="text"
                value={apogee}
                onChange={(e) => setApogee(e.target.value)}
                placeholder="ex. 22019485"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-code text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse e-mail académique <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex. amine.elidrissi@usmba.ac.ma"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 font-code text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Filière / Département EST
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as ESTDepartment)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catégorie d’usager
              </label>
              <select
                value={memberType}
                onChange={(e) => {
                  const val = e.target.value as MemberType;
                  setMemberType(val);
                  if (val === 'Enseignant-Chercheur') setMaxAllowedLoans(10);
                  else setMaxAllowedLoans(5);
                }}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {MEMBER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="Actif">Actif</option>
                <option value="Suspendu">Suspendu</option>
                <option value="Radié">Radié</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quota d'emprunts autorisés
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxAllowedLoans}
                onChange={(e) => setMaxAllowedLoans(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{initialMember ? 'Enregistrer les modifications' : 'Créer la fiche'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
