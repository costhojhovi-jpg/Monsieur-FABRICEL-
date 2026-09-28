/**
 * Utility to export a pedagogical response or lesson as a ready-to-compile .tex (LaTeX) document.
 */

export const generateLaTeXDocument = (
  text: string,
  config: {
    title?: string;
    subject?: string;
    grade?: string;
  }
): string => {
  const docTitle = config.title || "Fiche Pédagogique";
  const docSubject = config.subject || "Discipline";
  const docGrade = config.grade || "Enseignement";

  // Clean conversational markdown fillers if any
  let body = text || "";

  // Convert Markdown headings to LaTeX sections
  body = body.replace(/^# (.*$)/gim, '\\section*{$1}');
  body = body.replace(/^## (.*$)/gim, '\\subsection*{$1}');
  body = body.replace(/^### (.*$)/gim, '\\subsubsection*{$1}');

  // Convert Markdown bold and italic
  body = body.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
  body = body.replace(/\*(.*?)\*/g, '\\textit{$1}');

  // Fix KaTeX / MathJax specific overrides for standard LaTeX engine
  body = body.replace(/\\wideparen\{(.*?)\}/g, '\\overparen{$1}');
  body = body.replace(/\\bbox\s*(\[[^\]]*\])?\s*\{(.*?)\}/g, '\\boxed{$2}');

  const latexTemplate = `% ====================================================================
% Document LaTeX Pédagogique - Monsieur FABRICEL
% Généré automatiquement - Compatible Overleaf, TeXStudio & TeXLive
% ====================================================================
\\documentclass[12pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[french]{babel}
\\usepackage{amsmath,amssymb,amsfonts,amsthm}
\\usepackage{geometry}
\\geometry{a4paper, top=2.5cm, bottom=2.5cm, left=2cm, right=2cm}
\\usepackage{xcolor}
\\usepackage{fancyhdr}
\\usepackage{hyperref}

\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\textbf{${docSubject}} -- ${docGrade}}
\\lhead{Monsieur FABRICEL}
\\rfoot{Page \\thepage}
\\lfoot{Document pédagogique éditable}

\\definecolor{primary}{RGB}{13, 148, 136}

\\begin{document}

\\begin{center}
  {\\color{primary}\\huge\\bfseries ${docTitle}}\\\\[0.3em]
  {\\large\\textit{Matière : ${docSubject} | Niveau : ${docGrade}}}\\\\[0.5em]
  \\rule{\\linewidth}{1pt}
\\end{center}

\\vspace{1em}

${body}

\\vspace{3em}
\\noindent\\rule{\\linewidth}{0.5pt}\\\\
{\\small\\itshape Document généré par l'Assistant Virtuel Pédagogique Monsieur FABRICEL.}

\\end{document}
`;

  return latexTemplate;
};

export const downloadAsLaTeXFile = (
  text: string,
  config: {
    title?: string;
    subject?: string;
    grade?: string;
  }
) => {
  const latexContent = generateLaTeXDocument(text, config);
  const blob = new Blob([latexContent], { type: "text/x-tex;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeFilename = `Fiche_LaTeX_${(config.subject || "Pedagogique").replace(/[^a-z0-9]/gi, "_")}.tex`;
  
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return safeFilename;
};
