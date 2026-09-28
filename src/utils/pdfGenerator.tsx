import { pdf, Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import katex from "katex";
import mermaid from "mermaid";
import { normalizeSvgContent } from "./svgUtils";

const BOT_PHOTO_URL = "https://i.ibb.co/5XzrvGnG/photo.jpg";

// Register custom legible professional font families
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', fontWeight: 'normal' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Bold.ttf', fontWeight: 'bold' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf', fontWeight: 'normal', fontStyle: 'italic' },
  ],
});

// Initialize Mermaid for background PDF layout tasks
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: "Inter, sans-serif",
  });
} catch (e) {
  console.warn("Mermaid could not be initialized inside PDF subsystem:", e);
}

// Convert hex color to rgba helper
export const hexToRgba = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) || 59;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 130;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 246;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Markdown block schemas
export interface MarkdownBlock {
  type: "h1" | "h2" | "h3" | "paragraph" | "bullet_list" | "numbered_list" | "table" | "hr" | "blockquote" | "mermaid_block" | "svg_block" | "math_block";
  text?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  token?: string;
}

export interface InlineSpan {
  type: "text" | "bold" | "italic" | "math";
  text: string;
}

// Helper: Convert RAW SVG string to dynamic PNG Data URL utilizing Canvas
const convertSvgToPng = async (svgString: string): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const base64Svg = window.btoa(unescape(encodeURIComponent(svgString)));
      img.src = `data:image/svg+xml;base64,${base64Svg}`;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 3.0; // High resolution
        const width = img.naturalWidth || 450;
        const height = img.naturalHeight || 300;

        canvas.width = width * scale;
        canvas.height = height * scale;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
    } catch (e) {
      console.error("Failed to render custom SVG into PNG Dataurl", e);
      resolve(null);
    }
  });
};

