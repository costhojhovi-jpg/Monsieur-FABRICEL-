import { 
  parseMarkdownBlocks, 
  parseInlineSpans, 
  preprocessHTMLAndMarkdown 
} from "./pdfGenerator";

// Helper: Converts LaTeX mathematical notation into clean, unicode math text for Word
const latexToWordMath = (latex: string): string => {
  let text = latex.trim();

  // Remove common math style wrappers
  text = text.replace(/\\text\s*\{([^{}]+)\}/g, "$1");
  text = text.replace(/\\mathrm\s*\{([^{}]+)\}/g, "$1");
  text = text.replace(/\\mathbf\s*\{([^{}]+)\}/g, "$1");
  text = text.replace(/\\mathit\s*\{([^{}]+)\}/g, "$1");

  // Convert fractions: \frac{num}{den} -> (num)/(den)
  let prevText = "";
  while (text !== prevText) {
    prevText = text;
    text = text.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)");
  }

  // Superscripts
  text = text.replace(/\^2/g, "²");
  text = text.replace(/\^3/g, "³");
  text = text.replace(/\^n/g, "ⁿ");
  text = text.replace(/\^x/g, "ˣ");
  text = text.replace(/\^y/g, "ʸ");
  text = text.replace(/\^t/g, "ᵗ");
  text = text.replace(/\^{-1}/g, "⁻¹");

  // Subscripts
  text = text.replace(/_1/g, "₁");
  text = text.replace(/_2/g, "₂");
  text = text.replace(/_3/g, "₃");
  text = text.replace(/_n/g, "ₙ");
  text = text.replace(/_i/g, "ᵢ");
  text = text.replace(/_j/g, "ⱼ");
  text = text.replace(/_t/g, "ₜ");
  text = text.replace(/_0/g, "₀");
  text = text.replace(/_A/g, "ₐ");
  text = text.replace(/_B/g, "ᵦ");

  // Common operators and constants
  text = text.replace(/\\times/g, " × ");
  text = text.replace(/\\cdot/g, " · ");
  text = text.replace(/\\div/g, " ÷ ");
  text = text.replace(/\\pm/g, " ± ");
  text = text.replace(/\\mp/g, " ∓ ");
  text = text.replace(/\\approx/g, " ≈ ");
  text = text.replace(/\\neq/g, " ≠ ");
  text = text.replace(/\\leq/g, " ≤ ");
  text = text.replace(/\\geq/g, " ≥ ");
  text = text.replace(/\\le/g, " ≤ ");
  text = text.replace(/\\ge/g, " ≥ ");
  text = text.replace(/\\infty/g, " ∞ ");
  text = text.replace(/\\partial/g, " ∂ ");
  text = text.replace(/\\nabla/g, " ∇ ");
  text = text.replace(/\\Delta/g, " Δ ");
  text = text.replace(/\\pi/g, " π ");
  text = text.replace(/\\Pi/g, " Π ");
  text = text.replace(/\\alpha/g, " α ");
  text = text.replace(/\\beta/g, " β ");
  text = text.replace(/\\gamma/g, " γ ");
  text = text.replace(/\\theta/g, " θ ");
  text = text.replace(/\\Theta/g, " Θ ");
  text = text.replace(/\\lambda/g, " λ ");
  text = text.replace(/\\omega/g, " ω ");
  text = text.replace(/\\Omega/g, " Ω ");
  text = text.replace(/\\sigma/g, " σ ");
  text = text.replace(/\\phi/g, " φ ");
  text = text.replace(/\\sqrt\s*\{([^{}]+)\}/g, "√($1)");
  text = text.replace(/\\sqrt/g, " √ ");
  
  // Accents & formatting helper
  text = text.replace(/\\widehat\s*\{([^{}]+)\}/g, "Angle ($1)");
  text = text.replace(/\\overline\s*\{([^{}]+)\}/g, "Segment [$1]");

  // Units or helpers
  text = text.replace(/\\circ/g, "°");
  text = text.replace(/\\degree/g, "°");
  text = text.replace(/\\prime/g, "′");
  text = text.replace(/\\%/g, " %");
  text = text.replace(/\\textperthousand/g, " ‰");

  // Clean double-whitespaces & brackets
  text = text.replace(/\s+/g, " ");

  return text.trim();
};

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Replaces inline style tokens and inline math back with clean unicode representation
const renderInlineSpansToHtml = (text: string): string => {
  const spans = parseInlineSpans(text);
  return spans.map(span => {
    if (span.type === "bold") {
      return `<strong style="font-weight: bold; color: #1e293b;">${escapeHtml(span.text)}</strong>`;
    } else if (span.type === "italic") {
      return `<em style="font-style: italic; color: #475569;">${escapeHtml(span.text)}</em>`;
    } else if (span.type === "math") {
      // Inline equation
      const mathText = latexToWordMath(span.text);
      return `<code style="font-family: 'Consolas', 'Courier New', monospace; background-color: #f1f5f9; padding: 1px 4px; border-radius: 3px; color: #0f766e; font-weight: bold;">${escapeHtml(mathText)}</code>`;
    } else {
      return escapeHtml(span.text);
    }
  }).join("");
};

