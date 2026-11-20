import React, { useState, useMemo, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { RegistrationStatus } from '../../types/library';
import { StudentOcrEnrollmentModal } from '../members/StudentOcrEnrollmentModal';
import { Pagination } from '../common/Pagination';
import {
  X,
  RefreshCw,
  Search,
  Database,
  Camera,
} from 'lucide-react';

interface SchoolRegistrySyncModalProps {
  onClose: () => void;
}

const REGISTRY_PAGE_SIZE = 12;

export const SchoolRegistrySyncModal: React.FC<SchoolRegistrySyncModalProps> = ({ onClose }) => {
  const {
    studentRegistry,
    syncWithESTRegistry,
    updateStudentRegistrationStatus,
  } = useLibrary();

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOcrEnrollModalOpen, setIsOcrEnrollModalOpen] = useState(false);

  const departments = useMemo(() => {
    const set = new Set(studentRegistry.map((s) => s.department).filter(Boolean));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))];
  }, [studentRegistry]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return studentRegistry.filter((s) => {
      if (departmentFilter !== 'all' && s.department !== departmentFilter) return false;
      if (statusFilter !== 'all' && s.registrationStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.cne.toLowerCase().includes(q) ||
        s.apogee.toLowerCase().includes(q) ||
        s.academicEmail.toLowerCase().includes(q)
      );
    });
  }, [studentRegistry, search, departmentFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, departmentFilter, statusFilter]);

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * REGISTRY_PAGE_SIZE;
    return filteredStudents.slice(start, start + REGISTRY_PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncWithESTRegistry();
    setTimeout(() => setIsSyncing(false), 600);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Service Scolarité EST Fès — Registre des Inscriptions
                </h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  {studentRegistry.length} dossiers Apogée USMBA synchronisés.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Synchroniser Apogée</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 sm:p-6 space-y-4">
            {/* Controls */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrer par CNE, Apogée, nom..."
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-md px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  aria-label="Filtrer par filière"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d === 'all' ? 'Toutes filières' : d}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | RegistrationStatus)}
                  className="text-xs border border-slate-300 rounded-md px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  aria-label="Filtrer par statut"
                >
                  <option value="all">Tous statuts</option>
                  <option value="Inscrit">Inscrit</option>
                  <option value="Suspendu">Suspendu</option>
                  <option value="Radié">Radié</option>
                  <option value="Diplômé">Diplômé</option>
                </select>
              </div>

              {/* Automated OCR Inscription button replacing manual form */}
              <button
                type="button"
                onClick={() => setIsOcrEnrollModalOpen(true)}
                className="w-full lg:w-auto px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center justify-center gap-2 shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Inscrire un étudiant (Scan Carte OCR)</span>
              </button>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[640px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Étudiant & E-mail</th>
                    <th className="py-2.5 px-3">CNE / Apogée</th>
                    <th className="py-2.5 px-3">Filière EST</th>
                    <th className="py-2.5 px-3">Statut officiel</th>
                    <th className="py-2.5 px-3 text-right">Modifier statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-[11px] font-code text-slate-500">
                          {s.academicEmail}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-code text-slate-700 tabular-nums">
                        <div>{s.cne}</div>
                        <div className="text-[10px] text-slate-400">Apogée: {s.apogee}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-800">{s.department}</span>
                        <div className="text-[10px] text-slate-400">{s.studyYear}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[11px] font-semibold ${
                            s.registrationStatus === 'Inscrit'
                              ? 'text-emerald-700'
                              : s.registrationStatus === 'Radié'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {s.registrationStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <select
                          value={s.registrationStatus}
                          onChange={(e) =>
                            updateStudentRegistrationStatus(s.id, e.target.value as RegistrationStatus)
                          }
                          className="text-[11px] font-medium bg-white border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="Inscrit">Inscrit (Autorisé)</option>
                          <option value="Radié">Radié (Bloquer accès)</option>
                          <option value="Suspendu">Suspendu</option>
                          <option value="Diplômé">Diplômé</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredStudents.length}
              pageSize={REGISTRY_PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="dossiers Apogée"
            />
          </div>
        </div>
      </div>

      {/* OCR Enrollment Modal */}
      {isOcrEnrollModalOpen && (
        <StudentOcrEnrollmentModal
          onClose={() => setIsOcrEnrollModalOpen(false)}
        />
      )}
    </>
  );
};
