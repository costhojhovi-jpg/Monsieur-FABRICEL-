import React, { useState, useRef, useEffect, memo, useCallback } from "react";
import { 
  Send, 
  BookOpen, 
  FileText, 
  GraduationCap, 
  Users, 
  Lightbulb, 
  ShieldCheck, 
  Menu, 
  X,
  Bot,
  User as UserIcon,
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
  Info,
  Square,
  ArrowDown,
  LogOut,
  History,
  MessageSquare,
  LogIn,
  Palette,
  Share,
  ExternalLink,
  Search,
  Settings,
  Key,
  Download,
  File as FileIcon,
  ShieldAlert,
  Ban
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { chatWithGeminiStream, Message } from "@/services/geminiService";
import { cn } from "@/lib/utils";
import { Mermaid } from "@/components/Mermaid";
import { ZoomableSVG } from "@/components/ZoomableSVG";
import { ChatInput } from "@/components/ChatInput";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  handleFirestoreError,
  OperationType
} from "@/lib/firebase";

interface ChatSession {
  id: string;
  title: string;
  createdAt: any;
  updatedAt: any;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Une erreur inattendue est survenue.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes("permission")) {
          errorMessage = "Erreur de permission : Vous n'avez pas les droits nécessaires pour effectuer cette action.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 text-center">
          <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">Oups ! Quelque chose s'est mal passé.</h1>
          <p className="text-red-700 mb-6 max-w-md">{errorMessage}</p>
          <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-8">
            Recharger l'application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

const BOT_PHOTO_URL = "https://i.ibb.co/5XzrvGnG/photo.jpg";

const THEME_COLORS = [
  { name: "Vert (Défaut)", value: "emerald", bg: "bg-emerald-600", text: "text-emerald-600", hex: "#059669", border: "border-emerald-200", hover: "hover:bg-emerald-700", light: "bg-emerald-50", shadow: "shadow-emerald-200" },
  { name: "Bleu", value: "blue", bg: "bg-blue-600", text: "text-blue-600", hex: "#2563eb", border: "border-blue-200", hover: "hover:bg-blue-700", light: "bg-blue-50", shadow: "shadow-blue-200" },
  { name: "Violet", value: "violet", bg: "bg-violet-600", text: "text-violet-600", hex: "#7c3aed", border: "border-violet-200", hover: "hover:bg-violet-700", light: "bg-violet-50", shadow: "shadow-violet-200" },
  { name: "Orange", value: "orange", bg: "bg-orange-600", text: "text-orange-600", hex: "#ea580c", border: "border-orange-200", hover: "hover:bg-orange-700", light: "bg-orange-50", shadow: "shadow-orange-200" },
  { name: "Rouge", value: "red", bg: "bg-red-600", text: "text-red-600", hex: "#dc2626", border: "border-red-200", hover: "hover:bg-red-700", light: "bg-red-50", shadow: "shadow-red-200" },
  { name: "Personnalisé", value: "custom", bg: "", text: "", hex: "", border: "", hover: "", light: "", shadow: "" },
];

const sanitizeMarkdown = (text: string) => {
  if (!text) return "";
  
  // First, handle the question formatting: ensure a newline after 1), a), etc.
  // This regex looks for lines starting with a number or letter followed by ) or .
  // and then some text on the same line.
  let processedText = text.split('\n').map(line => {
    // Match patterns like "1) Text" or "a) Text" or "1. Text"
    // We exclude cases where it's already followed by a newline or is just the marker
    const questionMatch = line.match(/^(\s*([0-9]+|[a-z])[\).]\s+)(.+)$/i);
    if (questionMatch) {
      return `${questionMatch[1]}\n${questionMatch[3]}`;
    }
    return line;
  }).join('\n');

  // Fix absolute value pipes inside tables
  // This looks for lines that look like table rows and have math blocks with pipes
  return processedText.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.includes('$')) {
      // It's likely a table row or header. We need to escape | inside $...$
      return line.replace(/\$([^$]+)\$/g, (match, math) => {
        // Only escape if it's not already escaped
        return `$${math.replace(/(?<!\\)\|/g, '\\|')}$`;
      });
    }
    return line;
  }).join('\n');
};

