/**
 * Utility functions for normalizing, wrapping, and repairing SVGs in chat and exports.
 */

export const normalizeSvgContent = (rawContent: string): string => {
  if (!rawContent) return "";
  let content = rawContent.trim();
  
  // Remove markdown code fences if wrapped in ```svg ... ```
  content = content.replace(/^```(?:svg|xml|html)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Strip any \begin{svg} or \end{svg} pseudo-LaTeX delimiters
  content = content.replace(/\\begin\{svg\}/gi, "").replace(/\\end\{svg\}/gi, "").trim();

  // If already contains complete <svg>...</svg>, extract and ensure xmlns & defs
  const svgStartIndex = content.indexOf("<svg");
  const svgEndIndex = content.lastIndexOf("</svg>");
  if (svgStartIndex !== -1 && svgEndIndex !== -1) {
    let cleanSvg = content.substring(svgStartIndex, svgEndIndex + 6);
    if (!cleanSvg.includes("xmlns=")) {
      cleanSvg = cleanSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (cleanSvg.includes("<marker") && !cleanSvg.includes("<defs>")) {
      cleanSvg = cleanSvg.replace(/(<marker[\s\S]*?<\/marker>)/gi, "<defs>$1</defs>");
    }
    return cleanSvg;
  }

  // Otherwise, the snippet consists of raw SVG tags (rect, circle, line, marker, polygon, text, path...)
  let width = 400;
  let height = 200;

  // Check for width and height in any <rect> or attributes
  const widthMatch = content.match(/width=["'](\d+)["']/i);
  const heightMatch = content.match(/height=["'](\d+)["']/i);
  if (widthMatch) {
    width = parseInt(widthMatch[1], 10) || 400;
  }
  if (heightMatch) {
    height = parseInt(heightMatch[1], 10) || 200;
  }

  // Scan geometric coordinates
  const xMatches = Array.from(content.matchAll(/(?:cx|x|x1|x2)=["'](\d+)["']/gi)).map(m => parseInt(m[1], 10));
  const yMatches = Array.from(content.matchAll(/(?:cy|y|y1|y2)=["'](\d+)["']/gi)).map(m => parseInt(m[1], 10));
  if (xMatches.length > 0) {
    const maxX = Math.max(...xMatches);
    if (maxX + 40 > width) width = maxX + 50;
  }
  if (yMatches.length > 0) {
    const maxY = Math.max(...yMatches);
    if (maxY + 30 > height) height = maxY + 40;
  }

  let innerBody = content;
  // If <marker> is present without <defs>, wrap it in <defs>
  if (innerBody.includes("<marker") && !innerBody.includes("<defs>")) {
    innerBody = innerBody.replace(/(<marker[\s\S]*?<\/marker>)/gi, "<defs>$1</defs>");
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto">\n${innerBody}\n</svg>`;
};
