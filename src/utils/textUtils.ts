/**
 * Text utility helpers for cleaning exported documents.
 */

export const stripConversationalFiller = (text: string): string => {
  if (!text) return "";
  
  // Split into lines/paragraphs
  const lines = text.split("\n");
  
  // Skip typical assistant introductions or polite openings
  let startIdx = 0;
  while (startIdx < lines.length) {
    const trimmed = lines[startIdx].trim().toLowerCase();
    if (!trimmed) {
      startIdx++;
      continue;
    }
    
    // If it is a heading, list item, table column, math formula block, code block, or an SVG, stop stripping!
    if (
      trimmed.startsWith("#") || 
      trimmed.startsWith("-") || 
      trimmed.startsWith("*") || 
      trimmed.startsWith("|") || 
      trimmed.startsWith("$$") || 
      trimmed.startsWith("<svg") || 
      trimmed.startsWith("```") ||
      /^[0-9]+\./.test(trimmed)
    ) {
      break;
    }
    
    // Typical French / English pedagogical virtual assistant filler phrases
    if (
      trimmed.startsWith("bonjour") ||
      trimmed.startsWith("salut") ||
      trimmed.startsWith("certainement") ||
      trimmed.startsWith("bien sûr") ||
      trimmed.startsWith("voici") ||
      trimmed.startsWith("pour cela") ||
      trimmed.startsWith("je vous propose") ||
      trimmed.startsWith("je suis ravi") ||
      trimmed.startsWith("en tant que") ||
      trimmed.startsWith("en réponse à") ||
      (trimmed.includes("monsieur fabricel") && (trimmed.includes("assistant") || trimmed.includes("ravas") || trimmed.includes("fiche") || trimmed.includes("voici")))
    ) {
      startIdx++;
    } else {
      break;
    }
  }

  // Skip typical pedagogical concluding notes, personal tips, or standard conversational suffix phrases
  let endIdx = lines.length - 1;
  while (endIdx > startIdx) {
    const trimmed = lines[endIdx].trim().toLowerCase();
    if (!trimmed) {
      endIdx--;
      continue;
    }
    
    // If it is structural content, stop stripping
    if (
      trimmed.startsWith("#") || 
      trimmed.startsWith("-") || 
      trimmed.startsWith("*") || 
      trimmed.startsWith("|") || 
      trimmed.startsWith("$$") || 
      trimmed.endsWith("```") || 
      trimmed.endsWith("</svg>")
    ) {
      break;
    }
    
    // Typical conversational closing remarks, greetings, or off-topic advice
    if (
      trimmed.startsWith("j'espère que") ||
      trimmed.startsWith("n'hésitez pas") ||
      trimmed.startsWith("bon courage") ||
      trimmed.startsWith("conseil") ||
      trimmed.startsWith("conseils") ||
      trimmed.startsWith("recommandation") ||
      trimmed.startsWith("note :") ||
      trimmed.startsWith("remarque :") ||
      trimmed.startsWith("cordialement") ||
      trimmed.startsWith("en espérant") ||
      trimmed.startsWith("excllent") ||
      trimmed.startsWith("si vous avez") ||
      trimmed.startsWith("bonne préparation") ||
      trimmed.startsWith("à bientôt")
    ) {
      endIdx--;
    } else {
      break;
    }
  }

  return lines.slice(startIdx, endIdx + 1).join("\n");
};
