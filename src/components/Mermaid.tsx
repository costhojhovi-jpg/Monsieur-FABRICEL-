import { useEffect, useRef, useState, useMemo } from "react";
import { DidacticMindmap } from "./DidacticMindmap";
import mermaid from "mermaid";
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, Download, Eye, EyeOff, FileText, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import katex from "katex";

const KATEX_MACROS = {
  "\\textperthousand": "‰",
  "\\textpercent": "%",
  "\\overparen": "\\wideparen",
  "\\bbox": "\\boxed",
};

const renderMixedText = (text: string) => {
  let remaining = text;
  
  // Normalize fullwidth brackets and parentheses to standard ones for KaTeX parsing
  remaining = remaining
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/｛/g, "{")
    .replace(/｝/g, "}");

  // Replace LaTeX delimiters with standard double dollar signs for uniform splitting
  remaining = remaining.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  remaining = remaining.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  
  // Split by $$ or $
  const regex = /(\$\$\$[\s\S]*?\$\$\$|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = remaining.split(regex);
  
  let hasMath = false;
  
  const renderedParts = parts.map(part => {
    if (part.startsWith('$$$') && part.endsWith('$$$')) {
      const math = part.slice(3, -3).trim();
      hasMath = true;
      try {
        return katex.renderToString(math, { displayMode: true, throwOnError: false, macros: KATEX_MACROS });
      } catch (e) {
        return `<code>${part}</code>`;
      }
    } else if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim();
      hasMath = true;
      try {
        return katex.renderToString(math, { displayMode: true, throwOnError: false, macros: KATEX_MACROS });
      } catch (e) {
        return `<code>${part}</code>`;
      }
    } else if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim();
      hasMath = true;
      try {
        return katex.renderToString(math, { displayMode: false, throwOnError: false, macros: KATEX_MACROS });
      } catch (e) {
        return `<code>${part}</code>`;
      }
    } else {
      const cleanPart = part.trim();
      // Look for standard LaTeX operators or math characters
      const hasLaTexRaw = /\\(frac|sqrt|times|alpha|beta|theta|Delta|pi|sigma|pm|approx|neq|le|ge|text|vect|class|style|color|cdot|sum|int|infty)\b/.test(cleanPart);
      if (hasLaTexRaw) {
        hasMath = true;
        try {
          return katex.renderToString(cleanPart, { displayMode: false, throwOnError: false, macros: KATEX_MACROS });
        } catch (e) {
          return part;
        }
      }
      return part;
    }
  });
  
  return {
    hasMath,
    html: renderedParts.join("")
  };
};

const processSvgWithKaTeX = (doc: Document) => {
  const textElements = Array.from(doc.querySelectorAll("text"));
  
  textElements.forEach(textEl => {
    const tspans = Array.from(textEl.querySelectorAll("tspan"));
    let fullText = "";
    if (tspans.length > 0) {
      fullText = tspans.map(t => t.textContent || "").join(" ").trim();
    } else {
      fullText = textEl.textContent || "";
    }
    
    fullText = fullText.trim();
    if (!fullText) return;
    
    const { hasMath, html } = renderMixedText(fullText);
    if (!hasMath) return;
    
    // Replace the <text> element with a <foreignObject>
    const xAttr = textEl.getAttribute("x");
    const yAttr = textEl.getAttribute("y");
    const transform = textEl.getAttribute("transform");
    
    const foreignObj = doc.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    
    // Use clear bounding dimensions with overflow visible
    const width = 360;
    const height = 90;
    const halfW = width / 2;
    const halfH = height / 2;
    
    if (transform) {
      foreignObj.setAttribute("transform", transform);
      foreignObj.setAttribute("x", `-${halfW}`);
      foreignObj.setAttribute("y", `-${halfH}`);
    } else {
      const cx = xAttr ? parseFloat(xAttr) : 0;
      const cy = yAttr ? parseFloat(yAttr) : 0;
      foreignObj.setAttribute("x", `${cx - halfW}`);
      foreignObj.setAttribute("y", `${cy - halfH}`);
    }
    
    foreignObj.setAttribute("width", `${width}`);
    foreignObj.setAttribute("height", `${height}`);
    
    const containerDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    containerDiv.setAttribute("style", `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: visible;
      background: transparent;
      font-family: inherit;
      color: inherit;
      text-align: center;
      user-select: none;
    `.replace(/\s+/g, " ").trim());
    
    containerDiv.innerHTML = `<span class="katex-svg-label" style="font-size: 13.5px; color: currentColor; display: inline-block;">${html}</span>`;
    
    foreignObj.appendChild(containerDiv);
    textEl.parentNode?.replaceChild(foreignObj, textEl);
  });
};

mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "Inter, sans-serif",
});

interface MermaidProps {
  chart: string;
}

export const Mermaid = ({ chart }: MermaidProps) => {
  const fullScreenRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [viewMode, setViewMode] = useState<"interactive" | "standard">("interactive");

  const isMindmapChart = useMemo(() => {
    if (!chart) return false;
    return chart.trim().toLowerCase().split(/\s+/)[0] === "mindmap";
  }, [chart]);

  useEffect(() => {
    let active = true;
    setRendering(true);

    const renderChart = async () => {
      if (!chart) return;
      try {
        let sanitizedChart = chart.trim();

        // Remove trailing lines or unfinished connectors
        sanitizedChart = sanitizedChart.replace(/-->\s*$/, "");
        sanitizedChart = sanitizedChart.replace(/--\s*$/, "");
        sanitizedChart = sanitizedChart.replace(/-->\|[^|]*$/, "");
        sanitizedChart = sanitizedChart.replace(/-->\|[^|]*\|$/, "");
        sanitizedChart = sanitizedChart.replace(/\|\s*$/, "");
        sanitizedChart = sanitizedChart.replace(/,\s*$/, "");
        
        // Ensure style commands are on new lines
        sanitizedChart = sanitizedChart.replace(/([\]\)\}\>])\s*(style\s+)/g, '$1\n$2');
        sanitizedChart = sanitizedChart.replace(/(\s+)(style\s+)/g, '\n$2');

        const firstWord = sanitizedChart.split(/\s+/)[0].toLowerCase();
        const validKeywords = ["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "journey", "gantt", "pie", "mindmap", "timeline", "quadrantChart", "xychart", "kanban", "architecture", "packet"];
        
        let isFlowchart = firstWord === "graph" || firstWord === "flowchart";

        if (!validKeywords.includes(firstWord)) {
          if (sanitizedChart.includes("-->") || sanitizedChart.includes("---")) {
            sanitizedChart = `flowchart TD\n${sanitizedChart}`;
            isFlowchart = true;
          }
        }

        // CRITICAL PEDAGOGICAL MATCH: French math intervals ([12; 16[, ]12; 16[, ]a; b[, etc.)
        // These contain brackets that collision with Mermaid shape delimiters.
        // We replace them with safe fullwidth unicode bracket equivalents (［ and ］) that look identical
        // but prevent Mermaid parser syntax crash.
        // We restrict this strictly to valid alphanumeric characters, signs, spaces, or LaTeX infinity to avoid corrupting outer node shape labels that contain commas/semicolons.
        sanitizedChart = sanitizedChart.replace(/([\[\]])\s*([a-zA-Z0-9_\-\\+\infty\s]+?)\s*([;,])\s*([a-zA-Z0-9_\-\\+\infty\s]+?)\s*([\[\]])/g, (match, openBracket, left, sep, right, closeBracket) => {
          const safeOpen = openBracket === '[' ? '［' : '］';
          const safeClose = closeBracket === '[' ? '［' : '］';
          return `${safeOpen}${left}${sep}${right}${safeClose}`;
        });

        if (isFlowchart) {
          // Protect arrow labels: -->|Label| or --> |Label|
          const arrowLabels: string[] = [];
          sanitizedChart = sanitizedChart.replace(/(--+>|---+)\s*\|([^|]*?)\|/g, (match, arrow, label) => {
            const placeholder = `__ARROW_LABEL_${arrowLabels.length}__`;
            let safeLabel = label.trim().replace(/"/g, "'");
            arrowLabels.push(`${arrow}|"${safeLabel}"|`);
            return placeholder;
          });

          // Ensure no space between ID and brackets
          sanitizedChart = sanitizedChart.replace(/([a-zA-Z0-9_]+)\s+([\[\(\{\>])/g, '$1$2');

          // Fix node labels in flowchart
          const fixedNodes: string[] = [];
          const nodePatterns = [
            { open: '(((', close: ')))' }, { open: '([', close: '])' },
            { open: '[[', close: ']]' }, { open: '((', close: '))' },
            { open: '{{', close: '}}' }, { open: '[', close: ']' },
            { open: '(', close: ')' }, { open: '{', close: '}' },
            { open: '>', close: ']' },
          ];

          nodePatterns.forEach(({ open, close }) => {
            const escapedOpen = open.replace(/[\[\(\{\>]/g, '\\$&');
            const escapedClose = close.replace(/[\]\)\{\>]/g, '\\$&');
            const regex = new RegExp(`\\b([a-zA-Z0-9_]+)${escapedOpen}([^\\n${escapedClose}]+)${escapedClose}`, 'g');
            
            sanitizedChart = sanitizedChart.replace(regex, (match, id, content) => {
              const keywords = ["graph", "flowchart", "subgraph", "direction", "end", "style", "class", "click"];
              if (keywords.includes(id.toLowerCase())) return match;
              const placeholder = `__FIXED_NODE_${fixedNodes.length}__`;
              fixedNodes.push(`${id}${open}"${content.trim().replace(/"/g, "'")}"${close}`);
              return placeholder;
            });
          });

          // Fix subgraph labels
          sanitizedChart = sanitizedChart.replace(/subgraph\s+([a-zA-Z0-9_]+)\s+([^\\n\n]+)/g, (match, id, label) => {
            return `subgraph ${id} ["${label.trim().replace(/"/g, "'")}"]`;
          });

          // Restore placeholders
          arrowLabels.forEach((label, i) => {
            sanitizedChart = sanitizedChart.replace(`__ARROW_LABEL_${i}__`, label);
          });
          fixedNodes.forEach((node, i) => {
            sanitizedChart = sanitizedChart.replace(`__FIXED_NODE_${i}__`, node);
          });
        }

        const isMindmap = firstWord === "mindmap";
        if (isMindmap) {
          const cleanMindmapLabel = (text: string) => {
            const preservedMath: string[] = [];
            let maskedText = text;
            
            // Mask LaTeX math patterns ($...$, $$...$$, \(...\), \[...\]) to protect them from bracket modification
            maskedText = maskedText.replace(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
              const placeholder = `__MATH_PRESERVED_${preservedMath.length}__`;
              preservedMath.push(match);
              return placeholder;
            });

            // Clean other general text parts to safeguard mermaid shape compiler
            let cleaned = maskedText
              .replace(/\(/g, "（")
              .replace(/\)/g, "）")
              .replace(/\[/g, "［")
              .replace(/\]/g, "］")
              .replace(/\{/g, "｛")
              .replace(/\}/g, "｝")
              .replace(/"/g, "“")
              .replace(/'/g, "’")
              .replace(/::/g, "∷")
              .trim();
              
            // Re-inject pristine uncorrupted LaTeX math blocks
            preservedMath.forEach((math, i) => {
              cleaned = cleaned.replace(`__MATH_PRESERVED_${i}__`, math);
            });
            
            return cleaned;
          };

          let lines = sanitizedChart.split('\n');
          lines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "mindmap") return line;
            
            const indent = line.match(/^\s*/)?.[0] || "";
            let rest = trimmed;
            
            // Remove markdown bullet points or extra list symbols
            rest = rest.replace(/^([-*+]\s+|\d+[.)]\s+)/, '');
            if (!rest) return "";

            const shapeDefs = [
              { open: '(((', close: ')))', escOpen: '\\(\\(\\(', escClose: '\\)\\)\\)' },
              { open: '((', close: '))', escOpen: '\\(\\(', escClose: '\\)\\)' },
              { open: '{{', close: '}}', escOpen: '\\{\\{', escClose: '\\}\\}' },
              { open: '(', close: ')', escOpen: '\\(', escClose: '\\)' },
              { open: '[', close: ']', escOpen: '\\[', escClose: '\\]' },
              { open: ')', close: '(', escOpen: '\\)', escClose: '\\(' },
              { open: ']', close: '[', escOpen: '\\]', escClose: '\\[' },
              { open: '>', close: ']', escOpen: '>', escClose: '\\]' }
            ];

            let matchedShape = false;
            for (const def of shapeDefs) {
              const regex = new RegExp(`^([a-zA-Z0-9_-]*)\\s*${def.escOpen}([\\s\\S]*)${def.escClose}$`);
              const match = rest.match(regex);
              if (match) {
                const id = match[1] || "";
                let content = match[2].trim();
                content = content.replace(/^["']|["']$/g, "");
                const safeContent = cleanMindmapLabel(content);
                rest = `${id}${def.open}"${safeContent}"${def.close}`;
                matchedShape = true;
                break;
              }
            }

            if (!matchedShape) {
              const idWithQuotesRegex = /^([a-zA-Z0-9_-]+)\s+["'](.*?)["']$/;
              const idMatch = rest.match(idWithQuotesRegex);
              if (idMatch) {
                const id = idMatch[1];
                const label = idMatch[2].trim();
                const safeLabel = cleanMindmapLabel(label);
                rest = `${id} "${safeLabel}"`;
              } else {
                const content = rest.replace(/^["']|["']$/g, "").trim();
                const safeContent = cleanMindmapLabel(content);
                rest = `"${safeContent}"`;
              }
            }

            return `${indent}${rest}`;
          });
          sanitizedChart = lines.filter(l => l.trim() !== "").join('\n');
        }

        // Global unclosed delimiter safety
        const closers = [
          { open: /\[/g, close: /\]/g, char: ']' },
          { open: /\{/g, close: /\}/g, char: '}' },
          { open: /\(/g, close: /\)/g, char: ')' },
          { open: /"/g, close: /"/g, char: '"', isPair: true }
        ];

        closers.forEach(({ open, close, char, isPair }) => {
          const os = (sanitizedChart.match(open) || []).length;
          const cs = (sanitizedChart.match(close) || []).length;
          if (isPair) {
            if (os % 2 !== 0) sanitizedChart += char;
          } else if (os > cs) {
            sanitizedChart += char.repeat(os - cs);
          }
        });

        const lastNonEmptyLine = sanitizedChart.split('\n').map(l => l.trim()).filter(Boolean).pop() || '';
        const oddPipesOnLastLine = (lastNonEmptyLine.match(/\|/g) || []).length % 2 !== 0;
        if (oddPipesOnLastLine && sanitizedChart.match(/\|[^|]*$/)) {
          sanitizedChart += '" [...] |';
        }

        // Extremely robust line-by-line split for multiple independent elements on the same line
        let finalLines: string[] = [];
        const originalLines = sanitizedChart.split('\n');
        
        for (let line of originalLines) {
          const trimmed = line.trim();
          // Skip empty or header/meta lines
          if (!trimmed || trimmed.startsWith("graph ") || trimmed.startsWith("flowchart ") || trimmed.startsWith("mindmap") || trimmed.startsWith("subgraph") || trimmed === "end" || trimmed.startsWith("direction")) {
            finalLines.push(line);
            continue;
          }
          
          // Check for standard flowchart/diagram connectors
          const hasConnector = trimmed.includes("-->") || trimmed.includes("---") || trimmed.includes("==>") || trimmed.includes("-.->") || trimmed.includes("->") || trimmed.includes("-.-") || trimmed.includes("<--");
          
          // Count complete double quoted strings
          const quotesCount = (trimmed.match(/"([^"]*)"/g) || []).length;
          
          if (!hasConnector && quotesCount >= 2) {
            // Find indentation
            const indent = line.match(/^\s*/)?.[0] || "";
            // Extract each independent quoted string or bracketed element
            const parts: string[] = [];
            let currentStr = "";
            let inQuotes = false;
            let depth = 0; // tracking brackets: [], (), {}
            
            for (let i = 0; i < trimmed.length; i++) {
              const char = trimmed[i];
              if (char === '"' && trimmed[i-1] !== '\\') {
                inQuotes = !inQuotes;
                currentStr += char;
              } else if (inQuotes) {
                currentStr += char;
              } else {
                if (char === '[' || char === '(' || char === '{') {
                  depth++;
                  currentStr += char;
                } else if (char === ']' || char === ')' || char === '}') {
                  depth--;
                  currentStr += char;
                } else if ((char === ' ' || char === '\t') && depth === 0) {
                  if (currentStr.trim()) {
                    parts.push(currentStr.trim());
                    currentStr = "";
                  }
                } else {
                  currentStr += char;
                }
              }
            }
            if (currentStr.trim()) {
              parts.push(currentStr.trim());
            }
            
            if (parts.length > 1) {
              parts.forEach(part => {
                finalLines.push(indent + part);
              });
            } else {
              finalLines.push(line);
            }
          } else {
            finalLines.push(line);
          }
        }
        sanitizedChart = finalLines.join('\n');

        // Fallback for any other remaining consecutive elements
        sanitizedChart = sanitizedChart.replace(/(["\]\)\{\>])[ \t]+(?!--|==|~~|->|<-|-|style\b|click\b|class\b|end\b)(["\[\(\{\>a-zA-Z0-9_"]+)/g, '$1\n$2');
        sanitizedChart = sanitizedChart.replace(/\\/g, '\\\\');

        // Parse and validate syntax
        try {
          await mermaid.parse(sanitizedChart);
        } catch (parseError) {
          throw parseError;
        }

        const id = `mermaid-canvas-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, sanitizedChart);

        // Security check: Make sure Mermaid didn't fall back to its own visual error bomb SVG
        if (svg.includes("Syntax error in text") || svg.includes("error-icon") || svg.includes("error-text")) {
          throw new Error("Syntax error reported inside rendered output diagram");
        }

        // Decode and post-process SVG labels containing LaTeX equations with KaTeX
        let finalSvg = svg;
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, "image/svg+xml");
          processSvgWithKaTeX(doc);
          const serializer = new XMLSerializer();
          finalSvg = serializer.serializeToString(doc);
        } catch (postProcessError) {
          console.warn("Error rendering KaTeX math inside Mermaid nodes:", postProcessError);
        }

        if (active) {
          setSvgContent(finalSvg);
          setError(null);
          setRendering(false);
        }
      } catch (err: any) {
        if (err?.message?.includes("Could not find a suitable point")) {
          return; // Skip transient layout updates
        }
        console.warn("Mermaid parsing/rendering warning:", err);
        if (active) {
          setError(err?.message || "Invalid diagram structure");
          setRendering(false);
        }
      }
    };

    const timer = setTimeout(() => {
      renderChart();
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [chart]);

  const downloadSVG = () => {
    if (svgContent) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      const svg = doc.querySelector('svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        downloadLink.download = `schema-${Date.now()}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    }
  };

  if (isMindmapChart && viewMode === "interactive") {
    return (
      <div className="relative group/mindmap my-4 w-full">
        <DidacticMindmap chartText={chart} />
        <div className="absolute top-4 right-14 z-30">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10.5px] font-semibold bg-white/90 border-slate-200 text-slate-500 hover:text-slate-800 flex items-center gap-1.5 shadow-sm rounded-lg px-2.5"
            onClick={() => setViewMode("standard")}
          >
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            Rendu Brut
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mermaid-container group relative flex flex-col items-center my-4 p-4 bg-slate-50/20 rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[140px] justify-center">
        {rendering ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-mono text-xs animate-pulse">…</div>
            <p className="text-xs font-semibold text-slate-700 mt-3 animate-pulse">Génération de la carte visuelle...</p>
          </div>
        ) : error ? (
          <div className="w-full max-w-lg p-5 bg-white border border-slate-200/65 rounded-xl shadow-xs transition-all">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-indigo-50/50 text-indigo-600 border border-indigo-100/30">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  Visualisation didactique
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600">Texte disponible</span>
                </h4>
                <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">
                  Ce visuel contient des notations mathématiques ou formules complexes. Pour un confort optimal, vous pouvez en explorer directement la structure textuelle détaillée ci-dessous.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSource(!showSource)}
                    className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 px-3 shadow-none"
                  >
                    {showSource ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Masquer la structure
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Afficher la structure
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showSource && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <pre className="text-[10px] bg-slate-950 font-mono leading-relaxed text-slate-300 p-3.5 rounded-lg border border-slate-800 overflow-x-auto max-h-[180px] custom-scrollbar">
                    {chart}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <>
            <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex gap-1.5">
              {isMindmapChart && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 bg-white/90 backdrop-blur-xs border-indigo-100 shadow-sm text-[10.5px] font-semibold gap-1 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50/50"
                  onClick={() => setViewMode("interactive")}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Vue Interactive
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 bg-white/90 backdrop-blur-xs border-slate-200 shadow-sm"
                onClick={() => setIsFullScreen(true)}
                title="Agrandir au plein écran"
              >
                <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
              </Button>
            </div>
            <div className="w-full overflow-x-auto flex justify-center custom-scrollbar py-2">
              <div 
                dangerouslySetInnerHTML={{ __html: svgContent || "" }} 
                className="mermaid flex justify-center max-w-full [&>svg]:max-h-[380px] [&>svg]:w-auto [&>svg]:h-auto"
              />
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {isFullScreen && svgContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-900">Vue détaillée du schéma didactique</h3>
                  <p className="text-[10px] text-slate-500">Pincez ou utilisez la souris pour zoomer de manière fluide</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2 text-xs border-indigo-100 text-indigo-700 hover:bg-indigo-50/50 shadow-none px-3"
                    onClick={downloadSVG}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger SVG
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-slate-100"
                    onClick={() => setIsFullScreen(false)}
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 relative bg-slate-50/40 overflow-hidden">
                <TransformWrapper
                  initialScale={1}
                  initialPositionX={0}
                  initialPositionY={0}
                  centerOnInit={true}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1.5">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-9 w-9 rounded-xl shadow-md bg-white border border-slate-200"
                          onClick={() => zoomIn()}
                          title="Zoom avant"
                        >
                          <ZoomIn className="w-4.5 h-4.5 text-slate-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-9 w-9 rounded-xl shadow-md bg-white border border-slate-200"
                          onClick={() => zoomOut()}
                          title="Zoom arrière"
                        >
                          <ZoomOut className="w-4.5 h-4.5 text-slate-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-9 w-9 rounded-xl shadow-md bg-white border border-slate-200"
                          onClick={() => resetTransform()}
                          title="Réinitialiser l'affichage"
                        >
                          <RotateCcw className="w-4.5 h-4.5 text-slate-600" />
                        </Button>
                      </div>
                      
                      <TransformComponent
                        wrapperStyle={{
                          width: "100%",
                          height: "100%",
                        }}
                        contentStyle={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div 
                          dangerouslySetInnerHTML={{ __html: svgContent }} 
                          className="mermaid flex items-center justify-center p-10 max-h-full max-w-full [&>svg]:max-h-[80vh] [&>svg]:w-auto [&>svg]:h-auto select-none"
                        />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              </div>
              
              <div className="p-3 bg-white border-t border-slate-100 flex justify-center gap-1.5 items-center">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Mode Exploration Interactive</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
