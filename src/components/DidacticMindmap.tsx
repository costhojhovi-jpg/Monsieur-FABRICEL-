import { useState, useMemo, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Search, ChevronRight, Minimize2, Maximize2, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import katex from "katex";

// Types
export interface MindmapNode {
  id: string;
  label: string;
  level: number;
  children: MindmapNode[];
  shape?: "circle" | "rounded" | "rectangle" | "ellipse" | "none";
}

interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  side: "left" | "right" | "center";
  level: number;
  shape?: string;
  isCollapsed: boolean;
  hasChildren: boolean;
  parentId?: string;
}

interface Connection {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  side: "left" | "right";
}

const KATEX_MACROS = {
  "\\textperthousand": "‰",
  "\\textpercent": "%",
  "\\overparen": "\\wideparen",
  "\\bbox": "\\boxed",
};

// Math Delimiter Splitter & Renderer to HTML
const renderMixedLabelHtml = (text: string): string => {
  let remaining = text;
  
  // Normalize fullwidth brackets and parentheses for KaTeX
  remaining = remaining
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/｛/g, "{")
    .replace(/｝/g, "}");

  // Normalize delimiters
  remaining = remaining.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  remaining = remaining.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  
  const regex = /(\$\$\$[\s\S]*?\$\$\$|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
  const parts = remaining.split(regex);
  
  const renderedParts = parts.map(part => {
    if (part.startsWith('$$$') && part.endsWith('$$$')) {
      const math = part.slice(3, -3).trim();
      try {
        return katex.renderToString(math, { displayMode: true, throwOnError: false, macros: KATEX_MACROS });
      } catch {
        return `<code class="bg-amber-50 px-1 text-red-600 rounded">${part}</code>`;
      }
    } else if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim();
      try {
        return katex.renderToString(math, { displayMode: true, throwOnError: false, macros: KATEX_MACROS });
      } catch {
        return `<code class="bg-amber-50 px-1 text-red-600 rounded">${part}</code>`;
      }
    } else if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim();
      try {
        return katex.renderToString(math, { displayMode: false, throwOnError: false, macros: KATEX_MACROS });
      } catch {
        return `<code class="bg-amber-50 px-1 text-red-600 rounded">${part}</code>`;
      }
    } else {
      const cleanPart = part.trim();
      // Auto-detect standard LaTeX macros
      const hasLaTexRaw = /\\(frac|sqrt|times|alpha|beta|theta|Delta|pi|sigma|pm|approx|neq|le|ge|text|vect|class|style|color|cdot|sum|int|infty)\b/.test(cleanPart);
      if (hasLaTexRaw) {
        try {
          return katex.renderToString(cleanPart, { displayMode: false, throwOnError: false, macros: KATEX_MACROS });
        } catch {
          return part;
        }
      }
      return part;
    }
  });
  
  return renderedParts.join("");
};

