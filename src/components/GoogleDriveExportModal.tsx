import React, { useState } from "react";
import { 
  X, 
  FolderPlus, 
  Check, 
  ExternalLink, 
  Loader2, 
  HardDrive, 
  FileText, 
  FileCode, 
  FileType, 
  Sparkles,
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { 
  getDriveAccessToken, 
  openGoogleDrivePicker, 
  uploadToGoogleDrive, 
  DriveFolder, 
  UploadResult 
} from "@/services/googleDriveService";
import { stripConversationalFiller } from "@/utils/textUtils";
import { downloadMessageAsPDF } from "@/utils/pdfGenerator";
import { downloadMessageAsDOCX } from "@/utils/docxGenerator";

interface GoogleDriveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageText: string;
  theme: any;
  defaultTitle?: string;
  defaultSubject?: string;
  defaultGrade?: string;
  defaultDocType?: string;
}

export const GoogleDriveExportModal: React.FC<GoogleDriveExportModalProps> = ({
  isOpen,
  onClose,
  messageText,
  theme,
  defaultTitle = "Fiche_Pedagogique",
  defaultSubject = "Mathématiques",
  defaultGrade = "Collège / Lycée",
  defaultDocType = "Fiche de préparation de leçon"
}) => {
  const [format, setFormat] = useState<"gdoc" | "pdf" | "docx" | "md">("gdoc");
  const [docTitle, setDocTitle] = useState(defaultTitle);
  const [subject, setSubject] = useState(defaultSubject);
  const [grade, setGrade] = useState(defaultGrade);
  const [docType, setDocType] = useState(defaultDocType);
  const [stripFiller, setStripFiller] = useState(true);

  // Folder selection state
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder>({
    id: "auto",
    name: "Dossier automatique : Monsieur FABRICEL - Fiches Pédagogiques"
  });

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenPicker = async () => {
    setIsLoading(true);
    setStatusMessage("Connexion à Google Drive pour ouvrir le sélecteur...");
    setErrorMessage(null);

    try {
      const { accessToken } = await getDriveAccessToken();
      setStatusMessage("Ouverture de Google Picker...");
      
      await openGoogleDrivePicker(
        accessToken,
        (folder) => {
          setSelectedFolder(folder);
          setIsLoading(false);
          setStatusMessage("");
        },
        () => {
          setIsLoading(false);
          setStatusMessage("");
        }
      );
    } catch (error: any) {
      const isCancelled = 
        error?.isCancelled || 
        error?.code === 'auth/popup-closed-by-user' || 
        error?.code === 'auth/cancelled-popup-request' ||
        error?.message?.includes('popup-closed-by-user');

      if (isCancelled) {
        console.info("Google Picker : sélection annulée ou fenêtre fermée par l'utilisateur.");
        setErrorMessage("La fenêtre de connexion a été fermée avant la sélection. Le dossier automatique 'Monsieur FABRICEL - Fiches Pédagogiques' reste configuré par défaut.");
      } else {
        console.warn("Avertissement Google Picker:", error?.message || error);
        setErrorMessage(error?.message || "Impossible d'ouvrir le sélecteur Google Drive. Vérifiez l'autorisation de votre compte.");
      }
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setUploadResult(null);
    setStatusMessage("Authentification Google Drive...");

    const cleanText = stripFiller ? stripConversationalFiller(messageText) : messageText;

    try {
      const { accessToken } = await getDriveAccessToken();

      let contentToUpload: string | Blob = cleanText;

      if (format === "pdf") {
        setStatusMessage("Génération haute fidélité du PDF...");
        const pdfRes = await downloadMessageAsPDF(cleanText, theme.hex, {
          finalDocType: docType,
          finalSubject: subject,
          finalGrade: grade,
          finalIncludeAvatar: true,
          pdfEnableWatermark: false,
          pdfIncludeBrandHeader: true,
          pdfIncludeBrandFooter: true
        });
        if (pdfRes?.pdfUrl) {
          const fetchedBlob = await (await fetch(pdfRes.pdfUrl)).blob();
          contentToUpload = fetchedBlob;
        }
      } else if (format === "docx") {
        setStatusMessage("Génération du document Word...");
        const docxRes = await downloadMessageAsDOCX(cleanText, theme.hex, {
          finalDocType: docType,
          finalSubject: subject,
          finalGrade: grade,
          finalIncludeAvatar: true,
          finalIncludeBrandHeader: true,
          finalIncludeBrandFooter: true
        });
        if (docxRes?.docxUrl) {
          const fetchedBlob = await (await fetch(docxRes.docxUrl)).blob();
          contentToUpload = fetchedBlob;
        }
      }

      setStatusMessage("Téléversement vers Google Drive...");
      const result = await uploadToGoogleDrive(accessToken, {
        title: docTitle,
        subject,
        grade,
        docType,
        format,
        content: contentToUpload,
        folderId: selectedFolder.id === "auto" ? undefined : selectedFolder.id
      });

      setUploadResult(result);
      setStatusMessage("");
    } catch (error: any) {
      const isCancelled = 
        error?.isCancelled || 
        error?.code === 'auth/popup-closed-by-user' || 
        error?.code === 'auth/cancelled-popup-request' ||
        error?.message?.includes('popup-closed-by-user');

      if (isCancelled) {
        console.info("Google Drive Export : autorisation fermée par l'utilisateur.");
        setErrorMessage("Autorisation annulée : la fenêtre Google a été fermée avant la validation. Vous pouvez réessayer ou télécharger directement le document.");
      } else {
        console.warn("Avertissement export Google Drive:", error?.message || error);
        setErrorMessage(error?.message || "Échec de l'exportation vers Google Drive. Veuillez réessayer.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                  Exporter vers Google Drive
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Cloud Enseignant
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">Sauvegardez et organisez vos fiches dans votre espace personnel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-left">
            {uploadResult ? (
              /* Success Card */
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <Check className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-emerald-950">Fiche exportée avec succès !</h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    Votre document <strong>"{uploadResult.name}"</strong> a été enregistré dans Google Drive.
                  </p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5">
                    Emplacement : <strong>{uploadResult.folderName}</strong>
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                  {uploadResult.webViewLink && (
                    <a
                      href={uploadResult.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ouvrir dans Google Drive</span>
                    </a>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setUploadResult(null)}
                    className="text-xs font-semibold text-slate-700 border-slate-300"
                  >
                    Exporter à nouveau
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Titre et métadonnées */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Titre de la fiche</label>
                    <input
                      type="text"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="Ex: Fiche_Thalès_3ème"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Matière</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Classe / Niveau</label>
                      <input
                        type="text"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Format de destination */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Format d'exportation vers Google Drive</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Google Doc */}
                    <button
                      type="button"
                      onClick={() => setFormat("gdoc")}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition select-none ${
                        format === "gdoc" 
                          ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20" 
                          : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-800">Google Docs</span>
                          <span className="bg-blue-100 text-blue-800 text-[8px] font-extrabold px-1 rounded">ÉDITABLE</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Modifiable directement depuis votre téléphone ou PC.
                        </p>
                      </div>
                    </button>

                    {/* PDF */}
                    <button
                      type="button"
                      onClick={() => setFormat("pdf")}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition select-none ${
                        format === "pdf" 
                          ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20" 
                          : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-red-100 text-red-600 shrink-0 mt-0.5">
                        <FileType className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-800">Fichier PDF</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[8px] font-extrabold px-1 rounded">PRÊT</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Mise en page officielle figée, prête pour impression.
                        </p>
                      </div>
                    </button>

                    {/* Word */}
                    <button
                      type="button"
                      onClick={() => setFormat("docx")}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition select-none ${
                        format === "docx" 
                          ? "bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20" 
                          : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">Word (.docx)</span>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Document bureautique Microsoft Office standard.
                        </p>
                      </div>
                    </button>

                    {/* Markdown */}
                    <button
                      type="button"
                      onClick={() => setFormat("md")}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition select-none ${
                        format === "md" 
                          ? "bg-slate-100 border-slate-500 ring-2 ring-slate-400/20" 
                          : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-slate-200 text-slate-700 shrink-0 mt-0.5">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">Markdown (.md)</span>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Texte brut formaté avec syntaxe KaTeX et tableaux.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 3. Sélecteur de dossier Google Drive & Google Picker */}
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4 text-amber-700" />
                      Dossier de destination Google Drive
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenPicker}
                      disabled={isLoading}
                      className="text-[11px] font-bold text-amber-900 bg-white hover:bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 shadow-xs flex items-center gap-1 transition"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-amber-700" />
                      <span>Choisir avec Google Picker</span>
                    </button>
                  </div>
                  
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium truncate max-w-[80%]">
                      {selectedFolder.name}
                    </span>
                    {selectedFolder.id !== "auto" && (
                      <button
                        type="button"
                        onClick={() => setSelectedFolder({
                          id: "auto",
                          name: "Dossier automatique : Monsieur FABRICEL - Fiches Pédagogiques"
                        })}
                        className="text-[10px] text-slate-400 hover:text-red-600 underline font-semibold"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-amber-800/80">
                    💡 Par défaut, vos fiches sont regroupées proprement dans le dossier <strong>"Monsieur FABRICEL - Fiches Pédagogiques (MEN)"</strong> de votre Google Drive.
                  </p>
                </div>

                {/* Strip filler toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={stripFiller}
                    onChange={(e) => setStripFiller(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 font-medium">
                    Exporter le contenu didactique pur (sans les formules de politesse de fin de message)
                  </span>
                </label>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3.5 bg-amber-50 text-amber-900 text-xs rounded-2xl border border-amber-200/90 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-relaxed">{errorMessage}</p>
                      <button
                        type="button"
                        onClick={() => setErrorMessage(null)}
                        className="text-amber-500 hover:text-amber-700 text-xs font-bold px-1"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={handleExport}
                        disabled={isLoading}
                        className="text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs transition"
                      >
                        🔄 Réessayer la connexion
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cleanText = stripFiller ? stripConversationalFiller(messageText) : messageText;
                          downloadMessageAsPDF(cleanText, theme.hex, {
                            finalDocType: docType,
                            finalSubject: subject,
                            finalGrade: grade,
                            finalIncludeAvatar: true,
                            pdfEnableWatermark: false,
                            pdfIncludeBrandHeader: true,
                            pdfIncludeBrandFooter: true
                          });
                        }}
                        className="text-[11px] font-bold text-red-800 bg-white hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 shadow-2xs transition"
                      >
                        📄 Télécharger en PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cleanText = stripFiller ? stripConversationalFiller(messageText) : messageText;
                          downloadMessageAsDOCX(cleanText, theme.hex, {
                            finalDocType: docType,
                            finalSubject: subject,
                            finalGrade: grade,
                            finalIncludeAvatar: true,
                            finalIncludeBrandHeader: true,
                            finalIncludeBrandFooter: true
                          });
                        }}
                        className="text-[11px] font-bold text-blue-800 bg-white hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs transition"
                      >
                        📝 Télécharger en Word
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!uploadResult && (
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-medium truncate">
                {statusMessage || "Autorisation demandée avec accord explicite."}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  className="h-9 px-3.5 text-xs text-slate-600"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="h-9 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{statusMessage || "Export en cours..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Enregistrer dans mon Drive</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
