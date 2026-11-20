import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { getOverdueDays } from '../../utils/dateUtils';
import {
  Download,
  RotateCcw,
  FileSpreadsheet,
  ShieldAlert,
  Library,
  Users,
  AlertCircle,
  BarChart3,
  BookOpen,
} from 'lucide-react';

const MONTH_LABELS: Record<string, string> = {
  '05': 'Mai',
  '06': 'Juin',
  '07': 'Juil.',
  '08': 'Août',
  '09': 'Sept.',
  '10': 'Oct.',
};

export const ReportsView: React.FC = () => {
  const {
    books,
    members,
    loans,
    reservations,
    currentDate,
    getOverdueStudentsSummary,
    exportCatalogCSV,
    exportLoansCSV,
    resetToDefault,
  } = useLibrary();

  const [confirmReset, setConfirmReset] = useState(false);

  const totalTitles = books.length;
  const totalCopies = books.reduce((acc, b) => acc + b.totalCopies, 0);
  const availableCopies = books.reduce((acc, b) => acc + b.availableCopies, 0);
  const totalBorrowed = totalCopies - availableCopies;
  const rateDispo = totalCopies > 0 ? Math.round((availableCopies / totalCopies) * 100) : 0;

  const activeLoans = loans.filter((l) => l.status !== 'Rendu');
  const returnedLoans = loans.filter((l) => l.status === 'Rendu');
  const overdueLoans = loans.filter((l) => l.status === 'En retard');
  const overdueStudents = useMemo(() => getOverdueStudentsSummary(), [getOverdueStudentsSummary]);
  const totalLateFees = overdueLoans.reduce((acc, l) => acc + l.lateFee, 0);

  const activeMembers = members.filter((m) => m.status === 'Actif').length;
  const activeReservations = reservations.filter(
    (r) => r.status === 'En attente' || r.status === 'Confirmée' || r.status === 'Prêt pour retrait'
  ).length;

  // Dynamic monthly Loans vs Returns (6 months: 2026-05 .. 2026-10)
  const monthlyActivity = useMemo(() => {
    const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const map = new Map<string, { loans: number; returns: number }>();
    months.forEach((m) => map.set(m, { loans: 0, returns: 0 }));

    loans.forEach((l) => {
      const bMonth = l.borrowDate.slice(0, 7);
      if (map.has(bMonth)) {
        map.get(bMonth)!.loans += 1;
      }
      if (l.status === 'Rendu' && l.returnDate) {
        const rMonth = l.returnDate.slice(0, 7);
        if (map.has(rMonth)) {
          map.get(rMonth)!.returns += 1;
        }
      }
    });

    const rows = months.map((m) => ({
      key: m,
      label: `${MONTH_LABELS[m.slice(5, 7)] || m.slice(5, 7)} 26`,
      loans: map.get(m)!.loans,
      returns: map.get(m)!.returns,
    }));

    const maxVal = Math.max(1, ...rows.flatMap((r) => [r.loans, r.returns]));
    return { rows, maxVal };
  }, [loans]);

  // Dynamic physical copy status breakdown
  const copyStatusBreakdown = useMemo(() => {
    const counts = {
      Disponible: 0,
      Emprunté: 0,
      Réservé: 0,
      'En maintenance': 0,
      Perdu: 0,
    };
    books.forEach((b) => {
      if (b.copies && b.copies.length > 0) {
        b.copies.forEach((c) => {
          counts[c.status] = (counts[c.status] || 0) + 1;
        });
      } else {
        counts.Disponible += b.availableCopies;
        counts.Emprunté += Math.max(0, b.totalCopies - b.availableCopies);
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  }, [books]);

  // Dynamic overdue severity breakdown
  const overdueBuckets = useMemo(() => {
    const groups = [
      { id: '1-3', label: '1 à 3 jours', count: 0, fees: 0, color: 'bg-amber-500' },
      { id: '4-7', label: '4 à 7 jours', count: 0, fees: 0, color: 'bg-orange-500' },
      { id: '8-15', label: '8 à 15 jours', count: 0, fees: 0, color: 'bg-rose-600' },
      { id: '15+', label: 'Plus de 15 jours', count: 0, fees: 0, color: 'bg-rose-900' },
    ];

    overdueLoans.forEach((l) => {
      const d = getOverdueDays(l.dueDate, currentDate);
      const target =
        d <= 3 ? groups[0] : d <= 7 ? groups[1] : d <= 15 ? groups[2] : groups[3];
      target.count += 1;
      target.fees += l.lateFee || 0;
    });

    const maxCount = Math.max(1, ...groups.map((g) => g.count));
    return { groups, maxCount };
  }, [overdueLoans, currentDate]);

  // Top 6 most borrowed titles
  const topBorrowedBooks = useMemo(() => {
    const counts = new Map<string, { title: string; author: string; category: string; count: number }>();
    const bookMap = new Map(books.map((b) => [b.id, b]));
    loans.forEach((l) => {
      const b = bookMap.get(l.bookId);
      const existing = counts.get(l.bookId);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(l.bookId, {
          title: l.bookTitle,
          author: b?.author || 'Auteur EST',
          category: l.bookCategory || b?.category || 'Ouvrage',
          count: 1,
        });
      }
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [loans, books]);

  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number; available: number }> = {};
    books.forEach((b) => {
      if (!map[b.category]) map[b.category] = { total: 0, available: 0 };
      map[b.category].total += b.totalCopies;
      map[b.category].available += b.availableCopies;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [books]);

  const departmentStats = useMemo(() => {
    const counts = members.reduce((acc, m) => {
      const dept = m.department || 'EST Fès';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [members]);

  return (
    <div className="space-y-6 pb-10">
      {/* Compact Page Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
          Statistiques & Rapports
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Indicateurs analytiques de la circulation, état des exemplaires physiques et exports CSV.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium text-slate-600">Documents au catalogue</span>
            <Library className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {totalCopies}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">({totalTitles} titres)</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            <span className="text-emerald-700 font-medium">{availableCopies} dispo</span> · {rateDispo}% en rayon
          </div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium text-slate-600">Circulation globale</span>
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {activeLoans.length}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">actifs ({totalBorrowed} ex.)</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {returnedLoans.length} restitués · {activeReservations} résa active(s)
          </div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium text-slate-600">Retards & Pénalités</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-semibold tracking-tight tabular-nums ${
                overdueLoans.length > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {overdueLoans.length}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              ({overdueStudents.length} étudiant{overdueStudents.length > 1 ? 's' : ''})
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            Pénalités cumulées : <span className="font-semibold text-rose-700">{totalLateFees.toFixed(2)} €</span>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium text-slate-600">Adhérents inscrits</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {members.length}
            </span>
            <span className="text-xs text-slate-500">lecteurs EST</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {activeMembers} actifs · {members.length - activeMembers} suspendu(s)
          </div>
        </div>
      </div>

      {/* Visual Analytics Row: Monthly SVG Grouped Chart & Overdue Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                <span>Évolution mensuelle des prêts et retours</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Volume réel calculé à partir des dates d’emprunt et de restitution (Mai — Octobre 2026).
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-900" />
                <span>Prêts</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                <span>Retours</span>
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 620 210"
              className="w-full h-52 min-w-[460px]"
              role="img"
              aria-label="Graphique mensuel des prêts et retours"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 165 - ratio * 135;
                const val = Math.round(monthlyActivity.maxVal * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1="36"
                      y1={y}
                      x2="605"
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    />
                    <text
                      x="28"
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {monthlyActivity.rows.map((row, index) => {
                const groupX = 58 + index * 92;
                const loansH = (row.loans / monthlyActivity.maxVal) * 135;
                const returnsH = (row.returns / monthlyActivity.maxVal) * 135;
                return (
                  <g key={row.key}>
                    <rect
                      x={groupX}
                      y={165 - loansH}
                      width="24"
                      height={Math.max(2, loansH)}
                      rx="3"
                      fill="#0f172a"
                    />
                    <text
                      x={groupX + 12}
                      y={Math.max(14, 160 - loansH)}
                      textAnchor="middle"
                      className="fill-slate-700 text-[10px] font-mono font-semibold"
                    >
                      {row.loans}
                    </text>

                    <rect
                      x={groupX + 28}
                      y={165 - returnsH}
                      width="24"
                      height={Math.max(2, returnsH)}
                      rx="3"
                      fill="#059669"
                    />
                    <text
                      x={groupX + 40}
                      y={Math.max(14, 160 - returnsH)}
                      textAnchor="middle"
                      className="fill-emerald-700 text-[10px] font-mono font-semibold"
                    >
                      {row.returns}
                    </text>

                    <text
                      x={groupX + 26}
                      y="186"
                      textAnchor="middle"
                      className="fill-slate-600 text-[11px] font-medium"
                    >
                      {row.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Overdue Severity & Physical Copy Inventory */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Ancienneté des retards
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Répartition des {overdueLoans.length} prêts hors délai.
            </p>
            <div className="space-y-2.5">
              {overdueBuckets.groups.map((g) => {
                const widthPct = Math.round((g.count / overdueBuckets.maxCount) * 100);
                return (
                  <div key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium">{g.label}</span>
                      <span className="font-code text-[11px] text-slate-600 tabular-nums">
                        <strong className="text-slate-900">{g.count}</strong> · {g.fees.toFixed(2)} €
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`${g.color} h-1.5 rounded-full`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-900">
              Inventaire des exemplaires ({copyStatusBreakdown.total})
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  { label: 'Disponible', val: copyStatusBreakdown.counts.Disponible, cls: 'text-emerald-700' },
                  { label: 'Emprunté', val: copyStatusBreakdown.counts.Emprunté, cls: 'text-indigo-700' },
                  { label: 'Réservé', val: copyStatusBreakdown.counts.Réservé, cls: 'text-amber-700' },
                  { label: 'Maintenance / Perdu', val: copyStatusBreakdown.counts['En maintenance'] + copyStatusBreakdown.counts.Perdu, cls: 'text-slate-600' },
                ] as const
              ).map((item) => (
                <div
                  key={item.label}
                  className="px-2.5 py-2 rounded-md border border-slate-200 bg-slate-50/70"
                >
                  <div className="text-[10px] text-slate-500">{item.label}</div>
                  <div className={`text-sm font-semibold tabular-nums ${item.cls}`}>
                    {item.val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category & Department Distribution + Top Borrowed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Répartition du fonds par rayon
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Exemplaires totaux et disponibles par domaine.
          </p>
          <div className="space-y-3">
            {categoryStats.map(([cat, stats]) => {
              const percent = totalCopies > 0 ? Math.round((stats.total / totalCopies) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-slate-700 font-medium truncate">
                      {cat}
                    </span>
                    <span className="text-slate-500 tabular-nums font-code text-[11px] shrink-0">
                      {stats.available}/{stats.total} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-slate-800 h-1.5 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Adhérents par filière
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Distribution des {members.length} lecteurs inscrits à l’EST Fès.
          </p>
          <div className="space-y-3">
            {departmentStats.map(([dept, count]) => {
              const percent = members.length > 0 ? Math.round((count / members.length) * 100) : 0;
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-slate-700 font-medium truncate">
                      {dept}
                    </span>
                    <span className="text-slate-500 tabular-nums font-code text-[11px] shrink-0">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-700 h-1.5 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>Ouvrages les plus demandés</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Classement établi sur l’ensemble de l’historique des prêts.
          </p>
          <div className="divide-y divide-slate-100">
            {topBorrowedBooks.map((item, idx) => (
              <div key={item.title} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    <span className="font-code text-slate-400 mr-1.5">0{idx + 1}.</span>
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {item.author} · {item.category}
                  </div>
                </div>
                <span className="text-xs font-code font-semibold text-slate-800 tabular-nums shrink-0">
                  {item.count} prêts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exports & Policy Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Exportations des registres (CSV)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Téléchargez les données tabulaires pour vos archivages institutionnels.
            </p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
            <div className="p-3.5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">Catalogue des titres</h3>
                  <p className="text-[11px] text-slate-500">ISBN, titre, auteur, éditeur, cote et stock</p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportCatalogCSV}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exporter</span>
              </button>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">Registre des prêts & retards</h3>
                  <p className="text-[11px] text-slate-500">Emprunts, échéances, statuts et pénalités</p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportLoansCSV}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exporter</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Politique de circulation en vigueur
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paramètres appliqués automatiquement par Athenaeum EST Fès.
            </p>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md text-xs">
            <div className="p-3.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 block">Durée standard de prêt</span>
                <span className="text-[11px] text-slate-500">Renouvelable 2 fois si non réservé</span>
              </div>
              <span className="font-code font-semibold text-slate-900 tabular-nums">21 jours</span>
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 block">Pénalité de retard</span>
                <span className="text-[11px] text-slate-500">Facturée dès le lendemain de l’échéance</span>
              </div>
              <span className="font-code font-semibold text-slate-900 tabular-nums">0,20 € / jour</span>
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 block">Quotas d’emprunt</span>
                <span className="text-[11px] text-slate-500">Selon la catégorie d’adhérent</span>
              </div>
              <span className="font-code font-semibold text-slate-900 tabular-nums">3 à 10 docs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reset System State */}
      <div className="bg-white rounded-lg border border-rose-200 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <h2 className="text-sm font-semibold text-rose-900">
            Réinitialisation des données de démonstration
          </h2>
        </div>
        <p className="text-xs text-slate-600 max-w-xl">
          Restaurez les registres complets de la bibliothèque (215 ouvrages, 318 adhérents, prêts, réservations et notifications).
        </p>

        {confirmReset ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-semibold text-rose-900">
              Confirmer la suppression des modifications locales ?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetToDefault();
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurer les données initiales</span>
          </button>
        )}
      </div>
    </div>
  );
};
