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
  Ban,
  Smartphone,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  WifiOff,
  Eye,
  Sparkles
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
import { Message, generateDidacticFallback } from "@/services/geminiService";
import { aiService } from "@/services/ai/AIService";
import { cn } from "@/lib/utils";
import { Mermaid } from "@/components/Mermaid";
import { ZoomableSVG } from "@/components/ZoomableSVG";
import { normalizeSvgContent } from "@/utils/svgUtils";
import { OfficialPacksModal } from "@/components/OfficialPacksModal";
import { GoogleDriveExportModal } from "@/components/GoogleDriveExportModal";
import { setCachedAccessToken } from "@/services/googleDriveService";
import { ChatInput } from "@/components/ChatInput";
import { downloadMessageAsPDF } from "@/utils/pdfGenerator";
import { downloadMessageAsDOCX } from "@/utils/docxGenerator";
import { downloadAsLaTeXFile } from "@/utils/latexExporter";
import { stripConversationalFiller } from "@/utils/textUtils";
import { 
  auth, 
  db, 
  googleProvider, 
  GoogleAuthProvider,
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
  signInAnonymously,
  updateProfile,
  sendPasswordResetEmail,
  handleFirestoreError,
  OperationType
} from "@/lib/firebase";

const KATEX_MACROS = {
  "\\textperthousand": "‰",
  "\\textpercent": "%",
  "\\overparen": "\\wideparen",
  "\\bbox": "\\boxed",
};

interface ChatSession {
  id: string;
  title: string;
  createdAt: any;
  updatedAt: any;
}

interface SavedPDF {
  id: string;
  userId?: string;
  filename: string;
  messageText: string;
  themeHex: string;
  config: {
    finalDocType: string;
    finalSubject: string;
    finalGrade: string;
    finalIncludeAvatar: boolean;
    pdfEnableWatermark: boolean;
  };
  createdAt: number;
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

const wrapRawSvgs = (text: string): string => {
  if (!text) return "";
  
  // 1. Convert any \begin{svg} ... \end{svg} into ```svg ... ```
  let result = text.replace(/\\begin\{svg\}([\s\S]*?)\\end\{svg\}/gi, (_match, innerContent) => {
    const normalized = normalizeSvgContent(innerContent);
    return `\n\`\`\`svg\n${normalized}\n\`\`\`\n`;
  });

  // 2. Wrap any raw <svg ... </svg> not already enclosed in a code block
  let transformed = "";
  let currentIndex = 0;
  
  while (currentIndex < result.length) {
    const svgStart = result.indexOf("<svg", currentIndex);
    if (svgStart === -1) {
      transformed += result.substring(currentIndex);
      break;
    }
    
    const textBefore = result.substring(0, svgStart);
    const backtickCount = (textBefore.match(/```/g) || []).length;
    const isInsideCodeBlock = backtickCount % 2 === 1;
    
    const svgEnd = result.indexOf("</svg>", svgStart);
    if (svgEnd === -1) {
      transformed += result.substring(currentIndex);
      break;
    }
    
    const nextIndex = svgEnd + 6; // length of "</svg>"
    
    if (isInsideCodeBlock) {
      transformed += result.substring(currentIndex, nextIndex);
    } else {
      const svgContent = result.substring(svgStart, nextIndex);
      const prefixText = result.substring(currentIndex, svgStart);
      transformed += prefixText;
      const normalized = normalizeSvgContent(svgContent);
      transformed += `\n\`\`\`svg\n${normalized}\n\`\`\`\n`;
    }
    
    currentIndex = nextIndex;
  }
  
  return transformed;
};

let _htmlNodeCounter = 0;
const getUniqueHtmlKey = (prefix: string, index?: number): string => {
  if (index !== undefined) {
    return `${prefix}-${index}`;
  }
  _htmlNodeCounter = (_htmlNodeCounter + 1) % 100000000;
  return `${prefix}-${_htmlNodeCounter}`;
};

const parseHtmlToReact = (text: string): React.ReactNode => {
  if (!text) return "";
  
  // Basic HTML entity decoding for tags that might have been escaped by the markdown processor
  const decodedText = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");

  // Quick check: if there are no HTML tags, just return the text
  if (!decodedText.includes("<") || !decodedText.includes(">")) {
    return text;
  }
  
  // Simple regex tokenizer for tags and text
  const tagRegex = /(<\/?[a-zA-Z0-9_-]+(?:\s*\/?)>)/g;
  const parts = decodedText.split(tagRegex);
  
  const stack: { tag: string; children: any[] }[] = [{ tag: "root", children: [] }];
  
  for (const part of parts) {
    if (!part) continue;
    
    if (part.startsWith("<") && part.endsWith(">")) {
      const cleanTag = part.replace(/[<>]/g, "").trim().toLowerCase();
      
      if (cleanTag.startsWith("/")) {
        // Closing tag
        const closingTagName = cleanTag.slice(1).trim();
        // Pop matching tags from stack
        if (stack.length > 1 && stack[stack.length - 1].tag === closingTagName) {
          const finished = stack.pop()!;
          const parent = stack[stack.length - 1];
          
          // Map tag to React element
          let el: React.ReactNode = null;
          const key = getUniqueHtmlKey(`el-${closingTagName}`);
          
          if (finished.tag === "ul") {
            el = <ul key={key} className="list-disc pl-5 my-1 space-y-0.5">{finished.children}</ul>;
          } else if (finished.tag === "ol") {
            el = <ol key={key} className="list-decimal pl-5 my-1 space-y-0.5">{finished.children}</ol>;
          } else if (finished.tag === "li") {
            el = <li key={key} className="my-0.5">{finished.children}</li>;
          } else if (finished.tag === "strong" || finished.tag === "b") {
            el = <strong key={key} className="font-bold">{finished.children}</strong>;
          } else if (finished.tag === "em" || finished.tag === "i") {
            el = <em key={key} className="italic">{finished.children}</em>;
          } else if (finished.tag === "u") {
            el = <u key={key} className="underline">{finished.children}</u>;
          } else if (finished.tag === "p") {
            el = <p key={key} className="my-1">{finished.children}</p>;
          } else {
            // Fallback for unknown tag
            el = <span key={key}>{finished.children}</span>;
          }
          parent.children.push(el);
        } else {
          // Unmatched close tag, ignore or treat as text
          stack[stack.length - 1].children.push(part);
        }
      } else if (cleanTag.endsWith("/")) {
        // Self-closing tag (like <br />)
        const tagName = cleanTag.slice(0, -1).trim();
        const parent = stack[stack.length - 1];
        const key = getUniqueHtmlKey(`sc-${tagName}`);
        
        if (tagName === "br") {
          parent.children.push(<br key={key} />);
        } else {
          parent.children.push(<span key={key} />);
        }
      } else {
        // Opening tag
        const tagName = cleanTag.split(/\s+/)[0];
        if (tagName === "br") {
          // Sometimes people write <br> instead of <br />
          const parent = stack[stack.length - 1];
          const key = getUniqueHtmlKey("sc-br");
          parent.children.push(<br key={key} />);
        } else {
          stack.push({ tag: tagName, children: [] });
        }
      }
    } else {
      // Plain text
      // Unescape some standard HTML entities if present
      let decodedPart = part
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"');
      stack[stack.length - 1].children.push(decodedPart);
    }
  }
  
  // If stack has items unclosed, pop them back down to root
  while (stack.length > 1) {
    const finished = stack.pop()!;
    const parent = stack[stack.length - 1];
    const key = getUniqueHtmlKey("unclosed");
    parent.children.push(<React.Fragment key={key}>{finished.children}</React.Fragment>);
  }
  
  if (stack[0].children.length === 1 && typeof stack[0].children[0] === 'string') {
    return stack[0].children[0];
  }
  
  return stack[0].children.map((child, idx) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { key: child.key || getUniqueHtmlKey(`html-el-${idx}`) });
    }
    return <React.Fragment key={getUniqueHtmlKey(`html-txt-${idx}`)}>{child}</React.Fragment>;
  });
};

const replaceHtmlBreaks = (node: any): any => {
  if (typeof node === 'string') {
    return parseHtmlToReact(node);
  }
  if (Array.isArray(node)) {
    const result: any[] = [];
    React.Children.toArray(node).forEach((child: any, i) => {
      const processed = replaceHtmlBreaks(child);
      if (Array.isArray(processed)) {
        processed.forEach((item, j) => {
          if (React.isValidElement(item)) {
            const uniqueKey = getUniqueHtmlKey(`rhb-arr-${i}-${j}`);
            result.push(React.cloneElement(item, { key: uniqueKey }));
          } else {
            result.push(<React.Fragment key={getUniqueHtmlKey(`rhb-txt-${i}-${j}`)}>{item}</React.Fragment>);
          }
        });
      } else if (React.isValidElement(processed)) {
        const uniqueKey = getUniqueHtmlKey(`rhb-el-${i}`);
        result.push(React.cloneElement(processed, { key: uniqueKey }));
      } else {
        result.push(processed);
      }
    });
    return result;
  }
  if (node && typeof node === 'object' && node.props) {
    if (node.props.children) {
      return React.cloneElement(node, {
        ...node.props,
        children: replaceHtmlBreaks(node.props.children)
      });
    }
  }
  return node;
};

const formatMathBlocks = (text: string): string => {
  if (!text) return "";
  
  // Park any fenced code blocks (like ```svg, ```mermaid, etc.) so math parsing never touches them
  const codeBlocks: string[] = [];
  let formatted = text.replace(/```[\s\S]*?```/g, (match) => {
    const token = `___FMB_CODE_BLOCK_${codeBlocks.length}___`;
    codeBlocks.push(match);
    return token;
  });

  // Convert unsupported MathJax \bbox[...] or \bbox{...} to standard KaTeX \boxed{...}
  formatted = formatted.replace(/\\bbox\s*(\[[^\]]*\])?\s*\{/g, '\\boxed{');
  formatted = formatted.replace(/\\bbox\s*(\[[^\]]*\])?/g, '\\boxed');

  // Normalize smart quotes in LaTeX text blocks
  formatted = formatted.replace(/\\text\s*\{\s*[“"]\s*([^”"]+?)\s*[”"]\s*\}/g, '\\text{"$1"}');
  
  // A. Protect / clear emphasis decorators wrapping math environments or block/inline math
  formatted = formatted.replace(/\*\*(\s*\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\}\s*)\*\*/g, "$1");
  formatted = formatted.replace(/_(\s*\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\}\s*)_/g, "$1");
  formatted = formatted.replace(/\*\*(\s*\$\$[\s\S]*?\$\$\s*)\*\*/g, "$1");
  formatted = formatted.replace(/_(\s*\$\$[\s\S]*?\$\$\s*)_/g, "$1");
  formatted = formatted.replace(/\*\*(\s*\$[^$\n]+?\$\s*)\*\*/g, "$1");
  formatted = formatted.replace(/_(\s*\$[^$\n]+?\$\s*)_/g, "$1");

  // B. Auto-close unclosed mathematical environments (like aligned, align, matrix, cases, array, gather)
  const environmentsToClose = ["aligned", "align", "matrix", "cases", "array", "gather"];
  environmentsToClose.forEach(env => {
    const beginMatches = formatted.match(new RegExp(`\\\\begin\\{${env}\\}`, 'g')) || [];
    const endMatches = formatted.match(new RegExp(`\\\\end\\{${env}\\}`, 'g')) || [];
    if (beginMatches.length > endMatches.length) {
      const diff = beginMatches.length - endMatches.length;
      for (let i = 0; i < diff; i++) {
        formatted += `\n\\end{${env}}`;
      }
    }
  });
  
  // 1. Pre-process LaTeX environment blocks (like aligned, matrix, cases, array, align) to be enclosed in $$ ... $$
  const environments = ["aligned", "align", "align\\*", "matrix", "cases", "array", "gather", "gather\\*"];
  environments.forEach(env => {
    // This regex matches the environment and optionally captures surrounding $$ or $ delimiters if they exist!
    const regex = new RegExp(`(\\$\\$|\\$)?\\s*\\\\begin\\{(${env})\\}([\\s\\S]*?)\\\\end\\{\\2\\}\\s*(\\$\\$|\\$)?`, 'g');
    formatted = formatted.replace(regex, (match, openDelim, envName, body, closeDelim) => {
      const cleanBody = body.trim();
      return `\n\n$$\n\\begin{${envName}}\n${cleanBody}\n\\end{${envName}}\n$$\n\n`;
    });
  });

  // 2. Detect and recover block-style math equations that are missing delimiters or have unbalanced delimiters
  let lines = formatted.split('\n');
  let insideBlockMath = false;
  let insideEnvironment = false;

  lines = lines.map(line => {
    const trimmed = line.trim();
    
    // Toggle block math state
    if (trimmed.startsWith('$$')) {
      insideBlockMath = !insideBlockMath;
      return line;
    }
    
    // Toggle environment state
    if (trimmed.startsWith('\\begin{')) {
      insideEnvironment = true;
      return line;
    }
    if (trimmed.startsWith('\\end{')) {
      insideEnvironment = false;
      return line;
    }
    
    // If inside an existing mathematical block or math environment, do not apply single-line auto-wrapping
    if (insideBlockMath || insideEnvironment) {
      return line;
    }
    
    if (!trimmed) return line;
    
    // Fix unbalanced ending $$ (e.g. formula $$)
    if (trimmed.endsWith('$$') && !trimmed.startsWith('$$')) {
      const inside = trimmed.substring(0, trimmed.length - 2).trim();
      return `\n\n$$\n${inside}\n$$\n\n`;
    }
    // Fix unbalanced starting $$ (e.g. $$ formula)
    if (trimmed.startsWith('$$') && !trimmed.endsWith('$$') && !trimmed.substring(2).includes('$$')) {
      const inside = trimmed.substring(2).trim();
      return `\n\n$$\n${inside}\n$$\n\n`;
    }
    
    // Auto-detect equations on their own lines containing common LaTeX syntax but lacking any delimiters
    const hasMathSymbols = /\\(bbox|boxed|lim|infty|frac|times|dots|bar|sum|mu|sigma|alpha|beta|theta|pi|approx|rightarrow|implies|text|mathcal|mathbb|mathbf|sqrt|overparen|wideparen|pm|quad|qquad|left|right)\b/i.test(trimmed) || /^\\[a-zA-Z]+/i.test(trimmed);
    const hasEquals = trimmed.includes('=');
    const hasDelimiters = trimmed.includes('$');
    
    if (hasMathSymbols && !hasDelimiters && !trimmed.includes('|')) {
      return `\n\n$$\n${trimmed}\n$$\n\n`;
    }
    
    return line;
  });
  formatted = lines.join('\n');
  
  // 3. Format block math: $$ ... $$
  formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
    let cleanContent = content.trim();
    
    // Replace any <br> inside math blocks with \\
    cleanContent = cleanContent.replace(/<br\s*\/?>/gi, " \\\\ ");
    
    // Normalize unescaped single backslash followed by whitespace/newline to double backslashes \\
    cleanContent = cleanContent.replace(/(?<!\\)\\_?(?!\s*\\|[a-zA-Z])(?=\s)/g, " \\\\ ");
    cleanContent = cleanContent.replace(/(?<!\\)\\(?!\s*\\|[a-zA-Z])(?=\s)/g, " \\\\ ");
    
    // Escape unescaped percent sign % inside KaTeX/math to avoid commenting out the rest of the formula
    cleanContent = cleanContent.replace(/(?<!\\)%/g, "\\%");
    
    // Preserve LaTeX newlines \\ by doubling them to \\\\ for markdown escape preservation
    cleanContent = cleanContent.replace(/\\\\(?!\s*\\)/g, "\\\\\\\\");
    
    // Preserve LaTeX spacing \, by doubling to \\,
    cleanContent = cleanContent.replace(/\\,(?!\s*,)/g, "\\\\,");
    
    // Ensure $$ are strictly on their own line with spacing
    return `\n\n$$\n${cleanContent}\n$$\n\n`;
  });

  // 4. Format inline math: $ ... $
  // Matches any $ block that doesn't span lines, doesn't contain space right after/before $, 
  // and is not plain money/number like $10 or $5,000 or currency values.
  formatted = formatted.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, content) => {
    if (/^\s*\d+[\d\s,.]*\s*$/.test(content) || content.toLowerCase().includes("ar") || content.toLowerCase().includes("fmg")) {
      return match;
    }
    
    let cleanContent = content;
    // Escape % inside inline math too
    cleanContent = cleanContent.replace(/(?<!\\)%/g, "\\%");
    cleanContent = cleanContent.replace(/\\\\/g, "\\\\\\\\");
    cleanContent = cleanContent.replace(/\\,/g, "\\\\,");
    
    return `$${cleanContent}$`;
  });

  // Restore parked code blocks
  codeBlocks.forEach((block, idx) => {
    formatted = formatted.replace(`___FMB_CODE_BLOCK_${idx}___`, block);
  });
  
  return formatted;
};

