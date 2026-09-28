import React, { useState } from "react";
import { 
  BookOpen, 
  ExternalLink, 
  Search, 
  FileText, 
  Sparkles, 
  Check, 
  FolderDown, 
  X,
  Filter,
  GraduationCap
} from "lucide-react";
import { 
  OFFICIAL_DOCUMENTS_CATALOG, 
  OfficialDocument, 
  GENERAL_FOLDER_LINK 
} from "@/data/officialPacksCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OfficialPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocumentForChat?: (promptText: string) => void;
  themeHex?: string;
}

export const OfficialPacksModal: React.FC<OfficialPacksModalProps> = ({
  isOpen,
  onClose,
  onSelectDocumentForChat,
  themeHex = "#059669"
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCycle, setSelectedCycle] = useState<string>("Tous");
  const [selectedType, setSelectedType] = useState<string>("Tous");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const cycles = ["Tous", "Primaire", "Collège", "Lycée", "National"];
  const types = ["Tous", "PE", "RAPE", "FRP", "DIRECTIVE"];

  const filteredDocs = OFFICIAL_DOCUMENTS_CATALOG.filter((doc) => {
    const matchesCycle = selectedCycle === "Tous" || doc.cycle === selectedCycle;
    const matchesType = selectedType === "Tous" || doc.type === selectedType;
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.level.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.subject && doc.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
      doc.description.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesCycle && matchesType && matchesSearch;
  });

  const handleUseInChat = (doc: OfficialDocument) => {
    if (onSelectDocumentForChat) {
      const prompt = `Je souhaite préparer une séance selon les documents officiels du MEN Madagascar.
Document de référence : **${doc.title}** (${doc.level}${doc.subject ? ' - ' + doc.subject : ''}).
Type : ${doc.type === 'PE' ? 'Programme d’Études officiel' : doc.type === 'RAPE' ? 'Répartition Annuelle RAPE' : 'Fiche Ressources Pédagogiques FRP'}.

Peux-tu me proposer une fiche pédagogique complète (conforme au canevas officiel du Nouveau Programme d'Études) ou les objectifs clés pour ce niveau ?`;
      onSelectDocumentForChat(prompt);
      onClose();
    }
  };

  const getDrivePreviewUrl = (driveId: string) => {
    return `https://drive.google.com/file/d/${driveId}/view?usp=sharing`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  Documents Officiels de Référence (MEN Madagascar)
                </h2>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] px-2 py-0.5">
                  PACK GÉNÉRALISATION PE
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Programmes d'Études (PE), Répartitions Annuelles (RAPE), et Fiches Ressources (FRP) intégrés.
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 rounded-full h-8 w-8"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Global Drive Link Alert Banner */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <FolderDown className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Accès au dossier Drive source partagé contenant les packs complets (Prescolaire, Primaire, Collège, Lycée).
            </span>
          </div>
          <a
            href={GENERAL_FOLDER_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0 text-xs"
          >
            <span>Ouvrir le Drive Source</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Filters & Search */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher (ex: Maths 3ème, T6, RAPE)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs sm:text-sm h-9 bg-slate-50 border-slate-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {cycles.map((c, cIdx) => (
              <button
                key={`cycle-${c}-${cIdx}`}
                onClick={() => setSelectedCycle(c)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-lg font-medium transition",
                  selectedCycle === c 
                    ? "bg-emerald-600 text-white shadow-xs" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Document Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Aucun document ne correspond à votre filtre.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSearchTerm(""); setSelectedCycle("Tous"); setSelectedType("Tous"); }}
                className="mt-3 text-xs"
              >
                Réinitialiser les filtres
              </Button>
            </div>
          ) : (
            filteredDocs.map((doc, dIdx) => (
              <div
                key={`doc-${doc.id}-${dIdx}`}
                className="p-3 sm:p-3.5 bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[11px]",
                    doc.type === 'PE' ? "bg-blue-100 text-blue-700" :
                    doc.type === 'RAPE' ? "bg-amber-100 text-amber-700" :
                    doc.type === 'FRP' ? "bg-emerald-100 text-emerald-700" :
                    "bg-purple-100 text-purple-700"
                  )}>
                    {doc.type}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-800 group-hover:text-emerald-900 transition">
                        {doc.title}
                      </h3>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold border-slate-300 text-slate-600">
                        {doc.level}
                      </Badge>
                      {doc.subject && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-slate-200 text-slate-700">
                          {doc.subject}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {doc.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <a
                    href={getDrivePreviewUrl(doc.driveId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 bg-white px-2.5 py-1.5 rounded-lg transition"
                    title="Consulter le document sur Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Consulter</span>
                  </a>

                  {onSelectDocumentForChat && (
                    <Button
                      size="sm"
                      onClick={() => handleUseInChat(doc)}
                      className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Appliquer au cours</span>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            {filteredDocs.length} document{filteredDocs.length > 1 ? 's' : ''} répertorié{filteredDocs.length > 1 ? 's' : ''} (MEN Madagascar)
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClose}
            className="text-xs h-8"
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
