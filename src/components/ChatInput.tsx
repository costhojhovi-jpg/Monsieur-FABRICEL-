import React, { useState, KeyboardEvent, useRef } from "react";
import { Send, Square, Loader2, Paperclip, X, FileText, Image as ImageIcon, File, Mic, MicOff } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string, attachments?: { mimeType: string; data: string }[]) => void;
  onStop: () => void;
  isLoading: boolean;
  themeStyles: any;
  isWideLayout?: boolean;
  externalValue?: string;
  onExternalValueConsumed?: () => void;
}

export const ChatInput = React.memo(({ onSend, onStop, isLoading, themeStyles, isWideLayout, externalValue, onExternalValueConsumed }: ChatInputProps) => {
  const [input, setInput] = useState("");

  React.useEffect(() => {
    if (externalValue) {
      setInput(externalValue);
      if (onExternalValueConsumed) {
        onExternalValueConsumed();
      }
    }
  }, [externalValue, onExternalValueConsumed]);
  const [attachments, setAttachments] = useState<{ file: File, preview: string, base64: string, type: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Votre navigateur ne supporte pas la reconnaissance vocale.");
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          const isInIframe = window.self !== window.top;
          setError(isInIframe 
            ? "Microphone bloqué dans l'aperçu. Cliquez sur l'icône 'Ouvrir dans un nouvel onglet' en haut à droite pour utiliser la voix." 
            : "Microphone non autorisé. Veuillez vérifier les paramètres de votre navigateur.");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleSend = () => {
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      const attachmentData = attachments.map(a => ({
        mimeType: a.type,
        data: a.base64
      }));
      onSend(input, attachmentData.length > 0 ? attachmentData : undefined);
      setInput("");
      setAttachments([]);
      setError(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);

    // Allow images up to 15MB (will be compressed) and other files up to 1MB
    const validFiles = files.filter(f => {
      const isImage = f.type.startsWith('image/');
      const maxSize = isImage ? 15 * 1024 * 1024 : 1 * 1024 * 1024;
      
      if (f.size > maxSize) {
        setError(isImage 
          ? `L'image "${f.name}" est trop lourde (> 15 Mo).` 
          : `Le fichier "${f.name}" est trop volumineux (> 1 Mo).`
        );
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newAttachments = await Promise.all(validFiles.map(async (file) => {
      return new Promise<{ file: File, preview: string, base64: string, type: string }>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          let base64 = (reader.result as string).split(',')[1];
          let preview = reader.result as string;
          
          // Compress image if it's an image and potentially large
          if (file.type.startsWith('image/')) {
            const img = new Image();
            img.src = preview;
            await new Promise(res => img.onload = res);
            
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Max dimensions to keep it under Firestore 1MB limit (even with multiple images)
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG with 0.6 quality (good balance for Gemini and file size)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
            base64 = compressedDataUrl.split(',')[1];
            preview = compressedDataUrl;
          }
          
          resolve({ file, preview, base64, type: file.type.startsWith('image/') ? 'image/jpeg' : file.type });
        };
        reader.readAsDataURL(file);
      });
    }));

    setAttachments(prev => [...prev, ...newAttachments].slice(0, 5)); // Limit to 5 files
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="p-6 bg-white border-t border-slate-200 shrink-0">
      <div className={cn("mx-auto relative transition-all duration-300", isWideLayout ? "max-w-[95%] xl:max-w-[98%] w-full" : "max-w-5xl")}>
        {/* Error Message */}
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="w-3 h-3" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((att, i) => (
              <div key={`att-item-${att.file?.name || 'file'}-${i}`} className="relative group">
                <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                  {att.type.startsWith('image/') ? (
                    <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
                  ) : att.type === 'application/pdf' ? (
                    <div className="flex flex-col items-center gap-1">
                      <FileText className="w-6 h-6 text-red-500" />
                      <span className="text-[8px] font-bold uppercase">PDF</span>
                    </div>
                  ) : (
                    <File className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <button 
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {att.file.name}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
            accept="image/*,application/pdf"
          />
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "rounded-xl h-12 w-12 shrink-0 transition-all",
              isListening ? "text-red-500 bg-red-50 animate-pulse" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            )}
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading}
            title={isListening ? "Arrêter l'enregistrement" : "Parler à Monsieur FABRICEL"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="rounded-xl h-12 w-12 shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || attachments.length >= 5}
            title="Ajouter une photo ou un PDF"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question ou analysez un document..."
              className={cn(
                "pr-12 py-6 rounded-2xl border-slate-200 shadow-sm", 
                themeStyles.isCustom ? "focus-visible:ring-slate-400" : themeStyles.text.replace('text-', 'focus-visible:ring-')
              )}
              disabled={isLoading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isLoading ? (
                <Button 
                  size="icon" 
                  variant="outline"
                  className="rounded-xl h-9 w-9 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                  onClick={onStop}
                  title="Arrêter la génération"
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button 
                  size="icon" 
                  className={cn("rounded-xl h-9 w-9 text-white", themeStyles.bg, themeStyles.hover)}
                  style={themeStyles.bgStyle}
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-slate-400 mt-3">
        Monsieur FABRICEL peut faire des erreurs. Vérifiez toujours les informations par rapport aux textes officiels.
      </p>
    </div>
  );
});

ChatInput.displayName = "ChatInput";