// Parser
export function parseMermaidMindmapText(text: string): MindmapNode | null {
  const lines = text.split('\n');
  let root: MindmapNode | null = null;
  const stack: MindmapNode[] = [];

  // Find the 'mindmap' declaration line
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase().startsWith('mindmap')) {
      startIndex = i + 1;
      break;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const trimmed = line.trim();

    let label = trimmed;
    let shape: "circle" | "rounded" | "rectangle" | "ellipse" | "none" = "none";

    const doubleCircleMatch = trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s*)?\(\(\((.*?)\)\)\)$/);
    const circleMatch = trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s*)?\(\((.*?)\)\)$/);
    const bangMatch = trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s*)?\{\{(.*?)\}\}$/);
    const braceMatch = trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s*)?\{(.*?)\}$/);
    const roundedMatch = trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s*)?\((.*?)\)$/);
    const rectMatch = trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s*)?\[(.*?)\]$/);
    const quotesMatch = trimmed.match(/^(?:([a-zA-Z0-9_-]+)\s*)?"(.*?)"$/);

    let id = `node-${i}`;

    if (doubleCircleMatch) {
      id = doubleCircleMatch[1] || id;
      label = doubleCircleMatch[2];
      shape = "circle";
    } else if (circleMatch) {
      id = circleMatch[1] || id;
      label = circleMatch[2];
      shape = "circle";
    } else if (bangMatch) {
      id = bangMatch[1] || id;
      label = bangMatch[2];
      shape = "ellipse";
    } else if (braceMatch) {
      id = braceMatch[1] || id;
      label = braceMatch[2];
      shape = "ellipse";
    } else if (roundedMatch) {
      id = roundedMatch[1] || id;
      label = roundedMatch[2];
      shape = "rounded";
    } else if (rectMatch) {
      id = rectMatch[1] || id;
      label = rectMatch[2];
      shape = "rectangle";
    } else if (quotesMatch) {
      id = quotesMatch[1] || id;
      label = quotesMatch[2];
      shape = "none";
    } else {
      const plainMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s+(.+)$/);
      if (plainMatch && !["direction", "theme", "style", "class"].includes(plainMatch[1])) {
        id = plainMatch[1];
        label = plainMatch[2];
      }
      label = label.replace(/^["']|["']$/g, "");
    }

    // Ensure the ID is globally unique across the mindmap to prevent duplicate key errors
    id = `${id}-${i}`;

    const node: MindmapNode = {
      id,
      label: label.trim(),
      level: indent,
      children: [],
      shape
    };

    if (stack.length === 0) {
      root = node;
      stack.push(node);
    } else {
      while (stack.length > 0 && stack[stack.length - 1].level >= indent) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children.push(node);
      } else {
        if (root) {
          root.children.push(node);
        } else {
          root = node;
        }
      }
      stack.push(node);
    }
  }

  return root;
}

interface DidacticMindmapProps {
  chartText: string;
}