// Generates a structural and beautiful description table for diagrams
const renderDiagramDescriptionTable = (type: "angles" | "optics" | "general"): string => {
  if (type === "angles") {
    return `
      <table cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 12pt; border: 1px solid #cbd5e1; background-color: #f8fafc;">
        <thead>
          <tr style="background-color: #2563eb;">
            <th colspan="2" style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 10.5pt; font-weight: bold; color: #ffffff; text-align: left; padding: 8pt;">
              📐 ÉLÉMENTS GÉOMÉTRIQUES DU PROBLÈME (Lecture & Figure)
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; width: 30%; color: #334155; padding: 6pt;">Cercle de centre O</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #334155; padding: 6pt;">Cercle trigonométrique ou géométrique principal de centre <strong>O(200, 200)</strong>.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; color: #334155; padding: 6pt;">Angle au Centre (AOB)</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #2563eb; font-weight: bold; padding: 6pt;">Angle central égal à 2x. Représente l'axe d'interception principal. Arcs bleus concentriques de centre O.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; color: #334155; padding: 6pt;">Angle Inscrit (AMB)</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #dc2626; font-weight: bold; padding: 6pt;">Angle inscrit égal à x. Le sommet M est situé sur le cercle (Arc rouge centré en M).</td>
          </tr>
          <tr style="background-color: #eff6ff;">
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; color: #1e3a8a; padding: 6pt;">Théorème Appliqué</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #1e3a8a; font-style: italic; padding: 6pt;">L'angle inscrit (AMB) mesure exactement la moitié de l'angle au centre (AOB) interceptant le même arc AB : AOB = 2 × AMB.</td>
          </tr>
        </tbody>
      </table>
    `;
  } else if (type === "optics") {
    return `
      <table cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 12pt; border: 1px solid #cbd5e1; background-color: #f8fafc;">
        <thead>
          <tr style="background-color: #0d9488;">
            <th colspan="2" style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 10.5pt; font-weight: bold; color: #ffffff; text-align: left; padding: 8pt;">
              👓 CONFIGURATION DE L'INSTRUMENT OPTIQUE
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; width: 30%; color: #334155; padding: 6pt;">Axe Optique</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #334155; padding: 6pt;">Axe horizontal de propagation de la lumière délimitant le sens positif d'orientation.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; color: #334155; padding: 6pt;">Lentille Convergente (L)</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #0d9488; font-weight: bold; padding: 6pt;">Lentille mince à bords minces. Centre optique à l'origine O. Distance focale f' = 15 cm.</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; color: #334155; padding: 6pt;">Foyers Objet / Image</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #334155; padding: 6pt;">Foyer Objet F (en amont de la lentille) & Foyer Image F' (en aval à égale distance de O).</td>
          </tr>
          <tr style="background-color: #f0fdfa;">
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-weight: bold; font-size: 9.5pt; color: #115e59; padding: 6pt;">Relations d'Optique</td>
            <td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #115e59; font-style: italic; padding: 6pt;">Formule de conjugaison de Descartes : 1 / OA' - 1 / OA = 1 / OF'. Grandissement vertical : gamma = A'B' / AB = OA' / OA.</td>
          </tr>
        </tbody>
      </table>
    `;
  }
  
  return "";
};

