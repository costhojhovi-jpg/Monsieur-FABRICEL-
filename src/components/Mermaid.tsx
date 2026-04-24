import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, Download } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

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
  const ref = useRef<HTMLDivElement>(null);
  const fullScreenRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const renderChart = async (containerRef: React.RefObject<HTMLDivElement | null>, isFull: boolean) => {
      if (containerRef.current && chart) {
        containerRef.current.removeAttribute("data-processed");
        containerRef.current.innerHTML = ""; // Clear previous
        
        try {
          let sanitizedChart = chart.trim();
          
          // Remove trailing arrows or incomplete connections
          sanitizedChart = sanitizedChart.replace(/-->\s*$/, "");
          sanitizedChart = sanitizedChart.replace(/--\s*$/, "");
          sanitizedChart = sanitizedChart.replace(/-->\|[^|]*$/, "");
          sanitizedChart = sanitizedChart.replace(/-->\|[^|]*\|$/, "");
          sanitizedChart = sanitizedChart.replace(/\|\s*$/, "");
          
          // Fix trailing commas in style definitions
          sanitizedChart = sanitizedChart.replace(/,\s*$/, "");
          
          // 0. Fix: Ensure style commands are on new lines
          sanitizedChart = sanitizedChart.replace(/([\]\)\}\>])\s*(style\s+)/g, '$1\n$2');
          sanitizedChart = sanitizedChart.replace(/(\s+)(style\s+)/g, '\n$2');

          // 0. Detect type early to apply correct sanitization
          const firstWord = sanitizedChart.split(/\s+/)[0].toLowerCase();
          const validKeywords = ["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "journey", "gantt", "pie", "mindmap", "timeline", "quadrantChart", "xychart", "kanban", "architecture", "packet"];
          
          let isFlowchart = firstWord === "graph" || firstWord === "flowchart";
          let type = firstWord;

          if (!validKeywords.includes(firstWord)) {
            if (sanitizedChart.includes("-->") || sanitizedChart.includes("---")) {
              sanitizedChart = `flowchart TD\n${sanitizedChart}`;
              isFlowchart = true;
              type = "flowchart";
            }
          }
          
          if (isFlowchart) {
            // 2. Protect arrow labels: -->|Label| or --> |Label|
            const arrowLabels: string[] = [];
            sanitizedChart = sanitizedChart.replace(/(--+>|---+)\s*\|([^|]*?)\|/g, (match, arrow, label) => {
              const placeholder = `__ARROW_LABEL_${arrowLabels.length}__`;
              let safeLabel = label.trim().replace(/"/g, "'");
              arrowLabels.push(`${arrow}|"${safeLabel}"|`);
              return placeholder;
            });

            // 3. Fix: Ensure no space between ID and bracket/brace/paren
            sanitizedChart = sanitizedChart.replace(/([a-zA-Z0-9_]+)\s+([\[\(\{\>])/g, '$1$2');

            // 4. Prefix all numeric IDs with 'n'
            sanitizedChart = sanitizedChart.replace(/\b(\d[a-zA-Z0-9_]*)\b/g, (match) => {
              // Only prefix if it's likely a node ID, not inside a label or a year in timeline
              return type === 'timeline' ? match : `n${match}`;
            });

            // 5. Fix node labels
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

            // 6. Fix subgraph labels
            sanitizedChart = sanitizedChart.replace(/subgraph\s+([a-zA-Z0-9_]+)\s+([^\\n\n]+)/g, (match, id, label) => {
              return `subgraph ${id} ["${label.trim().replace(/"/g, "'")}"]`;
            });

            // 7. Restore placeholders
            arrowLabels.forEach((label, i) => {
              sanitizedChart = sanitizedChart.replace(`__ARROW_LABEL_${i}__`, label);
            });
            fixedNodes.forEach((node, i) => {
              sanitizedChart = sanitizedChart.replace(`__FIXED_NODE_${i}__`, node);
            });
          }

          // 8. Global safety fixes for streaming (unclosed delimiters)
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

          // Handle incomplete arrow labels at the end of the chart (streaming)
          if (sanitizedChart.match(/\|[^|]*$/)) {
            sanitizedChart += '" [...] |';
          }

          // 9. Separate nodes on the same line that aren't connected (flowchart only)
          if (isFlowchart) {
            sanitizedChart = sanitizedChart.replace(/([\]\)\{\>])\s+([a-zA-Z0-9_]+[\[\(\{\>])/g, '$1\n$2');
          }

          // 10. Fix backslashes for all types
          sanitizedChart = sanitizedChart.replace(/\\/g, '\\\\');

          const id = `mermaid-${isFull ? 'full-' : ''}${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, sanitizedChart);
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } catch (error: any) {
          // If it's a layout error, it might be transient during streaming
          if (error?.message?.includes("Could not find a suitable point")) {
            return; // Just skip this frame
          }
          
          console.error("Mermaid rendering failed:", error);
          if (containerRef.current) {
            containerRef.current.innerHTML = "<pre class='text-red-500 text-xs'>Erreur de rendu du schéma</pre>";
          }
        }
      }
    };

    // Debounce rendering to avoid heavy processing during streaming
    const timer = setTimeout(() => {
      renderChart(ref, false);
      if (isFullScreen) {
        renderChart(fullScreenRef, true);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timer);
  }, [chart, isFullScreen]);

  const downloadSVG = () => {
    if (fullScreenRef.current) {
      const svg = fullScreenRef.current.querySelector('svg');
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

  return (
    <>
      <div className="mermaid-container group relative flex flex-col items-center my-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm"
            onClick={() => setIsFullScreen(true)}
            title="Plein écran"
          >
            <Maximize2 className="w-4 h-4 text-slate-600" />
          </Button>
        </div>
        <div className="w-full overflow-x-auto flex justify-center">
          <div ref={ref} className="mermaid" />
        </div>
      </div>

      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-900">Vue détaillée du schéma</h3>
                  <p className="text-[10px] text-slate-500">Utilisez la souris ou les doigts pour zoomer et déplacer</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2 text-xs border-emerald-100 text-emerald-700 hover:bg-emerald-50"
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
              
              <div className="flex-1 relative bg-slate-50/50 overflow-hidden">
                <TransformWrapper
                  initialScale={1}
                  initialPositionX={0}
                  initialPositionY={0}
                  centerOnInit={true}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-xl shadow-lg bg-white border border-slate-200"
                          onClick={() => zoomIn()}
                          title="Zoom avant"
                        >
                          <ZoomIn className="w-5 h-5 text-slate-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-xl shadow-lg bg-white border border-slate-200"
                          onClick={() => zoomOut()}
                          title="Zoom arrière"
                        >
                          <ZoomOut className="w-5 h-5 text-slate-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-xl shadow-lg bg-white border border-slate-200"
                          onClick={() => resetTransform()}
                          title="Réinitialiser"
                        >
                          <RotateCcw className="w-5 h-5 text-slate-600" />
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
                        <div ref={fullScreenRef} className="mermaid p-10" />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              </div>
              
              <div className="p-3 bg-white border-t border-slate-100 flex justify-center">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Mode Exploration Interactive</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