export const DidacticMindmap = ({ chartText }: DidacticMindmapProps) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const transformRef = useRef<any>(null);

  // Parse the mindmap text using our stable parser
  const parsedRoot = useMemo(() => {
    try {
      return parseMermaidMindmapText(chartText);
    } catch (e) {
      console.error("Failed to parse mindmap", e);
      return null;
    }
  }, [chartText]);

  // Layout calculation helper
  const layout = useMemo(() => {
    if (!parsedRoot) return null;

    const layoutNodes: LayoutNode[] = [];
    const connections: Connection[] = [];
    const X_SPACING = 270; // High horizontal separation for wide LaTeX cards
    const VERTICAL_STEP = 80; // Elegant vertical padding per leaf

    // Toggle collapse click helper
    const isNodeCollapsed = (id: string) => collapsedIds.has(id);

    // Get bottom-up leaf count weight for visible nodes
    function getWeightedLeaves(node: MindmapNode): number {
      if (isNodeCollapsed(node.id) || node.children.length === 0) {
        return 1;
      }
      return node.children.reduce((sum, child) => sum + getWeightedLeaves(child), 0);
    }

    // Split direct children of root evenly to left and right sides
    const totalVisibleChildren = parsedRoot.children;
    const leftChildren: MindmapNode[] = [];
    const rightChildren: MindmapNode[] = [];

    totalVisibleChildren.forEach((child, index) => {
      if (index % 2 === 0) {
        rightChildren.push(child);
      } else {
        leftChildren.push(child);
      }
    });

    // Compute leaves per side
    const leftLeaves = leftChildren.reduce((sum, child) => sum + getWeightedLeaves(child), 0);
    const rightLeaves = rightChildren.reduce((sum, child) => sum + getWeightedLeaves(child), 0);
    
    // Grid alignment details
    const maxLeaves = Math.max(1, leftLeaves, rightLeaves);
    const totalHeight = maxLeaves * VERTICAL_STEP;

    // Place the absolute Root node in the center (0, 0)
    layoutNodes.push({
      id: parsedRoot.id,
      label: parsedRoot.label,
      x: 0,
      y: 0,
      side: "center",
      level: 0,
      shape: parsedRoot.shape,
      isCollapsed: false,
      hasChildren: totalVisibleChildren.length > 0
    });

    // Recursive placement functions
    function placeSubtree(
      node: MindmapNode,
      level: number,
      yMin: number,
      yMax: number,
      side: "left" | "right",
      parentId: string,
      parentX: number,
      parentY: number
    ) {
      const computedX = (side === "left" ? -1 : 1) * level * X_SPACING;
      const computedY = (yMin + yMax) / 2;

      layoutNodes.push({
        id: node.id,
        label: node.label,
        x: computedX,
        y: computedY,
        side,
        level,
        shape: node.shape,
        isCollapsed: isNodeCollapsed(node.id),
        hasChildren: node.children.length > 0,
        parentId
      });

      connections.push({
        fromId: parentId,
        toId: node.id,
        fromX: parentX,
        fromY: parentY,
        toX: computedX,
        toY: computedY,
        side
      });

      if (!isNodeCollapsed(node.id) && node.children.length > 0) {
        const totalChildLeaves = node.children.reduce((sum, c) => sum + getWeightedLeaves(c), 0);
        let currentY = yMin;

        node.children.forEach(child => {
          const childLeaves = getWeightedLeaves(child);
          const childHeight = (childLeaves / totalChildLeaves) * (yMax - yMin);
          placeSubtree(
            child,
            level + 1,
            currentY,
            currentY + childHeight,
            side,
            node.id,
            computedX,
            computedY
          );
          currentY += childHeight;
        });
      }
    }

    // Place left children
    if (leftChildren.length > 0) {
      let leftY = -totalHeight / 2;
      leftChildren.forEach(child => {
        const leaves = getWeightedLeaves(child);
        const childHeight = leaves * VERTICAL_STEP;
        placeSubtree(child, 1, leftY, leftY + childHeight, "left", parsedRoot.id, 0, 0);
        leftY += childHeight;
      });
    }

    // Place right children
    if (rightChildren.length > 0) {
      let rightY = -totalHeight / 2;
      rightChildren.forEach(child => {
        const leaves = getWeightedLeaves(child);
        const childHeight = leaves * VERTICAL_STEP;
        placeSubtree(child, 1, rightY, rightY + childHeight, "right", parsedRoot.id, 0, 0);
        rightY += childHeight;
      });
    }

    // Dynamic canvas viewbox size
    const leftMost = Math.min(...layoutNodes.map(n => n.x)) - 180;
    const rightMost = Math.max(...layoutNodes.map(n => n.x)) + 180;
    const topMost = Math.min(...layoutNodes.map(n => n.y)) - 100;
    const bottomMost = Math.max(...layoutNodes.map(n => n.y)) + 100;

    const canvasWidth = rightMost - leftMost;
    const canvasHeight = bottomMost - topMost;

    return {
      nodes: layoutNodes,
      connections,
      leftMost,
      topMost,
      canvasWidth,
      canvasHeight
    };
  }, [parsedRoot, collapsedIds]);

  // Click handler to collapse / expand sub-branches
  const handleToggleNode = (id: string) => {
    if (id === parsedRoot?.id) return; // Cant collapse the main root
    const updated = new Set(collapsedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setCollapsedIds(updated);
  };

  if (!parsedRoot || !layout) {
    return (
      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500">
        Le format de la carte mentale n'a pas pu être analysé. Visualisation textuelle disponible à la place.
      </div>
    );
  }

  // Smooth Bezier Curve link path generator
  const getCurvePath = (c: Connection) => {
    const parentPivotX = c.fromX;
    const childPivotX = c.toX;
    
    // S-curve calculations
    const controlOffset = Math.abs(childPivotX - parentPivotX) * 0.45;
    const controlX1 = parentPivotX + (c.side === "right" ? controlOffset : -controlOffset);
    const controlX2 = childPivotX - (c.side === "right" ? controlOffset : -controlOffset);
    
    return `M ${parentPivotX} ${c.fromY} C ${controlX1} ${c.fromY}, ${controlX2} ${c.toY}, ${childPivotX} ${c.toY}`;
  };

  const hasSearchHighlight = (label: string) => {
    if (!searchQuery) return false;
    return label.toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <div className="relative w-full bg-linear-to-b from-white to-slate-50/50 rounded-2xl border border-slate-200/80 shadow-md p-4 group overflow-hidden">
      {/* Mindmap header with title and search bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              Carte Mental Didactique Interactive
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 text-indigo-700 font-semibold uppercase">Premium</span>
            </span>
            <p className="text-[10px] text-slate-400">Rendu LaTeX natif • Cliquez sur un nœud pour le déplier/fermer</p>
          </div>
        </div>

        {/* Dynamic filter */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher des notions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-2.5 text-xs bg-white text-slate-700 placeholder-slate-400 border-slate-200 focus:ring-indigo-500 shadow-none rounded-lg"
            />
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 bg-white border-slate-200"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? "Réduire l'écran" : "Agrandir en plein écran"}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5 text-slate-600" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
          </Button>
        </div>
      </div>

      <div className={`relative ${isFullScreen ? "fixed inset-0 z-[110] bg-white p-4 h-full" : "h-[450px]"}`}>
        {isFullScreen && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-100 shadow-lg">
            <div className="text-left px-2">
              <p className="text-xs font-bold text-slate-800">Visualisation plein écran</p>
              <p className="text-[9px] text-slate-400">Pincez ou utilisez la souris pour naviguer</p>
            </div>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 border-slate-200 shadow-xs"
              onClick={() => setIsFullScreen(false)}
            >
              <Minimize2 className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
        )}

        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          initialPositionX={0}
          initialPositionY={0}
          centerOnInit={true}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Zoom controls float button pane on bottom right */}
              <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-1.5 p-1 bg-white/80 backdrop-blur-xs rounded-xl border border-slate-200/50 shadow-sm">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-white hover:bg-slate-50 border border-slate-150 rounded-lg shadow-none"
                  onClick={() => zoomIn()}
                  title="Faire un zoom avant"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-white hover:bg-slate-50 border border-slate-150 rounded-lg shadow-none"
                  onClick={() => zoomOut()}
                  title="Faire un zoom arrière"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-white hover:bg-slate-50 border border-slate-150 rounded-lg shadow-none"
                  onClick={() => resetTransform()}
                  title="Réinitialiser l'affichage"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                </Button>
              </div>

              {/* Live Canvas stage */}
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden"
                }}
                contentStyle={{
                  width: `${layout.canvasWidth}px`,
                  height: `${layout.canvasHeight}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "radial-gradient(#f1f5f9 1.3px, transparent 1.3px)",
                  backgroundSize: "20px 20px"
                }}
              >
                {/* Visual rendering stack */}
                <div 
                  className="relative overflow-visible"
                  style={{
                    width: `${layout.canvasWidth}px`,
                    height: `${layout.canvasHeight}px`,
                  }}
                >
                  {/* SVG lines element in absolute background */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                    style={{ zIndex: 1 }}
                  >
                    {/* Render curved connective splines */}
                    {layout.connections.map((c, idx) => {
                      // Adjust coordinate offset to origin alignment
                      const connectionObj: Connection = {
                        ...c,
                        fromX: c.fromX - layout.leftMost,
                        fromY: c.fromY - layout.topMost,
                        toX: c.toX - layout.leftMost,
                        toY: c.toY - layout.topMost,
                      };

                      const isChildSearchMatch = hasSearchHighlight(
                        layout.nodes.find(n => n.id === c.toId)?.label || ""
                      );

                      return (
                        <path
                          key={`conn-${c.fromId || 'f'}-${c.toId || 't'}-${idx}`}
                          d={getCurvePath(connectionObj)}
                          fill="none"
                          stroke={isChildSearchMatch ? "#6366f1" : "#cfd8dc"}
                          strokeWidth={isChildSearchMatch ? 3 : 2}
                          strokeDasharray={isChildSearchMatch ? "none" : layout.nodes.find(n => n.id === c.toId)?.isCollapsed ? "5,5" : "none"}
                          className="transition-all duration-300"
                        />
                      );
                    })}
                  </svg>

                  {/* HTML Cards sitting on top on the relative grid */}
                  <div
                    className="absolute inset-0 overflow-visible pointer-events-none"
                    style={{ zIndex: 2 }}
                  >
                    {layout.nodes.map((node, nodeIdx) => {
                      const absoluteX = node.x - layout.leftMost;
                      const absoluteY = node.y - layout.topMost;
                      const isRoot = node.level === 0;
                      const isMainBranch = node.level === 1;
                      const matchesSearch = hasSearchHighlight(node.label);

                      // Interactive styles
                      let cardClass = "";
                      if (isRoot) {
                        cardClass = "bg-indigo-600 text-white shadow-md border-indigo-700 border-2 font-semibold text-[13px] py-2 px-4 rounded-xl min-w-[170px]";
                      } else if (isMainBranch) {
                        cardClass = `bg-white border-2 text-indigo-950 font-semibold text-xs py-2 px-3.5 rounded-lg shadow-sm min-w-[160px] ${
                          matchesSearch
                            ? "border-indigo-500 bg-indigo-50/40 shadow-indigo-100"
                            : "border-indigo-100/85 hover:border-indigo-400 hover:shadow-md"
                        }`;
                      } else {
                        cardClass = `bg-white border text-slate-700 text-[11px] py-1.5 px-3 rounded-md shadow-2xs hover:bg-slate-50/50 min-w-[140px] ${
                          matchesSearch
                            ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-emerald-50"
                            : "border-slate-200/80 hover:border-slate-350"
                        }`;
                      }

                      return (
                        <div
                          key={`card-${node.id}-${nodeIdx}`}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 select-none flex flex-col items-center pointer-events-auto transition-transform hover:-translate-y-[calc(50%+2px)] ${
                            node.hasChildren ? "cursor-pointer" : ""
                          }`}
                          style={{
                            left: `${absoluteX}px`,
                            top: `${absoluteY}px`,
                          }}
                          onClick={() => {
                            if (node.hasChildren) {
                              handleToggleNode(node.id);
                            }
                          }}
                        >
                          <div className={`${cardClass} text-center flex flex-col items-center justify-center transition-all duration-300 relative`}>
                            {/* Render label with native math formula decoding */}
                            <span 
                              className="w-full inline-block text-center break-words leading-tight [&>.katex-display]:my-1.5"
                              dangerouslySetInnerHTML={{ __html: renderMixedLabelHtml(node.label) }}
                            />

                            {/* Collapse indicators on branch edges */}
                            {node.hasChildren && !isRoot && (
                              <div 
                                className={`absolute rounded-full p-0.5 border ${
                                  node.side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
                                } top-1/2 -translate-y-1/2 bg-white flex items-center justify-center transition-all ${
                                  node.isCollapsed
                                    ? "bg-indigo-50 border-indigo-300 text-indigo-600 scale-110"
                                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                                }`}
                                style={{ width: "15px", height: "15px" }}
                              >
                                <ChevronRight 
                                  className={`w-2.5 h-2.5 transition-transform duration-300 ${
                                    node.isCollapsed 
                                      ? (node.side === "left" ? "rotate-180" : "rotate-0") 
                                      : (node.side === "left" ? "rotate-270" : "rotate-90")
                                  }`} 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      <div className="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
        <span className="text-[9.5px] text-slate-400 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-slate-400" />
          Astuce : Utilisez la molette pour zoomer et glissez pour déplacer la carte.
        </span>
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <ChevronRight className="w-2.5 h-2.5 text-indigo-500 animate-ping" />
          Mise en page symétrique dynamique
        </span>
      </div>
    </div>
  );
};
