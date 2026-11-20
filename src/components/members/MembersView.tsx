import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Member } from '../../types/library';
import { MemberFormModal } from './MemberFormModal';
import { MemberCardModal } from './MemberCardModal';
import { StudentOcrEnrollmentModal } from './StudentOcrEnrollmentModal';
import { Pagination } from '../common/Pagination';
import {
  Search,
  CreditCard,
  Edit3,
  Trash2,
  AlertCircle,
  Mail,
  Calendar,
  Camera,
  X,
} from 'lucide-react';

const MEMBERS_PAGE_SIZE = 18;

export const MembersView: React.FC = () => {
  const { members, loans, updateMember, deleteMember } = useLibrary();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Actif' | 'Suspendu'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [isOcrEnrollModalOpen, setIsOcrEnrollModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [cardModalMember, setCardModalMember] = useState<Member | null>(null);

  const departments = useMemo(() => {
    const set = new Set(members.map((m) => m.department).filter(Boolean) as string[]);
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))];
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchDept = departmentFilter === 'all' || m.department === departmentFilter;
      const matchSearch =
        !q ||
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.cardNumber.toLowerCase().includes(q) ||
        (m.cne && m.cne.toLowerCase().includes(q)) ||
        (m.apogee && m.apogee.toLowerCase().includes(q));

      return matchStatus && matchDept && matchSearch;
    });
  }, [members, statusFilter, departmentFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, departmentFilter, searchQuery]);

  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * MEMBERS_PAGE_SIZE;
    return filteredMembers.slice(start, start + MEMBERS_PAGE_SIZE);
  }, [filteredMembers, currentPage]);

  const handleUpdateMember = (data: Omit<Member, 'id' | 'cardNumber'>) => {
    if (editingMember) {
      updateMember(editingMember.id, data);
      setEditingMember(null);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Compact Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
            Adhérents EST
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {members.length} lecteur(s) enregistré(s) · Cartes de bibliothèque et quotas d’emprunt.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOcrEnrollModalOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Inscrire un étudiant (Scan OCR)</span>
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Actif')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
              statusFilter === 'Actif'
                ? 'bg-white text-emerald-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Actifs ({members.filter((m) => m.status === 'Actif').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Suspendu')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
              statusFilter === 'Suspendu'
                ? 'bg-white text-rose-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suspendus ({members.filter((m) => m.status === 'Suspendu').length})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs border border-slate-200 bg-slate-50 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:bg-white focus:border-slate-400"
            aria-label="Filtrer par filière"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'all' ? 'Toutes les filières EST' : d}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher nom, CNE, Apogée, carte..."
              className="w-full text-xs pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Effacer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-sm font-semibold text-slate-800">Aucun adhérent trouvé</p>
          <p className="text-xs text-slate-500 mt-1">
            Aucun dossier ne correspond à votre recherche actuelle.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedMembers.map((member) => {
              const memberLoans = loans.filter((l) => l.memberId === member.id && l.status !== 'Rendu');
              const hasOverdue = memberLoans.some((l) => l.status === 'En retard');

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                          <span>{member.memberType}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span
                            className={
                              member.status === 'Actif' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
                            }
                          >
                            {member.status}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                          {member.firstName} {member.lastName}
                        </h3>
                      </div>

                      <span className="font-code text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                        {member.cardNumber}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <div className="font-code text-[11px] text-slate-700">
                        CNE : {member.cne || 'N/A'} · Apogée : {member.apogee || 'N/A'}
                      </div>
                      <div className="text-[11px] font-medium text-slate-800 truncate">
                        {member.department || 'EST Fès'}
                        {member.studyYear ? ` · ${member.studyYear}` : ''}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Valide jusqu’au {member.expiryDate}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Emprunts en cours</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {memberLoans.length} / {member.maxAllowedLoans}
                        </span>
                      </div>
                      {hasOverdue && (
                        <div className="text-rose-700 font-medium text-[11px] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Prêt(s) en retard non restitué(s)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setCardModalMember(member)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                      <span>Carte lecteur</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingMember(member)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                        title="Modifier"
                        aria-label="Modifier"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMember(member.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredMembers.length}
            pageSize={MEMBERS_PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="adhérents"
          />
        </div>
      )}

      {isOcrEnrollModalOpen && (
        <StudentOcrEnrollmentModal onClose={() => setIsOcrEnrollModalOpen(false)} />
      )}

      {editingMember && (
        <MemberFormModal
          initialMember={editingMember}
          onClose={() => setEditingMember(null)}
          onSubmit={handleUpdateMember}
        />
      )}

      {cardModalMember && (
        <MemberCardModal
          member={cardModalMember}
          onClose={() => setCardModalMember(null)}
        />
      )}
    </div>
  );
};