// Main Export function for Microsoft Word (.doc format, openable perfectly anywhere)
export const downloadMessageAsDOCX = async (
  messageTextOrMessages: string | { role: string; text: string }[],
  themeHex: string,
  config: {
    finalDocType: string;
    finalSubject: string;
    finalGrade: string;
    finalIncludeAvatar: boolean;
    finalIncludeBrandHeader?: boolean;
    finalIncludeBrandFooter?: boolean;
  }
): Promise<{ docxUrl: string; filename: string }> => {
  let combinedText = "";

  if (typeof messageTextOrMessages === "string") {
    combinedText = messageTextOrMessages;
  } else {
    combinedText = messageTextOrMessages.map(m => m.text).join("\n");
  }

  const primaryColor = themeHex || "#0f766e";

  // Pre-process the block structures
  const cleanBaseText = preprocessHTMLAndMarkdown(combinedText);
  const parsedBlocks = parseMarkdownBlocks(cleanBaseText);

  // --- STAGE 2: GENERATING RICH, COMPATIBLE HTML FOR MS WORD ---
  let bodyHtml = "";

  // Title Banner
  if (config.finalIncludeBrandHeader !== false) {
    bodyHtml += `
      <!-- Top banner with primary color -->
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 20pt; border-bottom: 3px solid ${primaryColor};">
        <tr>
          <td style="padding-bottom: 12pt;">
            <h1 style="color: ${primaryColor}; font-family: 'Arial', sans-serif; font-size: 24pt; font-weight: bold; margin: 0 0 4pt 0;">Monsieur FABRICEL</h1>
            <p style="color: #475569; font-family: 'Arial', sans-serif; font-size: 11pt; margin: 0; font-style: italic;">Ressources Didactiques et Pédagogiques Clés en Main</p>
          </td>
        </tr>
      </table>
    `;
  } else {
    bodyHtml += `
      <!-- Clean Top banner with primary color -->
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 18pt; border-bottom: 2.5px solid ${primaryColor};">
        <tr>
          <td style="padding-bottom: 10pt;">
            <h1 style="color: ${primaryColor}; font-family: 'Arial', sans-serif; font-size: 20pt; font-weight: bold; margin: 0 0 4pt 0;">${escapeHtml(config.finalDocType)}</h1>
            <p style="color: #64748b; font-family: 'Arial', sans-serif; font-size: 10pt; margin: 0; font-style: italic;">Support Pédagogique Didactique</p>
          </td>
        </tr>
      </table>
    `;
  }

  bodyHtml += `
    <!-- Meta Details Card -->
    <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 24pt; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
      <tr>
        <td style="padding: 12pt; font-family: 'Arial', sans-serif; font-size: 10.5pt; color: #334155;">
          <table cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 50%; padding-bottom: 6pt;">
                <strong>Type de ressource :</strong> ${escapeHtml(config.finalDocType || "Fiche d'activité")}
              </td>
              <td style="width: 50%; padding-bottom: 6pt;">
                <strong>Discipline :</strong> ${escapeHtml(config.finalSubject || "Enseignement Général")}
              </td>
            </tr>
            <tr>
              <td style="width: 50%;">
                <strong>Classe / Niveau :</strong> ${escapeHtml(config.finalGrade || "Niveau Scolaire")}
              </td>
              <td style="width: 50%;">
                <strong>Format d'origine :</strong> Microsoft Word (Éditable / Modifiable)
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  // Render parsed blocks as HTML elements
  parsedBlocks.forEach((block) => {
    switch (block.type) {
      case "h1": {
        const hText = renderInlineSpansToHtml(block.text || "");
        bodyHtml += `<h1 style="color: ${primaryColor}; font-family: 'Arial', sans-serif; font-size: 16pt; font-weight: bold; margin-top: 18pt; margin-bottom: 8pt; border-bottom: 1.5px solid ${primaryColor}; padding-bottom: 4px;">${hText}</h1>`;
        break;
      }
      case "h2": {
        const hText = renderInlineSpansToHtml(block.text || "");
        bodyHtml += `<h2 style="color: ${primaryColor}; font-family: 'Arial', sans-serif; font-size: 13pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">${hText}</h2>`;
        break;
      }
      case "h3": {
        const hText = renderInlineSpansToHtml(block.text || "");
        bodyHtml += `<h3 style="color: #1e293b; font-family: 'Arial', sans-serif; font-size: 11pt; font-weight: bold; margin-top: 10pt; margin-bottom: 4pt;">${hText}</h3>`;
        break;
      }
      case "paragraph": {
        // Double check if this paragraph is hosting a simple LaTeX formula replacement token
        // In this newly optimized flow, block formulas are separate, but we handle paragraphs safely
        const rawText = block.text || "";
        if (rawText.trim()) {
          const pText = renderInlineSpansToHtml(rawText);
          bodyHtml += `<p style="font-family: 'Arial', sans-serif; font-size: 10.5pt; color: #334155; line-height: 1.5; margin-top: 0; margin-bottom: 8pt; text-align: justify;">${pText}</p>`;
        }
        break;
      }
      case "blockquote": {
        const qLines = (block.text || "").split("\n");
        const qHtml = qLines.map(line => renderInlineSpansToHtml(line)).join("<br />");
        bodyHtml += `
          <table cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 8pt; margin-bottom: 10pt; border-collapse: collapse;">
            <tr>
              <td style="width: 4px; background-color: ${primaryColor};">&nbsp;</td>
              <td style="background-color: #f8fafc; padding: 8pt 12pt; font-family: 'Arial', sans-serif; font-size: 10pt; color: #475569; font-style: italic;">
                ${qHtml}
              </td>
            </tr>
          </table>
        `;
        break;
      }
      case "bullet_list": {
        if (block.items && block.items.length > 0) {
          bodyHtml += `<ul style="margin-top: 0; margin-bottom: 8pt; padding-left: 18pt;">`;
          block.items.forEach((item) => {
            const itemText = renderInlineSpansToHtml(item);
            bodyHtml += `<li style="font-family: 'Arial', sans-serif; font-size: 10.5pt; color: #334155; margin-bottom: 3.5pt;">${itemText}</li>`;
          });
          bodyHtml += `</ul>`;
        }
        break;
      }
      case "numbered_list": {
        if (block.items && block.items.length > 0) {
          bodyHtml += `<ol style="margin-top: 0; margin-bottom: 8pt; padding-left: 18pt;">`;
          block.items.forEach((item) => {
            const itemText = renderInlineSpansToHtml(item);
            bodyHtml += `<li style="font-family: 'Arial', sans-serif; font-size: 10.5pt; color: #334155; margin-bottom: 3.5pt;">${itemText}</li>`;
          });
          bodyHtml += `</ol>`;
        }
        break;
      }
      case "table": {
        if (block.headers && block.rows) {
          bodyHtml += `
            <table cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: 12pt; border: 1px solid #cbd5e1;">
              <thead>
                <tr style="background-color: ${primaryColor};">
                  ${block.headers.map(h => {
                    const hText = renderInlineSpansToHtml(h);
                    return `<th style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 10pt; font-weight: bold; color: #ffffff; text-align: left; padding: 6pt;">${hText}</th>`;
                  }).join("")}
                </tr>
              </thead>
              <tbody>
                ${block.rows.map((row, rIdx) => {
                  const bg = rIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
                  return `
                    <tr style="background-color: ${bg};">
                      ${row.map(cell => {
                        const cellText = renderInlineSpansToHtml(cell);
                        return `<td style="border: 1px solid #cbd5e1; font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #334155; padding: 6pt;">${cellText}</td>`;
                      }).join("")}
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `;
        }
        break;
      }
      case "hr": {
        bodyHtml += `<hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 12pt; margin-bottom: 12pt;" />`;
        break;
      }
      case "math_block": {
        // Extract raw latex of formula and display it beautifully as a editable text block
        const cleanFormulaText = block.text ? latexToWordMath(block.text) : "";
        if (cleanFormulaText) {
          bodyHtml += `
            <div style="background-color: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 4px; padding: 10pt 14pt; margin: 12pt 0; text-align: center; font-family: 'Consolas', 'Courier New', monospace; font-size: 11pt; color: #1e3a8a; font-weight: bold;">
              [ FORMULE MODIFIABLE ]&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(cleanFormulaText)}
            </div>
          `;
        }
        break;
      }
      case "mermaid_block": {
        // Display Mermaid code format inside an elegant code structure box
        const rawCode = block.text || "";
        bodyHtml += `
          <table cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10pt; margin-bottom: -4pt; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 4px;">
            <tr>
              <td style="font-family: 'Consolas', 'Courier New', monospace; font-size: 9pt; color: #475569;">
                <strong style="color: #0f766e; font-size: 9.5pt;">📊 DIAGRAMME STRUCTUREL (Mermaid Code)</strong><br />
                <pre style="margin: 4pt 0 0 0; line-height: 1.3;">${escapeHtml(rawCode)}</pre>
              </td>
            </tr>
          </table>
          <p style="font-family: 'Arial', sans-serif; font-size: 8.5pt; color: #64748b; margin-top: 4pt; margin-bottom: 12pt; font-style: italic;">
            (Pour voir le rendu visuel complet haute définition de ce graphique, veuillez vous référer à votre version d'export PDF.)
          </p>
        `;
        break;
      }
      case "svg_block": {
        // SVG drawings detect which lesson we are in (e.g. Circular Angles or Optics)
        const blockContent = block.text || "";
        let diagType: "angles" | "optics" | "general" = "general";
        if (blockContent.toLowerCase().includes("cx=\"200\"") && blockContent.toLowerCase().includes("cy=\"200\"")) {
          diagType = "angles";
        } else if (blockContent.toLowerCase().includes("lens") || blockContent.toLowerCase().includes("foyer") || blockContent.toLowerCase().includes("optic")) {
          diagType = "optics";
        }
        
        bodyHtml += `
          <div style="margin-top: 12pt; margin-bottom: 12pt; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10pt; background-color: #fafafa;">
            <p style="font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #475569; margin: 0 0 8pt 0; text-align: justify;">
              <strong>📐 SCHÉMA TECHNIQUE D'ACCOMPAGNEMENT :</strong><br/>
              <em>Ce schéma géométrique interactif est disponible en couleurs haute résolution dans votre version d'export PDF. Afin de rester 100% modifiable et d'éviter d'endommager votre traitement de texte Word, les paramètres clés du schéma sont présentés ci-dessous :</em>
            </p>
            ${renderDiagramDescriptionTable(diagType)}
          </div>
        `;
        break;
      }
      default:
        break;
    }
  });

  // Footer Standard
  if (config.finalIncludeBrandFooter !== false) {
    bodyHtml += `
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 30pt; border-top: 1px solid #e2e8f0; padding-top: 8pt;">
        <tr>
          <td style="font-family: 'Arial', sans-serif; font-size: 8.5pt; color: #64748b; text-align: left;">
            Document pédagogique modifiable généré informatiquement par l'Assistant Virtuel de Monsieur FABRICEL.
          </td>
          <td style="font-family: 'Arial', sans-serif; font-size: 8.5pt; color: #64748b; text-align: right;">
            Toamasina, Madagascar
          </td>
        </tr>
      </table>
    `;
  } else {
    bodyHtml += `
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 30pt; border-top: 1px solid #e2e8f0; padding-top: 8pt;">
        <tr>
          <td style="font-family: 'Arial', sans-serif; font-size: 8.5pt; color: #64748b; text-align: left;">
            Support d'activités et ressources didactiques. Format de fichier éditable.
          </td>
          <td style="font-family: 'Arial', sans-serif; font-size: 8.5pt; color: #64748b; text-align: right;">
            Fiche de travail / Document de classe
          </td>
        </tr>
      </table>
    `;
  }

  // Full Word Document wrappers, conforming strictly to standard HTML requirements of Microsoft Word import filters 
  const docHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>Document - Monsieur FABRICEL</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 {
            size: 8.27in 11.69in; /* A4 standard */
            margin: 1.0in 1.0in 1.0in 1.0in;
            mso-header-margin: .5in;
            mso-footer-margin: .5in;
            mso-paper-source: 0;
          }
          div.Section1 {
            page: Section1;
          }
          body {
            font-family: 'Arial', sans-serif;
            font-size: 10.5pt;
            color: #334155;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${bodyHtml}
        </div>
      </body>
    </html>
  `;

  // MUST include the Unicode BOM (\ufeff) so Word parses non-ASCII French chars correctly
  const documentBlob = new Blob(["\ufeff", docHtml], { type: "application/vnd.ms-word;charset=utf-8" });
  
  const safeSubjectLabel = (config.finalSubject || "sujet").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "_");
  
  const safeTypeLabel = (config.finalDocType || "fiche").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "_");

  const docxUrl = URL.createObjectURL(documentBlob);
  const filename = `document-fabricel-${safeTypeLabel}-${safeSubjectLabel}-${Date.now().toString().slice(-6)}.doc`;

  try {
    const link = document.createElement("a");
    link.href = docxUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.warn("Automated link click for Word file failed. Using fallback link.");
  }

  return { docxUrl, filename };
};
