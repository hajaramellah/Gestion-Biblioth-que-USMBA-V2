import React, { useEffect, useState } from 'react';
import { Member } from '../../types/library';
import { generateQrDataUrl, buildStudentQrPayload } from '../../utils/qrHelper';
import { X, Printer, BookOpen } from 'lucide-react';

interface MemberCardModalProps {
  member: Member;
  onClose: () => void;
}

export const MemberCardModal: React.FC<MemberCardModalProps> = ({ member, onClose }) => {
  const [qrUrl, setQrUrl] = useState<string>(member.qrCodeDataUrl || '');

  useEffect(() => {
    let active = true;
    if (!member.qrCodeDataUrl) {
      generateQrDataUrl(buildStudentQrPayload(member)).then((url) => {
        if (active && url) setQrUrl(url);
      });
    } else {
      setQrUrl(member.qrCodeDataUrl);
    }
    return () => {
      active = false;
    };
  }, [member]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-lg max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Carte de lecteur numérique
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="rounded-lg bg-slate-900 text-white p-5 border border-slate-800">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold tracking-wide text-white">
                    ÉCOLE SUPÉRIEURE DE TECHNOLOGIE
                  </h4>
                  <span className="text-[10px] text-slate-400 block">
                    Université Sidi Mohamed Ben Abdellah · Fès
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/10 text-slate-200 border border-white/15 shrink-0">
                {member.department ? member.department.split(' ')[0] : 'EST FÈS'}
              </span>
            </div>

            <div className="mt-5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
                Carte d’Étudiant & Lecteur
              </span>
              <h3 className="text-base font-semibold tracking-tight text-white mt-0.5">
                {member.firstName} {member.lastName}
              </h3>
              <div className="text-xs text-slate-300 font-code tabular-nums mt-1 flex flex-wrap gap-2">
                <span>CNE : <strong className="text-white">{member.cne}</strong></span>
                <span>·</span>
                <span>Apogée : <strong className="text-white">{member.apogee}</strong></span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-code truncate">
                {member.email}
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-800 flex items-end justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Identifiant Carte
                </span>
                <span className="text-xs font-code font-semibold tracking-wider text-amber-300 tabular-nums">
                  {member.cardNumber}
                </span>
                <div className="text-[10px] text-slate-400 mt-1 tabular-nums">
                  Valide jusqu’au : <span className="text-slate-200">{member.expiryDate}</span>
                </div>
              </div>

              <div className="bg-white p-1.5 rounded-md flex flex-col items-center shrink-0">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="QR Code Carte Étudiant"
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-slate-500 text-[9px]">
                    Génération...
                  </div>
                )}
                <span className="text-[7px] font-code text-slate-600 tracking-wider mt-0.5">
                  EST-USMBA
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span>Droit de prêt : <strong className="text-slate-900 tabular-nums">{member.maxAllowedLoans} documents</strong></span>
            <span className={member.status === 'Actif' ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
              Statut : {member.status}
            </span>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer la carte</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