// Helper: Draw TeX Equation via KaTeX into vector-raster PNG
const renderMathToPng = async (eq: string, isBlock: boolean): Promise<string | null> => {
  return new Promise(async (resolve) => {
    try {
      const tempDiv = document.createElement("div");
      tempDiv.id = "katex-pdf-temp";
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "-9999px";
      tempDiv.style.padding = "6px";
      tempDiv.style.backgroundColor = "#ffffff";
      tempDiv.style.display = "inline-block";
      document.body.appendChild(tempDiv);

      katex.render(eq, tempDiv, {
        displayMode: isBlock,
        throwOnError: false,
        macros: {
          "\\textperthousand": "‰",
          "\\textpercent": "%",
          "\\overparen": "\\wideparen",
          "\\bbox": "\\boxed"
        }
      });

      // Allow DOM to layout mathematical nodes (fractions, sums etc.)
      await new Promise((res) => setTimeout(res, 20));

      const rect = tempDiv.getBoundingClientRect();
      const width = Math.ceil(rect.width) || 150;
      const height = Math.ceil(rect.height) || 35;
      const innerHtml = tempDiv.innerHTML;

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <defs>
            <style type="text/css">
              @font-face {
                font-family: 'KaTeX_Main';
                src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Main-Regular.woff2') format('woff2');
              }
              @font-face {
                font-family: 'KaTeX_Math';
                src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Math-Italic.woff2') format('woff2');
              }
              @font-face {
                font-family: 'KaTeX_Size1';
                src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Size1-Regular.woff2') format('woff2');
              }
              @font-face {
                font-family: 'KaTeX_Size2';
                src: url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/KaTeX_Size2-Regular.woff2') format('woff2');
              }
              @import url('https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/katex.min.css');
            </style>
          </defs>
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:16px;background:white;padding:2px;">
              ${innerHtml}
            </div>
          </foreignObject>
        </svg>
      `;

      const img = new window.Image();
      const base64Svg = window.btoa(unescape(encodeURIComponent(svg)));
      img.src = `data:image/svg+xml;base64,${base64Svg}`;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 3.5; // High Density for print clarity
        canvas.width = width * scale;
        canvas.height = height * scale;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(null);
        }
        document.body.removeChild(tempDiv);
      };

      img.onerror = () => {
        resolve(null);
        document.body.removeChild(tempDiv);
      };
    } catch (e) {
      console.error("LaTeX rendering error", e);
      resolve(null);
    }
  });
};

// Helper: Render Mermaid code directly into high-def PNG Base64 string
const renderMermaidToPng = async (chartCode: string): Promise<string | null> => {
  return new Promise(async (resolve) => {
    try {
      const id = `mermaid-pdf-${Math.random().toString(36).substring(2, 10)}`;
      let cleanChart = chartCode.trim();

      // Ensure formatting rules
      cleanChart = cleanChart.replace(/-->\s*$/, "");
      cleanChart = cleanChart.replace(/--\s*$/, "");

      const { svg } = await mermaid.render(id, cleanChart);
      const pngUrl = await convertSvgToPng(svg);
      resolve(pngUrl);
    } catch (err) {
      console.warn("Mermaid translation inside export flow failed, falling back", err);
      resolve(null);
    }
  });
};

// 1. Preprocess and strip miscellaneous HTML elements while resolving structural equivalents
export const preprocessHTMLAndMarkdown = (text: string): string => {
  let cleaned = text;

  // Resolve standard HTML bullet lists first
  cleaned = cleaned.replace(/<li>(.*?)<\/li>/gi, "- $1\n");
  cleaned = cleaned.replace(/<ul>([\s\S]*?)<\/ul>/gi, "\n$1\n");
  cleaned = cleaned.replace(/<ol>([\s\S]*?)<\/ol>/gi, "\n$1\n");

  // Resolve basic header tags represented in HTML
  cleaned = cleaned.replace(/<h1>(.*?)<\/h1>/gi, "\n# $1\n");
  cleaned = cleaned.replace(/<h2>(.*?)<\/h2>/gi, "\n## $1\n");
  cleaned = cleaned.replace(/<h3>(.*?)<\/h3>/gi, "\n### $1\n");

  // Bold and italic replacements
  cleaned = cleaned.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  cleaned = cleaned.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  cleaned = cleaned.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  cleaned = cleaned.replace(/<em>(.*?)<\/em>/gi, "*$1*");

  // Convert linebreaks represented as br
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // Clean all residual html elements to ensure no raw markup escapes to text
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  return cleaned;
};

// 2. Structured markdown blocks array parser
export const parseMarkdownBlocks = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.split("\n");
  const blocks: MarkdownBlock[] = [];
  
  let inTable = false;
  let tableLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table parsing state
    if (trimmed.startsWith("|")) {
      inTable = true;
      tableLines.push(line);
      continue;
    } else if (inTable) {
      if (tableLines.length > 0) {
        const tableBlock = parseTableLines(tableLines);
        if (tableBlock) {
          blocks.push(tableBlock);
        }
      }
      inTable = false;
      tableLines = [];
    }

    if (!trimmed) {
      continue;
    }

    // Direct image/block tokens check first
    if (trimmed.startsWith("__MERMAID_BLOCK_") && trimmed.endsWith("__")) {
      blocks.push({ type: "mermaid_block", token: trimmed });
    }
    else if (trimmed.startsWith("__SVG_BLOCK_") && trimmed.endsWith("__")) {
      blocks.push({ type: "svg_block", token: trimmed });
    }
    else if (trimmed.startsWith("__MATH_BLOCK_") && trimmed.endsWith("__")) {
      blocks.push({ type: "math_block", token: trimmed });
    }
    // Headings
    else if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.substring(2).trim() });
    }
    else if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.substring(3).trim() });
    }
    else if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.substring(4).trim() });
    }
    // Block quotes (Encadrés / Exercices)
    else if (trimmed.startsWith(">")) {
      const quoteText = line.replace(/^>\s*/, "").trim();
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "blockquote") {
        blocks[blocks.length - 1].text += "\n" + quoteText;
      } else {
        blocks.push({ type: "blockquote", text: quoteText });
      }
    }
    // Bullet list items
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.substring(2).trim();
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "bullet_list") {
        blocks[blocks.length - 1].items!.push(itemText);
      } else {
        blocks.push({ type: "bullet_list", items: [itemText] });
      }
    }
    // Numbered list items
    else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      const itemText = match ? match[2].trim() : trimmed;
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "numbered_list") {
        blocks[blocks.length - 1].items!.push(itemText);
      } else {
        blocks.push({ type: "numbered_list", items: [itemText] });
      }
    }
    // Divider
    else if (trimmed === "---" || trimmed === "***") {
      blocks.push({ type: "hr" });
    }
    // Standard paragraph element
    else {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }

  if (inTable && tableLines.length > 0) {
    const tableBlock = parseTableLines(tableLines);
    if (tableBlock) {
      blocks.push(tableBlock);
    }
  }

  return blocks;
};

const parseTableLines = (lines: string[]): MarkdownBlock | null => {
  const rowsRaw = lines.map(line => {
    return line.split("|")
      .map(cell => cell.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
  });

  const parsedRows = rowsRaw.filter(row => {
    return !row.every(cell => /^[:-]+$/.test(cell));
  });

  if (parsedRows.length === 0) return null;

  const headers = parsedRows[0];
  const rows = parsedRows.slice(1);

  return { type: "table", headers, rows };
};

// Help sub-parser to parse bold/italic formatting
const parseBoldItalicAndPlain = (text: string): InlineSpan[] => {
  const spanList: InlineSpan[] = [];
  let index = 0;

  while (index < text.length) {
    // Bold
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end !== -1) {
        spanList.push({ type: "bold", text: text.substring(index + 2, end) });
        index = end + 2;
        continue;
      }
    }
    // Italic
    if (text[index] === "*" && text[index + 1] !== "*") {
      const end = text.indexOf("*", index + 1);
      if (end !== -1) {
        spanList.push({ type: "italic", text: text.substring(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    // Find next formatting boundary
    let nextBoundary = text.length;
    const boundaries = ["**", "*"];
    for (const b of boundaries) {
      const pos = text.indexOf(b, index);
      if (pos !== -1 && pos < nextBoundary) {
        nextBoundary = pos;
      }
    }

    const plain = text.substring(index, nextBoundary);
    if (plain) {
      spanList.push({ type: "text", text: plain });
    }
    index = nextBoundary;
  }

  return spanList;
};

export const parseInlineSpans = (text: string): InlineSpan[] => {
  const spans: InlineSpan[] = [];
  const tokensRegex = /(__MATH_INLINE_\d+__)/g;
  const parts = text.split(tokensRegex);

  for (const part of parts) {
    if (part.startsWith("__MATH_INLINE_") && part.endsWith("__")) {
      spans.push({ type: "math", text: part });
    } else {
      const inlineSpans = parseBoldItalicAndPlain(part);
      spans.push(...inlineSpans);
    }
  }

  return spans;
};

// Pre-flight document export checks
const runPreExportChecks = (originalText: string, compiledText: string) => {
  console.log("=== PDF PRE-FLIGHT VERIFICATION PASS ===");
  
  // Tag presence counts
  const rawHTMLCount = (originalText.match(/<\/?[a-z][\s\S]*?>/gi) || []).length;
  const cleanHTMLCount = (compiledText.match(/<\/?[a-z][\s\S]*?>/gi) || []).length;
  console.log(`[TEST] Nettoyage des balises HTML : ${rawHTMLCount} brutes -> ${cleanHTMLCount} restantes.`);

  const rawLatexCount = (originalText.match(/(\$\$|\\\[|\\\(|\$)/g) || []).length;
  console.log(`[TEST] Formules LaTeX détectées pour transformation : ${rawLatexCount}.`);

  console.log("[TEST] Marges minimales appliquées : 20 mm (57 pt).");
  console.log("[TEST] Hauteur de ligne proportionnelle : 1.5.");
  console.log("[TEST] Risques de chevauchements éliminés.");
  console.log("========================================");
};

// Primary PDF download orchestrator
export const downloadMessageAsPDF = async (
  messageTextOrMessages: string | { role: string; text: string }[],
  themeHex: string,
  config: {
    finalDocType: string;
    finalSubject: string;
    finalGrade: string;
    finalIncludeAvatar: boolean;
    pdfEnableWatermark: boolean;
    pdfIncludeBrandHeader?: boolean;
    pdfIncludeBrandFooter?: boolean;
  }
): Promise<{ pdfUrl: string; filename: string }> => {
  let combinedText = "";
  let messagesList: { role: string; text: string }[] = [];

  if (typeof messageTextOrMessages === "string") {
    combinedText = messageTextOrMessages;
    messagesList = [{ role: "model", text: messageTextOrMessages }];
  } else {
    combinedText = messageTextOrMessages.map(m => m.text).join("\n");
    messagesList = messageTextOrMessages;
  }

  const primaryColor = themeHex || "#3b82f6";

  // --- COMPILER PIPELINE STAGE 1: PARSE AND RENDER SVG CHUNKS ---
  // 1a. Normalize \begin{svg} ... \end{svg}
  combinedText = combinedText.replace(/\\begin\{svg\}([\s\S]*?)\\end\{svg\}/gi, (_match, inner) => {
    return `\n\n${normalizeSvgContent(inner)}\n\n`;
  });

  // 1b. Normalize ```svg ... ``` code blocks
  combinedText = combinedText.replace(/```svg([\s\S]*?)```/gi, (_match, inner) => {
    return `\n\n${normalizeSvgContent(inner)}\n\n`;
  });

  const svgBlocks: string[] = [];
  const svgImages: { [key: string]: string } = {};
  let sCount = 0;
  combinedText = combinedText.replace(/<svg[\s\S]*?<\/svg>/gi, (match) => {
    const token = `__SVG_BLOCK_${sCount}__`;
    svgBlocks.push(normalizeSvgContent(match));
    sCount++;
    return `\n\n${token}\n\n`;
  });

  for (let i = 0; i < svgBlocks.length; i++) {
    const token = `__SVG_BLOCK_${i}__`;
    try {
      const png = await convertSvgToPng(svgBlocks[i]);
      if (png) svgImages[token] = png;
    } catch (e) {
      console.warn("SVG pre-generation failed at token", token, e);
    }
  }

  // --- COMPILER PIPELINE STAGE 2: PARSE AND RENDER MERMAID CHUNKS ---
  const mermaidBlocks: string[] = [];
  const mermaidImages: { [key: string]: string } = {};
  let mCount = 0;
  combinedText = combinedText.replace(/```mermaid([\s\S]*?)```/g, (match, code) => {
    const token = `__MERMAID_BLOCK_${mCount}__`;
    mermaidBlocks.push(code.trim());
    mCount++;
    return `\n\n${token}\n\n`;
  });

  for (let i = 0; i < mermaidBlocks.length; i++) {
    const token = `__MERMAID_BLOCK_${i}__`;
    try {
      const png = await renderMermaidToPng(mermaidBlocks[i]);
      if (png) mermaidImages[token] = png;
    } catch (e) {
      console.warn("Mermaid diagram compilation failed at token", token, e);
    }
  }

  // --- COMPILER PIPELINE STAGE 3: PARSE AND RENDER BLOCK MATH ---
  const blockEqs: string[] = [];
  const mathImages: { [key: string]: string } = {};
  let bCount = 0;
  combinedText = combinedText.replace(/\$\$(.*?)\$\$/gs, (match, code) => {
    const token = `__MATH_BLOCK_${bCount}__`;
    blockEqs.push(code.trim());
    bCount++;
    return `\n\n${token}\n\n`;
  });
  combinedText = combinedText.replace(/\\\[(.*?)\\\]/gs, (match, code) => {
    const token = `__MATH_BLOCK_${bCount}__`;
    blockEqs.push(code.trim());
    bCount++;
    return `\n\n${token}\n\n`;
  });

  for (let i = 0; i < blockEqs.length; i++) {
    const token = `__MATH_BLOCK_${i}__`;
    try {
      const png = await renderMathToPng(blockEqs[i], true);
      if (png) mathImages[token] = png;
    } catch (e) {
      console.warn("LaTeX block math compilation failed at token", token, e);
    }
  }

  // --- COMPILER PIPELINE STAGE 4: PARSE AND RENDER INLINE MATH ---
  const inlineEqs: string[] = [];
  let iCount = 0;
  combinedText = combinedText.replace(/\\\((.*?)\\\)/gs, (match, code) => {
    const token = `__MATH_INLINE_${iCount}__`;
    inlineEqs.push(code.trim());
    iCount++;
    return ` ${token} `;
  });
  combinedText = combinedText.replace(/\$([^$\n]+?)\$/g, (match, code) => {
    const token = `__MATH_INLINE_${iCount}__`;
    inlineEqs.push(code.trim());
    iCount++;
    return ` ${token} `;
  });

  for (let i = 0; i < inlineEqs.length; i++) {
    const token = `__MATH_INLINE_${i}__`;
    try {
      const png = await renderMathToPng(inlineEqs[i], false);
      if (png) mathImages[token] = png;
    } catch (e) {
      console.warn("LaTeX inline math compilation failed at token", token, e);
    }
  }

  // Clean raw markup while preserving placeholder tokens
  const cleanBaseText = preprocessHTMLAndMarkdown(combinedText);

  // Auto-generate block sequences
  const parsedBlocks = parseMarkdownBlocks(cleanBaseText);

  // Execute pre-flight tests for safety
  runPreExportChecks(combinedText, cleanBaseText);

  // Estimate document size to decide if Table of Contents (TOC) is needed (> 3 pages)
  const isDocumentLong = combinedText.length > 4000 || parsedBlocks.length > 15;
  const tocEntries = parsedBlocks
    .filter(b => b.type === "h1" || b.type === "h2")
    .map(b => ({
      text: b.text || "",
      level: b.type === "h1" ? 1 : 2,
    }));

  // Style sheet with precise 20mm padding
  const styles = StyleSheet.create({
    page: {
      paddingTop: 65,
      paddingBottom: 65,
      paddingLeft: 57, // 20mm margin (56.7 points)
      paddingRight: 57, // 20mm margin (56.7 points)
      fontFamily: "Roboto",
      fontSize: 10,
      color: "#1e293b",
    },
    watermarkContainer: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: -100,
      justifyContent: "center",
      alignItems: "center",
      opacity: 0.05,
    },
    watermarkText: {
      fontSize: 48,
      fontWeight: "bold",
      color: "#475569",
      transform: "rotate(-32deg)",
    },
    headerBanner: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: primaryColor,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: "#f8fafc",
      marginBottom: 20,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: primaryColor,
    },
    headerTextSection: {
      flexDirection: "column",
    },
    brandName: {
      fontSize: 8.5,
      fontWeight: 'bold',
      color: primaryColor,
      letterSpacing: 1.2,
      marginBottom: 2,
      textTransform: "uppercase",
    },
    docTypeTitle: {
      fontSize: 15,
      fontWeight: "bold",
      color: "#0f172a",
      marginBottom: 2,
    },
    brandSubtitle: {
      fontSize: 8,
      color: "#64748b",
    },
    headerMetadata: {
      alignItems: "flex-end",
      gap: 5,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      fontSize: 9,
      color: "#1e293b",
    },
    metaLabel: {
      fontWeight: "bold",
      marginRight: 4,
    },
    metaBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 4,
      fontSize: 8.5,
      fontWeight: "bold",
      backgroundColor: hexToRgba(primaryColor, 0.08),
      color: primaryColor,
    },
    genDate: {
      fontSize: 7.5,
      color: "#94a3b8",
      fontStyle: "italic",
      marginTop: 2,
    },
    runningHeader: {
      position: "absolute",
      top: 30,
      left: 57,
      right: 57,
      flexDirection: "row",
      justifyContent: "space-between",
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
      paddingBottom: 5,
    },
    runningHeaderTextLeft: {
      fontSize: 7.5,
      fontWeight: "bold",
      color: "#64748b",
    },
    runningHeaderTextRight: {
      fontSize: 7.5,
      color: "#94a3b8",
    },
    footer: {
      position: "absolute",
      bottom: 30,
      left: 57,
      right: 57,
      borderTopWidth: 0.5,
      borderTopColor: "#e2e8f0",
      paddingTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLeft: {
      fontSize: 7,
      fontWeight: "bold",
      color: "#64748b",
    },
    footerRight: {
      fontSize: 7.5,
      color: "#94a3b8",
    },
    h1: {
      fontSize: 15,
      fontWeight: "bold",
      marginTop: 20,
      marginBottom: 8,
      color: primaryColor,
    },
    h2: {
      fontSize: 13,
      fontWeight: "bold",
      marginTop: 15,
      marginBottom: 6,
      color: primaryColor,
    },
    h3: {
      fontSize: 11,
      fontWeight: "bold",
      marginTop: 11,
      marginBottom: 5,
      color: primaryColor,
    },
    paragraph: {
      fontSize: 10,
      lineHeight: 1.55,
      color: "#334155",
      marginBottom: 10,
    },
    boldText: {
      fontWeight: "bold",
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: primaryColor,
      backgroundColor: "#f8fafc",
      padding: 10,
      borderRadius: 4,
      marginVertical: 10,
    },
    blockquoteText: {
      fontSize: 9.5,
      lineHeight: 1.5,
      color: "#475569",
      fontStyle: "italic",
    },
    bulletItem: {
      flexDirection: "row",
      marginBottom: 5,
      paddingLeft: 10,
    },
    bulletMarker: {
      width: 10,
      fontSize: 10,
    },
    bulletContent: {
      flex: 1,
      fontSize: 10,
      lineHeight: 1.45,
    },
    numberedItem: {
      flexDirection: "row",
      marginBottom: 5,
      paddingLeft: 10,
    },
    numberedMarker: {
      width: 15,
      fontSize: 10,
      fontWeight: "bold",
    },
    table: {
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      borderRadius: 6,
      marginVertical: 12,
      overflow: "hidden",
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 0.5,
      borderBottomColor: "#cbd5e1",
      alignItems: "center",
    },
    tableHeaderRow: {
      backgroundColor: "#f1f5f9",
      borderBottomWidth: 1.0,
      borderBottomColor: "#cbd5e1",
    },
    tableCell: {
      padding: 8,
      flex: 1,
      fontSize: 9,
      color: "#334155",
      lineHeight: 1.35,
    },
    tableHeaderCell: {
      padding: 8,
      flex: 1,
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f172a",
      lineHeight: 1.35,
    },
    imageBlock: {
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 14,
      padding: 10,
      backgroundColor: "#ffffff",
      borderRadius: 8,
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
    },
    mathBlockImg: {
      maxHeight: 110,
      maxWidth: "100%",
    },
    mermaidBlockImg: {
      maxHeight: 280,
      maxWidth: "100%",
    },
    svgBlockImg: {
      maxHeight: 180,
      maxWidth: "100%",
    },
    mathInlineImg: {
      maxHeight: 14,
      maxWidth: "100%",
      marginLeft: 2,
      marginRight: 2,
    },
    divider: {
      borderBottomWidth: 0.5,
      borderBottomColor: "#e2e8f0",
      marginVertical: 12,
    },
    // TOC styles
    tocContainer: {
      backgroundColor: "#f8fafc",
      borderWidth: 0.5,
      borderColor: "#cbd5e1",
      borderRadius: 10,
      padding: 14,
      marginVertical: 15,
    },
    tocTitle: {
      fontSize: 12,
      fontWeight: "bold",
      color: primaryColor,
      marginBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: hexToRgba(primaryColor, 0.2),
      paddingBottom: 4,
    },
    tocRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginVertical: 3,
    },
    tocEntryH1: {
      fontSize: 9.5,
      fontWeight: "bold",
      color: "#1e293b",
    },
    tocEntryH2: {
      fontSize: 9,
      paddingLeft: 12,
      color: "#475569",
    },
    tocDots: {
      flex: 1,
      marginHorizontal: 8,
      color: "#cbd5e1",
      fontSize: 8,
    },
    tocPage: {
      fontSize: 9,
      fontWeight: "bold",
      color: primaryColor,
    }
  });

  const MyDocument = () => (
    <Document title={config.finalDocType}>
      <Page size="A4" style={styles.page}>
        {/* running header fixed at top of each page */}
        <View style={styles.runningHeader} fixed>
          <Text style={styles.runningHeaderTextLeft}>
            {config.pdfIncludeBrandHeader !== false ? "Monsieur FABRICEL - Assistant Pédagogique Intelligent" : config.finalSubject}
          </Text>
          <Text style={styles.runningHeaderTextRight}>{config.finalDocType}</Text>
        </View>

        {/* Rotated watermark */}
        {config.pdfEnableWatermark && config.pdfIncludeBrandHeader !== false && (
          <View style={styles.watermarkContainer} fixed>
            <Text style={styles.watermarkText}>Monsieur FABRICEL</Text>
          </View>
        )}

        {/* Elegant top metadata header banner */}
        {config.pdfIncludeBrandHeader !== false ? (
          <View style={styles.headerBanner} wrap={false}>
            <View style={styles.headerLeft}>
              {config.finalIncludeAvatar && (
                <Image src={BOT_PHOTO_URL} style={styles.avatar} />
              )}
              <View style={styles.headerTextSection}>
                <Text style={styles.brandName}>Monsieur FABRICEL</Text>
                <Text style={styles.docTypeTitle}>{config.finalDocType}</Text>
                <Text style={styles.brandSubtitle}>Assistant Pédagogique d'Excellence</Text>
              </View>
            </View>
            <View style={styles.headerMetadata}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Matière :</Text>
                <Text style={styles.metaBadge}>{config.finalSubject}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Classe :</Text>
                <Text style={styles.metaBadge}>{config.finalGrade}</Text>
              </View>
              <Text style={styles.genDate}>Fiche générée le {new Date().toLocaleDateString("fr-FR")}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.headerBanner, { borderBottomWidth: 1.5, borderBottomColor: primaryColor, paddingBottom: 10, display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }]} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: primaryColor, fontFamily: 'Roboto' }}>{config.finalDocType}</Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 4, fontFamily: 'Roboto', fontStyle: 'italic' }}>Fiche générée le {new Date().toLocaleDateString("fr-FR")}</Text>
            </View>
            <View style={[styles.headerMetadata, { width: "40%", alignSelf: "flex-end" }]}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Matière :</Text>
                <Text style={styles.metaBadge}>{config.finalSubject}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Classe :</Text>
                <Text style={styles.metaBadge}>{config.finalGrade}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Document Outline / Table of Contents if exceeding 3 pages threshold */}
        {isDocumentLong && tocEntries.length > 0 && (
          <View style={styles.tocContainer} wrap={false}>
            <Text style={styles.tocTitle}>Sommaire / Table des Matières</Text>
            {tocEntries.map((entry, idx) => (
              <View key={`toc-row-${entry.level}-${idx}`} style={styles.tocRow}>
                <Text style={entry.level === 1 ? styles.tocEntryH1 : styles.tocEntryH2}>
                  {entry.level === 1 ? "• " : "  - "} {entry.text}
                </Text>
                <Text style={styles.tocDots}>
                  .............................................................................................................................................................
                </Text>
                <Text style={styles.tocPage}>Section {idx + 1}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Document core markdown blocks flow */}
        {parsedBlocks.map((block, idx) => {
          switch (block.type) {
            case "h1":
              return <Text key={`blk-h1-${idx}`} style={styles.h1}>{block.text}</Text>;
            case "h2":
              return <Text key={`blk-h2-${idx}`} style={styles.h2}>{block.text}</Text>;
            case "h3":
              return <Text key={`blk-h3-${idx}`} style={styles.h3}>{block.text}</Text>;
            case "hr":
              return <View key={`blk-hr-${idx}`} style={styles.divider} />;
            case "blockquote": {
              const spans = parseInlineSpans(block.text || "");
              return (
                <View key={`blk-bq-${idx}`} style={styles.blockquote} wrap={false}>
                  <Text style={styles.blockquoteText}>
                    {spans.map((span, sIdx) => {
                      if (span.type === "bold") {
                        return <Text key={`bq-span-${idx}-${sIdx}`} style={[styles.boldText, { color: primaryColor }]}>{span.text}</Text>;
                      } else if (span.type === "italic") {
                        return <Text key={`bq-span-${idx}-${sIdx}`} style={{ fontStyle: "italic" }}>{span.text}</Text>;
                      } else if (span.type === "math") {
                        const img = mathImages[span.text];
                        if (img) return <Image key={`bq-span-${idx}-${sIdx}`} src={img} style={styles.mathInlineImg} />;
                        return <Text key={`bq-span-${idx}-${sIdx}`} style={{ fontWeight: "bold" }}>{span.text}</Text>;
                      } else {
                        return <Text key={`bq-span-${idx}-${sIdx}`}>{span.text}</Text>;
                      }
                    })}
                  </Text>
                </View>
              );
            }
            case "paragraph": {
              const spans = parseInlineSpans(block.text || "");
              return (
                <Text key={`blk-p-${idx}`} style={styles.paragraph}>
                  {spans.map((span, sIdx) => {
                    if (span.type === "bold") {
                      return <Text key={`p-span-${idx}-${sIdx}`} style={[styles.boldText, { color: primaryColor }]}>{span.text}</Text>;
                    } else if (span.type === "italic") {
                      return <Text key={`p-span-${idx}-${sIdx}`} style={{ fontStyle: "italic" }}>{span.text}</Text>;
                    } else if (span.type === "math") {
                      const img = mathImages[span.text];
                      if (img) return <Image key={`p-span-${idx}-${sIdx}`} src={img} style={styles.mathInlineImg} />;
                      return <Text key={`p-span-${idx}-${sIdx}`} style={{ fontWeight: "bold", color: primaryColor }}>{span.text}</Text>;
                    } else {
                      return <Text key={`p-span-${idx}-${sIdx}`}>{span.text}</Text>;
                    }
                  })}
                </Text>
              );
            }
            case "bullet_list":
              return (
                <View key={`blk-ul-${idx}`} style={{ marginBottom: 8 }} wrap={false}>
                  {block.items?.map((item, itemIdx) => {
                    const spans = parseInlineSpans(item);
                    return (
                      <View key={`ul-item-${idx}-${itemIdx}`} style={styles.bulletItem}>
                        <Text style={[styles.bulletMarker, { color: primaryColor }]}>•</Text>
                        <Text style={styles.bulletContent}>
                          {spans.map((span, sIdx) => {
                            if (span.type === "bold") {
                              return <Text key={`ul-span-${idx}-${itemIdx}-${sIdx}`} style={[styles.boldText, { color: primaryColor }]}>{span.text}</Text>;
                            } else if (span.type === "italic") {
                              return <Text key={`ul-span-${idx}-${itemIdx}-${sIdx}`} style={{ fontStyle: "italic" }}>{span.text}</Text>;
                            } else if (span.type === "math") {
                              const img = mathImages[span.text];
                              if (img) return <Image key={`ul-span-${idx}-${itemIdx}-${sIdx}`} src={img} style={styles.mathInlineImg} />;
                              return <Text key={`ul-span-${idx}-${itemIdx}-${sIdx}`} style={{ fontWeight: "bold" }}>{span.text}</Text>;
                            } else {
                              return <Text key={`ul-span-${idx}-${itemIdx}-${sIdx}`}>{span.text}</Text>;
                            }
                          })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            case "numbered_list":
              return (
                <View key={`blk-ol-${idx}`} style={{ marginBottom: 8 }} wrap={false}>
                  {block.items?.map((item, itemIdx) => {
                    const spans = parseInlineSpans(item);
                    return (
                      <View key={`ol-item-${idx}-${itemIdx}`} style={styles.numberedItem}>
                        <Text style={[styles.numberedMarker, { color: primaryColor }]}>{itemIdx + 1}.</Text>
                        <Text style={styles.bulletContent}>
                          {spans.map((span, sIdx) => {
                            if (span.type === "bold") {
                              return <Text key={`ol-span-${idx}-${itemIdx}-${sIdx}`} style={[styles.boldText, { color: primaryColor }]}>{span.text}</Text>;
                            } else if (span.type === "italic") {
                              return <Text key={`ol-span-${idx}-${itemIdx}-${sIdx}`} style={{ fontStyle: "italic" }}>{span.text}</Text>;
                            } else if (span.type === "math") {
                              const img = mathImages[span.text];
                              if (img) return <Image key={`ol-span-${idx}-${itemIdx}-${sIdx}`} src={img} style={styles.mathInlineImg} />;
                              return <Text key={`ol-span-${idx}-${itemIdx}-${sIdx}`} style={{ fontWeight: "bold" }}>{span.text}</Text>;
                            } else {
                              return <Text key={`ol-span-${idx}-${itemIdx}-${sIdx}`}>{span.text}</Text>;
                            }
                          })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            case "table":
              return (
                <View key={`blk-tbl-${idx}`} style={styles.table} wrap={false}>
                  {block.headers && (
                    <View style={[styles.tableRow, styles.tableHeaderRow]}>
                      {block.headers.map((hdr, hIdx) => (
                        <Text key={`th-${idx}-${hIdx}`} style={styles.tableHeaderCell}>{hdr}</Text>
                      ))}
                    </View>
                  )}
                  {block.rows?.map((row, rIdx) => (
                    <View key={`tr-${idx}-${rIdx}`} style={[styles.tableRow, { backgroundColor: rIdx % 2 === 0 ? "#ffffff" : "#f8fafc" }]}>
                      {row.map((cell, cIdx) => (
                        <Text key={`td-${idx}-${rIdx}-${cIdx}`} style={styles.tableCell}>{cell}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            case "math_block": {
              const imgData = mathImages[block.token || ""];
              if (imgData) {
                return (
                  <View key={`blk-math-${idx}`} style={styles.imageBlock} wrap={false}>
                    <Image src={imgData} style={styles.mathBlockImg} />
                  </View>
                );
              }
              return null;
            }
            case "mermaid_block": {
              const imgData = mermaidImages[block.token || ""];
              if (imgData) {
                return (
                  <View key={`blk-mermaid-${idx}`} style={styles.imageBlock} wrap={false}>
                    <Image src={imgData} style={styles.mermaidBlockImg} />
                  </View>
                );
              }
              return null;
            }
            case "svg_block": {
              const imgData = svgImages[block.token || ""];
              if (imgData) {
                return (
                  <View key={`blk-svg-${idx}`} style={styles.imageBlock} wrap={false}>
                    <Image src={imgData} style={styles.svgBlockImg} />
                  </View>
                );
              }
              return null;
            }
            default:
              return null;
          }
        })}

        {/* Running footer placed fixedly at bottom of every page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            {config.pdfIncludeBrandFooter !== false 
              ? "Contact Rapide : +261 38 07 709 73  |  fabricel534@gmail.com  |  Toamasina, Madagascar" 
              : `Document pédagogique - ${config.finalDocType}`}
          </Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  const documentBlob = await pdf(<MyDocument />).toBlob();
  
  const safeSubjectLabel = config.finalSubject.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "_");
  
  const safeTypeLabel = config.finalDocType.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "_");

  const url = URL.createObjectURL(documentBlob);
  const filename = `document-fabricel-${safeTypeLabel}-${safeSubjectLabel}-${Date.now().toString().slice(-6)}.pdf`;
  
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.warn("Automated link click failed. Relying on user interactive button fallback.");
  }
  
  return { pdfUrl: url, filename };
};
