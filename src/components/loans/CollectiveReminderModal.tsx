import React, { useState } from 'react';
import {
  useLibrary,
  CollectiveReminderResult,
} from '../../context/LibraryContext';
import {
  X,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Users,
  BookOpen,
  Info,
} from 'lucide-react';

interface CollectiveReminderModalProps {
  onClose: () => void;
}

export const CollectiveReminderModal: React.FC<CollectiveReminderModalProps> = ({
  onClose,
}) => {
  const { getOverdueStudentsSummary, sendCollectiveReminders } = useLibrary();

  const overdueGroups = getOverdueStudentsSummary();
  const [includeAlreadyReminded, setIncludeAlreadyReminded] = useState(false);
  const [result, setResult] = useState<CollectiveReminderResult | null>(null);

  const alreadyRemindedCount = overdueGroups.filter((g) => g.alreadyRemindedToday).length;
  const eligibleCount = includeAlreadyReminded
    ? overdueGroups.length
    : overdueGroups.length - alreadyRemindedCount;

  const totalOverdueBooks = overdueGroups.reduce((acc, g) => acc + g.loans.length, 0);

  const handleConfirmSend = () => {
    const res = sendCollectiveReminders({
      includeAlreadyRemindedToday: includeAlreadyReminded,
    });
    setResult(res);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              {result
                ? 'Récapitulatif de la relance collective'
                : 'Relancer tous les étudiants en retard'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {result
                ? 'Rapport d’envoi et journalisation des notifications'
                : 'Regroupement automatique des ouvrages en retard par étudiant'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {!result ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">
                    Étudiants concernés
                  </span>
                  <div className="text-xl font-semibold text-slate-900 tabular-nums mt-0.5 flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-600" />
                    <span>{overdueGroups.length}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">
                    Livres en retard
                  </span>
                  <div className="text-xl font-semibold text-slate-900 tabular-nums mt-0.5 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    <span>{totalOverdueBooks}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">
                    Notifications à envoyer
                  </span>
                  <div className="text-xl font-semibold text-emerald-700 tabular-nums mt-0.5 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-700" />
                    <span>{eligibleCount}</span>
                  </div>
                </div>
              </div>

              {overdueGroups.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-lg border border-slate-200">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">
                    Aucun étudiant en retard actuellement
                  </p>
                </div>
              ) : (
                <>
                  {alreadyRemindedCount > 0 && (
                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                      <div className="flex items-start gap-2 text-xs text-amber-900">
                        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Protection anti-doublon :</span>{' '}
                          {alreadyRemindedCount} étudiant(s) ont déjà reçu une relance aujourd’hui et seront ignorés par défaut.
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-amber-950 font-medium pl-6 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeAlreadyReminded}
                          onChange={(e) => setIncludeAlreadyReminded(e.target.checked)}
                          className="rounded border-amber-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span>Inclure les étudiants déjà relancés aujourd’hui</span>
                      </label>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        Destinataires regroupés
                      </span>
                      <span>1 notification par étudiant</span>
                    </div>

                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                      {overdueGroups.map((group) => {
                        const willSkip = group.alreadyRemindedToday && !includeAlreadyReminded;
                        return (
                          <div
                            key={group.studentKey}
                            className={`p-3.5 space-y-1.5 ${willSkip ? 'bg-slate-50 opacity-70' : 'bg-white'}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-900">
                                    {group.studentName}
                                  </span>
                                  <span className="text-[11px] font-code text-slate-500">
                                    {group.studentCne} · {group.department}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-code">
                                  {group.studentEmail || 'Adresse @usmba.ac.ma manquante'}
                                </div>
                              </div>

                              <span
                                className={`text-[11px] font-semibold shrink-0 tabular-nums ${
                                  willSkip ? 'text-slate-500' : 'text-rose-700'
                                }`}
                              >
                                {willSkip
                                  ? 'Déjà relancé aujourd’hui'
                                  : `${group.loans.length} livre(s) en retard`}
                              </span>
                            </div>

                            <ul className="space-y-0.5 text-xs text-slate-700 pt-1 border-t border-slate-100">
                              {group.loans.map((l) => (
                                <li key={l.loanId} className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-slate-800">{l.bookTitle}</span>
                                  <span className="text-[11px] text-rose-700 font-code tabular-nums">
                                    Prévu {l.dueDate} ({l.daysOverdue} j)
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-medium text-emerald-800 block">
                    Envoyées
                  </span>
                  <div className="text-xl font-semibold text-emerald-700 tabular-nums mt-0.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{result.sentCount}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="text-xs font-medium text-rose-800 block">
                    Échecs
                  </span>
                  <div className="text-xl font-semibold text-rose-700 tabular-nums mt-0.5 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{result.failedCount}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-medium text-slate-600 block">
                    Ignorées (anti-doublon)
                  </span>
                  <div className="text-xl font-semibold text-slate-800 tabular-nums mt-0.5 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>{result.skippedCount}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700">
                  Détail enregistré dans l’historique
                </h3>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                  {result.entries.map((entry) => (
                    <div key={entry.id} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {entry.studentName}{' '}
                          <span className="font-normal font-code text-slate-500">
                            ({entry.studentEmail})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {entry.bookTitles.join(' · ')}
                        </div>
                        {entry.errorReason && (
                          <div className="text-[11px] text-rose-600 mt-0.5">
                            {entry.errorReason}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-code text-[11px] text-slate-400">
                          {entry.date} {entry.time}
                        </span>
                        <span
                          className={`font-semibold text-[11px] ${
                            entry.status === 'Envoyée'
                              ? 'text-emerald-700'
                              : entry.status === 'Échec'
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          {!result ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={overdueGroups.length === 0 || eligibleCount === 0}
                onClick={handleConfirmSend}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  Confirmer l’envoi ({eligibleCount} étudiant{eligibleCount > 1 ? 's' : ''})
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
            >
              Terminer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