const sanitizeMarkdown = (text: string) => {
  if (!text) return "";
  
  // 1. Pre-process to fix tables with list prefixes (e.g., "4. | Classes...") or introductory text prior to the table
  // If a line starts with a list marker or introductory text ending with a colon, separate it with a newline.
  let preProcessedText = text.replace(/^(\s*\d+[.)]\s*|\s*[-*+]\s*|[^|\n\s][^|\n]*?:\s*)(\|)/gm, '$1\n$2');

  // 2. Pre-process to fix actually collapsed separate table rows while keeping standard empty cells intact.
  // We only replace double-pipes without space "||" that are commonly used by models to join separate lines.
  let lines = preProcessedText.split('\n');
  lines = lines.map(line => {
    const pipeCount = (line.match(/\|/g) || []).length;
    if (pipeCount >= 8 && line.includes("||")) {
      return line.replace(/\|\|/g, "|\n|");
    }
    return line;
  });
  preProcessedText = lines.join('\n');

  // 3. Fix absolute value pipes inside table rows first, before extracting placeholders
  lines = preProcessedText.split('\n');
  lines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.includes('$')) {
      return line.replace(/\$([^$]+)\$/g, (match, math) => {
        return `$${math.replace(/(?<!\\)\|/g, '\\|')}$`;
      });
    }
    return line;
  });
  const textWithTablePipesFixed = lines.join('\n');
  
  // 4. Wrap raw SVGs and convert \begin{svg}...\end{svg} FIRST so math parsing never interferes
  const wrappedText = wrapRawSvgs(textWithTablePipesFixed);

  // 5. Now format math blocks (which safely protects all fenced code blocks)
  const mathFormat = formatMathBlocks(wrappedText);
  
  // 6. Extract and protect (park) code blocks, block math, and inline math
  const placeholders: string[] = [];
  let processedText = mathFormat;
  
  // Matches all fenced code blocks (like ```mermaid, ```svg etc)
  // Matches all double-dollar block math $$ ... $$
  // Matches all single-dollar inline math $ ... $
  const blockRegex = /(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]+?\$)/g;
  
  processedText = processedText.replace(blockRegex, (match) => {
    const placeholder = `___CONTAINER_PLACEHOLDER_${placeholders.length}___`;
    placeholders.push(match);
    return placeholder;
  });
  
  // 5. Perform standard substitutions on the text OUTSIDE of code/math blocks
  // We process line-by-line to avoid injecting literal newlines into any lines containing pipes ('|'), 
  // as literal newlines break markdown tables. Markdown tables use '<br>' tags for line breaks instead.
  const linesArray = processedText.split('\n');
  const processedLines = linesArray.map(line => {
    if (line.includes('|')) {
      return line;
    }
    
    let temp = line;
    // Standardize existing <br /> and <br> elements as markdown soft breaks (two spaces + newline)
    temp = temp.replace(/<br\s*\/?>/gi, "  \n");

    // Insert line breaks (two spaces + newline) before inline numbers/letters tightly for list structures
    temp = temp.replace(/([^\s>#|*=\-_])\s*\n?\s*\b(\d{1,2})([).])\s+/g, '$1  \n$2$3 ');
    temp = temp.replace(/([^\s>#|*=\-_])\s*\n?\s*\b([IVXLCDM]{1,4})\b([).])\s+/gi, '$1  \n$2$3 ');
    temp = temp.replace(/([^\s>#|*=\-_])\s*\n?\s*\b([a-hA-H])([).])\s+/g, '$1  \n$2$3 ');
    
    return temp;
  });
  processedText = processedLines.join('\n');

  // 6. Unpark the placeholders back in reverse order, to avoid nested container parsing issues
  for (let i = placeholders.length - 1; i >= 0; i--) {
    processedText = processedText.replace(`___CONTAINER_PLACEHOLDER_${i}___`, placeholders[i]);
  }
  
  return processedText;
};

// Memoized Message Component for performance
const ChatMessage = memo(({ message, index, onCopy, copiedId, theme, onSettingsClick, isWideLayout, onPDFDownloaded }: { 
  message: Message, 
  index: number, 
  onCopy: (text: string, id: number) => void,
  copiedId: number | null,
  theme: any,
  onSettingsClick: () => void,
  isWideLayout?: boolean,
  onPDFDownloaded?: (pdf: {
    filename: string;
    messageText: string;
    themeHex: string;
    config: {
      finalDocType: string;
      finalSubject: string;
      finalGrade: string;
      finalIncludeAvatar: boolean;
      pdfEnableWatermark: boolean;
      pdfIncludeBrandHeader?: boolean;
      pdfIncludeBrandFooter?: boolean;
      pdfStripFiller?: boolean;
    };
  }) => void;
}) => {
  const isModel = message.role === "model";
  const messageRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Custom PDF configuration states for Madagascar educators
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"print" | "pdf" | "docx" | "tex" | "drive">("print");
  const [pdfDocType, setPdfDocType] = useState("Fiche de préparation de leçon");
  const [pdfSubject, setPdfSubject] = useState("Mathématiques");
  const [pdfGrade, setPdfGrade] = useState("Classe de Terminale");
  const [pdfEnableWatermark, setPdfEnableWatermark] = useState(true);
  const [pdfIncludeAvatar, setPdfIncludeAvatar] = useState(true);
  const [pdfIncludeBrandHeader, setPdfIncludeBrandHeader] = useState(true);
  const [pdfIncludeBrandFooter, setPdfIncludeBrandFooter] = useState(true);
  const [pdfStripFiller, setPdfStripFiller] = useState(false);
  
  const [customDocType, setCustomDocType] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customGrade, setCustomGrade] = useState("");
  const [downloadedPdfInfo, setDownloadedPdfInfo] = useState<{ pdfUrl: string; filename: string } | null>(null);
  const [downloadedDocxInfo, setDownloadedDocxInfo] = useState<{ docxUrl: string; filename: string } | null>(null);

  const printDiscussionMessage = () => {
    setIsGeneratingPDF(true);
    const finalDocType = pdfDocType === "Autre" ? (customDocType.trim() || "Fiche Pédagogique") : pdfDocType;
    const finalSubject = pdfSubject === "Autre" ? (customSubject.trim() || "Multi-disciplines") : pdfSubject;
    const finalGrade = pdfGrade === "Autre" ? (customGrade.trim() || "Enseignement Général") : pdfGrade;

    const safeTypeLabel = finalDocType.toLowerCase().replace(/[^a-z0-9]/gi, "_");
    const safeSubjectLabel = finalSubject.toLowerCase().replace(/[^a-z0-9]/gi, "_");
    const docFilename = `document-fabricel-${safeTypeLabel}-${safeSubjectLabel}-${Date.now().toString().slice(-6)}.pdf`;

    if (onPDFDownloaded) {
      onPDFDownloaded({
        filename: docFilename,
        messageText: message.text,
        themeHex: theme.hex,
        config: {
          finalDocType,
          finalSubject,
          finalGrade,
          finalIncludeAvatar: pdfIncludeAvatar,
          pdfEnableWatermark,
          pdfIncludeBrandHeader,
          pdfIncludeBrandFooter,
          pdfStripFiller
        }
      });
    }

    try {
      // 1. Remove old print-section if exists
      let printSection = document.getElementById("print-section");
      if (printSection) {
        printSection.remove();
      }
      
      // 2. Create the printing container
      printSection = document.createElement("div");
      printSection.id = "print-section";

      // 3. Clone current bubble content
      const element = messageRef.current;
      if (!element) return;
      const contentClone = element.cloneNode(true) as HTMLElement;

      // 4. Remove copy/download buttons and other interactive UI widgets
      const interactive = contentClone.querySelectorAll("button, .flex.items-center.gap-1.mt-2, .zoom-controls, .copy-button, .transform-controls, .zoom-slider-container, .interactive-controls");
      interactive.forEach(el => el.remove());

      // If requested, strip conversational fillers from HTML before printing
      if (pdfStripFiller) {
        const markdownBody = contentClone.querySelector(".markdown-body") || contentClone;
        const paragraphs = Array.from(markdownBody.children);
        
        // Remove first paragraph if it is typical opening filler
        if (paragraphs.length > 0) {
          let checkFirst = true;
          while (checkFirst && paragraphs.length > 0) {
            const el = paragraphs[0];
            const text = el.textContent?.trim().toLowerCase() || "";
            if (!text) {
              el.remove();
              paragraphs.shift();
              continue;
            }
            if (el.tagName === "P" && (
              text.startsWith("bonjour") ||
              text.startsWith("salut") ||
              text.startsWith("certainement") ||
              text.startsWith("bien sûr") ||
              text.startsWith("voici") ||
              text.startsWith("pour cela") ||
              text.startsWith("je vous propose") ||
              text.startsWith("je suis ravi") ||
              text.startsWith("en tant que") ||
              text.startsWith("en réponse à") ||
              text.includes("monsieur fabricel")
            )) {
              el.remove();
              paragraphs.shift();
            } else {
              checkFirst = false;
            }
          }
        }

        // Remove last paragraph if it is typical closing advice or signature
        if (paragraphs.length > 0) {
          let checkLast = true;
          while (checkLast && paragraphs.length > 0) {
            const el = paragraphs[paragraphs.length - 1];
            const text = el.textContent?.trim().toLowerCase() || "";
            if (!text) {
              el.remove();
              paragraphs.pop();
              continue;
            }
            if (el.tagName === "P" && (
              text.startsWith("j'espère que") ||
              text.startsWith("n'hésitez pas") ||
              text.startsWith("bon courage") ||
              text.startsWith("conseil") ||
              text.startsWith("conseils") ||
              text.startsWith("recommandation") ||
              text.startsWith("note :") ||
              text.startsWith("remarque :") ||
              text.startsWith("cordialement") ||
              text.startsWith("en espérant") ||
              text.startsWith("si vous avez") ||
              text.startsWith("bonne préparation") ||
              text.startsWith("à bientôt")
            )) {
              el.remove();
              paragraphs.pop();
            } else {
              checkLast = false;
            }
          }
        }
      }

      // 5. Create header HTML matching app theme
      const headerHtml = pdfIncludeBrandHeader ? `
        <div class="print-header-banner" style="border: 2px solid ${theme.hex};">
          <div class="print-header-left">
            ${pdfIncludeAvatar ? `<img src="${BOT_PHOTO_URL}" class="print-avatar" style="border-color: ${theme.hex};" />` : ""}
            <div class="print-header-brand">
              <span class="print-brand-name" style="color: ${theme.hex};">MONSIEUR FABRICEL</span>
              <h1 class="print-doc-type">${finalDocType}</h1>
              <span class="print-brand-subtitle">Assistant Pédagogique d'Excellence</span>
            </div>
          </div>
          <div class="print-header-meta">
            <div class="print-meta-line"><strong>Matière:</strong> <span class="print-meta-badge" style="background-color: ${theme.hex}15; color: ${theme.hex};">${finalSubject}</span></div>
            <div class="print-meta-line"><strong>Classe:</strong> <span class="print-meta-badge" style="background-color: ${theme.hex}15; color: ${theme.hex};">${finalGrade}</span></div>
            <div class="print-meta-date">Fiche générée le ${new Date().toLocaleDateString("fr-FR")}</div>
          </div>
        </div>
      ` : `
        <div class="print-header-banner" style="border-bottom: 2px solid ${theme.hex}; border-radius: 0; background: transparent; padding: 12px 0 16px 0; margin-bottom: 20px;">
          <div class="print-header-left" style="flex: 1;">
            <div class="print-header-brand">
              <h1 class="print-doc-type" style="font-size: 22px; margin: 0;">${finalDocType}</h1>
              <span class="print-brand-subtitle" style="font-size: 11px; margin-top: 4px;">Fiche générée le ${new Date().toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
          <div class="print-header-meta" style="width: auto;">
            <div class="print-meta-line"><strong>Matière:</strong> <span class="print-meta-badge" style="background-color: ${theme.hex}15; color: ${theme.hex}; font-size: 12px;">${finalSubject}</span></div>
            <div class="print-meta-line" style="margin-top: 4px;"><strong>Classe:</strong> <span class="print-meta-badge" style="background-color: ${theme.hex}15; color: ${theme.hex}; font-size: 12px;">${finalGrade}</span></div>
          </div>
        </div>
      `;

      // 6. Create A4 Footer
      const footerHtml = pdfIncludeBrandFooter ? `
        <div class="print-footer">
          <div class="print-footer-contact">Monsieur FABRICEL - Assistant Pédagogique d'Excellence  |  Toamasina, Madagascar</div>
          <div class="print-footer-contact">Contact: +261 38 07 709 73  |  fabricel534@gmail.com</div>
        </div>
      ` : `
        <div class="print-footer" style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 10px;">
          <div class="print-footer-contact">Support d'activités - ${finalDocType}</div>
          <div class="print-footer-contact">Fiche pédagogique</div>
        </div>
      `;

      // 7. Watermark element if checked
      const watermarkHtml = (pdfEnableWatermark && pdfIncludeBrandHeader) ? `
        <div class="print-watermark">
          <span>MONSIEUR FABRICEL</span>
        </div>
      ` : "";

      // 8. Style for print window
      const stylesHtml = `
        <style>
          @media print {
            body * {
              visibility: hidden !important;
            }
            #print-section, #print-section * {
              visibility: visible !important;
            }
            #print-section {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              color: #1e293b !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            @page {
              size: A4;
              margin: 20mm 15mm 20mm 15mm;
            }
          }

          #print-section {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1e293b;
            line-height: 1.6;
            font-size: 14px;
            background: white;
            padding: 10px;
          }

          .print-header-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            margin-bottom: 24px;
            border-radius: 12px;
            background-color: #f8fafc;
            box-sizing: border-box;
            width: 100%;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-header-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .print-avatar {
            width: 60px;
            height: 60px;
            border-radius: 9999px;
            border: 2px solid;
            object-fit: cover;
          }
          .print-header-brand {
            display: flex;
            flex-direction: column;
          }
          .print-brand-name {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1.5px;
          }
          .print-doc-type {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            margin: 4px 0;
            line-height: 1.2;
          }
          .print-brand-subtitle {
            font-size: 11px;
            color: #64748b;
          }
          .print-header-meta {
            text-align: right;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .print-meta-line {
            font-size: 12px;
            color: #334155;
          }
          .print-meta-badge {
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 11px;
          }
          .print-meta-date {
            font-size: 10px;
            color: #94a3b8;
            font-style: italic;
          }

          .print-footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #94a3b8;
            font-size: 9px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-footer-contact {
            font-weight: 500;
          }

          .print-watermark {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: -1;
            opacity: 0.05;
            overflow: hidden;
          }
          .print-watermark span {
            font-size: 60px;
            font-weight: 900;
            color: #475569;
            transform: rotate(-32deg);
            letter-spacing: 5px;
            white-space: nowrap;
          }

          .print-content {
            color: #1e293b !important;
            width: 100% !important;
            background: transparent !important;
          }
          .print-content .prose {
            max-width: 100% !important;
            color: #1e293b !important;
          }
          .print-content p {
            color: #1e293b !important;
            margin-bottom: 12px !important;
            line-height: 1.6 !important;
          }
          
          .print-content h1, .print-content h2, .print-content h3, .print-content h4 {
            color: ${theme.hex} !important;
            font-weight: 700 !important;
            line-height: 1.3 !important;
            break-after: avoid;
            page-break-after: avoid;
            margin-top: 1.5em !important;
            margin-bottom: 0.6em !important;
          }
          .print-content h1 { font-size: 20px !important; }
          .print-content h2 { font-size: 16px !important; }
          .print-content h3 { font-size: 14px !important; }

          .print-content table, 
          .print-content .mermaid, 
          .print-content .katex-display, 
          .print-content blockquote, 
          .print-content pre,
          .print-content li,
          .print-content .math-block {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-content table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 16px 0 !important;
            font-size: 12px !important;
          }
          .print-content th, .print-content td {
            border: 1px solid #cbd5e1 !important;
            padding: 8px 10px !important;
            text-align: left !important;
            color: #1e293b !important;
            background: transparent !important;
          }
          .print-content th {
            background-color: #f1f5f9 !important;
            font-weight: 700 !important;
          }

          .print-content ul {
            list-style-type: disc !important;
            margin-left: 20px !important;
            padding-left: 0 !important;
            margin-bottom: 12px !important;
          }
          .print-content ol {
            list-style-type: decimal !important;
            margin-left: 20px !important;
            padding-left: 0 !important;
            margin-bottom: 12px !important;
          }
          .print-content li {
            margin-bottom: 4px !important;
            display: list-item !important;
            color: #1e293b !important;
          }

          .print-content svg {
            max-width: 100% !important;
            height: auto !important;
          }
          
          .text-white {
            color: #1e293b !important;
          }
        </style>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      `;

      // 9. Assemble everything inside print-section
      printSection.innerHTML = `
        ${stylesHtml}
        ${watermarkHtml}
        <div style="max-width: 800px; margin: 0 auto; padding: 10px; box-sizing: border-box;">
          ${headerHtml}
          <div class="print-content">
            ${contentClone.innerHTML}
          </div>
          ${footerHtml}
        </div>
      `;

      // 10. Append printSection temporarily to body
      document.body.appendChild(printSection);

      // 11. Custom brief timeout before triggering native print
      setTimeout(() => {
        window.print();
        if (printSection) {
          document.body.removeChild(printSection);
        }
        setIsGeneratingPDF(false);
        setIsConfigModalOpen(false);
      }, 500);

    } catch (error) {
      console.error("Impression Directe Error:", error);
      setIsGeneratingPDF(false);
    }
  };

  const handleExportAction = () => {
    if (exportType === "print") {
      printDiscussionMessage();
    } else if (exportType === "docx") {
      downloadAsDOCX();
    } else if (exportType === "tex") {
      downloadAsLaTeX();
    } else if (exportType === "drive") {
      setIsConfigModalOpen(false);
      setIsDriveModalOpen(true);
    } else {
      downloadAsPDF();
    }
  };

  const downloadAsLaTeX = () => {
    setIsGeneratingPDF(true);
    setDownloadedDocxInfo(null);
    setDownloadedPdfInfo(null);
    const finalDocType = pdfDocType === "Autre" ? (customDocType.trim() || "Fiche Pédagogique") : pdfDocType;
    const finalSubject = pdfSubject === "Autre" ? (customSubject.trim() || "Multi-disciplines") : pdfSubject;
    const finalGrade = pdfGrade === "Autre" ? (customGrade.trim() || "Enseignement Général") : pdfGrade;

    const exportText = pdfStripFiller ? stripConversationalFiller(message.text) : message.text;

    try {
      downloadAsLaTeXFile(exportText, {
        title: finalDocType,
        subject: finalSubject,
        grade: finalGrade,
      });
      setIsGeneratingPDF(false);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error("LaTeX Export Error:", error);
      setIsGeneratingPDF(false);
    }
  };

  const downloadAsDOCX = async () => {
    setIsGeneratingPDF(true);
    setDownloadedDocxInfo(null);
    setDownloadedPdfInfo(null);
    const finalDocType = pdfDocType === "Autre" ? (customDocType.trim() || "Fiche Pédagogique") : pdfDocType;
    const finalSubject = pdfSubject === "Autre" ? (customSubject.trim() || "Multi-disciplines") : pdfSubject;
    const finalGrade = pdfGrade === "Autre" ? (customGrade.trim() || "Enseignement Général") : pdfGrade;

    const exportText = pdfStripFiller ? stripConversationalFiller(message.text) : message.text;

    try {
      const result = await downloadMessageAsDOCX(exportText, theme.hex, {
        finalDocType,
        finalSubject,
        finalGrade,
        finalIncludeAvatar: pdfIncludeAvatar,
        finalIncludeBrandHeader: pdfIncludeBrandHeader,
        finalIncludeBrandFooter: pdfIncludeBrandFooter,
      });
      setDownloadedDocxInfo(result);
      setIsGeneratingPDF(false);
    } catch (error) {
      console.error("Word Generation Error:", error);
      setIsGeneratingPDF(false);
    }
  };

  const downloadAsPDF = async () => {
    setIsGeneratingPDF(true);
    setDownloadedPdfInfo(null);
    setDownloadedDocxInfo(null);
    const finalDocType = pdfDocType === "Autre" ? (customDocType.trim() || "Fiche Pédagogique") : pdfDocType;
    const finalSubject = pdfSubject === "Autre" ? (customSubject.trim() || "Multi-disciplines") : pdfSubject;
    const finalGrade = pdfGrade === "Autre" ? (customGrade.trim() || "Enseignement Général") : pdfGrade;

    const exportText = pdfStripFiller ? stripConversationalFiller(message.text) : message.text;

    try {
      const result = await downloadMessageAsPDF(exportText, theme.hex, {
        finalDocType,
        finalSubject,
        finalGrade,
        finalIncludeAvatar: pdfIncludeAvatar,
        pdfEnableWatermark,
        pdfIncludeBrandHeader,
        pdfIncludeBrandFooter,
      });
      setDownloadedPdfInfo(result);
      if (onPDFDownloaded) {
        onPDFDownloaded({
          filename: result.filename,
          messageText: exportText,
          themeHex: theme.hex,
          config: {
            finalDocType,
            finalSubject,
            finalGrade,
            finalIncludeAvatar: pdfIncludeAvatar,
            pdfEnableWatermark,
            pdfIncludeBrandHeader,
            pdfIncludeBrandFooter,
            pdfStripFiller
          }
        });
      }
      setIsGeneratingPDF(false);
      return; // Clean short-circuit preventing any legacy html2canvas/jsPDF code path
    } catch (error) {
      console.error("PDF Generation Error:", error);
      setIsGeneratingPDF(false);
      return;
    }

    try {
      const finalIncludeAvatar = true;
      const jsPDF: any = null;
      const element = messageRef.current;
      
      // Create a temporary container for PDF rendering to ensure high quality and correct width
      const printContainer = document.createElement('div');
      printContainer.id = 'pdf-print-container';
      printContainer.style.position = 'fixed';
      printContainer.style.left = '0';
      printContainer.style.top = '0';
      printContainer.style.zIndex = '-9999';
      printContainer.style.width = '800px'; // Set to 800px for robust mobile rendering and page scaling
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
            font-size: 15px !important;
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
          
          /* Apply standard fonts only to non-math elements. IMPORTANT: DO NOT override .katex elements! */
          body, p, div:not(.katex *), h1, h2, h3, h4, li:not(.katex *) {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            letter-spacing: 0.1px !important;
            word-spacing: 0.5px !important;
          }

          /* General styling resets to override OKLCH colors, which crash html2canvas styling */
          :root, * {
            --background: #ffffff !important;
            --foreground: #000000 !important;
            --tw-prose-body: #1e293b !important;
            --tw-prose-headings: ${theme.hex} !important;
            --tw-prose-links: ${theme.hex} !important;
            --tw-prose-bold: #0f172a !important;
            --tw-prose-counters: #475569 !important;
            --tw-prose-bullets: #94a3b8 !important;
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

          /* Extremely robust KaTeX Integration: Preserve standard math rendering styles and special fonts */
          .katex-mathml {
            display: none !important;
          }
          .katex-html {
            display: inline-block !important;
          }
          .katex {
            font-size: 1.1em !important;
            line-height: normal !important;
            text-rendering: auto !important;
          }
          .katex-display {
            display: block !important;
            margin: 1.2em 0 !important;
            text-align: center !important;
            width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding: 4px 0 !important;
          }
          /* Ensure we do NOT apply inline-block or Arial overrides to KaTeX children and force their native math fonts */
          .katex, .katex * {
            font-family: KaTeX_Main, KaTeX_Math, KaTeX_Size1, KaTeX_Size2, KaTeX_Size3, KaTeX_Size4, KaTeX_Caligraphic, KaTeX_Size5, KaTeX_SansSerif, KaTeX_Script, KaTeX_Typewriter, serif !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            font-style: normal !important;
          }

          /* Clean, spacious and professional Prose typography */
          .prose {
            color: #1e293b !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .prose p {
            margin-top: 0 !important;
            margin-bottom: 12px !important;
            line-height: 1.6 !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            text-align: justify !important;
          }
          .prose h1, .prose h2, .prose h3, .prose h4 {
            color: ${theme.hex} !important;
            font-weight: 700 !important;
            margin-top: 1.5em !important;
            margin-bottom: 0.6em !important;
            line-height: 1.3 !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
          
          /* Re-establish high quality lists because Tailwind typography collapses them */
          .prose ul, .prose ol {
            margin-top: 8px !important;
            margin-bottom: 16px !important;
            padding-left: 12px !important;
            width: 100% !important;
            display: block !important;
          }
          .prose li {
            margin-bottom: 6px !important;
            line-height: 1.6 !important;
            display: block !important; /* Extremely stable, prevents standard marker offset issues */
            list-style: none !important; /* Rely entirely on visual prepended prefix icons */
            color: #1e293b !important;
          }
          .prose li li {
            margin-left: 20px !important; /* Indent sublists beautifully */
          }
          .prose strong {
            color: ${theme.hex} !important;
            font-weight: 700 !important;
          }

          /* Improved table styling for PDF structure */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 20px 0 !important;
            table-layout: auto !important;
            font-size: 13px !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 8px 10px !important;
            text-align: left !important;
            word-break: break-word !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: 700 !important;
          }

          /* Ensure Mermaid diagrams fit horizontally */
          .mermaid svg {
            max-width: 100% !important;
            height: auto !important;
          }

          /* Avoid partial splitting of key blocks */
          .mermaid-container, tr, pre, blockquote, .katex-display, h1, h2, h3, h4 {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          * {
            color-scheme: light !important;
            -webkit-print-color-adjust: exact !important;
          }
        </style>
        <div style="display: flex; align-items: center; justify-content: space-between; border: 2px solid ${theme.hex}; padding: 18px; margin-bottom: 25px; border-radius: 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; box-sizing: border-box; width: 100%; overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${finalIncludeAvatar ? `<img src="${BOT_PHOTO_URL}" style="width: 65px; height: 65px; border-radius: 9999px; border: 2.5px solid ${theme.hex}; object-fit: cover; display: block;" crossOrigin="anonymous" />` : ''}
            <div>
              <div style="color: ${theme.hex}; font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 3px; font-family: inherit;">Monsieur FABRICEL</div>
              <div style="font-size: 20px; font-weight: 800; color: #011627; margin-bottom: 3px; line-height: 1.1; font-family: inherit;">${finalDocType}</div>
              <div style="font-size: 11px; color: #64748b; font-weight: 500; font-family: inherit;">Assistant Pédagogique d'Excellence</div>
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; gap: 5px; font-family: inherit;">
            <div style="font-size: 12px; color: #334155;"><strong style="font-family: inherit;">Matière :</strong> <span style="background-color: ${theme.hex}15; color: ${theme.hex}; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; font-family: inherit;">${finalSubject}</span></div>
            <div style="font-size: 12px; color: #334155;"><strong style="font-family: inherit;">Classe :</strong> <span style="background-color: ${theme.hex}15; color: ${theme.hex}; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; font-family: inherit;">${finalGrade}</span></div>
            <div style="font-size: 10px; color: #94a3b8; font-style: italic; margin-top: 2px; font-family: inherit;">Fiche générée le ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
      `;
      printContainer.appendChild(header);

      // Clone the message content
      const contentClone = element.cloneNode(true) as HTMLElement;
      
      // Remove copy/download buttons and other interactive UI widgets from the printed element
      const buttons = contentClone.querySelector('.flex.items-center.gap-1.mt-2');
      if (buttons) buttons.remove();
      
      contentClone.querySelectorAll('button').forEach((b: any) => b.remove());
      contentClone.querySelectorAll('.zoom-controls, .copy-button, .transform-controls, .zoom-slider-container, .interactive-controls').forEach((el: any) => el.remove());

      // Manually prefix lists with colored numbers and bullet symbols to guarantee consistent rendering in html2canvas
      const listItems = contentClone.querySelectorAll('li');
      listItems.forEach((li) => {
        const parent = li.parentElement;
        if (!parent) return;
        
        if (parent.tagName.toLowerCase() === 'ol') {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(li) + 1;
          const prefix = document.createElement('span');
          prefix.style.fontWeight = '700';
          prefix.style.marginRight = '8px';
          prefix.style.color = theme.hex;
          prefix.textContent = `${index}. `;
          li.prepend(prefix);
        } else if (parent.tagName.toLowerCase() === 'ul') {
          const prefix = document.createElement('span');
          prefix.style.marginRight = '8px';
          prefix.style.color = theme.hex;
          prefix.style.fontWeight = '900';
          prefix.textContent = '• ';
          li.prepend(prefix);
        }
      });
      
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

            // En-tête de page courante (running header) de qualité pour les pages consécutives
            if (i > 1) {
              try {
                doc.setFont('Helvetica', 'Bold');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139); // slate-500
                doc.text("Monsieur FABRICEL - Assistant Pédagogique d'Excellence", 30, 25);
                
                doc.setFont('Helvetica', 'Normal');
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184); // slate-400
                doc.text(finalDocType, pdfWidth - 30, 25, { align: 'right' });

                doc.setDrawColor(226, 232, 240); // slate-200 border
                doc.setLineWidth(1);
                doc.line(30, 31, pdfWidth - 30, 31);
              } catch (err) {
                console.warn("Could not render top running header:", err);
              }
            }

            // Watermark (Filigrane) transparent en diagonale (si activé)
            if (pdfEnableWatermark) {
              try {
                doc.setFont('Helvetica', 'Bold');
                doc.setFontSize(38);
                // Set text color to a soft, almost invisible gray for printers
                doc.setTextColor(244, 244, 244);
                // Draw diagonal text centered on A4 page
                doc.text("Monsieur FABRICEL", pdfWidth / 2, pdfHeight / 2, { align: 'center', angle: -32 });
              } catch (err) {
                console.warn("Could not render rotated watermark:", err);
              }
            }

            // Bas de page (Footer) - Ligne séparatrice
            doc.setDrawColor(226, 232, 240); // slate-200 border
            doc.setLineWidth(1);
            doc.line(30, pdfHeight - 45, pdfWidth - 30, pdfHeight - 45);

            // Infos admin à gauche (Contacts & Profil de Monsieur FABRICEL)
            doc.setFont('Helvetica', 'Bold');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text("Monsieur FABRICEL - Assistant Pédagogique Intelligent", 30, pdfHeight - 33);
            doc.setFont('Helvetica', 'Normal');
            doc.setFontSize(7);
            doc.text("Contact Rapide : +261 38 07 709 73  |  fabricel534@gmail.com  |  Toamasina, Madagascar", 30, pdfHeight - 22);

            // Numéro de page à droite
            doc.setFont('Helvetica', 'Bold');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105); // slate-600
            doc.text(`Page ${i} de ${totalPages}`, pdfWidth - 30, pdfHeight - 33, { align: 'right' });
            doc.setFont('Helvetica', 'Normal');
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text(finalDocType, pdfWidth - 30, pdfHeight - 22, { align: 'right' });
          }
          
          const safeSubjectLabel = finalSubject.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9]/gi, '_');
          
          const safeTypeLabel = finalDocType.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9]/gi, '_');

          doc.save(`document-fabricel-${safeTypeLabel}-${safeSubjectLabel}-${Date.now().toString().slice(-6)}.pdf`);
          document.body.removeChild(printContainer);
          setIsGeneratingPDF(false);
          setIsConfigModalOpen(false);
        },
        x: 0,
        y: 0,
        margin: [45, 30, 50, 30],
        width: pdfWidth - 60, 
        windowWidth: 800,
        autoPaging: 'text',
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          logging: false,
          width: 800,
          windowWidth: 800,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            // Remove duplicate MathML tags (stops superposition of symbols)
            clonedDoc.querySelectorAll('.katex-mathml').forEach((el: any) => el.remove());

            // Inject absolute CDN URLs for KaTeX fonts to ensure standard math symbols like minus, less-than-or-equal, etc.
            // render beautifully inside html2canvas's sandboxed environment without failing due to CORS/relative paths
            try {
              const katexFontsStyle = clonedDoc.createElement('style');
              katexFontsStyle.textContent = `
                @font-face {
                  font-family: 'KaTeX_Main';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Main-Regular.woff2') format('woff2');
                  font-weight: normal;
                  font-style: normal;
                }
                @font-face {
                  font-family: 'KaTeX_Main';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Main-Bold.woff2') format('woff2');
                  font-weight: bold;
                  font-style: normal;
                }
                @font-face {
                  font-family: 'KaTeX_Math';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Math-Italic.woff2') format('woff2');
                  font-weight: normal;
                  font-style: italic;
                }
                @font-face {
                  font-family: 'KaTeX_Math';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Math-BoldItalic.woff2') format('woff2');
                  font-weight: bold;
                  font-style: italic;
                }
                @font-face {
                  font-family: 'KaTeX_Size1';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Size1-Regular.woff2') format('woff2');
                }
                @font-face {
                  font-family: 'KaTeX_Size2';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Size2-Regular.woff2') format('woff2');
                }
                @font-face {
                  font-family: 'KaTeX_Size3';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Size3-Regular.woff2') format('woff2');
                }
                @font-face {
                  font-family: 'KaTeX_Size4';
                  src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Size4-Regular.woff2') format('woff2');
                }
                
                /* Override any fallback overrides to force native KaTeX fonts for formula glyphs */
                .katex, .katex * {
                  font-family: KaTeX_Main, KaTeX_Math, KaTeX_Size1, KaTeX_Size2, KaTeX_Size3, KaTeX_Size4, serif !important;
                  letter-spacing: normal !important;
                  word-spacing: normal !important;
                }
              `;
              clonedDoc.head.appendChild(katexFontsStyle);
            } catch (e) {
              console.warn("Could not inject KaTeX CDN fonts into cloned document:", e);
            }

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
            const scripts = Array.from(clonedDoc.getElementsByTagName('script')) as any[];
            scripts.forEach(s => s.remove());
            
            const iframes = Array.from(clonedDoc.getElementsByTagName('iframe')) as any[];
            iframes.forEach(f => f.remove());

            const metas = Array.from(clonedDoc.getElementsByTagName('meta')) as any[];
            metas.forEach(m => m.remove());

            // 0.1 We keep external stylesheets but will try to override problematic variables
            // Removing them causes the layout to break completely
            // We specifically want to ensure KaTeX styles are preserved
            
            // 1. Aggressive removal of modern CSS from all style tags in head and body
            const styleTags = Array.from(clonedDoc.getElementsByTagName('style')) as any[];
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
            clonedDoc.documentElement.style.width = '800px';
            clonedDoc.documentElement.style.maxWidth = '800px';
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
              const finalStyles = Array.from(clonedDoc.getElementsByTagName('style')) as any[];
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
              container.style.width = '800px';
              container.style.minWidth = '800px';
              container.style.maxWidth = '800px';
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
            const finalStyles = Array.from(clonedDoc.getElementsByTagName('style')) as any[];
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
        "flex flex-col group transition-all duration-300",
        isWideLayout ? "max-w-[95%] w-full" : "max-w-[85%]",
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
              rehypePlugins={[[rehypeKatex, { macros: KATEX_MACROS }]]}
              components={{
                h1: ({ children }) => <h1 className={cn("font-bold text-xl mb-4", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{replaceHtmlBreaks(children)}</h1>,
                h2: ({ children }) => <h2 className={cn("font-bold text-lg mb-3", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{replaceHtmlBreaks(children)}</h2>,
                h3: ({ children }) => <h3 className={cn("font-bold text-md mb-2", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{replaceHtmlBreaks(children)}</h3>,
                h4: ({ children }) => <h4 className={cn("font-bold text-sm mb-1", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{replaceHtmlBreaks(children)}</h4>,
                strong: ({ children }) => <strong className={cn("font-bold", isModel ? theme.text : "")} style={isModel ? theme.textStyle : {}}>{replaceHtmlBreaks(children)}</strong>,
                p: ({ children, ...props }: any) => <p className="mb-4" {...props}>{replaceHtmlBreaks(children)}</p>,
                li: ({ children, ...props }: any) => <li className="mb-1" {...props}>{replaceHtmlBreaks(children)}</li>,
                td: ({ children, ...props }: any) => <td {...props}>{replaceHtmlBreaks(children)}</td>,
                th: ({ children, ...props }: any) => <th {...props}>{replaceHtmlBreaks(children)}</th>,
                pre: ({ children, ...props }: any) => {
                  const isSpecial = React.Children.toArray(children).some((child: any) => {
                    if (child && typeof child === 'object' && child.props) {
                      const className = child.props.className || "";
                      return className.includes("language-svg") || className.includes("language-mermaid");
                    }
                    return false;
                  });
                  if (isSpecial) {
                    return <div className="not-prose my-4">{children}</div>;
                  }
                  return <pre {...props}>{children}</pre>;
                },
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
                  
                  const childrenStr = String(children);
                  const trimmedStr = childrenStr.trim();
                  const isSvgContent = trimmedStr.startsWith("<svg") || (trimmedStr.includes("<svg") && trimmedStr.includes("</svg>")) || trimmedStr.includes("<marker") || trimmedStr.includes("<circle") || trimmedStr.includes("<line") || trimmedStr.includes("<rect") || trimmedStr.includes("<polygon") || trimmedStr.includes("<path");
                  if (!inline && (language === "svg" || (isSvgContent && (language === "xml" || language === "html" || !language)))) {
                    const svgCode = normalizeSvgContent(childrenStr);
                    return <ZoomableSVG svgCode={svgCode} />;
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
                <div key={`att-${index}-${i}-${att.mimeType}-${att.data.length}`} className="max-w-[200px] rounded-xl overflow-hidden border border-slate-200/50 bg-white/10 backdrop-blur-sm">
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
                onClick={() => {
                  setDownloadedPdfInfo(null);
                  setDownloadedDocxInfo(null);
                  setIsConfigModalOpen(true);
                }}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {isGeneratingPDF ? "Génération..." : "Télécharger / Exporter"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-[10px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50/70 hover:bg-amber-100 border border-amber-200/80 rounded-lg shadow-2xs transition"
                onClick={() => setIsDriveModalOpen(true)}
                title="Exporter cette fiche directement vers Google Drive"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                <span>Google Drive</span>
              </Button>
            </div>
          )}
        </div>
        <span className="text-[10px] text-slate-400 mt-1 px-1">
          {isModel ? "Monsieur FABRICEL" : "Vous"}
        </span>
      </div>

      {/* Configurer la mise en page du PDF */}
      <AnimatePresence>
        {isConfigModalOpen && (
          <div key={`pdf-config-modal-backdrop-${index}`} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 text-slate-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-150 bg-slate-50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg text-white" style={{ backgroundColor: theme.hex }}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900">Mise en page PDF Professionnelle</h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">Configurez l'entête et le pied de page de votre fiche d'enseignement</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid Content - Flexible and Scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* Left Column: Form Parameters */}
                  <div className="md:col-span-6 space-y-4 text-left">
                    <div className="pb-1 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paramètres du Document</span>
                    </div>

                    {/* 1. Type de document */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>Type de document (Entête gauche)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Ex: Fiche de cours...</span>
                      </label>
                      <select
                        value={pdfDocType}
                        onChange={(e) => setPdfDocType(e.target.value)}
                        className="w-full px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500 text-slate-700 transition"
                      >
                        <option value="Fiche de préparation (Nouveau Programme d'Études)">Fiche de préparation (Nouveau Programme d'Études - MEN)</option>
                        <option value="Situation d'Apprentissage et d'Évaluation (SAE - APC)">Situation d'Apprentissage et d'Évaluation (SAE - APC)</option>
                        <option value="Fiche de préparation de leçon">Fiche de préparation de leçon (Classique)</option>
                        <option value="Fiche de cours / Résumé">Fiche de cours / Résumé</option>
                        <option value="Série d'exercices">Série d'exercices / TD</option>
                        <option value="Évaluation / Devoir de contrôle">Évaluation / Devoir de contrôle</option>
                        <option value="Sujet de composition">Sujet de composition / Examen</option>
                        <option value="Autre">Sauter / Saisir un titre personnalisé...</option>
                      </select>
                      
                      {pdfDocType === "Autre" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="pt-1"
                        >
                          <input
                            type="text"
                            placeholder="Ex: Devoir de Maison N°1"
                            value={customDocType}
                            onChange={(e) => setCustomDocType(e.target.value)}
                            className="w-full px-3 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-slate-50 focus:outline-none focus:border-stone-400 placeholder-slate-400 text-slate-800 animate-fade-in"
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* 2. Matière */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Matière / Discipline</label>
                      <select
                        value={pdfSubject}
                        onChange={(e) => setPdfSubject(e.target.value)}
                        className="w-full px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500 text-slate-700 transition"
                      >
                        <option value="Mathématiques">Mathématiques</option>
                        <option value="Sciences de la Vie et de la Terre (SVT)">Sciences de la Vie et de la Terre (SVT)</option>
                        <option value="Physique-Chimie">Physique-Chimie</option>
                        <option value="Français">Français</option>
                        <option value="Malagasy">Malagasy</option>
                        <option value="Anglais">Anglais</option>
                        <option value="Histoire-Géographie">Histoire-Géographie</option>
                        <option value="Philosophie">Philosophie</option>
                        <option value="Autre">Discipline personnalisée...</option>
                      </select>

                      {pdfSubject === "Autre" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="pt-1"
                        >
                          <input
                            type="text"
                            placeholder="Ex: Sciences Économiques & Sociales"
                            value={customSubject}
                            onChange={(e) => setCustomSubject(e.target.value)}
                            className="w-full px-3 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-slate-50 focus:outline-none focus:border-stone-400 placeholder-slate-400 text-slate-800 animate-fade-in"
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* 3. Classe */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Niveau / Classe d'études</label>
                      <select
                        value={pdfGrade}
                        onChange={(e) => setPdfGrade(e.target.value)}
                        className="w-full px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500 text-slate-700 transition"
                      >
                        <option value="Classe de Terminale D">Terminale D</option>
                        <option value="Classe de Terminale C">Terminale C</option>
                        <option value="Classe de Terminale A">Terminale A / OSE</option>
                        <option value="Classe de Première">Première (L / S / G)</option>
                        <option value="Classe de Seconde">Seconde</option>
                        <option value="Classe de Troisième">Troisième (3ème)</option>
                        <option value="Classe de Quatrième">Quatrième (4ème)</option>
                        <option value="Classe de Cinquième">Cinquième (5ème)</option>
                        <option value="Classe de Sixième">Sixième (6ème)</option>
                        <option value="Enseignement Primaire">Primaire (T1 à T5 / CEP)</option>
                        <option value="Autre">Classe personnalisée...</option>
                      </select>

                      {pdfGrade === "Autre" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="pt-1"
                        >
                          <input
                            type="text"
                            placeholder="Ex: Enseignement Supérieur (Licence)"
                            value={customGrade}
                            onChange={(e) => setCustomGrade(e.target.value)}
                            className="w-full px-3 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-slate-50 focus:outline-none focus:border-stone-400 placeholder-slate-400 text-slate-800 animate-fade-in"
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* Visuel Options */}
                    <div className="pt-2 border-t border-slate-100 space-y-2.5">
                      <span className="text-xs font-semibold text-slate-500 block">Paramètres et Contenu de la Fiche</span>
                      
                      {/* Brand Header Toggle */}
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={pdfIncludeBrandHeader}
                          onChange={(e) => setPdfIncludeBrandHeader(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition"
                        />
                        <div className="text-xs">
                          <span className="font-medium text-slate-800 block leading-tight">Présentation de "Monsieur FABRICEL"</span>
                          <span className="text-slate-400 text-[10px]">Grand bandeau de présentation avec le logo et sous-titre pédagogique</span>
                        </div>
                      </label>

                      {/* Strip convo filler toggle */}
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={pdfStripFiller}
                          onChange={(e) => setPdfStripFiller(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-850 block leading-tight flex items-center gap-1">
                            Contenu de la fiche uniquement 
                            <span className="bg-emerald-100 text-emerald-700 text-[7px] font-extrabold px-1.5 py-0.2 rounded">SANS CONSEILS DE FIN</span>
                          </span>
                          <span className="text-emerald-600 text-[10px] font-medium font-semibold">
                            Masque automatiquement les salutations d'intro et les conseils/remarques d'assistant tout à la fin
                          </span>
                        </div>
                      </label>

                      {/* Brand Footer Toggle */}
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={pdfIncludeBrandFooter}
                          onChange={(e) => setPdfIncludeBrandFooter(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition"
                        />
                        <div className="text-xs">
                          <span className="font-medium text-slate-800 block leading-tight">Coordonnées de contact (Pied de page)</span>
                          <span className="text-slate-400 text-[10px]">Affiche vos contacts rapides (téléphone, e-mail) à chaque bas de page</span>
                        </div>
                      </label>

                      {/* Watermark toggle */}
                      {pdfIncludeBrandHeader && (
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={pdfEnableWatermark}
                            onChange={(e) => setPdfEnableWatermark(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition"
                          />
                          <div className="text-xs">
                            <span className="font-medium text-slate-800 block leading-tight">Filigrane diagonal</span>
                            <span className="text-slate-400 text-[10px]">Arrière-plan de sécurité discret sur chaque page</span>
                          </div>
                        </label>
                      )}

                      {/* Profile/avatar toggle */}
                      {pdfIncludeBrandHeader && (
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={pdfIncludeAvatar}
                            onChange={(e) => setPdfIncludeAvatar(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition"
                          />
                          <div className="text-xs">
                            <span className="font-medium text-slate-800 block leading-tight">Photo de profil de l'assistant</span>
                            <span className="text-slate-400 text-[10px]">Affiche le portrait à gauche dans l'en-tête</span>
                          </div>
                        </label>
                      )}
                    </div>

                    {/* Mode d'Exportation */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <span className="text-xs font-semibold text-slate-500 block">Mode de Téléchargement / Exportation</span>
                      <div className="grid grid-cols-1 gap-2">
                        {/* Option 1: Direct Print */}
                        <label className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none text-left",
                          exportType === "print" ? "bg-emerald-50/50 border-emerald-500 animate-pulse-subtle" : "bg-slate-50 border-slate-200"
                        )}>
                          <input
                            type="radio"
                            name="exportType"
                            checked={exportType === "print"}
                            onChange={() => setExportType("print")}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <div className="text-[11px] leading-snug">
                            <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                              Impression Directe & Sauvegarder PDF
                              <span className="bg-emerald-100 text-emerald-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">RECOMMANDÉ</span>
                            </span>
                            <span className="text-slate-500 text-[10px] block mt-0.5">
                              Recopie 100% conforme des formules et schémas sans bug. Idéal sur téléphones, tablettes ou application de messagerie (WhatsApp, Facebook).
                            </span>
                          </div>
                        </label>

                        {/* Option 2: Download raw PDF file */}
                        <label className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none text-left",
                          exportType === "pdf" ? "bg-emerald-50/50 border-emerald-500" : "bg-slate-50 border-slate-200"
                        )}>
                          <input
                            type="radio"
                            name="exportType"
                            checked={exportType === "pdf"}
                            onChange={() => setExportType("pdf")}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <div className="text-[11px] leading-snug">
                            <span className="font-bold text-slate-800 block">Fichier PDF Interactif (.pdf)</span>
                            <span className="text-slate-500 text-[10px] block mt-0.5">
                              Modèle de compilation hors-ligne téléchargé directement. Moins compatible sur navigateurs mobiles.
                            </span>
                          </div>
                        </label>

                        {/* Option 3: Download editable Word file */}
                        <label className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none text-left",
                          exportType === "docx" ? "bg-emerald-50/50 border-emerald-500" : "bg-slate-50 border-slate-200"
                        )}>
                          <input
                            type="radio"
                            name="exportType"
                            checked={exportType === "docx"}
                            onChange={() => setExportType("docx")}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <div className="text-[11px] leading-snug">
                            <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                              Fichier Word Éditable (.doc)
                              <span className="bg-emerald-100 text-emerald-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">PRO</span>
                            </span>
                            <span className="text-slate-500 text-[10px] block mt-0.5">
                              Générez un vrai document entièrement modifiable. Idéal pour personnaliser l'exercice ou modifier le texte directement dans Word ou Google Docs.
                            </span>
                          </div>
                        </label>

                        {/* Option 4: Download ready-to-compile LaTeX source code */}
                        <label className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none text-left",
                          exportType === "tex" ? "bg-emerald-50/50 border-emerald-500" : "bg-slate-50 border-slate-200"
                        )}>
                          <input
                            type="radio"
                            name="exportType"
                            checked={exportType === "tex"}
                            onChange={() => setExportType("tex")}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <div className="text-[11px] leading-snug">
                            <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                              Code Source LaTeX (.tex)
                              <span className="bg-teal-100 text-teal-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">LATEX PUR</span>
                            </span>
                            <span className="text-slate-500 text-[10px] block mt-0.5">
                              Document source .tex pré-configuré (amsmath, babel, geometry). Prêt à être compilé dans Overleaf, TeXStudio ou VSCode.
                            </span>
                          </div>
                        </label>

                        {/* Option 5: Export directly to Google Drive */}
                        <label className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none text-left",
                          exportType === "drive" ? "bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20" : "bg-slate-50 border-slate-200"
                        )}>
                          <input
                            type="radio"
                            name="exportType"
                            checked={exportType === "drive"}
                            onChange={() => setExportType("drive")}
                            className="mt-0.5 text-amber-600 focus:ring-amber-500 shrink-0"
                          />
                          <div className="text-[11px] leading-snug">
                            <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                              Google Drive (Cloud Enseignant)
                              <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">GOOGLE DRIVE</span>
                            </span>
                            <span className="text-slate-500 text-[10px] block mt-0.5">
                              Sauvegardez directement dans votre Google Drive personnel (Google Docs modifiable, PDF ou Word) avec sélection de dossier via Google Picker.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Document Preview */}
                  <div className="md:col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-start">
                    {downloadedPdfInfo || downloadedDocxInfo ? (
                      <div className="flex-1 flex flex-col justify-between text-left p-2 h-full">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                              <Check className="w-6 h-6 stroke-[3px]" />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900 leading-snug">Document Prêt & Téléchargé !</h4>
                              <p className="text-[10px] text-slate-500 font-medium">Votre fichier {downloadedDocxInfo ? "Word (.doc) éditable" : "PDF"} a été compilé avec succès.</p>
                            </div>
                          </div>

                          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
                            <div className="flex items-start gap-2.5">
                              <FileIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Nom du Fichier</span>
                                <span className="text-xs font-bold text-slate-800 break-all">
                                  {downloadedDocxInfo ? downloadedDocxInfo.filename : downloadedPdfInfo?.filename}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Guide: Où trouver le fichier PDF ou Word */}
                          <div className="bg-amber-50/70 rounded-xl border border-amber-100 p-4 space-y-2.5 text-xs text-slate-700 animate-fadeIn">
                            <h5 className="font-bold text-slate-800 flex items-center gap-2 text-[11px]">
                              💡 Où se trouve votre fichier enregistré ?
                            </h5>
                            <div className="space-y-1.5 text-[10px] sm:text-[10.5px] leading-relaxed text-slate-600">
                              <p>
                                📥 **Sur Ordinateur :** Le fichier a été envoyé vers votre dossier de téléchargements habituel (dossier **Téléchargements** ou **Downloads**).
                              </p>
                              {downloadedDocxInfo && (
                                <p>
                                  📝 **Modification libre :** Double-cliquez sur le fichier pour l'ouvrir dans **Microsoft Word** ou **LibreOffice**, ou déposez-le dans **Google Docs** pour modifier entièrement le texte, les questions ou les tableaux à votre guise !
                                </p>
                              )}
                              <p>
                                📱 **Sur Mobile / Tablette (Android & iPhone) :**
                                Il s'enregistre dans la mémoire de votre appareil. Ouvrez l'application nommée <strong className="text-slate-800">"Fichiers"</strong>, <strong className="text-slate-800">"Mes Fichiers"</strong> ou <strong className="text-slate-800">"Files"</strong> de votre téléphone, puis accédez au dossier <strong className="text-slate-800">"Téléchargements"</strong> (Downloads).
                              </p>
                              <p>
                                💬 **Note Réseaux & Iframe (WhatsApp / Facebook) :**
                                Si vous êtes connecté depuis un navigateur de réseau social ou un iframe, les téléchargements automatiques peuvent être restreints. Utilisez les boutons ci-dessous pour forcer l'ouverture.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Special Mobile-Focused Helper Links */}
                        <div className="pt-4 space-y-2 border-t border-slate-200 mt-4">
                          <a
                            href={downloadedDocxInfo ? downloadedDocxInfo.docxUrl : downloadedPdfInfo?.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 p-3 text-xs font-bold text-white transition active:scale-[0.98] shadow-md cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Ouvrir & Partager {downloadedDocxInfo ? "(Fichier Modifiable)" : "(Recommandé sur Mobile)"}
                          </a>
                          
                          <a
                            href={downloadedDocxInfo ? downloadedDocxInfo.docxUrl : downloadedPdfInfo?.pdfUrl}
                            download={downloadedDocxInfo ? downloadedDocxInfo.filename : downloadedPdfInfo?.filename}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 p-3 text-xs font-bold text-slate-700 transition active:scale-[0.98] shadow-sm cursor-pointer"
                          >
                            <Download className="w-4 h-4 text-emerald-600" />
                            Forcer le téléchargement direct
                          </a>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                          <span>Aperçu de l'Impression A4</span>
                          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Format Professionnel</span>
                        </div>

                        {/* Interactive mini PDF page */}
                        <div className="bg-white shadow-lg border border-slate-150 rounded-lg p-4 relative aspect-[1/1.4] overflow-hidden select-none flex flex-col justify-between text-[8px] leading-tight text-slate-800 shrink-0">
                          
                          {/* Diagonal Watermark simulation */}
                          {pdfEnableWatermark && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
                              <span className="text-[11px] sm:text-[13px] font-bold text-slate-100/70 uppercase tracking-widest rotate-[-32deg] whitespace-nowrap">
                                Monsieur FABRICEL
                              </span>
                            </div>
                          )}

                          {/* Header block simulation */}
                          <div className="border border-slate-200 rounded-md p-2 bg-slate-50 flex items-center justify-between gap-1 z-10" style={{ borderColor: theme.hex }}>
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {pdfIncludeAvatar && (
                                <div className="w-6 h-6 rounded-full border border-slate-300 overflow-hidden shrink-0">
                                  <img src={BOT_PHOTO_URL} alt="Fabricel bot profile" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-[5px] tracking-wider text-slate-500 uppercase leading-none">MONSIEUR FABRICEL</div>
                                <div className="font-bold text-[8px] text-slate-900 truncate leading-tight">
                                  {pdfDocType === "Autre" ? (customDocType.trim() || "Fiche Pédagogique") : pdfDocType}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-[5px] text-slate-500 text-right shrink-0 space-y-0.5 pl-2 border-l border-slate-200">
                              <div>Matière : <span className="font-bold text-slate-800 line-clamp-1">{pdfSubject === "Autre" ? (customSubject.trim() || "Discipline") : pdfSubject}</span></div>
                              <div>Classe : <span className="font-bold text-slate-800 line-clamp-1">{pdfGrade === "Autre" ? (customGrade.trim() || "Classe") : pdfGrade}</span></div>
                            </div>
                          </div>

                          {/* Body sheet preview mockup */}
                          <div className="flex-1 my-3 flex flex-col gap-1.5 justify-center z-10 px-1 opacity-70">
                            <div className="h-1 w-11/12 bg-slate-200 rounded"></div>
                            <div className="h-1 w-full bg-slate-150 rounded"></div>
                            <div className="h-1 w-10/12 bg-slate-150 rounded"></div>
                            <div className="h-1 w-full bg-slate-150 rounded"></div>
                            <div className="h-1 w-8/12 bg-slate-200 rounded"></div>
                          </div>

                          {/* Footer block simulation */}
                          <div className="border-t border-slate-200 pt-1.5 text-[4.5px] leading-normal text-slate-400 flex items-center justify-between z-10 bg-white">
                            <div className="truncate pr-2 shrink min-w-0 max-w-[80%] font-medium">
                              Concepteur: Monsieur FABRICEL — Adr: Toamasina, Madagascar — Tél: +261 38 07 709 73
                            </div>
                            <div className="text-right shrink-0 text-slate-500 font-bold">Page 1 de 1</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>

              {/* Actions Footer - Fixed perfectly to the bottom */}
              <div className="flex items-center gap-2.5 justify-end px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-50 border-t border-slate-100 shrink-0">
                {downloadedPdfInfo ? (
                  <>
                    <a
                      href={downloadedPdfInfo.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 h-9 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-800 transition active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5 mr-2" />
                      Visualiser le PDF
                    </a>
                    <Button
                      onClick={() => setIsConfigModalOpen(false)}
                      className="h-9 px-4 text-xs font-bold text-white shadow-md active:scale-95 bg-emerald-600 hover:bg-emerald-700 transition"
                    >
                      Terminé
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsConfigModalOpen(false)}
                      className="h-9 px-4 text-xs font-semibold text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-colors"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleExportAction}
                      disabled={isGeneratingPDF}
                      className="h-9 px-4 text-xs font-bold text-white transition-all shadow-md active:scale-95 group hover:brightness-105"
                      style={{ backgroundColor: theme.hex }}
                    >
                      {isGeneratingPDF ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          Génération en cours...
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 mr-2 group-hover:translate-x-0.5 transition-transform" />
                          {exportType === "print" ? "Confirmer & Imprimer / Sauvegarder" : (exportType === "drive" ? "Continuer vers Google Drive" : "Confirmer & Télécharger")}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Google Drive Export Modal with Google Picker */}
      <GoogleDriveExportModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        messageText={message.text}
        theme={theme}
        defaultTitle={pdfDocType === "Autre" ? (customDocType.trim() || "Fiche_Pedagogique") : pdfDocType}
        defaultSubject={pdfSubject === "Autre" ? (customSubject.trim() || "Mathématiques") : pdfSubject}
        defaultGrade={pdfGrade === "Autre" ? (customGrade.trim() || "Enseignement Général") : pdfGrade}
        defaultDocType={pdfDocType === "Autre" ? customDocType : pdfDocType}
      />
    </motion.div>
  );
});

ChatMessage.displayName = "ChatMessage";

const QUICK_ACTIONS = [
  { 
    id: "lesson-plan", 
    label: "Fiche Nouveau Programme d'Études", 
    icon: BookOpen, 
    prompt: "Rédige une fiche de préparation pédagogique complète et détaillée conforme au Nouveau Programme d'Études du MEN Madagascar pour une classe de 3ème en Mathématiques sur le théorème de Thalès, avec situation-problème contextualisée à Madagascar, tableau des 6 étapes didactiques et évaluation formative critériée." 
  },
  { 
    id: "apc-situation", 
    label: "Situation-Problème APC (Madagascar)", 
    icon: Lightbulb, 
    prompt: "Conçois une situation-problème stimulante et signifiante ancrée dans la vie quotidienne à Madagascar (commerce ou agriculture) pour introduire les fractions en classe de 5ème selon le Nouveau Programme d'Études." 
  },
  { 
    id: "criteriated-exercises", 
    label: "Exercices critériés (C1, C2, C3)", 
    icon: FileText, 
    prompt: "Crée 3 exercices progressifs d'application et d'intégration avec grille d'évaluation critériée (Pertinence, Utilisation correcte des outils, Cohérence) pour une classe de 4ème en Physique-Chimie sur la masse volumique selon le Nouveau Programme du MEN." 
  },
  { 
    id: "exam-prep", 
    label: "Sujet type Examen officiel", 
    icon: GraduationCap, 
    prompt: "Génère une épreuve type d'examen officiel conforme aux nouvelles directives curriculaires du MEN Madagascar pour l'épreuve de SVT (niveau 3ème / BEPC), avec barème de notation détaillé point par point." 
  },
  { 
    id: "management", 
    label: "Grand effectif & APC locale", 
    icon: Users, 
    prompt: "Quels sont vos conseils didactiques et méthodologiques pour appliquer le Nouveau Programme d'Études dans une classe à grand effectif (plus de 50 élèves) avec peu de matériel dans un établissement à Madagascar ?" 
  },
  { 
    id: "remediation", 
    label: "Fiche de remédiation ciblée", 
    icon: ShieldCheck, 
    prompt: "Élabore une fiche d'activités de remédiation immédiate pour les apprenants en difficulté sur la factorisation et le calcul littéral en classe de 3ème selon le Nouveau Programme d'Études." 
  },
  { 
    id: "diagram", 
    label: "Schéma didactique bilingue", 
    icon: Lightbulb, 
    prompt: "Crée un schéma (Mermaid) expliquant le cycle de l'eau pour une classe de 6ème selon le nouveau curriculum, avec explications bilingues français et malgache." 
  },
];

const AuthView = ({ 
  onGoogleLogin, 
  onGuestLogin, 
  theme,
  authError
}: { 
  onGoogleLogin: () => void, 
  onGuestLogin: () => void, 
  theme: any,
  authError?: string | null
}) => {
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
        <div className="flex flex-col items-center mb-6">
          <div className={cn(theme.bg, "p-4 rounded-2xl shadow-lg mb-4")} style={theme.bgStyle}>
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Monsieur FABRICEL</h1>
          <p className="text-slate-500 text-center mt-2 text-sm">
            Assistant didactique conforme au <strong className="text-emerald-700 font-bold">Nouveau Programme d'Études</strong> (MEN Madagascar).
          </p>
        </div>

        {/* OPTION ACCÈS IMMÉDIAT SANS CONNEXION */}
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500/40 text-left shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Nouveau • Accès direct
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
              10 crédits offerts
            </span>
          </div>
          <p className="text-xs text-slate-700 font-medium mb-3 leading-relaxed">
            Accédez immédiatement à l'application sans créer de compte ni mot de passe pour générer vos fiches et exercices du Nouveau Programme d'Études.
          </p>
          <Button 
            type="button"
            onClick={onGuestLogin}
            className="w-full py-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Accéder directement sans se connecter</span>
          </Button>
          <div className="mt-2.5 flex items-center gap-2">
            <input 
              type="checkbox" 
              id="rememberGuest" 
              defaultChecked 
              onChange={(e) => {
                if (e.target.checked) {
                  localStorage.setItem('fabricel_direct_access', 'true');
                } else {
                  localStorage.removeItem('fabricel_direct_access');
                }
              }}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
            />
            <label htmlFor="rememberGuest" className="text-[11px] text-slate-600 cursor-pointer select-none font-medium">
              Mémoriser ce choix pour les prochaines visites
            </label>
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Ou se connecter avec un compte
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
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
          className="w-full mt-4 py-5 rounded-xl border-slate-200 flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          <span className="text-slate-700 font-medium text-sm">Continuer avec Google</span>
        </Button>

        {authError && (
          <div className="mt-3 p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200 flex items-start gap-2 text-left">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{authError}</p>
              <button 
                type="button" 
                onClick={onGuestLogin}
                className="mt-1 text-emerald-700 font-bold underline hover:text-emerald-800 block text-xs"
              >
                👉 Ou cliquer ici pour continuer directement sans mot de passe
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-left">
          <div className="flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Ouverture depuis WhatsApp ou Facebook ?</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Si la connexion est bloquée, appuyez sur les <strong className="text-amber-950">3 points (⋮)</strong> en haut à droite et choisissez <strong className="text-amber-950">"Ouvrir dans Chrome / Safari"</strong>.
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

  const toggleFreeMode = async (userId: string, isFreeUnlimited: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isFreeUnlimited: !isFreeUnlimited
      });
    } catch (error) {
      console.error("Error toggling free mode:", error);
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
              filteredUsers.map((u, uIdx) => (
                <div key={u.id ? `user-${u.id}-${uIdx}` : `user-idx-${uIdx}`} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 border border-slate-100 shrink-0">
                      <AvatarImage src={u.photoURL} />
                      <AvatarFallback className="bg-slate-100 text-slate-600">
                        {(u.displayName || u.email || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 truncate">{u.displayName || "Utilisateur sans nom"}</p>
                        {u.status === 'suspended' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5" /> Suspendu
                          </span>
                        )}
                        {u.isFreeUnlimited && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Gratuit (Illimité)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 break-all select-all">{u.email}</p>
                      {u.role !== 'admin' && (
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            onClick={() => toggleFreeMode(u.id, !!u.isFreeUnlimited)}
                            className={cn("text-[10px] uppercase tracking-wider font-bold hover:underline", theme.text)}
                            style={theme.textStyle}
                          >
                            Passer au {u.isFreeUnlimited ? "Mode Payant (Abonnement)" : "Mode Gratuit (Illimité)"}
                          </button>
                        </div>
                      )}
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
                        {u.role === 'admin' || u.isFreeUnlimited ? "∞" : (u.credits || 0)}
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
  const [showAllHistory, setShowAllHistory] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "model", 
      text: "Salama! Je suis Monsieur FABRICEL, enseignant de mathématiques et expert en Sciences de l'éducation. Comment puis-je vous accompagner dans vos pratiques pédagogiques aujourd'hui ?" 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Saved PDF Offline State
  const [savedPdfs, setSavedPdfs] = useState<SavedPDF[]>(() => {
    try {
      const stored = localStorage.getItem("saved_pdfs_list");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeOfflinePdf, setActiveOfflinePdf] = useState<SavedPDF | null>(null);
  const [isGeneratingSidebarPdf, setIsGeneratingSidebarPdf] = useState<string | null>(null);

  // Sync Saved PDFs with Firestore in real-time
  useEffect(() => {
    if (!user) {
      try {
        const stored = localStorage.getItem("saved_pdfs_list");
        setSavedPdfs(stored ? JSON.parse(stored) : []);
      } catch {
        setSavedPdfs([]);
      }
      return;
    }

    const q = query(
      collection(db, 'saved_pdfs'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pdfList: SavedPDF[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        pdfList.push({
          id: doc.id,
          userId: data.userId,
          filename: data.filename,
          messageText: data.messageText,
          themeHex: data.themeHex,
          config: data.config,
          createdAt: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : (data.createdAt || Date.now())
        } as SavedPDF);
      });
      // Sort desc by createdAt
      pdfList.sort((a, b) => b.createdAt - a.createdAt);
      setSavedPdfs(pdfList);
      
      try {
        localStorage.setItem("saved_pdfs_list", JSON.stringify(pdfList));
      } catch (err) {
        console.error("Local storage sync error:", err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'saved_pdfs');
    });

    return () => unsubscribe();
  }, [user]);

  const handlePDFDownloaded = useCallback(async (pdfData: Omit<SavedPDF, "id" | "createdAt" | "userId">) => {
    if (user) {
      try {
        const path = "saved_pdfs";
        await addDoc(collection(db, path), {
          userId: user.uid,
          filename: pdfData.filename,
          messageText: pdfData.messageText,
          themeHex: pdfData.themeHex,
          config: pdfData.config,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "saved_pdfs");
      }
    } else {
      setSavedPdfs(prev => {
        const exists = prev.some(p => p.filename === pdfData.filename);
        if (exists) return prev;
        
        const newPdf: SavedPDF = {
          ...pdfData,
          userId: "offline",
          id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now()
        };
        const updated = [...prev, newPdf];
        try {
          localStorage.setItem("saved_pdfs_list", JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
    }
  }, [user]);

  const handleDownloadSavedPDFDirect = async (pdf: SavedPDF) => {
    setIsGeneratingSidebarPdf(pdf.id);
    try {
      await downloadMessageAsPDF(pdf.messageText, pdf.themeHex, pdf.config);
    } catch (err) {
      console.error("Error regenerating PDF:", err);
    } finally {
      setIsGeneratingSidebarPdf(null);
    }
  };

  const handleDeleteSavedPDF = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (user && !id.startsWith("pdf_")) {
      try {
        await deleteDoc(doc(db, "saved_pdfs", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `saved_pdfs/${id}`);
      }
    } else {
      setSavedPdfs(prev => {
        const filtered = prev.filter(p => p.id !== id);
        try {
          localStorage.setItem("saved_pdfs_list", JSON.stringify(filtered));
        } catch (e) {
          console.error(e);
        }
        return filtered;
      });
    }

    if (activeOfflinePdf && activeOfflinePdf.id === id) {
      setActiveOfflinePdf(null);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getTimestampMs = useCallback((val: any): number => {
    if (!val) return 0;
    if (typeof val?.toMillis === 'function') return val.toMillis();
    if (typeof val?.toDate === 'function') return val.toDate().getTime();
    if (val?.seconds !== undefined) return val.seconds * 1000;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime();
    return 0;
  }, []);

  const [isWideLayout, setIsWideLayout] = useState<boolean>(() => {
    try {
      return localStorage.getItem("isWideLayout") === "true";
    } catch {
      return false;
    }
  });

  const toggleWideLayout = () => {
    const nextVal = !isWideLayout;
    setIsWideLayout(nextVal);
    try {
      localStorage.setItem("isWideLayout", String(nextVal));
    } catch (e) {
      console.error(e);
    }
  };

  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState(THEME_COLORS[0]);
  const [customHex, setCustomHex] = useState("#059669");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isOfficialPacksOpen, setIsOfficialPacksOpen] = useState(false);
  const [externalInputPrompt, setExternalInputPrompt] = useState<string>("");

  const [referralRewards, setReferralRewards] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'referral_rewards'), where('toUserId', '==', user.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setReferralRewards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      const errStr = error?.message || String(error);
      if (errStr.includes('unavailable') || errStr.includes('offline')) {
        console.warn("Referral rewards listen warning (operating offline):", error);
      } else {
        handleFirestoreError(error, OperationType.GET, 'referral_rewards');
      }
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
  const [isInstallBannerDismissed, setIsInstallBannerDismissed] = useState<boolean>(() => {
    return localStorage.getItem('fabricel-install-banner-dismissed') === 'true';
  });

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

  const handleGuestLogin = async () => {
    localStorage.setItem('fabricel_direct_access', 'true');
    localStorage.removeItem('fabricel_explicit_logout');

    try {
      await signInAnonymously(auth);
      return;
    } catch (e) {
      console.warn("Firebase anonymous auth skipped, using instant direct teacher session:", e);
    }

    const guestUser: any = {
      uid: 'guest-' + Math.random().toString(36).substring(2, 9),
      displayName: 'Enseignant (Accès Direct)',
      email: 'enseignant@fabricel.local',
      isAnonymous: true,
    };
    setUser(guestUser);
    setUserProfile({
      uid: guestUser.uid,
      displayName: 'Enseignant (Accès Direct)',
      email: guestUser.email,
      role: 'user',
      credits: 9999,
      createdAt: new Date(),
    });
    setMessages([
      { 
        role: "model", 
        text: "Salama ! Je suis **Monsieur FABRICEL**, votre assistant pédagogique de référence à Madagascar, 100% à jour avec le **Nouveau Programme d'Études** du Ministère de l'Éducation Nationale (MEN).\n\nVous êtes actuellement connecté en **Accès Direct Enseignant (100% Débloqué)**.\n\nQue souhaitez-vous préparer aujourd'hui ?\n- 📚 **Fiche de préparation de leçon** conforme au Nouveau Programme d'Études\n- 🎯 **Situation-problème contextualisée (APC)** pour votre cours\n- 📝 **Exercices progressifs avec barème et critères d'évaluation C1, C2, C3**\n- 🎓 **Préparation d'examen officiel (CEPE, BEPC, Baccalauréat)**\n\nN'hésitez pas à poser votre question ou utiliser une action rapide !" 
      }
    ]);
  };

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
    }, 2000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimeout);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsAuthLoading(false);
        setIsProfileLoading(true);
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial offline profile cache load
        try {
          const cachedProfile = localStorage.getItem(`fabricel-cached-profile-${firebaseUser.uid}`);
          if (cachedProfile) {
            setUserProfile(JSON.parse(cachedProfile));
          }
        } catch (e) {
          console.error("Failed to load cached user profile:", e);
        }
        
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
              email: firebaseUser.email || (firebaseUser.isAnonymous ? 'anonyme@fabricel.local' : 'user@fabricel.local'),
              displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Enseignant (Accès Direct)' : 'Enseignant'),
              photoURL: firebaseUser.photoURL,
              role: isAdmin ? 'admin' : 'user',
              credits: isAdmin ? 999999 : (firebaseUser.isAnonymous ? 9999 : (10 + bonus)),
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
            try {
              localStorage.setItem(`fabricel-cached-profile-${firebaseUser.uid}`, JSON.stringify(initialData));
            } catch (e) {
              console.error(e);
            }
          } else {
            const data = userSnap.data();
            setUserProfile(data);
            try {
              localStorage.setItem(`fabricel-cached-profile-${firebaseUser.uid}`, JSON.stringify(data));
            } catch (e) {
              console.error(e);
            }
          }
        } catch (error) {
          console.warn("Could not get initial user profile document, might be offline:", error);
        }
        setIsProfileLoading(false);

        // Real-time listener
        unsubProfile = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setUserProfile(data);
            try {
              localStorage.setItem(`fabricel-cached-profile-${firebaseUser.uid}`, JSON.stringify(data));
            } catch (e) {
              console.error(e);
            }
            
            // Migration: Add referral code if missing
            if (!data.referralCode) {
              const myRefCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              updateDoc(userRef, { referralCode: myRefCode }).catch(err => console.warn(err));
            }
          }
        }, (error) => {
          console.warn("Profile real-time listen warning (expected offline):", error);
        });
      } else {
        const explicitLogout = localStorage.getItem('fabricel_explicit_logout') === 'true';
        if (!explicitLogout) {
          handleGuestLogin();
        } else {
          setUser(null);
          setUserProfile(null);
          setChats([]);
          setCurrentChatId(null);
          setMessages([
            { 
              role: "model", 
              text: "Salama ! Je suis **Monsieur FABRICEL**, assistant pédagogique conforme au **Nouveau Programme d'Études** de Madagascar. Accédez directement sans mot de passe ou connectez-vous pour commencer !" 
            }
          ]);
        }
        setIsProfileLoading(false);
        setIsAuthLoading(false);
        if (unsubProfile) unsubProfile();
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

    // Load initial chats from offline cache if available to show immediately!
    try {
      const cachedChatsStr = localStorage.getItem(`fabricel-cached-chats-${user.uid}`);
      if (cachedChatsStr) {
        setChats(JSON.parse(cachedChatsStr));
      }
    } catch (err) {
      console.error("Failed to parse cached chats:", err);
    }

    // For local guest users, chats are handled entirely via local cache
    if (user.uid.startsWith('guest-')) {
      return;
    }

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
        const timeA = getTimestampMs(a.createdAt);
        const timeB = getTimestampMs(b.createdAt);
        return timeB - timeA;
      });
      setChats(chatList);

      // Save to cache
      try {
        localStorage.setItem(`fabricel-cached-chats-${user.uid}`, JSON.stringify(chatList));
      } catch (e) {
        console.error("Failed to cache chats:", e);
      }
    }, (error) => {
      console.warn("Chats firestore listen warning (expected offline): using existing cache state.", error);
    });

    return () => unsubscribe();
  }, [user, getTimestampMs]);

  // Fetch Messages for current chat
  useEffect(() => {
    if (!user || !currentChatId) return;

    userHasScrolledUpRef.current = false;

    // Reset messages state before loading to avoid displaying previous chat content
    if (currentChatId === "new") {
      setMessages([{ role: "model", text: "Salama! Nouvelle session démarrée. Comment puis-je vous aider ?" }]);
    } else {
      setMessages([]);
    }

    // Load initial messages from offline cache if available to show immediately!
    try {
      const cachedMsgsStr = localStorage.getItem(`fabricel-cached-msgs-${user.uid}-${currentChatId}`);
      if (cachedMsgsStr) {
        setMessages(JSON.parse(cachedMsgsStr));
      }
    } catch (err) {
      console.error("Failed to parse cached messages:", err);
    }

    // For local guest or local chats, messages are handled entirely via local cache
    if (user.uid.startsWith('guest-') || currentChatId.startsWith('guest-') || currentChatId.startsWith('local-')) {
      return;
    }

    const q = query(
      collection(db, 'chats', currentChatId, 'messages')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList: Message[] = [];
      snapshot.forEach((doc) => {
        msgList.push({ id: doc.id, ...(doc.data() as any) } as Message);
      });
      // Sort client-side by createdAt asc
      msgList.sort((a, b) => {
        const timeA = getTimestampMs((a as any).createdAt);
        const timeB = getTimestampMs((b as any).createdAt);
        return timeA - timeB;
      });
      
      setMessages(msgList);

      if (msgList.length > 0) {
        // Save to cache
        try {
          localStorage.setItem(`fabricel-cached-msgs-${user.uid}-${currentChatId}`, JSON.stringify(msgList));
        } catch (e) {
          console.error("Failed to cache messages:", e);
        }
      }
    }, (error) => {
      console.warn("Messages firestore listen warning (expected offline): using existing cache state.", error);
    });

    return () => unsubscribe();
  }, [user, currentChatId, getTimestampMs]);

  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }
    } catch (error: any) {
      console.warn("Login via popup encountered an issue:", error);
      const isCancelled = error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request';
      if (isCancelled) {
        setAuthError("La fenêtre Google a été fermée. Vous pouvez réessayer ou cliquer sur 'Accéder directement sans se connecter'.");
      } else if (error?.code === 'auth/popup-blocked') {
        setAuthError("La fenêtre de connexion a été bloquée par votre navigateur (souvent dans Facebook/WhatsApp). Utilisez l'Accès direct ou ouvrez dans Chrome.");
      } else {
        // Automatically activate Direct Mode so the teacher is NEVER blocked!
        await handleGuestLogin();
        setAuthError("Connexion directe activée avec succès pour vous permettre de travailler immédiatement sans être bloqué !");
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
      setCachedAccessToken(null);
      localStorage.setItem('fabricel_explicit_logout', 'true');
      localStorage.removeItem('fabricel_direct_access');
      if (user && !user.uid?.startsWith('guest-')) {
        await signOut(auth);
      }
      setUser(null);
      setUserProfile(null);
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
    if (!user || chatId.startsWith('guest-') || chatId.startsWith('local-')) return;
    const path = `chats/${chatId}/messages`;
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role,
        text,
        attachments: attachments || null,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path);
      } catch (e) {
        console.warn("Message sync to firestore warning:", e);
      }
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

    // Connection offline handler - Never block! Generate via local didactic engine
    if (!isOnline) {
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      const offlineDidacticText = generateDidacticFallback(text);
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            role: "model",
            text: offlineDidacticText
          }
        ]);
        setIsLoading(false);
      }, 300);
      return;
    }
    
    // Check credits if not admin or free unlimited mode
    const isAdmin = user?.email === "fabricel534@gmail.com" || userProfile?.role === 'admin';
    const isFreeUnlimited = userProfile?.isFreeUnlimited === true;
    const hasCredits = (userProfile?.credits || 0) > 0;

    if (user && !isAdmin && !isFreeUnlimited && !hasCredits && !isProfileLoading) {
      // Never block the teacher! Replenish evaluation credits with an informative toast/message
      const isGuestUser = user.uid.startsWith('guest-');
      const bonusCredits = 10;
      
      if (isGuestUser) {
        setUserProfile(prev => prev ? { ...prev, credits: bonusCredits } : null);
      } else {
        updateDoc(doc(db, 'users', user.uid), { credits: bonusCredits }).catch(err => console.warn(err));
        setUserProfile(prev => prev ? { ...prev, credits: bonusCredits } : null);
      }
      
      const welcomeBonusMsg = `🎁 **Recharge Pédagogique Automatique (+10 crédits offerts)**
      
Pour vous garantir une continuité de travail sans aucun blocage, **10 crédits pédagogiques** ont été automatiquement ajoutés à votre compte. Vous pouvez continuer à générer vos fiches et exercices !`;
      setMessages(prev => [...prev, { role: "model", text: welcomeBonusMsg }]);
    }

    // If not logged in, safety check
    if (!user) return;

    const isGuest = user.uid.startsWith('guest-');

    // Chat session handling
    let chatId = currentChatId;
    if (!isGuest && !chatId) {
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
        try {
          handleFirestoreError(error, OperationType.CREATE, 'chats');
        } catch (e) {
          console.warn("Chat session create warning:", e);
        }
        chatId = 'local-chat-' + Date.now();
        setCurrentChatId(chatId);
      }
    } else if (isGuest && !chatId) {
      chatId = 'guest-chat-' + Date.now();
      setCurrentChatId(chatId);
      const newGuestChat: ChatSession = {
        id: chatId,
        title: text.substring(0, 40) + (text.length > 40 ? "..." : ""),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setChats(prev => {
        const nextChats = [newGuestChat, ...prev];
        try {
          localStorage.setItem(`fabricel-cached-chats-${user.uid}`, JSON.stringify(nextChats));
        } catch (e) {}
        return nextChats;
      });
    }

    if (chatId) {
      if (!isGuest && !chatId.startsWith('local-')) {
        await saveMessage(chatId, "user", text, attachments);
      }
      if (isGuest) {
        try {
          const cachedStr = localStorage.getItem(`fabricel-cached-msgs-${user.uid}-${chatId}`);
          const cur = cachedStr ? JSON.parse(cachedStr) : messages;
          localStorage.setItem(`fabricel-cached-msgs-${user.uid}-${chatId}`, JSON.stringify([...cur, userMessage]));
        } catch (e) {}
      }
      
      // Deduct credit if not admin and not free unlimited
      if (!isAdmin && !isFreeUnlimited) {
        if (isGuest) {
          setUserProfile(prev => prev ? { ...prev, credits: Math.max(0, (prev.credits || 10) - 1) } : null);
        } else {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              credits: Math.max(0, (userProfile?.credits || 1) - 1)
            });
          } catch (error) {
            try {
              handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
            } catch (e) {
              console.warn("User credit update warning:", e);
            }
          }
        }
      }
    }

    setIsLoading(true);
    setStreamingText("");
    isStreamingRef.current = true;

    try {
      const stream = aiService.stream({
        messages: [...messages, userMessage],
      });
      let fullText = "";
      let lastUpdate = Date.now();
      
      for await (const chunk of stream) {
        if (!isStreamingRef.current) break;
        if (chunk.error) {
          throw new Error(chunk.error);
        }
        if (chunk.text) {
          fullText += chunk.text;
        }
        const now = Date.now();
        if (now - lastUpdate > 64) {
          setStreamingText(fullText);
          lastUpdate = now;
        }
      }
      
      if (isStreamingRef.current) {
        if (!isGuest && chatId) {
          await saveMessage(chatId, "model", fullText);
        }
        if (isGuest) {
          setMessages(prev => {
            const nextList = [...prev, { role: "model" as const, text: fullText }];
            if (chatId) {
              try {
                localStorage.setItem(`fabricel-cached-msgs-${user.uid}-${chatId}`, JSON.stringify(nextList));
              } catch (e) {}
            }
            return nextList;
          });
        }
      }
      setStreamingText("");
    } catch (error: any) {
      console.error("Chat error, engaging Didactic Resilience Fallback:", error);
      const fallbackDidactic = generateDidacticFallback(text);
      setMessages(prev => [...prev, { role: "model", text: fallbackDidactic }]);
    } finally {
      setIsLoading(false);
      isStreamingRef.current = false;
    }
  };

  const handleQuickAction = (prompt: string) => {
    setExternalInputPrompt(prompt);
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
    return <AuthView onGoogleLogin={handleLogin} onGuestLogin={handleGuestLogin} theme={themeStyles} authError={authError} />;
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
            key="sidebar-drawer"
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
                      <>
                        {(() => {
                          if (showAllHistory) {
                            return chats;
                          }
                          return chats.slice(0, 1);
                        })().map((chat, cIdx) => (
                          <button
                            key={chat.id ? `chat-${chat.id}-${cIdx}` : `chat-idx-${cIdx}`}
                            onClick={() => selectChat(chat.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left group animate-fadeIn",
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
                        ))}
                        
                        {chats.length > 1 && (
                          <button
                            onClick={() => setShowAllHistory(!showAllHistory)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-all",
                              themeStyles.text
                            )}
                            style={themeStyles.isCustom ? { color: themeStyles.hex } : {}}
                          >
                            <span className="flex items-center gap-1.5">
                              {showAllHistory ? "Voir moins" : `Voir tout (${chats.length})`}
                            </span>
                            {showAllHistory ? (
                              <ChevronUp className="w-4 h-4 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 shrink-0" />
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 px-2 italic">
                        Aucune discussion enregistrée.
                      </p>
                    )}
                    <Separator className="my-4 bg-slate-100" />
                  </div>
                )}

                {/* Documents PDF (Offline Reader / Direct Download) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <div className="flex items-center gap-2">
                      <FileIcon className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Documents PDF ({savedPdfs.length})
                      </p>
                    </div>
                  </div>
                  {savedPdfs.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {savedPdfs.map((pdf, pIdx) => (
                        <div 
                          key={pdf.id ? `pdf-${pdf.id}-${pIdx}` : `pdf-idx-${pIdx}`}
                          className="group relative flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition-all text-xs"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <FileIcon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-700 truncate" title={pdf.filename}>
                                {pdf.filename.replace("document-fabricel-", "").replace(".pdf", "").replace(/_/g, " ")}
                              </p>
                              <p className="text-[10px] text-slate-400 leading-snug truncate">
                                {pdf.config.finalDocType} • {pdf.config.finalSubject}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200/60 rounded-md transition-colors"
                              onClick={() => setActiveOfflinePdf(pdf)}
                              title="Consulter hors connexion"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isGeneratingSidebarPdf === pdf.id}
                              className={cn(
                                "h-6 w-6 text-slate-400 hover:text-emerald-600 hover:bg-white border border-transparent hover:border-slate-200/60 rounded-md transition-colors",
                                isGeneratingSidebarPdf === pdf.id && "animate-pulse"
                              )}
                              onClick={() => handleDownloadSavedPDFDirect(pdf)}
                              title="Télécharger à nouveau"
                            >
                              {isGeneratingSidebarPdf === pdf.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-white border border-transparent hover:border-slate-200/60 rounded-md transition-colors"
                              onClick={(e) => handleDeleteSavedPDF(pdf.id, e)}
                              title="Supprimer de la liste"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 text-center px-4 leading-normal italic">
                      Téléchargez un document pour l'ajouter ici pour une consultation hors connexion.
                    </div>
                  )}
                  <Separator className="my-4 bg-slate-100" />
                </div>

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
                  {QUICK_ACTIONS.map((action, aIdx) => (
                    <button
                      key={action.id ? `qa-${action.id}-${aIdx}` : `qa-idx-${aIdx}`}
                      onClick={() => handleQuickAction(action.prompt)}
                      className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                      style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                    >
                      <action.icon className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                      <span>{action.label}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setIsOfficialPacksOpen(true);
                      setIsSidebarOpen(false);
                    }}
                    className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 transition-all group text-left shadow-xs hover:bg-emerald-100/70")}
                  >
                    <BookOpen className="w-5 h-5 text-emerald-600 transition-colors shrink-0" />
                    <div className="flex flex-col">
                      <span>Programmes Officiels MEN</span>
                      <span className="text-[10px] text-emerald-600 font-normal">Packs PE, RAPE & FRP</span>
                    </div>
                  </button>

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

                  <a
                    href="/code-source-application.zip"
                    download="code-source-application.zip"
                    className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 transition-all group text-left", themeStyles.light.replace('bg-', 'hover:bg-'), themeStyles.text.replace('text-', 'hover:text-'))}
                    style={themeStyles.isCustom ? { backgroundColor: `${themeStyles.hex}15`, color: themeStyles.hex } : {}}
                  >
                    <Download className={cn("w-5 h-5 text-slate-400 transition-colors shrink-0", themeStyles.text.replace('text-', 'group-hover:text-'))} style={themeStyles.isCustom ? { color: themeStyles.hex } : {}} />
                    <div className="flex-1">
                      <span>Code source (.zip)</span>
                      <p className="text-[10px] opacity-60 leading-none">Télécharger le projet</p>
                    </div>
                  </a>

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
                            {user.email === "fabricel534@gmail.com" || userProfile?.role === 'admin' 
                              ? "Admin" 
                              : (userProfile?.isFreeUnlimited ? "Mode Gratuit" : "Mode Payant")}
                          </span>
                          <span className={cn("text-xs font-mono px-2 py-0.5 rounded", themeStyles.light, themeStyles.text)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>
                            {user.email === "fabricel534@gmail.com" || userProfile?.role === 'admin' || userProfile?.isFreeUnlimited
                              ? "ILLIMITÉ" 
                              : `${userProfile?.credits || 0} CRÉDITS`}
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
            <Badge variant="outline" className={cn("font-medium hidden md:inline-flex", themeStyles.light, themeStyles.text, themeStyles.border)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle, ...themeStyles.borderLightStyle }}>
              Accompagnateur & Encadreur
            </Badge>
            {!isOnline && (
              <Badge variant="outline" className="font-semibold bg-amber-50 text-amber-600 border-amber-200 flex items-center gap-1.5 animate-pulse">
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>Hors-ligne (Sauvegarde active)</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setIsOfficialPacksOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200 rounded-xl"
              title="Programmes d'Études (PE), RAPE et Fiches Ressources (FRP)"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>Programmes MEN</span>
            </Button>

            <a 
              href="https://drive.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-amber-900 bg-amber-50/90 hover:bg-amber-100 border border-amber-200/90 rounded-xl px-2.5 py-1.5 transition shadow-2xs"
              title="Ouvrir votre espace personnel Google Drive"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <span>Mon Drive</span>
            </a>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleWideLayout}
              className={cn("text-slate-400", themeStyles.text.replace('text-', 'hover:text-'))}
              title={isWideLayout ? "Réduire l'affichage (Vue centrée)" : "Agrandir l'affichage (Plein écran)"}
            >
              {isWideLayout ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </Button>

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
                  <p className="text-sm font-semibold">
                    {user.uid?.startsWith('guest-') ? "Mode Accès Direct" : (user.displayName || "Enseignant")}
                  </p>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      user.uid?.startsWith('guest-')
                        ? "bg-emerald-100 text-emerald-800"
                        : userProfile?.role === 'admin'
                          ? "bg-amber-100 text-amber-700"
                          : (userProfile?.isFreeUnlimited ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-100 text-slate-600")
                    )}>
                      {user.uid?.startsWith('guest-') ? "SANS MOT DE PASSE" : userProfile?.role === 'admin' ? "ADMIN" : (userProfile?.isFreeUnlimited ? "COMPTE GRATUIT" : "ENSEIGNANT")}
                    </span>
                    <p className="text-xs text-slate-500 font-medium">
                      {user.uid?.startsWith('guest-') ? `${userProfile?.credits || 0} crédits` : (userProfile?.role === 'admin' || userProfile?.isFreeUnlimited ? "∞ Crédits" : `${(userProfile?.credits || 0) * 100} Ar`)}
                    </p>
                  </div>
                </div>

                {user.uid?.startsWith('guest-') ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      localStorage.removeItem('fabricel_direct_access');
                      setUser(null);
                    }}
                    className="h-9 px-2.5 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shadow-sm"
                    title="Se connecter avec un compte"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden md:inline">Connexion</span>
                  </Button>
                ) : (
                  <Avatar className={cn("h-9 w-9 border-2", themeStyles.border.replace('200', '100'))} style={themeStyles.borderLightStyle}>
                    <AvatarImage src={user.photoURL || ""} />
                    <AvatarFallback className={cn(themeStyles.light, themeStyles.text)} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>
                      {(user.displayName || "E").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-500"
                  title={user.uid?.startsWith('guest-') ? "Quitter le mode sans connexion" : "Se déconnecter"}
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
            <div className={cn("mx-auto pb-12 transition-all duration-300", isWideLayout ? "max-w-[95%] xl:max-w-[98%] px-4" : "max-w-5xl")}>
              {messages.map((message, index) => (
                <ChatMessage 
                  key={message.id ? `msg-${message.id}-${index}` : `msg-idx-${index}-${message.role}`} 
                  message={message} 
                  index={index} 
                  onCopy={copyToClipboard}
                  copiedId={copiedId}
                  theme={themeStyles}
                  onSettingsClick={() => setIsSettingsOpen(true)}
                  isWideLayout={isWideLayout}
                  onPDFDownloaded={handlePDFDownloaded}
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
                  <div className={cn("flex flex-col items-start transition-all duration-300", isWideLayout ? "max-w-[95%] w-full" : "max-w-[85%]")}>
                    <div className="px-5 py-3 rounded-2xl shadow-sm bg-white border border-slate-200 text-slate-800 rounded-tl-none w-full overflow-hidden">
                      <div className={cn(
                        "prose prose-sm max-w-none break-words overflow-x-auto text-slate-800 prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:bg-slate-50 prose-th:px-4 prose-th:py-3 prose-td:border prose-td:border-slate-200 prose-td:px-4 prose-td:py-4 prose-td:align-middle",
                        "prose-headings:text-[var(--theme-color)] prose-strong:text-[var(--theme-color)]"
                      )} style={{ "--theme-color": themeStyles.hex } as any}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[[rehypeKatex, { macros: KATEX_MACROS }]]}
                          components={{
                            h1: ({ children }) => <h1 className={cn("font-bold text-xl mb-4", themeStyles.text)} style={themeStyles.textStyle}>{replaceHtmlBreaks(children)}</h1>,
                            h2: ({ children }) => <h2 className={cn("font-bold text-lg mb-3", themeStyles.text)} style={themeStyles.textStyle}>{replaceHtmlBreaks(children)}</h2>,
                            h3: ({ children }) => <h3 className={cn("font-bold text-md mb-2", themeStyles.text)} style={themeStyles.textStyle}>{replaceHtmlBreaks(children)}</h3>,
                            h4: ({ children }) => <h4 className={cn("font-bold text-sm mb-1", themeStyles.text)} style={themeStyles.textStyle}>{replaceHtmlBreaks(children)}</h4>,
                            strong: ({ children }) => <strong className={cn("font-bold", themeStyles.text)} style={themeStyles.textStyle}>{replaceHtmlBreaks(children)}</strong>,
                            p: ({ children, ...props }: any) => <p className="mb-4" {...props}>{replaceHtmlBreaks(children)}</p>,
                            li: ({ children, ...props }: any) => <li className="mb-1" {...props}>{replaceHtmlBreaks(children)}</li>,
                            td: ({ children, ...props }: any) => <td {...props}>{replaceHtmlBreaks(children)}</td>,
                            th: ({ children, ...props }: any) => <th {...props}>{replaceHtmlBreaks(children)}</th>,
                            pre: ({ children, ...props }: any) => {
                              const isSpecial = React.Children.toArray(children).some((child: any) => {
                                if (child && typeof child === 'object' && child.props) {
                                  const className = child.props.className || "";
                                  return className.includes("language-svg") || className.includes("language-mermaid");
                                }
                                return false;
                              });
                              if (isSpecial) {
                                return <div className="not-prose my-4">{children}</div>;
                              }
                              return <pre {...props}>{children}</pre>;
                            },
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
                              
                              const childrenStr = String(children);
                              const trimmedStr = childrenStr.trim();
                              const isSvgContent = trimmedStr.startsWith("<svg") || (trimmedStr.includes("<svg") && trimmedStr.includes("</svg>")) || trimmedStr.includes("<marker") || trimmedStr.includes("<circle") || trimmedStr.includes("<line") || trimmedStr.includes("<rect") || trimmedStr.includes("<polygon") || trimmedStr.includes("<path");
                              if (!inline && (language === "svg" || (isSvgContent && (language === "xml" || language === "html" || !language)))) {
                                const svgCode = normalizeSvgContent(childrenStr);
                                return <ZoomableSVG svgCode={svgCode} />;
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
          isWideLayout={isWideLayout}
          externalValue={externalInputPrompt}
          onExternalValueConsumed={() => setExternalInputPrompt("")}
        />
      </main>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <div key="modal-about-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
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
                      <Badge className={cn("border-none", themeStyles.light, themeStyles.text, themeStyles.light.replace('bg-', 'hover:bg-'))} style={{ ...themeStyles.lightStyle, ...themeStyles.textStyle }}>Version 1.2</Badge>
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
          <div key="modal-install-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
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
          <div key="modal-recharge-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                    <p className="text-xs opacity-80">Tarif : 100 Ar / crédit</p>
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
      </AnimatePresence>

      {/* Referral Modal */}
      <AnimatePresence>
        {isReferralModalOpen && (
          <div key="modal-referral-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                      {referralRewards.map((reward, rIdx) => (
                        <div key={reward.id ? `reward-${reward.id}-${rIdx}` : `reward-idx-${rIdx}`} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
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
          <div key="modal-palette-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
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
                  {THEME_COLORS.map((theme, tIdx) => (
                    <div key={`theme-${theme.value}-${tIdx}`} className="space-y-2">
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
          <div key="modal-settings-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
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

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Download className="w-4 h-4 text-emerald-600" />
                      <label className="text-sm font-bold">Code source de l'application</label>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Téléchargez l'intégralité du projet (fichiers React, TypeScript, backend Express, configuration Firebase et styles) compressé dans une archive ZIP.
                    </p>
                    <a
                      href="/code-source-application.zip"
                      download="code-source-application.zip"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger le code source (.zip)
                    </a>
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
      </AnimatePresence>

      {/* Offline PDF Document Reader Modal */}
      <AnimatePresence>
        {activeOfflinePdf && (
          <div key="modal-offline-pdf-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl h-[85vh] max-w-4xl w-full overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-rose-100 p-2.5 rounded-xl text-rose-600 shrink-0">
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate pr-4" title={activeOfflinePdf.filename}>
                      {activeOfflinePdf.filename.replace("document-fabricel-", "").replace(".pdf", "").replace(/_/g, " ")}
                    </h2>
                    <p className="text-xs text-slate-500 truncate">
                      Mode: Hors connexion • Type: {activeOfflinePdf.config.finalDocType} • Classe: {activeOfflinePdf.config.finalGrade}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isGeneratingSidebarPdf === activeOfflinePdf.id}
                    className={cn(
                      "gap-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50",
                      isGeneratingSidebarPdf === activeOfflinePdf.id && "animate-pulse"
                    )}
                    onClick={() => handleDownloadSavedPDFDirect(activeOfflinePdf)}
                  >
                    {isGeneratingSidebarPdf === activeOfflinePdf.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Download className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>Télécharger</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setActiveOfflinePdf(null)} 
                    className="rounded-full hover:bg-slate-100"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Document Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-50/30">
                <div className="max-w-3xl mx-auto">
                  <div className="mb-6 p-4 rounded-xl border border-rose-100 bg-rose-50/40 flex items-center gap-3 text-rose-800 text-xs leading-relaxed shadow-sm">
                    <Info className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                    <p>
                      Vous consultez ce document enregistré directement depuis la mémoire de votre navigateur. Vous pouvez lire le contenu rédigé et le copier librement même sans aucun accès à Internet.
                    </p>
                  </div>

                  <div className="border border-slate-200 p-6 md:p-8 rounded-2xl bg-white shadow-sm">
                    <div className="mb-6 pb-4 border-b border-dashed border-slate-200">
                      <h3 className="text-2xl font-bold text-slate-800 tracking-tight leading-snug">
                        {activeOfflinePdf.config.finalDocType}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 mt-1.5">
                        Matière: {activeOfflinePdf.config.finalSubject} | Niveau: {activeOfflinePdf.config.finalGrade}
                      </p>
                    </div>

                    <div className="markdown-body prose prose-slate max-w-none text-slate-700">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[[rehypeKatex, { macros: KATEX_MACROS }]]}
                      >
                        {sanitizeMarkdown(activeOfflinePdf.messageText)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400 font-mono shrink-0 px-6">
                <span>MONSIEUR FABRICEL • Enregistré localement</span>
                <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Disponible Hors Ligne
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        
      <AdminPanel 
        isOpen={isAdminPanelOpen} 
        onClose={() => setIsAdminPanelOpen(false)} 
        theme={themeStyles} 
      />

      <OfficialPacksModal
        isOpen={isOfficialPacksOpen}
        onClose={() => setIsOfficialPacksOpen(false)}
        onSelectDocumentForChat={(promptText) => {
          setExternalInputPrompt(promptText);
        }}
        themeHex={customHex}
      />
      </div>
    </ErrorBoundary>
  );
}