// Memoized Message Component for performance
const ChatMessage = memo(({ message, index, onCopy, copiedId, theme, onSettingsClick }: { 
  message: Message, 
  index: number, 
  onCopy: (text: string, id: number) => void,
  copiedId: number | null,
  theme: any,
  onSettingsClick: () => void
}) => {
  const isModel = message.role === "model";
  const messageRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const downloadAsPDF = async () => {
    if (!messageRef.current) return;
    setIsGeneratingPDF(true);

    try {
      const element = messageRef.current;
      
      // Create a temporary container for PDF rendering to ensure high quality and correct width
      const printContainer = document.createElement('div');
      printContainer.id = 'pdf-print-container';
      printContainer.style.position = 'fixed';
      printContainer.style.left = '0';
      printContainer.style.top = '0';
      printContainer.style.zIndex = '-9999';
      printContainer.style.width = '700px'; // Reduced width for better fit
      printContainer.style.backgroundColor = 'white';
      printContainer.style.opacity = '1';
      printContainer.style.visibility = 'visible';
      printContainer.style.padding = '30px';
      printContainer.style.paddingBottom = '50px'; 
      printContainer.style.fontFamily = 'Inter, sans-serif';
      printContainer.style.boxSizing = 'border-box';
      printContainer.style.overflow = 'hidden';
      printContainer.style.wordBreak = 'break-word';
      
      // Add Header to the print container
      const header = document.createElement('div');
      header.innerHTML = `
        <style>
          html, body { 
            font-size: 16px !important; 
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
          }
          *, *:before, *:after {
            box-sizing: border-box !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            font-variant-ligatures: none !important;
          }
          /* Force a standard font for PDF to avoid character width calculation issues, but exclude KaTeX */
          body, p, div, span, h1, h2, h3, h4, li:not(.katex *) {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
            letter-spacing: 0.2px !important;
            word-spacing: 1px !important;
          }
          .katex * {
            font-family: KaTeX_Main, KaTeX_Math, serif !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            display: inline-block !important;
            font-style: normal !important;
          }
          .katex .mord { font-family: KaTeX_Main, serif !important; }
          .katex .mord.mathnormal { font-family: KaTeX_Math, serif !important; }
          .katex .msupsub { font-family: KaTeX_Main, serif !important; }
          .katex-display {
            display: block !important;
            margin: 1em 0 !important;
          }
          /* Aggressive override to prevent oklch parsing errors in html2canvas */
          :root, * {
            --background: #ffffff !important;
            --foreground: #000000 !important;
            --tw-prose-body: #334155 !important;
            --tw-prose-headings: ${theme.hex} !important;
            --tw-prose-links: ${theme.hex} !important;
            --tw-prose-bold: #0f172a !important;
            --tw-prose-counters: #64748b !important;
            --tw-prose-bullets: #cbd5e1 !important;
            --tw-prose-hr: #e2e8f0 !important;
            --tw-prose-quotes: #0f172a !important;
            --tw-prose-quote-borders: #e2e8f0 !important;
            --tw-prose-captions: #64748b !important;
            --tw-prose-code: #0f172a !important;
            --tw-prose-pre-code: #e2e8f0 !important;
            --tw-prose-pre-bg: #0f172a !important;
            --tw-prose-th-borders: #cbd5e1 !important;
            --tw-prose-td-borders: #e2e8f0 !important;
            --primary: ${theme.hex} !important;
            --primary-foreground: #ffffff !important;
            --secondary: #f1f5f9 !important;
            --secondary-foreground: #0f172a !important;
            --muted: #f1f5f9 !important;
            --muted-foreground: #64748b !important;
            --accent: #f1f5f9 !important;
            --accent-foreground: #0f172a !important;
            --destructive: #ef4444 !important;
            --destructive-foreground: #ffffff !important;
            --border: #e2e8f0 !important;
            --input: #e2e8f0 !important;
            --ring: ${theme.hex} !important;
          }
          
          /* Hide KaTeX MathML to prevent double rendering in PDF */
          .katex-mathml { display: none !important; }
          .katex-html { display: inline-block !important; }
          
          .prose { 
            color: #334155 !important; 
            font-size: 14px !important;
            line-height: 1.6 !important;
          }
          .prose h1, .prose h2, .prose h3, .prose h4 { 
            color: ${theme.hex} !important; 
            margin-top: 1.5em !important;
            margin-bottom: 0.5em !important;
          }
          .prose p { 
            margin-bottom: 1em !important; 
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }
          
          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            margin: 20px 0 !important; 
            table-layout: auto !important;
            font-size: 12px !important;
          }
          th, td { 
            border: 1px solid #e2e8f0 !important; 
            padding: 8px !important; 
            text-align: left !important; 
            word-break: break-word !important;
          }
          th { background-color: #f8fafc !important; }
          
          /* Ensure Mermaid diagrams fit horizontally */
          .mermaid svg { max-width: 100% !important; height: auto !important; }
          
          /* Prevent elements from being cut in half across pages */
          .mermaid-container, table, pre, blockquote, .katex-display, h1, h2, h3, .prose p {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          * { 
            color-scheme: light !important;
            -webkit-print-color-adjust: exact !important;
          }
        </style>
        <div style="border-bottom: 2px solid ${theme.hex}; padding-bottom: 10px; margin-bottom: 30px; box-sizing: border-box; width: 100%; overflow: hidden;">
          <h1 style="color: ${theme.hex}; margin: 0; font-size: 18px; font-weight: bold;">Monsieur FABRICEL - Document Pédagogique</h1>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 10px;">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      `;
      printContainer.appendChild(header);

      // Clone the message content
      const contentClone = element.cloneNode(true) as HTMLElement;
      
      // Remove the copy/download buttons from the clone
      const buttons = contentClone.querySelector('.flex.items-center.gap-1.mt-2');
      if (buttons) buttons.remove();
      
      // Ensure the clone is fully visible and not affected by motion animations
      contentClone.style.opacity = '1';
      contentClone.style.transform = 'none';
      contentClone.style.visibility = 'visible';
      contentClone.style.display = 'block';
      
      // Ensure all text is black for printing
      contentClone.style.color = 'black';
      contentClone.style.backgroundColor = 'transparent';
      contentClone.style.border = 'none';
      contentClone.style.boxShadow = 'none';
      contentClone.style.padding = '0';
      contentClone.style.maxWidth = '100%';
      
      printContainer.appendChild(contentClone);
      
      // Aggressively remove modern CSS functions from the printContainer before PDF generation
      // This is a pre-pass before html2canvas cloning
      const modernColorFuncs = ['oklch', 'oklab', 'lab', 'lch', 'hwb', 'color-mix', 'color-contrast', 'light-dark', 'color', 'image-set', 'conic-gradient', 'repeating-conic-gradient', 'clamp'];
      
      const stripCssFunction = (text: string, funcNames: string[]) => {
        const regex = new RegExp(`(?:${funcNames.join('|')})\\s*\\(`, 'gi');
        let match;
        let result = text;
        while ((match = regex.exec(result)) !== null) {
          let start = match.index;
          let count = 1;
          let end = -1;
          for (let i = start + match[0].length; i < result.length; i++) {
            if (result[i] === '(') count++;
            else if (result[i] === ')') count--;
            if (count === 0) {
              end = i;
              break;
            }
          }
          if (end !== -1) {
            const isColorFunc = ['oklch', 'oklab', 'lab', 'lch', 'hwb', 'color-mix', 'color-contrast', 'light-dark', 'color'].some(f => match![0].toLowerCase().includes(f));
            result = result.slice(0, start) + (isColorFunc ? '#000000' : 'inherit') + result.slice(end + 1);
            regex.lastIndex = 0;
          } else {
            // Neutralize the function without truncating the rest of the string
            result = result.slice(0, start) + '/*invalid*/' + result.slice(start + match[0].length);
            regex.lastIndex = start + 11;
          }
        }
        return result;
      };

      const stripCssBlock = (text: string, keyword: string) => {
        const regex = new RegExp(`@${keyword}[^{]*\\{`, 'gi');
        let match;
        let result = text;
        while ((match = regex.exec(result)) !== null) {
          let start = match.index;
          let count = 1;
          let end = -1;
          for (let i = start + match[0].length; i < result.length; i++) {
            if (result[i] === '{') count++;
            else if (result[i] === '}') count--;
            if (count === 0) {
              end = i;
              break;
            }
          }
          if (end !== -1) {
            result = result.slice(0, start) + ' ' + result.slice(end + 1);
            regex.lastIndex = 0;
          } else {
            // Neutralize the block without truncating
            result = result.slice(0, start) + '/*invalid-block*/' + result.slice(start + match[0].length);
            regex.lastIndex = start + 17;
          }
        }
        return result;
      };

      const stripCssRule = (text: string, keyword: string) => {
        const regex = new RegExp(`@${keyword}[^;]*;`, 'gi');
        return text.replace(regex, ' ');
      };

      const stripAllAtBlocks = (text: string) => {
        // Only strip at-rules that are known to be problematic or unnecessary for PDF
        // Keep @media as it's essential for layout
        const regex = /@(supports|container|layer|property|font-palette-values|scope|starting-style)[^{]*\{/gi;
        let match;
        let result = text;
        while ((match = regex.exec(result)) !== null) {
          let start = match.index;
          let count = 1;
          let end = -1;
          for (let i = start + match[0].length; i < result.length; i++) {
            if (result[i] === '{') count++;
            else if (result[i] === '}') count--;
            if (count === 0) {
              end = i;
              break;
            }
          }
          if (end !== -1) {
            result = result.slice(0, start) + ' ' + result.slice(end + 1);
            regex.lastIndex = 0;
          } else {
            result = result.slice(0, start) + '/*invalid-at-block*/' + result.slice(start + match[0].length);
            regex.lastIndex = start + 20;
          }
        }
        return result;
      };

      const balanceCss = (css: string) => {
        let braces = 0;
        let parens = 0;
        for (let i = 0; i < css.length; i++) {
          if (css[i] === '{') braces++;
          else if (css[i] === '}') braces--;
          else if (css[i] === '(') parens++;
          else if (css[i] === ')') parens--;
        }
        let balanced = css;
        while (braces > 0) { balanced += '\n}'; braces--; }
        while (parens > 0) { balanced += ')'; parens--; }
        return balanced;
      };

      // Move append to after conversion to avoid flickering or issues
      printContainer.style.position = 'fixed';
      printContainer.style.zIndex = '-9999';
      printContainer.style.left = '0';
      printContainer.style.top = '0';
      printContainer.style.opacity = '1';
      printContainer.style.pointerEvents = 'none';
      printContainer.style.visibility = 'visible'; 
      document.body.appendChild(printContainer);

      // Small delay to ensure DOM is ready and fonts are loaded
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 300));

      // Wait for all images to be fully loaded
      const images = printContainer.querySelectorAll('img');
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      
      // Also wait for KaTeX/MathJax if present
      await Promise.all(imagePromises);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Extra buffer for math rendering

      // 2.5 Convert all SVGs and SVG-Images to PNGs before PDF generation
      // This is the most robust way to handle SVGs with html2canvas
      const elementsToConvert = [
        ...Array.from(printContainer.querySelectorAll('svg')),
        ...Array.from(printContainer.querySelectorAll('img')).filter(img => img.src && img.src.includes('data:image/svg+xml'))
      ];

      for (const el of elementsToConvert) {
        try {
          let svgData = '';
          let width = 0;
          let height = 0;
          const rect = el.getBoundingClientRect();
          width = rect.width || 500;
          height = rect.height || 400;

          if (el.tagName.toLowerCase() === 'svg') {
            svgData = new XMLSerializer().serializeToString(el);
          } else {
            // It's an <img> with SVG data URI
            const src = (el as HTMLImageElement).src;
            if (src.includes('base64,')) {
              svgData = atob(src.split('base64,')[1]);
            } else {
              const commaIndex = src.indexOf(',');
              if (commaIndex !== -1) {
                svgData = decodeURIComponent(src.substring(commaIndex + 1));
              }
            }
          }
          
          if (!svgData) continue;

          const canvas = document.createElement('canvas');
          canvas.width = width * 2; // Higher resolution
          canvas.height = height * 2;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            const img = new Image();
            
            // Helper to strip CSS functions with matching parentheses (handles nesting)
            const stripCssFunction = (text: string, funcNames: string[]) => {
              const regex = new RegExp(`(?:${funcNames.join('|')})\\s*\\(`, 'gi');
              let match;
              let result = text;
              while ((match = regex.exec(result)) !== null) {
                let start = match.index;
                let count = 1;
                let end = -1;
                for (let i = start + match[0].length; i < result.length; i++) {
                  if (result[i] === '(') count++;
                  else if (result[i] === ')') count--;
                  if (count === 0) {
                    end = i;
                    break;
                  }
                }
                if (end !== -1) {
                  result = result.slice(0, start) + '#000000' + result.slice(end + 1);
                  regex.lastIndex = 0;
                } else {
                  result = result.slice(0, start) + '/*invalid*/' + result.slice(start + match[0].length);
                  regex.lastIndex = start + 11;
                }
              }
              return result;
            };

            // Helper to balance braces and parentheses
            const balanceCss = (css: string) => {
              let braces = 0;
              let parens = 0;
              for (let i = 0; i < css.length; i++) {
                if (css[i] === '{') braces++;
                else if (css[i] === '}') braces--;
                else if (css[i] === '(') parens++;
                else if (css[i] === ')') parens--;
              }
              let balanced = css;
              while (braces > 0) { balanced += '\n}'; braces--; }
              while (parens > 0) { balanced += ')'; parens--; }
              return balanced;
            };

            const modernColorFuncs = ['oklch', 'oklab', 'lab', 'lch', 'hwb', 'color-mix', 'color-contrast', 'light-dark', 'color', 'image-set', 'conic-gradient'];

            // Clean up the SVG data
            let cleanedSvgData = svgData;
            cleanedSvgData = balanceCss(stripCssFunction(cleanedSvgData, modernColorFuncs));
            cleanedSvgData = cleanedSvgData
              .replace(/width\s*=\s*["']([\d.]+)px["']/gi, 'width="$1"')
              .replace(/height\s*=\s*["']([\d.]+)px["']/gi, 'height="$1"')
              .replace(/transition\s*:\s*[^;"]*;?/gi, 'transition: none;')
              .replace(/animation\s*:\s*[^;"]*;?/gi, 'animation: none;')
              .replace(/-webkit-[^;"]*;?/gi, '');
              
            const svgBlob = new Blob([cleanedSvgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            await new Promise((resolve) => {
              img.onload = () => {
                try {
                  ctx.fillStyle = 'white';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const pngUrl = canvas.toDataURL('image/png');
                  const pngImg = document.createElement('img');
                  pngImg.src = pngUrl;
                  pngImg.style.width = `${width}px`;
                  pngImg.style.height = `${height}px`;
                  pngImg.style.display = 'block';
                  pngImg.style.margin = '0 auto';
                  // Copy classes
                  pngImg.className = el.className;
                  el.parentNode?.replaceChild(pngImg, el);
                } catch (err) {
                  console.warn("SVG to PNG conversion failed due to tainted canvas, keeping original", err);
                } finally {
                  URL.revokeObjectURL(url);
                  resolve(null);
                }
              };
              img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
              };
              img.src = url;
            });
          }
        } catch (e) {
          console.error("Failed to convert SVG to PNG", e);
        }
      }

      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      await pdf.html(printContainer, {
        callback: (doc) => {
          const totalPages = (doc as any).internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} sur ${totalPages} - Monsieur FABRICEL`, pdfWidth / 2, pdfHeight - 15, { align: 'center' });
          }
          
          doc.save(`document-fabricel-${Date.now()}.pdf`);
          document.body.removeChild(printContainer);
          setIsGeneratingPDF(false);
        },
        x: 20,
        y: 20,
        width: pdfWidth - 40, 
        windowWidth: 700,
        autoPaging: 'text',
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          logging: false,
          onclone: (clonedDoc) => {
            // Helper to strip all CSS at-rules with matching braces (handles nesting)
            const stripAllAtBlocks = (text: string) => {
              // Only strip at-rules that are known to be problematic or unnecessary for PDF
              // Keep @media as it's essential for layout
              const regex = /@(supports|container|layer|property|font-palette-values|scope|starting-style)[^{]*\{/gi;
              let match;
              let result = text;
              while ((match = regex.exec(result)) !== null) {
                let start = match.index;
                let count = 1;
                let end = -1;
                for (let i = start + match[0].length; i < result.length; i++) {
                  if (result[i] === '{') count++;
                  else if (result[i] === '}') count--;
                  if (count === 0) {
                    end = i;
                    break;
                  }
                }
                if (end !== -1) {
                  result = result.slice(0, start) + ' ' + result.slice(end + 1);
                  regex.lastIndex = 0;
                } else {
                  result = result.slice(0, start) + '/*invalid-at-block*/' + result.slice(start + match[0].length);
                  regex.lastIndex = start + 20;
                }
              }
              return result;
            };

            // Helper to balance braces and parentheses
            const balanceCss = (css: string) => {
              let braces = 0;
              let parens = 0;
              for (let i = 0; i < css.length; i++) {
                if (css[i] === '{') braces++;
                else if (css[i] === '}') braces--;
                else if (css[i] === '(') parens++;
                else if (css[i] === ')') parens--;
              }
              let balanced = css;
              while (braces > 0) { balanced += '\n}'; braces--; }
              while (parens > 0) { balanced += ')'; parens--; }
              return balanced;
            };

            // Helper to strip CSS functions with matching parentheses (handles nesting)
            const stripCssFunction = (text: string, funcNames: string[]) => {
              const regex = new RegExp(`(?:${funcNames.join('|')})\\s*\\(`, 'gi');
              let match;
              let result = text;
              while ((match = regex.exec(result)) !== null) {
                let start = match.index;
                let count = 1;
                let end = -1;
                for (let i = start + match[0].length; i < result.length; i++) {
                  if (result[i] === '(') count++;
                  else if (result[i] === ')') count--;
                  if (count === 0) {
                    end = i;
                    break;
                  }
                }
                if (end !== -1) {
                  const isColorFunc = ['oklch', 'oklab', 'lab', 'lch', 'hwb', 'color-mix', 'color-contrast', 'light-dark', 'color'].some(f => match![0].toLowerCase().includes(f));
                  result = result.slice(0, start) + (isColorFunc ? '#000000' : 'inherit') + result.slice(end + 1);
                  regex.lastIndex = 0;
                } else {
                  result = result.slice(0, start) + '/*invalid*/' + result.slice(start + match[0].length);
                  regex.lastIndex = start + 11;
                }
              }
              return result;
            };

            // Helper to strip CSS rules that end with a semicolon (like @import)
            const stripCssRule = (text: string, keyword: string) => {
              const regex = new RegExp(`@${keyword}[^;]*;`, 'gi');
              return text.replace(regex, ' ');
            };

            const modernColorFuncs = ['oklch', 'oklab', 'lab', 'lch', 'hwb', 'color-mix', 'color-contrast', 'light-dark', 'color', 'image-set', 'conic-gradient', 'repeating-conic-gradient', 'clamp'];

            // 0. Clean up the document structure
            const scripts = Array.from(clonedDoc.getElementsByTagName('script'));
            scripts.forEach(s => s.remove());
            
            const iframes = Array.from(clonedDoc.getElementsByTagName('iframe'));
            iframes.forEach(f => f.remove());

            const metas = Array.from(clonedDoc.getElementsByTagName('meta'));
            metas.forEach(m => m.remove());

            // 0.1 We keep external stylesheets but will try to override problematic variables
            // Removing them causes the layout to break completely
            // We specifically want to ensure KaTeX styles are preserved
            
            // 1. Aggressive removal of modern CSS from all style tags in head and body
            const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
            styleTags.forEach(tag => {
              try {
                let content = tag.textContent || tag.innerHTML;
                
                // Remove comments
                content = content.replace(/\/\*[\s\S]*?\*\//g, '');
                
                // Remove all at-rules with blocks
                content = stripAllAtBlocks(content);

                // Remove problematic single-line at-rules
                ['import', 'charset', 'namespace', 'property'].forEach(kw => {
                  content = stripCssRule(content, kw);
                });
                
                // Remove modern color functions
                content = stripCssFunction(content, modernColorFuncs);
                
                // Remove data URI urls from style tags
                content = content.replace(/url\s*\(['"]?data:[^)]*['"]?\)/gi, 'none');

                // Simplify content properties to prevent parsing issues
                content = content.replace(/content\s*:\s*[^;}]*;/gi, 'content: "";');

                // Fix calc() expressions (ensure spaces around operators for html2canvas)
                content = content.replace(/calc\(([^)]+)\)/gi, (match, p1) => {
                  return `calc(${p1.replace(/([+\-*/])/g, ' $1 ').replace(/\s+/g, ' ')})`;
                });

                // Final safety: remove any remaining @rules that might be malformed
                content = content.replace(/@[a-z-]+\s*[^;{]*;/gi, ' ');
                
                // Balance the CSS to prevent unexpected EOF errors
                tag.textContent = balanceCss(content);
              } catch (e) {}
            });
            
            clonedDoc.documentElement.style.backgroundColor = '#ffffff';
            clonedDoc.documentElement.style.fontSize = '16px';
            clonedDoc.documentElement.style.width = '1024px';
            clonedDoc.documentElement.style.maxWidth = '1024px';
            clonedDoc.documentElement.style.transform = 'none';
            clonedDoc.documentElement.style.transformOrigin = 'top left';
            clonedDoc.body.style.backgroundColor = '#ffffff';
            clonedDoc.body.style.color = '#000000';
            clonedDoc.body.style.fontSize = '16px';
            clonedDoc.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            clonedDoc.body.style.wordSpacing = '1px';
            clonedDoc.body.style.letterSpacing = '0.2px';
            clonedDoc.body.style.fontVariantLigatures = 'none';
            clonedDoc.body.style.lineHeight = '1.5';
            clonedDoc.body.style.overflow = 'visible';
            clonedDoc.body.style.position = 'relative';
            clonedDoc.body.style.left = '0';
            clonedDoc.body.style.top = '0';
            clonedDoc.body.style.transformOrigin = 'top left';
            clonedDoc.body.style.transform = 'scale(1)';
            clonedDoc.body.style.margin = '0';
            clonedDoc.body.style.padding = '0';
            clonedDoc.body.style.visibility = 'visible';
            clonedDoc.body.style.opacity = '1';
            clonedDoc.body.style.display = 'block';
            
            // 2. Aggressive removal of modern CSS and force overflow visible
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach((el: any) => {
              try {
                // Remove prose-invert to ensure text is visible on white background
                if (el.classList && el.classList.contains('prose-invert')) {
                  el.classList.remove('prose-invert');
                }
                
                // Remove modern CSS from inline styles
                if (el.style && el.style.cssText && el.style.cssText.match(/oklch|oklab|lab|lch|hwb|color-mix|color-contrast|light-dark|color/i)) {
                  try {
                    el.style.cssText = stripCssFunction(el.style.cssText, modernColorFuncs);
                  } catch (e) {
                    // If cssText assignment fails, try to remove the style attribute entirely
                    el.removeAttribute('style');
                  }
                }
                
                // Remove data URI urls from inline styles as they often cause parsing errors
                if (el.style && el.style.cssText && el.style.cssText.includes('data:')) {
                  el.style.cssText = el.style.cssText.replace(/url\s*\(['"]?data:[^)]*['"]?\)/gi, 'none');
                }

                // Force overflow visible to prevent clipping in html2canvas
                if (el.style) {
                  el.style.overflow = 'visible';
                  el.style.overflowX = 'visible';
                  el.style.overflowY = 'visible';
                  
                  // Fix calc() in inline styles
                  if (el.style.cssText && el.style.cssText.includes('calc(')) {
                    try {
                      el.style.cssText = el.style.cssText.replace(/calc\(([^)]+)\)/gi, (match, p1) => {
                        return `calc(${p1.replace(/([+\-*/])/g, ' $1 ').replace(/\s+/g, ' ')})`;
                      });
                    } catch (e) {}
                  }

                  // Balance inline styles
                  if (el.style.cssText) {
                    try {
                      el.style.cssText = balanceCss(el.style.cssText);
                    } catch (e) {}
                  }
                }
                
                // Remove empty style attributes
                if (el.getAttribute('style') === '') {
                  el.removeAttribute('style');
                }
              } catch (e) {}
            });

            // 2.4 Convert SVG data URIs in <img> tags to actual <svg> elements
            // html2canvas has trouble loading SVG data URIs
            const images = clonedDoc.querySelectorAll('img');
            images.forEach(img => {
              try {
                const src = img.src || '';
                if (src.includes('data:image/svg+xml')) {
                  let svgData = '';
                  const isBase64 = src.includes('base64');
                  
                  try {
                    if (isBase64) {
                      svgData = atob(src.split('base64,')[1]);
                    } else {
                      const commaIndex = src.indexOf(',');
                      if (commaIndex !== -1) {
                        svgData = decodeURIComponent(src.substring(commaIndex + 1));
                      }
                    }
                  } catch (e) {}
                  
                  if (svgData) {
                    // Aggressively clean up the SVG string
                    const cleanedSvg = svgData
                      .replace(/width\s*=\s*["']([\d.]+)px["']/gi, 'width="$1"')
                      .replace(/height\s*=\s*["']([\d.]+)px["']/gi, 'height="$1"')
                      .replace(/transition\s*:\s*[^;"]*;?/gi, 'transition: none;')
                      .replace(/animation\s*:\s*[^;"]*;?/gi, 'animation: none;')
                      .replace(/-webkit-user-select:[^;"]*;?/gi, '')
                      .replace(/-webkit-writing-mode:[^;"]*;?/gi, '');
                    
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(cleanedSvg, 'image/svg+xml');
                    const svgElement = svgDoc.querySelector('svg');
                    
                    if (svgElement && !svgDoc.querySelector('parsererror')) {
                      const imgClass = img.getAttribute('class');
                      const imgStyle = img.getAttribute('style');
                      if (imgClass) svgElement.setAttribute('class', imgClass);
                      if (imgStyle) svgElement.setAttribute('style', imgStyle);
                      
                      if (!svgElement.getAttribute('viewBox') && svgElement.getAttribute('width') && svgElement.getAttribute('height')) {
                        const w = svgElement.getAttribute('width').replace('px', '');
                        const h = svgElement.getAttribute('height').replace('px', '');
                        svgElement.setAttribute('viewBox', `0 0 ${w} ${h}`);
                      }

                      if (img.parentNode) {
                        img.parentNode.replaceChild(svgElement, img);
                      }
                    }
                  }
                }
              } catch (e) {}
            });

            // 2.4.5 Clean up background images that might contain SVGs
            const allWithStyle = clonedDoc.querySelectorAll('[style*="data:image/svg+xml"]');
            allWithStyle.forEach((el: any) => {
              try {
                let style = el.getAttribute('style') || '';
                if (style.includes('data:image/svg+xml')) {
                  // Remove px units from width/height in data URIs (both encoded and raw)
                  style = style.replace(/width(%3D|%3d)%22([\d.]+)px%22/gi, 'width$1%22$2%22');
                  style = style.replace(/height(%3D|%3d)%22([\d.]+)px%22/gi, 'height$1%22$2%22');
                  style = style.replace(/width\s*=\s*["']([\d.]+)px["']/gi, 'width="$1"');
                  style = style.replace(/height\s*=\s*["']([\d.]+)px["']/gi, 'height="$1"');
                  el.setAttribute('style', style);
                }
              } catch (e) {}
            });

            // 2.5 Clean up SVGs for html2canvas
            const svgs = clonedDoc.querySelectorAll('svg');
            svgs.forEach(svg => {
              try {
                // Ensure width/height are numeric
                ['width', 'height'].forEach(attr => {
                  const val = svg.getAttribute(attr);
                  if (val && val.includes('px')) {
                    svg.setAttribute(attr, val.replace('px', ''));
                  }
                  if (svg.style[attr as any] && svg.style[attr as any].includes('px')) {
                    (svg.style as any)[attr] = svg.style[attr as any].replace('px', '');
                  }
                });

                svg.style.transition = 'none';
                svg.style.animation = 'none';
                
                if (!svg.getAttribute('xmlns')) {
                  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                }
              } catch (e) {}
            });

            // 3. Final safety pass for modern CSS and px units in attributes
            try {
              // Clean head style tags again if needed, but avoid innerHTML on body
              const finalStyles = Array.from(clonedDoc.getElementsByTagName('style'));
              finalStyles.forEach(tag => {
                let content = tag.textContent || '';
                if (content.match(/oklch|oklab|lab|lch|hwb|color-mix|color-contrast|light-dark|color/i)) {
                  tag.textContent = balanceCss(stripCssFunction(content, modernColorFuncs));
                }
              });
            } catch (e) {}

            // 4. Ensure the print container itself is clean and visible
            let container = clonedDoc.getElementById('pdf-print-container');
            if (!container) {
              // Fallback if the element itself was cloned as the root or if ID is lost
              container = clonedDoc.querySelector('[id="pdf-print-container"]') || clonedDoc.body.firstElementChild as HTMLElement;
            }
            
            if (container) {
              container.style.position = 'relative';
              container.style.left = '0';
              container.style.top = '0';
              container.style.width = '1024px';
              container.style.minWidth = '1024px';
              container.style.maxWidth = '1024px';
              container.style.padding = '40px';
              container.style.color = 'black';
              container.style.backgroundColor = 'white';
              container.style.backgroundImage = 'none';
              container.style.filter = 'none';
              container.style.opacity = '1';
              container.style.visibility = 'visible';
              container.style.overflow = 'visible';
              container.style.display = 'block';
              container.style.transform = 'none';
              container.style.height = 'auto';
            }

            // 5. Final cleanup of empty styles
            const finalStyles = Array.from(clonedDoc.getElementsByTagName('style'));
            finalStyles.forEach(tag => {
              if (!tag.textContent?.trim()) {
                tag.remove();
              }
            });
          }
        }
      });
    } catch (error) {
      console.error("PDF Generation Error:", error);
      setIsGeneratingPDF(false);
    }
  };
  
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "flex gap-4 mb-8",
        !isModel ? "flex-row-reverse" : "flex-row"
      )}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 100px' } as any}
    >
      <Avatar className={cn(
        "h-9 w-9 shrink-0 mt-1 shadow-sm",
        isModel ? theme.bg : "bg-slate-200"
      )} style={isModel ? theme.bgStyle : {}}>
        {isModel ? (
          <AvatarImage src={BOT_PHOTO_URL} className="object-cover" />
        ) : null}
        {isModel ? (
          <AvatarFallback className={cn(theme.bg, "text-white")} style={theme.bgStyle}>
            <Bot className="w-5 h-5" />
          </AvatarFallback>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-slate-600">
            <UserIcon className="w-5 h-5" />
          </div>
        )}
      </Avatar>
      <div className={cn(
        "flex flex-col max-w-[85%] group",
        !isModel ? "items-end" : "items-start"
      )}>
        <div 
          ref={messageRef}
          className={cn(
            "px-5 py-3 rounded-2xl shadow-sm relative w-full overflow-hidden",
            !isModel 
              ? cn(theme.bg, "text-white rounded-tr-none") 
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
          )} style={!isModel ? theme.bgStyle : {}}>
          <div className={cn(
            "prose prose-sm max-w-none break-words overflow-x-auto prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-4 prose-th:py-3 prose-td:border prose-td:border-slate-200 prose-td:px-4 prose-td:py-4 prose-td:align-middle",
            !isModel ? "text-white prose-invert" : "text-slate-800",
            // Pedagogical highlighting
            isModel && "prose-headings:text-[var(--theme-color)] prose-strong:text-[var(--theme-color)]"
          )} style={{ "--theme-color": isModel ? theme.hex : 'inherit' } as any}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                h1: ({ children }) => <h1 className={cn("font-bold text-xl mb-4", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{children}</h1>,
                h2: ({ children }) => <h2 className={cn("font-bold text-lg mb-3", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{children}</h2>,
                h3: ({ children }) => <h3 className={cn("font-bold text-md mb-2", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{children}</h3>,
                h4: ({ children }) => <h4 className={cn("font-bold text-sm mb-1", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{children}</h4>,
                strong: ({ children }) => <strong className={cn("font-bold", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{children}</strong>,
                a: ({ node, children, href, ...props }: any) => {
                  if (href === "#settings") {
                    return (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          onSettingsClick();
                        }}
                        className={cn("font-bold underline decoration-2 underline-offset-4", isModel ? theme.text : "")}
                        style={isModel ? theme.textStyle : {}}
                      >
                        {children}
                      </button>
                    );
                  }
                  return <a href={href} target="_blank" rel="noopener noreferrer" className="underline" {...props}>{children}</a>;
                },
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const language = match ? match[1] : "";
                  
                  if (!inline && language === "mermaid") {
                    return <Mermaid chart={String(children).replace(/\n$/, "")} />;
                  }
                  
                  if (!inline && language === "svg") {
                    return <ZoomableSVG svgCode={String(children)} />;
                  }
                  
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {sanitizeMarkdown(message.text)}
            </ReactMarkdown>
          </div>

          {/* Message Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={cn(
              "flex flex-wrap gap-2 mt-3",
              !isModel ? "justify-end" : "justify-start"
            )}>
              {message.attachments.map((att, i) => (
                <div key={i} className="max-w-[200px] rounded-xl overflow-hidden border border-slate-200/50 bg-white/10 backdrop-blur-sm">
                  {att.mimeType.startsWith('image/') ? (
                    <div className="relative group/img">
                      <img 
                        src={`data:${att.mimeType};base64,${att.data}`} 
                        alt="attachment" 
                        className="w-full h-auto max-h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-white hover:bg-white/20"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = `data:${att.mimeType};base64,${att.data}`;
                            link.download = `image.${att.mimeType.split('/')[1]}`;
                            link.click();
                          }}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-white hover:bg-white/20"
                          onClick={() => {
                            const newWindow = window.open();
                            if (newWindow) {
                              newWindow.document.write(`<img src="data:${att.mimeType};base64,${att.data}" style="max-width:100%">`);
                            }
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        {att.mimeType === 'application/pdf' ? (
                          <FileText className="w-5 h-5 text-red-400" />
                        ) : (
                          <FileIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase opacity-60">
                          {att.mimeType.split('/')[1]}
                        </p>
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = `data:${att.mimeType};base64,${att.data}`;
                            link.download = `document.${att.mimeType.split('/')[1]}`;
                            link.click();
                          }}
                          className="text-[10px] hover:underline truncate block"
                        >
                          Voir le document
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {isModel && message.text && (
            <div className="flex items-center gap-1 mt-2">
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-7 gap-1.5 text-[10px] font-medium", theme.text)}
                style={theme.textStyle}
                onClick={() => onCopy(message.text, index)}
              >
                {copiedId === index ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === index ? "Copié" : "Copier"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-[10px] font-medium text-slate-500 hover:text-emerald-600"
                onClick={downloadAsPDF}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {isGeneratingPDF ? "Génération..." : "Télécharger PDF"}
              </Button>
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-400 mt-1 px-1">
          {isModel ? "Monsieur FABRICEL" : "Vous"}
        </span>
      </div>
    </motion.div>
  );
});

ChatMessage.displayName = "ChatMessage";

const QUICK_ACTIONS = [
  { 
    id: "lesson-plan", 
    label: "Générer un plan de leçon", 
    icon: BookOpen, 
    prompt: "Génère un plan de leçon structuré pour une classe de 3ème en Mathématiques sur le théorème de Thalès, en suivant le programme officiel du MEN Madagascar." 
  },
  { 
    id: "exercises", 
    label: "Générer des exercices", 
    icon: FileText, 
    prompt: "Crée 3 exercices de niveaux de difficulté variés pour une classe de 4ème en Physique-Chimie sur la masse volumique, avec les solutions détaillées selon les normes du MEN." 
  },
  { 
    id: "bepc", 
    label: "Préparer l'examen BEPC", 
    icon: GraduationCap, 
    prompt: "Génère un sujet type BEPC pour l'épreuve de SVT, avec le barème de notation officiel du MEN Madagascar." 
  },
  { 
    id: "management", 
    label: "Conseils de gestion de classe", 
    icon: Users, 
    prompt: "Quels sont vos conseils pour gérer une classe de 50 élèves avec peu de matériel pédagogique dans un collège rural à Madagascar ?" 
  },
  { 
    id: "diagram", 
    label: "Créer un schéma/diagramme", 
    icon: Lightbulb, 
    prompt: "Crée un schéma (Mermaid) expliquant le cycle de l'eau pour une classe de 6ème, avec des explications simples en français et malgache." 
  },
  { 
    id: "strategy", 
    label: "Stratégie d'enseignement", 
    icon: Lightbulb, 
    prompt: "Expliquez comment appliquer l'Approche Par Compétences (APC) pour enseigner l'Anglais en classe de 6ème." 
  },
  { 
    id: "ethics", 
    label: "Éthique professionnelle", 
    icon: ShieldCheck, 
    prompt: "Quelles sont les règles d'éthique professionnelle qu'un enseignant doit respecter dans ses relations avec les parents d'élèves à Madagascar ?" 
  },
];

const AuthView = ({ onGoogleLogin, theme }: { onGoogleLogin: () => void, theme: any }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Email ou mot de passe incorrect.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Cet email est déjà utilisé.");
      } else if (err.code === 'auth/weak-password') {
        setError("Le mot de passe est trop court (min. 6 caractères).");
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
      >
        <div className="flex flex-col items-center mb-8">
          <div className={cn(theme.bg, "p-4 rounded-2xl shadow-lg mb-4")} style={theme.bgStyle}>
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Monsieur FABRICEL</h1>
          <p className="text-slate-500 text-center mt-2">
            Assistant pédagogique intelligent pour les enseignants à Madagascar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nom complet</label>
              <Input 
                placeholder="Votre nom" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                className="rounded-xl"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">E-mail</label>
            <Input 
              type="email" 
              placeholder="votre@email.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Mot de passe</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="rounded-xl"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading}
            className={cn("w-full py-6 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all", theme.bg, theme.hover)}
            style={theme.bgStyle}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Se connecter" : "S'inscrire")}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-slate-400 font-medium">OU</span>
          <Separator className="flex-1" />
        </div>

        <Button 
          variant="outline" 
          onClick={onGoogleLogin}
          className="w-full mt-6 py-6 rounded-xl border-slate-200 flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          <span className="text-slate-700 font-medium">Continuer avec Google</span>
        </Button>

        <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <div className="flex gap-2 items-start">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-blue-700 uppercase">Problème de connexion ?</p>
              <p className="text-[10px] text-blue-600 leading-relaxed text-left">
                Si l'erreur "missing initial state" apparaît, assurez-vous de ne pas être en mode "Navigation privée" et d'autoriser les cookies tiers dans votre navigateur.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className={cn("text-sm font-medium hover:underline mb-6", theme.text)}
            style={theme.textStyle}
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>

          <div className="pt-6 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">CONSEIL D'EXPERT</p>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              "Pour utiliser Monsieur FABRICEL comme une <span className="text-slate-900 font-bold">vraie application</span> (sans la barre d'adresse), 
              connectez-vous puis cliquez sur le bouton <span className="font-bold underline text-emerald-600">Installer</span> dans le menu."
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AdminPanel = ({ isOpen, onClose, theme }: { isOpen: boolean, onClose: () => void, theme: any }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: any[] = [];
      snapshot.forEach((doc) => {
        userList.push({ id: doc.id, ...doc.data() });
      });
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const updateCredits = async (userId: string, currentCredits: number, amount: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        credits: Math.max(0, currentCredits + amount)
      });
    } catch (error) {
      console.error("Error updating credits:", error);
    }
  };

  const toggleSuspension = async (userId: string, isSuspended: boolean) => {
    try {
      if (!confirm(`Voulez-vous ${isSuspended ? "rétablir" : "suspendre"} cet utilisateur ?`)) return;
      await updateDoc(doc(db, 'users', userId), {
        status: isSuspended ? 'active' : 'suspended',
        suspendedAt: isSuspended ? null : serverTimestamp()
      });
    } catch (error) {
      console.error("Error toggling suspension:", error);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      if (!confirm("ATTENTION : Cette action est irréversible. Voulez-vous vraiment supprimer cet utilisateur et toutes ses données ?")) return;
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Users className={cn("w-6 h-6", theme.text)} style={theme.textStyle} />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Gestion des Utilisateurs</h2>
              <p className="text-xs text-slate-500">{filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''} trouvé{filteredUsers.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </Button>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-100 sticky top-[81px] z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Rechercher par nom ou email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl bg-white border-slate-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className={cn("w-8 h-8 animate-spin", theme.text)} style={theme.textStyle} />
                <p className="text-sm text-slate-500">Chargement des utilisateurs...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Aucun utilisateur trouvé.
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 border border-slate-100 shrink-0">
                      <AvatarImage src={u.photoURL} />
                      <AvatarFallback className="bg-slate-100 text-slate-600">
                        {(u.displayName || u.email || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">{u.displayName || "Utilisateur sans nom"}</p>
                        {u.status === 'suspended' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5" /> Suspendu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 break-all select-all">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                    {u.role !== 'admin' && (
                      <div className="flex items-center gap-1.5">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className={cn("h-8 w-8 rounded-xl", u.status === 'suspended' ? "text-emerald-600 bg-emerald-50" : "text-amber-500 hover:text-amber-600 hover:bg-amber-50")}
                          onClick={() => toggleSuspension(u.id, u.status === 'suspended')}
                          title={u.status === 'suspended' ? "Rétablir" : "Suspendre"}
                        >
                          {u.status === 'suspended' ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                          onClick={() => deleteUser(u.id)}
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Crédits</p>
                      <p className={cn("text-sm font-mono font-bold", theme.text)} style={theme.textStyle}>
                        {u.role === 'admin' ? "∞" : (u.credits || 0)}
                      </p>
                    </div>
                    {u.role !== 'admin' && (
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex items-center gap-1">
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-7 w-7 rounded-lg border-slate-200 text-[10px]"
                            onClick={() => updateCredits(u.id, u.credits || 0, -10)}
                            disabled={ (u.credits || 0) < 10 }
                          >
                            -10
                          </Button>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-7 w-7 rounded-lg border-slate-200 text-[10px]"
                            onClick={() => updateCredits(u.id, u.credits || 0, -1)}
                            disabled={ (u.credits || 0) < 1 }
                          >
                            -1
                          </Button>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-7 w-7 rounded-lg border-slate-200 text-[10px]"
                            onClick={() => updateCredits(u.id, u.credits || 0, 1)}
                          >
                            +1
                          </Button>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-7 w-7 rounded-lg border-slate-200 text-[10px]"
                            onClick={() => updateCredits(u.id, u.credits || 0, 10)}
                          >
                            +10
                          </Button>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-7 w-7 rounded-lg border-slate-200 text-[10px]"
                            onClick={() => updateCredits(u.id, u.credits || 0, 20)}
                          >
                            +20
                          </Button>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-7 w-7 rounded-lg border-slate-200 text-[10px]"
                            onClick={() => updateCredits(u.id, u.credits || 0, 50)}
                          >
                            +50
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            placeholder="Qté" 
                            className="h-7 w-16 text-[10px] px-1.5 rounded-lg border-slate-200"
                            value={customAmounts[u.id] || ''}
                            onChange={(e) => setCustomAmounts(prev => ({ ...prev, [u.id]: e.target.value }))}
                          />
                          <Button 
                            size="sm" 
                            className={cn("h-7 px-2 text-[10px] rounded-lg text-white", theme.bg)}
                            style={theme.bgStyle}
                            onClick={() => {
                              const amount = parseInt(customAmounts[u.id] || "0");
                              if (amount !== 0) {
                                updateCredits(u.id, u.credits || 0, amount);
                                setCustomAmounts(prev => ({ ...prev, [u.id]: '' }));
                              }
                            }}
                          >
                            Appliquer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <Button onClick={onClose} className={cn("rounded-xl px-8 text-white", theme.bg, theme.hover)} style={theme.bgStyle}>
            Fermer
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "model", 
      text: "Salama! Je suis Monsieur FABRICEL, enseignant de mathématiques et expert en Sciences de l'éducation. Comment puis-je vous accompagner dans vos pratiques pédagogiques aujourd'hui ?" 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState(THEME_COLORS[0]);
  const [customHex, setCustomHex] = useState("#059669");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  const [referralRewards, setReferralRewards] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referral_rewards'), where('toUserId', '==', user.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setReferralRewards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  const claimReward = async (reward: any) => {
    if (!user || !userProfile) return;
    try {
      // 1. Mark as claimed
      await updateDoc(doc(db, 'referral_rewards', reward.id), {
        status: 'claimed',
        claimedAt: serverTimestamp()
      });
      // 2. Add credits (+2)
      await updateDoc(doc(db, 'users', user.uid), {
        credits: (userProfile.credits || 0) + 2
      });
    } catch (e) {
      console.error("Error claiming reward:", e);
    }
  };
  const [isShared, setIsShared] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installStatus, setInstallStatus] = useState<'waiting' | 'ready' | 'downloading' | 'installed'>('waiting');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleBeforeInstallPrompt = useCallback((e: any) => {
    e.preventDefault();
    setDeferredPrompt(e);
    setIsInstallable(true);
    setInstallStatus('ready');
  }, []);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  const userHasScrolledUpRef = useRef(false);

  // Load theme from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedApiKey) {
      setTempApiKey(savedApiKey);
      // We don't need to set process.env here as the service will read from localStorage
    }

    const savedTheme = localStorage.getItem('fabricel-theme');
    const savedCustomHex = localStorage.getItem('fabricel-custom-hex');
    
    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsInstalling(false);
      setInstallStatus('installed');
      console.log('App was installed');
    });

    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      setIsInstallable(false);
      setInstallStatus('installed');
    }

    if (savedCustomHex) {
      setCustomHex(savedCustomHex);
    }

    if (savedTheme) {
      if (savedTheme === 'custom') {
        setCurrentTheme(THEME_COLORS[THEME_COLORS.length - 1]);
      } else {
        const theme = THEME_COLORS.find(t => t.value === savedTheme);
        if (theme) setCurrentTheme(theme);
      }
    }
  }, []);

  const changeTheme = (theme: typeof THEME_COLORS[0], hex?: string) => {
    setCurrentTheme(theme);
    localStorage.setItem('fabricel-theme', theme.value);
    if (theme.value === 'custom' && hex) {
      setCustomHex(hex);
      localStorage.setItem('fabricel-custom-hex', hex);
    }
    if (theme.value !== 'custom') {
      setIsPaletteOpen(false);
    }
  };

  const getThemeStyles = (theme: typeof THEME_COLORS[0]) => {
    const isCustom = theme.value === 'custom';
    const hex = isCustom ? customHex : theme.hex;
    return {
      bg: isCustom ? "" : theme.bg,
      text: isCustom ? "" : theme.text,
      border: isCustom ? "" : theme.border,
      hover: isCustom ? "" : theme.hover,
      light: isCustom ? "" : theme.light,
      shadow: isCustom ? "" : theme.shadow,
      hex,
      isCustom,
      bgStyle: isCustom ? { backgroundColor: hex } : {},
      textStyle: isCustom ? { color: hex } : {},
      borderStyle: isCustom ? { borderColor: hex } : {},
      lightStyle: isCustom ? { backgroundColor: `${hex}15` } : {},
      borderLightStyle: isCustom ? { borderColor: `${hex}33` } : {},
    };
  };

  const saveSettings = () => {
    if (tempApiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', tempApiKey.trim());
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
    setIsSettingsOpen(false);
    // Reload to apply key changes to the service
    window.location.reload();
  };

  const themeStyles = getThemeStyles(currentTheme);

  // Update CSS variable for theme color
  useEffect(() => {
    const hex = currentTheme.value === 'custom' ? customHex : currentTheme.hex;
    document.documentElement.style.setProperty('--theme-color', hex);
    
    // Generate variants using color-mix if supported, or just use the hex
    // We'll use the hex for the main color and CSS variables for others
    document.documentElement.style.setProperty('--theme-color-light', `${hex}15`); // ~8% opacity
    document.documentElement.style.setProperty('--theme-color-border', `${hex}33`); // ~20% opacity
  }, [currentTheme, customHex]);

  // Auth Listener
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    // Safety fallback: if auth takes too long, stop loading
    const safetyTimeout = setTimeout(() => {
      setIsAuthLoading(prev => {
        if (prev) {
          console.warn("Auth loading timed out, forcing false");
          return false;
        }
        return prev;
      });
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimeout);
      setUser(firebaseUser);
      setIsAuthLoading(false);
      
      if (firebaseUser) {
        setIsProfileLoading(true);
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial fetch
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const isAdmin = firebaseUser.email === "fabricel534@gmail.com";
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref');
            
            // Generate a simple unique-ish code for the user
            const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Give 2 extra credits if referred
            const bonus = refCode ? 2 : 0;

            const initialData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: isAdmin ? 'admin' : 'user',
              credits: isAdmin ? 999999 : (10 + bonus),
              referralCode: myRefCode,
              referredBy: refCode || null,
              hasClaimedReferral: refCode ? true : false,
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, initialData);
            
            // If referred, we should also notify/reward the referrer
            if (refCode) {
              try {
                // Find referrer and create a reward record for them
                const q = query(collection(db, 'users'), where('referralCode', '==', refCode));
                const snap = await getDocs(q);
                if (!snap.empty) {
                  const referrerId = snap.docs[0].id;
                  await addDoc(collection(db, 'referral_rewards'), {
                    toUserId: referrerId,
                    fromUserEmail: firebaseUser.email,
                    status: 'pending',
                    amount: 2,
                    createdAt: serverTimestamp()
                  });
                }
              } catch (e) {
                console.error("Referral reward error:", e);
              }
            }
            setUserProfile(initialData);
          } else {
            setUserProfile(userSnap.data());
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
        setIsProfileLoading(false);

        // Real-time listener
        unsubProfile = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setUserProfile(data);
            
            // Migration: Add referral code if missing
            if (!data.referralCode) {
              const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              updateDoc(userRef, { referralCode: myRefCode });
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });
      } else {
        setUserProfile(null);
        setIsProfileLoading(false);
        if (unsubProfile) unsubProfile();
        setChats([]);
        setCurrentChatId(null);
        setMessages([{ role: "model", text: "Salama! Je suis Monsieur FABRICEL, enseignant de mathématiques et expert en Sciences de l'éducation. Connectez-vous pour sauvegarder vos discussions." }]);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Fetch Chats
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: ChatSession[] = [];
      snapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() } as ChatSession);
      });
      // Sort client-side by createdAt desc
      chatList.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setChats(chatList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch Messages for current chat
  useEffect(() => {
    if (!user || !currentChatId) return;

    const q = query(
      collection(db, 'chats', currentChatId, 'messages')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList: Message[] = [];
      snapshot.forEach((doc) => {
        msgList.push(doc.data() as Message);
      });
      // Sort client-side by createdAt asc
      msgList.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis?.() || 0;
        const timeB = (b as any).createdAt?.toMillis?.() || 0;
        return timeA - timeB;
      });
      if (msgList.length > 0) {
        setMessages(msgList);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${currentChatId}/messages`);
    });

    return () => unsubscribe();
  }, [user, currentChatId]);

  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("La fenêtre de connexion a été fermée. Veuillez réessayer.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError("Ce domaine n'est pas autorisé. Veuillez vérifier la configuration Firebase.");
      } else if (error.message?.includes('missing initial state')) {
        setAuthError("Erreur d'état : Désactivez le mode navigation privée ou autorisez les cookies tiers.");
      } else {
        setAuthError("Échec de la connexion. Vérifiez votre navigateur ou désactivez les bloqueurs de pub.");
      }
    }
  };

  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => setAuthError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [authError]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleShare = async () => {
    const currentUrl = window.location.origin;
    const isDev = currentUrl.includes('ais-dev');
    
    // Use the shared URL if we are in dev, otherwise use current origin
    const publicUrl = isDev 
      ? "https://ais-pre-r46ukjinvbfrup2cqv4z3p-560404174701.europe-west2.run.app" 
      : currentUrl;

    const shareData = {
      title: "Monsieur FABRICEL",
      text: "Monsieur FABRICEL - Assistant pédagogique intelligent pour les enseignants à Madagascar.",
      url: publicUrl,
    };

    const copyToClipboardFallback = async () => {
      try {
        await navigator.clipboard.writeText(publicUrl);
        setIsShared(true);
        setTimeout(() => setIsShared(false), 2000);
        return true;
      } catch (err) {
        // Last resort: try execCommand('copy') with a hidden input
        try {
          const textArea = document.createElement("textarea");
          textArea.value = publicUrl;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) {
            setIsShared(true);
            setTimeout(() => setIsShared(false), 2000);
            return true;
          }
        } catch (execErr) {
          console.error("Fallback copy failed:", execErr);
        }
        return false;
      }
    };

    try {
      // Check if sharing is supported and data is shareable
      if (navigator.share && (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        await copyToClipboardFallback();
      }
    } catch (err: any) {
      // AbortError means user cancelled, which is fine
      if (err.name !== 'AbortError') {
        console.error("Error sharing:", err);
        await copyToClipboardFallback();
      }
    }
  };

  const scrollToBottom = useCallback((force = false) => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const now = Date.now();
        const behavior = force ? "smooth" : (isStreamingRef.current ? "auto" : "smooth");
        
        if (force || (!userHasScrolledUpRef.current && (now - lastScrollTimeRef.current > 100))) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior
          });
          lastScrollTimeRef.current = now;
        }
      }
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        
        userHasScrolledUpRef.current = !isAtBottom;
        setShowScrollButton(!isAtBottom);
      }
    }
  }, []);

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const handleStop = () => {
    isStreamingRef.current = false;
    setIsLoading(false);
  };

  const saveMessage = async (chatId: string, role: string, text: string, attachments?: { mimeType: string; data: string }[]) => {
    if (!user) return;
    const path = `chats/${chatId}/messages`;
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role,
        text,
        attachments: attachments || null,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleInstallClick = async () => {
    // Check if we are in an iframe (AI Studio preview)
    const isInIframe = window.self !== window.top;
    
    if (isInIframe) {
      window.open(window.location.href, '_blank');
      return;
    }

    // simulated download to satisfy user expectation
    setInstallStatus('downloading');
    setDownloadProgress(0);
    
    // Animate progress (simulated download)
    for (let i = 0; i <= 100; i += 5) {
      setDownloadProgress(i);
      await new Promise(r => setTimeout(r, 60)); // Fast but visible
    }

    if (deferredPrompt) {
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setIsInstalling(false);
      setInstallStatus(outcome === 'accepted' ? 'installed' : 'ready');
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } else {
      setInstallStatus('ready');
      setIsInstallModalOpen(true);
    }
  };

  const handleSend = async (text: string, attachments?: { mimeType: string; data: string }[]) => {
    if (!text.trim() && !attachments?.length) return;
    if (isLoading) return;

    const userMessage: Message = { role: "user", text, attachments };
    
    // Check credits if not admin
    const isAdmin = user?.email === "fabricel534@gmail.com" || userProfile?.role === 'admin';
    const hasCredits = (userProfile?.credits || 0) > 0;

    if (user && !isAdmin && !hasCredits && !isProfileLoading) {
      const rechargeMessage = `⚠️ **Crédits insuffisants**

Pour continuer à recevoir l'aide de Monsieur FABRICEL, vous devez recharger votre compte.
**Tarif : 1 crédit = 200 Ar** (1 crédit permet d'obtenir 1 réponse).

**Options de recharge :**
*   **Mvola** : Envoyez votre paiement au **0380770973** (au nom de **FABRICEL**). 
    *👉 Indiquez impérativement votre email (**${user?.email}**) dans la description du transfert.*
*   **WhatsApp** : [Cliquez ici pour m'écrire](https://wa.me/261328922904) ou contactez le **+261 32 89 229 04**.
*   **Téléphone** : Appelez le **0380770973**.

Votre compte sera crédité dès réception de la confirmation.`;
      
      setMessages(prev => [...prev, { role: "model", text: rechargeMessage }]);
      return;
    }

    // If not logged in, we shouldn't even be here, but safety check
    if (!user) return;

    // Logged in flow
    let chatId = currentChatId;
    if (!chatId) {
      try {
        const chatDoc = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          title: text.substring(0, 40) + (text.length > 40 ? "..." : ""),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        chatId = chatDoc.id;
        setCurrentChatId(chatId);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'chats');
      }
    }

    if (chatId) {
      await saveMessage(chatId, "user", text, attachments);
      
      // Deduct credit if not admin
      if (!isAdmin) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            credits: (userProfile?.credits || 0) - 1
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
    }

    setIsLoading(true);
    setStreamingText("");
    isStreamingRef.current = true;

    try {
      const stream = chatWithGeminiStream([...messages, userMessage]);
      let fullText = "";
      let lastUpdate = Date.now();
      
      for await (const chunk of stream) {
        if (!isStreamingRef.current) break;
        fullText += chunk;
        const now = Date.now();
        if (now - lastUpdate > 64) {
          setStreamingText(fullText);
          lastUpdate = now;
        }
      }
      
      if (isStreamingRef.current) {
        await saveMessage(chatId, "model", fullText);
      }
      setStreamingText("");
    } catch (error: any) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "⚠️ Une erreur est survenue lors de l'envoi du message.";
      setMessages(prev => [...prev, { role: "model", text: errorMessage }]);
    } finally {
      setIsLoading(false);
      isStreamingRef.current = false;
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const copyToClipboard = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(index);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // Fallback for clipboard failure (e.g. focus issues in iframe)
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopiedId(index);
          setTimeout(() => setCopiedId(null), 2000);
        }
      } catch (execErr) {
        console.error("Copy fallback failed:", execErr);
      }
    }
  }, []);

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([
      { 
        role: "model", 
        text: "Salama! Nouvelle session démarrée. Comment puis-je vous aider ?" 
      }
    ]);
    setStreamingText("");
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const selectChat = (id: string) => {
    setCurrentChatId(id);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: "model", text: "Discussion réinitialisée. Comment puis-je vous aider ?" }]);
    setStreamingText("");
  };

  if (isAuthLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <Loader2 className={cn("w-12 h-12 animate-spin mb-4", themeStyles.text)} style={themeStyles.textStyle} />
        <p className="text-slate-600 font-medium animate-pulse">Initialisation de Monsieur FABRICEL...</p>
        <p className="text-slate-400 text-xs mt-2 max-w-xs text-center">Vérification de la connexion sécurisée et de votre profil.</p>
        
        {/* Anti-stuck button */}
        <button 
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="mt-8 text-[10px] text-slate-300 hover:text-slate-500 underline uppercase tracking-widest transition-colors font-bold"
        >
          Problème d'ouverture ? Cliquez ici pour réinitialiser
        </button>
      </div>
    );
  }

  if (!user) {
    return <AuthView onGoogleLogin={handleLogin} theme={themeStyles} />;
  }

  if (userProfile?.status === 'suspended' && user.email !== "fabricel534@gmail.com") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full">
          <div className="bg-red-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Ban className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Compte Suspendu</h2>
          <p className="text-slate-600 mb-8">
            Désolé, votre accès à Monsieur FABRICEL a été temporairement suspendu. 
            Veuillez contacter l'administrateur pour plus d'informations.
          </p>
          <div className="space-y-4">
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6"
              onClick={() => window.open('https://wa.me/261328922904', '_blank')}
            >
              Contacter via WhatsApp
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-slate-500"
              onClick={handleLogout}
            >
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 shadow-xl lg:relative lg:shadow-none"
          >
            <div className="flex flex-col h-full p-6">
                <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn(themeStyles.bg, "p-2 rounded-lg shadow-lg", themeStyles.shadow)} style={themeStyles.bgStyle}>
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <h1 className={cn("font-display font-bold text-xl leading-tight", themeStyles.isCustom ? "text-slate-900" : themeStyles.text.replace('600', '900'))} style={themeStyles.isCustom ? themeStyles.textStyle : {}}>
                    Monsieur<br />
                    <span className="text-sm font-medium text-slate-500">FABRICEL</span>
                  </h1>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="lg:hidden" 
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <Button 
                onClick={startNewChat}
                className={cn("w-full mb-6 text-white rounded-xl py-6 flex items-center gap-2 shadow-md hover:shadow-lg transition-all", themeStyles.bg, themeStyles.hover)}
                style={themeStyles.bgStyle}
              >
                <Plus className="w-5 h-5" />
                Nouvelle Discussion
              </Button>

              <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                {user && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Historique
                      </p>
                    </div>
                    {chats.length > 0 ? (
                      chats.map((chat) => (
                        <button
                          key={chat.id}
                          onClick={() => selectChat(chat.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group",
                            currentChatId === chat.id 
                              ? cn(themeStyles.light, themeStyles.text, "font-medium") 
                              : "text-slate-600 hover:bg-slate-50"
                          )}
                          style={currentChatId === chat.id ? themeStyles.lightStyle : {}}
                        >
                          <MessageSquare className={cn(
                            "w-4 h-4 shrink-0",
                            currentChatId === chat.id ? themeStyles.text : "text-slate-400"
                          )} style={currentChatId === chat.id ? themeStyles.textStyle : {}} />
                          <span className="truncate">{chat.title}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 px-2 italic">
                        Aucune discussion enregistrée.
                      </p>
                    )}
                    <Separator className="my-4 bg-slate-100" />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Actions Rapides
                    </p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-slate-400 hover:text-red-500"
                      onClick={clearChat}
                      title="Effacer la discussion"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action.prompt)}
                      className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                      style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                    >
                      <action.icon className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setIsPaletteOpen(true)}
                    className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                    style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                  >
                    <Palette className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                    <span>Changer la couleur</span>
                  </button>
                  <button
                    onClick={() => setIsAboutOpen(true)}
                    className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                    style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                  >
                    <Info className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                    <span>À propos</span>
                  </button>

                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                    style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                  >
                    <Settings className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                    <span>Paramètres</span>
                  </button>

                  <button
                    onClick={() => setIsRechargeModalOpen(true)}
                    className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                    style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                  >
                    <Plus className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                    <span>Recharger Crédits</span>
                  </button>

                  <button
                    onClick={() => setIsReferralModalOpen(true)}
                    className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                    style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                  >
                    <Users className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                    <div className="flex-1">
                      <span>Parrainage</span>
                      <p className="text-[10px] opacity-60 leading-none">Gagnez des crédits gratuits</p>
                    </div>
                  </button>

                  {!isStandalone && (
                    <button
                      onClick={handleInstallClick}
                      disabled={isInstalling || installStatus === 'downloading'}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-white transition-all group text-left mt-4 shadow-lg overflow-hidden relative", 
                        isInstalling || installStatus === 'downloading' ? "opacity-90 cursor-wait" : "animate-bounce",
                        themeStyles.bg, 
                        themeStyles.hover
                      )}
                      style={themeStyles.bgStyle}
                    >
                      {/* Download Progress Bar Overlay */}
                      {installStatus === 'downloading' && (
                        <motion.div 
                          className="absolute inset-0 bg-white/20 z-0"
                          initial={{ width: 0 }}
                          animate={{ width: `${downloadProgress}%` }}
                        />
                      )}

                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/90 shrink-0 shadow-inner z-10">
                        <img src={BOT_PHOTO_URL} alt="Monsieur FABRICEL" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col z-10">
                        <span className="text-[10px] opacity-90 uppercase tracking-tighter">
                          {installStatus === 'downloading' ? `TÉLÉCHARGEMENT ${downloadProgress}%` : isInstalling ? "Progression..." : "Mode Application"}
                        </span>
                        <span className="text-xs font-black leading-none">
                          {installStatus === 'ready' ? "INSTALLER MAINTENANT" : installStatus === 'downloading' ? "RÉCUPÉRATION DES FICHIERS..." : "TÉLÉCHARGER L'APP"}
                        </span>
                      </div>
                      <div className="ml-auto z-10">
                        {isInstalling || installStatus === 'downloading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </div>
                    </button>
                  )}

                  {(user?.email === "fabricel534@gmail.com" || userProfile?.role === 'admin') && (
                    <button
                      onClick={() => setIsAdminPanelOpen(true)}
                      className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                      style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                    >
                      <Users className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                      <span>Gestion Utilisateurs</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-auto space-y-4 pt-6 border-t border-slate-100">
                <div className="flex items-start gap-2 px-2 text-[10px] text-slate-400">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  <p>
                    Basé sur le programme officiel du Ministère de l'Éducation Nationale de Madagascar.
                  </p>
                </div>
                <Card className={cn("p-4 rounded-2xl border-none shadow-lg", themeStyles.isCustom ? "bg-slate-900 text-white" : "bg-white text-slate-800")}>
                  <p className="text-xs font-medium opacity-60 mb-2">Statut du Curriculum</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", themeStyles.bg)} style={themeStyles.bgStyle} />
                    <span className="text-sm font-semibold">MEN Madagascar 2026</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    {user && (
                      <>
                        <p className="text-[10px] font-medium opacity-50 uppercase tracking-wider mb-1">Mon Compte</p>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold">
                            {user.email === "fabricel534@gmail.com" || userProfile?.role === 'admin' ? "Admin" : "Standard"}
                          </span>
                          <span className={cn("text-xs font-mono px-2 py-0.5 rounded", themeStyles.light, themeStyles.text)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>
                            {user.email === "fabricel534@gmail.com" || userProfile?.role === 'admin' ? "ILLIMITÉ" : `${userProfile?.credits || 0} CRÉDITS`}
                          </span>
                        </div>
                      </>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleShare}
                      className={cn("w-full rounded-xl gap-2 h-8 text-xs", themeStyles.border, themeStyles.text)}
                      style={{ ...themeStyles.borderLightStyle, ...themeStyles.textStyle }}
                    >
                      {isShared ? <Check className="w-3 h-3" /> : <Share className="w-3 h-3" />}
                      {isShared ? "Lien copié !" : "Partager l'application"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 relative">
          <AnimatePresence>
            {authError && (
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="absolute top-full left-0 right-0 z-[60] bg-red-50 border-b border-red-100 px-6 py-2 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-2 text-red-600 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{authError}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setAuthError(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <Badge variant="outline" className={cn("font-medium", themeStyles.light, themeStyles.text, themeStyles.border)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle, ...themeStyles.borderLightStyle }}>
              Accompagnateur & Encadreur
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSettingsOpen(true)}
              className={cn("text-slate-400", themeStyles.text.replace('text-', 'hover:text-'))}
              title="Paramètres"
            >
              <Settings className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleShare}
              className={cn("text-slate-400", themeStyles.text.replace('text-', 'hover:text-'))}
              title="Partager l'application"
            >
              {isShared ? <Check className="w-5 h-5 text-green-500" /> : <Share className="w-5 h-5" />}
            </Button>
            
            {user ? (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold">{user.displayName || "Enseignant"}</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", userProfile?.role === 'admin' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                      {userProfile?.role === 'admin' ? "ADMIN" : "ENSEIGNANT"}
                    </span>
                    <p className="text-xs text-slate-500">
                      {userProfile?.role === 'admin' ? "∞ Crédits" : `${(userProfile?.credits || 0) * 200} Ar`}
                    </p>
                  </div>
                </div>
                <Avatar className={cn("h-9 w-9 border-2", themeStyles.border.replace('200', '100'))} style={themeStyles.borderLightStyle}>
                  <AvatarImage src={user.photoURL || ""} />
                  <AvatarFallback className={cn(themeStyles.light, themeStyles.text)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>
                    {(user.displayName || "E").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-500"
                  title="Se déconnecter"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleLogin}
                className={cn("text-white gap-2 rounded-xl", themeStyles.bg, themeStyles.hover)}
                style={themeStyles.bgStyle}
              >
                <LogIn className="w-4 h-4" />
                Se connecter
              </Button>
            )}
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 relative overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full p-6">
            <div className="max-w-5xl mx-auto pb-12">
              {messages.map((message, index) => (
                <ChatMessage 
                  key={index} 
                  message={message} 
                  index={index} 
                  onCopy={copyToClipboard}
                  copiedId={copiedId}
                  theme={themeStyles}
                  onSettingsClick={() => setIsSettingsOpen(true)}
                />
              ))}
              
              {/* Active Streaming Message */}
              {streamingText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4 mb-8"
                >
                  <Avatar className={cn("h-9 w-9 shrink-0 mt-1 shadow-sm", themeStyles.bg)} style={themeStyles.bgStyle}>
                    <AvatarImage src={BOT_PHOTO_URL} className="object-cover" />
                    <AvatarFallback className={cn(themeStyles.bg, "text-white")} style={themeStyles.bgStyle}>
                      <Bot className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col max-w-[85%] items-start">
                    <div className="px-5 py-3 rounded-2xl shadow-sm bg-white border border-slate-200 text-slate-800 rounded-tl-none w-full overflow-hidden">
                      <div className={cn(
                        "prose prose-sm max-w-none break-words overflow-x-auto text-slate-800 prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-4 prose-th:py-3 prose-td:border prose-td:border-slate-200 prose-td:px-4 prose-td:py-4 prose-td:align-middle",
                        "prose-headings:text-[var(--theme-color)] prose-strong:text-[var(--theme-color)]"
                      )} style={{ "--theme-color": themeStyles.hex } as any}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            h1: ({ children }) => <h1 className={cn("font-bold text-xl mb-4", themeStyles.text)} style={themeStyles.textStyle}>{children}</h1>,
                            h2: ({ children }) => <h2 className={cn("font-bold text-lg mb-3", themeStyles.text)} style={themeStyles.textStyle}>{children}</h2>,
                            h3: ({ children }) => <h3 className={cn("font-bold text-md mb-2", themeStyles.text)} style={themeStyles.textStyle}>{children}</h3>,
                            strong: ({ children }) => <strong className={cn("font-bold", themeStyles.text)} style={themeStyles.textStyle}>{children}</strong>,
                            a: ({ node, children, href, ...props }: any) => {
                              if (href === "#settings") {
                                return (
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setIsSettingsOpen(true);
                                    }}
                                    className={cn("font-bold underline decoration-2 underline-offset-4", themeStyles.text)}
                                    style={themeStyles.textStyle}
                                  >
                                    {children}
                                  </button>
                                );
                              }
                              return <a href={href} target="_blank" rel="noopener noreferrer" className="underline" {...props}>{children}</a>;
                            },
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || "");
                              const language = match ? match[1] : "";
                              
                              if (!inline && language === "mermaid") {
                                return <Mermaid chart={String(children).replace(/\n$/, "")} />;
                              }
                              
                              if (!inline && language === "svg") {
                                return <ZoomableSVG svgCode={String(children)} />;
                              }
                              
                              return (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {sanitizeMarkdown(streamingText)}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">Monsieur FABRICEL</span>
                  </div>
                </motion.div>
              )}

              {isLoading && !streamingText && (
                <div className="flex gap-4 mb-8">
                  <Avatar className={cn("h-9 w-9 shrink-0 shadow-sm", themeStyles.bg)} style={themeStyles.bgStyle}>
                    <AvatarImage src={BOT_PHOTO_URL} className="object-cover" />
                    <AvatarFallback className={cn(themeStyles.bg, "text-white")} style={themeStyles.bgStyle}>
                      <Bot className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-white border border-slate-200 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 className={cn("w-4 h-4 animate-spin", themeStyles.text)} style={themeStyles.textStyle} />
                    <span className="text-sm text-slate-500 italic">Monsieur FABRICEL réfléchit...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Floating Scroll to Bottom Button */}
          <AnimatePresence>
            {showScrollButton && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
              >
                <Button
                  size="sm"
                  onClick={() => scrollToBottom(true)}
                  className={cn("bg-white border border-slate-200 shadow-lg rounded-full px-4 py-2 flex items-center gap-2", themeStyles.text, themeStyles.light.replace('bg-', 'hover:bg-'))}
                  style={{ ...themeStyles.textStyle, ...themeStyles.lightStyle }}
                >
                  <ArrowDown className="w-4 h-4" />
                  <span className="text-xs font-semibold">Retour en bas</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <ChatInput 
          onSend={handleSend} 
          onStop={handleStop} 
          isLoading={isLoading} 
          themeStyles={themeStyles} 
        />
      </main>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className={cn("h-16 w-16 border-4 shadow-lg", themeStyles.border.replace('200', '100'))} style={themeStyles.borderLightStyle}>
                      <AvatarImage src={BOT_PHOTO_URL} className="object-cover" />
                      <AvatarFallback className={cn(themeStyles.bg, "text-white")} style={themeStyles.bgStyle}>
                        <Bot className="w-8 h-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">À propos</h2>
                      <p className={cn("font-medium", themeStyles.text)} style={themeStyles.textStyle}>Monsieur FABRICEL</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsAboutOpen(false)} className="rounded-full">
                    <X className="w-6 h-6 text-slate-400" />
                  </Button>
                </div>

                <div className="space-y-6 text-slate-600 leading-relaxed">
                  <section>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Rôle de l'application</h3>
                    <p className="text-sm">
                      Cette application sert d'assistant pédagogique intelligent pour les enseignants du collège à Madagascar. 
                      Elle aide à la conception de plans de leçons, à la création d'exercices, et à la préparation aux examens officiels (BEPC), 
                      tout en respectant strictement le programme du Ministère de l'Éducation Nationale (MEN).
                    </p>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Administration</h3>
                    <p className="text-sm">
                      <strong>Monsieur FABRICEL</strong><br />
                      Enseignant de mathématiques malgache, titulaire d’un Master 2 en Sciences de l’éducation.<br />
                      Expert en didactique, formation des enseignants et intégration des technologies éducatives (IA, applications pédagogiques).
                    </p>
                  </section>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                    <div className="text-xs text-slate-400">
                      Année de création : <strong>2026 (Avril)</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleShare}
                        className={cn("rounded-xl gap-2 h-8 text-xs", themeStyles.border, themeStyles.text)}
                        style={{ ...themeStyles.borderLightStyle, ...themeStyles.textStyle }}
                      >
                        {isShared ? <Check className="w-3 h-3" /> : <Share className="w-3 h-3" />}
                        {isShared ? "Lien copié !" : "Partager"}
                      </Button>
                      <Badge className={cn("border-none", themeStyles.light, themeStyles.text, themeStyles.light.replace('bg-', 'hover:bg-'))} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>Version 1.0</Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 flex justify-end">
                <Button onClick={() => setIsAboutOpen(false)} className={cn("rounded-xl px-8 text-white", themeStyles.bg, themeStyles.hover)} style={themeStyles.bgStyle}>
                  Fermer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Install Modal */}
      <AnimatePresence>
        {isInstallModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className={cn("p-8 text-white text-center relative", themeStyles.bg)} style={themeStyles.bgStyle}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-4 right-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full" 
                  onClick={() => setIsInstallModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
                
                <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 border-white/20 mx-auto mb-4 shadow-xl">
                  <img src={BOT_PHOTO_URL} alt="Monsieur FABRICEL" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-xl font-black tracking-tight">Installer Monsieur FABRICEL</h2>
                <p className="text-sm opacity-80 font-medium italic">Pas de téléchargement via Play Store nécessaire</p>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="space-y-6">
                  <p className="text-sm text-slate-600 font-medium">
                    Pour avoir l'application sans barre d'adresse et y accéder directement depuis votre écran d'accueil :
                  </p>
                  
                  {/* Android / Chrome */}
                  <div className="flex items-start gap-4 group">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg shadow-sm", themeStyles.light, themeStyles.text)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>
                      A
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 leading-tight">Sur Android (Chrome)</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Cliquez sur les <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 rounded text-slate-900 font-bold">⋮</span> en haut, puis sur <span className="text-emerald-600 font-bold">"Installer l'application"</span>.
                      </p>
                    </div>
                  </div>
                  
                  {/* iPhone / Safari */}
                  <div className="flex items-start gap-4 group">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg shadow-sm", themeStyles.light, themeStyles.text)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>
                      i
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 leading-tight">Sur iPhone (Safari)</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Appuyez sur <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 rounded text-blue-500"><Share className="w-3 h-3" /></span> en bas, puis sur <span className="text-blue-600 font-bold">"Sur l'écran d'accueil"</span>.
                      </p>
                    </div>
                  </div>

                  {/* Facebook / WhatsApp Tip */}
                  <div className="pt-4 border-t border-slate-100 italic">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      <strong>Note :</strong> Si vous êtes dans l'application <span className="text-slate-600">Facebook</span> ou <span className="text-slate-600">WhatsApp</span>, cliquez d'abord sur les <span className="font-bold">⋮</span> ou l'icône de partage, puis sur <span className="text-emerald-600 font-bold">"Ouvrir dans Chrome / Safari"</span> avant d'installer.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    className={cn("w-full py-7 rounded-2xl text-white font-black text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all", themeStyles.bg, themeStyles.hover)} 
                    style={themeStyles.bgStyle}
                    onClick={() => setIsInstallModalOpen(false)}
                  >
                    C'EST COMPRIS !
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center mt-4 uppercase tracking-widest font-bold">
                    Simple • Rapide • Gratuit
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recharge Modal */}
      <AnimatePresence>
        {isRechargeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className={cn("p-6 text-white flex items-center justify-between", themeStyles.bg)} style={themeStyles.bgStyle}>
                <div className="flex items-center gap-3">
                  <Plus className="w-6 h-6" />
                  <div>
                    <h2 className="font-bold">Recharger mon compte</h2>
                    <p className="text-xs opacity-80">Tarif : 200 Ar / crédit</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setIsRechargeModalOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
                  <div className="bg-emerald-500 text-white p-2 rounded-xl">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Offre Enseignant</p>
                    <p className="text-xs text-emerald-700">1 crédit = 1 réponse complète de Monsieur FABRICEL.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Paiement Mvola</p>
                    <p className="text-sm font-bold text-slate-800">Numéro : 038 07 70 973</p>
                    <p className="text-sm text-slate-600">Nom : FABRICEL</p>
                    <p className="text-xs text-red-500 mt-2 font-medium italic">👉 Notez votre email ({user?.email}) dans la description.</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Contact Direct</p>
                    <div className="flex flex-col gap-1">
                      <a href="https://wa.me/261328922904" target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 font-bold flex items-center gap-2">
                        WhatsApp : +261 32 89 229 04
                      </a>
                      <p className="text-sm text-slate-600">Tél : 038 07 70 973</p>
                    </div>
                  </div>
                </div>

                <Button 
                  className={cn("w-full py-6 rounded-2xl text-white font-bold", themeStyles.bg, themeStyles.hover)} 
                  style={themeStyles.bgStyle}
                  onClick={() => setIsRechargeModalOpen(false)}
                >
                  Fermer
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {isReferralModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className={cn("p-6 text-white flex items-center justify-between", themeStyles.bg)} style={themeStyles.bgStyle}>
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6" />
                  <div>
                    <h2 className="font-bold">Programme de Parrainage</h2>
                    <p className="text-xs opacity-80">Invitez vos collègues et gagnez des crédits !</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setIsReferralModalOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* How it works */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                    <p className="text-xs font-bold text-amber-800 uppercase mb-1">Pour vous</p>
                    <p className="text-sm text-amber-900 font-medium">+2 crédits pour chaque nouvel inscrit qui utilise votre lien.</p>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-800 uppercase mb-1">Pour votre collègue</p>
                    <p className="text-sm text-indigo-900 font-medium">+2 crédits bonus dès l'inscription (total 12 crédits).</p>
                  </div>
                </div>

                {/* Share Link */}
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-700">Votre lien de parrainage :</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-mono break-all text-slate-600">
                      {window.location.origin}/?ref={userProfile?.referralCode}
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?ref=${userProfile?.referralCode}`);
                        // Optional: Toast message
                      }}
                      className="rounded-xl"
                    >
                      Copier
                    </Button>
                  </div>
                  <Button 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2"
                    onClick={() => {
                      const text = `Salama! Je t'invite à découvrir Monsieur FABRICEL, l'assistant IA pour les enseignants à Madagascar. Utilise mon lien pour avoir 2 crédits bonus : ${window.location.origin}/?ref=${userProfile?.referralCode}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                  >
                    Partager sur WhatsApp
                  </Button>
                </div>

                {/* Pending Rewards */}
                {referralRewards.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-700">Récompenses en attente ({referralRewards.length}) :</p>
                    <div className="space-y-2">
                      {referralRewards.map((reward) => (
                        <div key={reward.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                          <div>
                            <p className="text-xs font-bold text-emerald-900">{reward.fromUserEmail}</p>
                            <p className="text-[10px] text-emerald-700">Nouveau collègue inscrit !</p>
                          </div>
                          <Button 
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-4 rounded-lg"
                            onClick={() => claimReward(reward)}
                          >
                            Encaisser +2 🎁
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {referralRewards.length === 0 && (
                  <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-sm text-slate-400 italic">Aucune récompense en attente.</p>
                    <p className="text-xs text-slate-400">Partagez votre lien pour commencer à gagner !</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Theme Palette Modal */}
      <AnimatePresence>
        {isPaletteOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Palette className={cn("w-6 h-6", themeStyles.text)} style={themeStyles.textStyle} />
                    <h2 className="text-xl font-bold text-slate-900">Personnalisation</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsPaletteOpen(false)} className="rounded-full">
                    <X className="w-5 h-5 text-slate-400" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {THEME_COLORS.map((theme) => (
                    <div key={theme.value} className="space-y-2">
                      <button
                        onClick={() => changeTheme(theme)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                          currentTheme.value === theme.value 
                            ? (theme.value === 'custom' ? "border-slate-900 bg-slate-50" : cn(theme.border, theme.light))
                            : "border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className={cn("w-6 h-6 rounded-full shadow-inner", theme.bg)} 
                            style={theme.value === 'custom' ? { backgroundColor: customHex } : {}}
                          />
                          <span className={cn("font-medium", currentTheme.value === theme.value ? (theme.value === 'custom' ? "text-slate-900" : theme.text) : "text-slate-600")}>
                            {theme.name}
                          </span>
                        </div>
                        {currentTheme.value === theme.value && <Check className={cn("w-5 h-5", theme.value === 'custom' ? "text-slate-900" : theme.text)} />}
                      </button>
                      
                      {theme.value === 'custom' && currentTheme.value === 'custom' && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="px-4 pb-2"
                        >
                          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <input 
                              type="color" 
                              value={customHex}
                              onChange={(e) => changeTheme(theme, e.target.value)}
                              className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                            />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-slate-500 uppercase">Choisir une couleur</p>
                              <p className="text-sm font-mono text-slate-700">{customHex.toUpperCase()}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 p-4 flex justify-end">
                <Button onClick={() => setIsPaletteOpen(false)} className={cn("rounded-xl px-8 text-white", themeStyles.bg, themeStyles.hover)} style={themeStyles.bgStyle}>
                  Terminer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Settings className={cn("w-6 h-6", themeStyles.text)} style={themeStyles.textStyle} />
                    <h2 className="text-xl font-bold text-slate-900">Paramètres</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(false)} className="rounded-full">
                    <X className="w-5 h-5 text-slate-400" />
                  </Button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Key className="w-4 h-4" />
                      <label className="text-sm font-bold">Clé API Gemini</label>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Pour utiliser Monsieur FABRICEL sur ce lien partagé, vous devez fournir votre propre clé API. 
                      Elle sera enregistrée uniquement dans votre navigateur.
                    </p>
                    <Input 
                      type="password"
                      placeholder="AIzaSy..."
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                      className="rounded-xl border-slate-200 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 italic">
                      Obtenez une clé gratuite sur <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-600">Google AI Studio</a>.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      <strong>Note :</strong> Si vous avez déjà configuré une clé dans les Secrets d'AI Studio, elle sera utilisée par défaut si ce champ est vide.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-xl px-6">
                  Annuler
                </Button>
                <Button onClick={saveSettings} className={cn("rounded-xl px-8 text-white", themeStyles.bg, themeStyles.hover)} style={themeStyles.bgStyle}>
                  Enregistrer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
        
        <AdminPanel 
          isOpen={isAdminPanelOpen} 
          onClose={() => setIsAdminPanelOpen(false)} 
          theme={themeStyles} 
        />
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
