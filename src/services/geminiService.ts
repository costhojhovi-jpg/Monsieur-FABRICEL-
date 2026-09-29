import { SYSTEM_INSTRUCTION } from "./systemPrompt";

const API_BASE_URL = "https://monsieur-fabricel.onrender.com";

export interface Message {
  id?: string;
  role: "user" | "model";
  text: string;
  attachments?: {
    mimeType: string;
    data: string; // base64
  }[];
}

export { SYSTEM_INSTRUCTION };

export const getCustomApiKey = () => {
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('GEMINI_API_KEY');
    if (localKey && localKey.trim()) return localKey.trim();
  }
  return null;
};

export function getFriendlyErrorMessage(error: any): string {
  const errorStr = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
  
  if (errorStr.includes("503") || errorStr.includes("high demand") || errorStr.includes("UNAVAILABLE") || errorStr.includes("temporary") || errorStr.includes("overloaded")) {
    return "⚠️ **Forte demande sur le serveur IA (Erreur 503)**. Le mode résilience didactique a pris le relais pour générer votre document sans blocage.";
  }
  
  if (errorStr.includes("429") || errorStr.includes("Quota exceeded") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("exhausted")) {
    return "⚠️ **Quota de requêtes temporairement atteint**. Monsieur FABRICEL active son moteur didactique local pour que vous puissiez continuer à travailler sans attente.";
  }
  
  if (errorStr.includes("Clé API non configurée") || errorStr.includes("API key not valid") || errorStr.includes("key is missing") || errorStr.includes("CONFIG_REQUIRED")) {
    return "ℹ️ **Clé API non configurée ou en cours de renouvellement**. Monsieur FABRICEL a activé son moteur pédagogique embarqué pour répondre immédiatement.";
  }
  
  if (errorStr.includes("500") || errorStr.includes("INTERNAL") || errorStr.includes("internal")) {
    return "⚠️ **Erreur interne momentanée du serveur**. Le moteur didactique local prend le relais pour garantir la continuité.";
  }

  return `Communication avec le serveur IA perturbée (${errorStr.substring(0, 150)}...). Génération via le moteur didactique de secours.`;
}

/**
 * Moteur didactique de résilience pédagogique conforme au Nouveau Programme d'Études (MEN Madagascar).
 * Permet de générer instantanément des documents didactiques complets et de qualité professionnelle
 * lorsque l'API est indisponible, en dépassement de quota ou en panne de réseau.
 */
export function generateDidacticFallback(prompt: string): string {
  const pLower = prompt.toLowerCase();
  
  // Extract possible level/class
  let level = "Collège (6ème / 5ème / 4ème / 3ème)";
  if (pLower.includes("6e") || pLower.includes("6ème") || pLower.includes("t6")) level = "6ème (T6)";
  else if (pLower.includes("5e") || pLower.includes("5ème") || pLower.includes("t7")) level = "5ème (T7)";
  else if (pLower.includes("4e") || pLower.includes("4ème") || pLower.includes("t8")) level = "4ème (T8)";
  else if (pLower.includes("3e") || pLower.includes("3ème") || pLower.includes("t9")) level = "3ème (T9 - Préparation BEPC)";
  else if (pLower.includes("primaire") || pLower.includes("cepe") || pLower.includes("t5") || pLower.includes("cm2")) level = "Primaire T5 (Préparation CEPE)";
  else if (pLower.includes("seconde") || pLower.includes("2nde") || pLower.includes("t10")) level = "Seconde (T10 Lycée)";
  else if (pLower.includes("premiere") || pLower.includes("1ère") || pLower.includes("t11")) level = "Première (T11 Lycée)";
  else if (pLower.includes("terminale") || pLower.includes("bac") || pLower.includes("t12")) level = "Terminale (T12 - Baccalauréat)";

  // Extract possible subject
  let subject = "Mathématiques";
  if (pLower.includes("physique") || pLower.includes("chimie") || pLower.includes("spc") || pLower.includes("sciences physiques")) subject = "Sciences Physiques et Chimiques";
  else if (pLower.includes("svt") || pLower.includes("biologie") || pLower.includes("géologie") || pLower.includes("naturelles")) subject = "Sciences de la Vie et de la Terre (SVT)";
  else if (pLower.includes("francais") || pLower.includes("français") || pLower.includes("grammaire") || pLower.includes("conjugaison")) subject = "Français";
  else if (pLower.includes("malagasy") || pLower.includes("fiteny") || pLower.includes("fanoratana")) subject = "Malagasy (Fiteny sy Fanabeazana)";
  else if (pLower.includes("histoire") || pLower.includes("geo") || pLower.includes("géographie") || pLower.includes("fov")) subject = "Histoire-Géographie & Éducation à la Citoyenneté";
  else if (pLower.includes("anglais") || pLower.includes("english")) subject = "Anglais (English Language)";

  // Case 1: Exercices / Évaluation / Devoir
  if (pLower.includes("exercice") || pLower.includes("évaluation") || pLower.includes("evaluation") || pLower.includes("devoir") || pLower.includes("test") || pLower.includes("bepc") || pLower.includes("cepe") || pLower.includes("bac")) {
    return `> 💡 **Mode Résilience Didactique Activé :** *Document généré par le moteur pédagogique embarqué de Monsieur FABRICEL selon le Nouveau Programme d'Études (MEN Madagascar).*

# ÉVALUATION FORMATIVE CRITÉRIÉE (APC)
**Discipline :** ${subject}  
**Niveau ciblé :** ${level}  
**Cadre de référence :** Nouveau Programme d'Études (MEN Madagascar - Généralisation PE)

---

## I. CONSIGNES OFFICIELLES & GRILLE D'ÉVALUATION MEN
L'évaluation applique rigoureusement les critères de correction préconisés par le Ministère de l'Éducation Nationale :
* **Critère 1 (C1) - Pertinence (40%) :** Compréhension globale du sujet, choix judicieux de la méthode de résolution.
* **Critère 2 (C2) - Utilisation correcte des outils de la discipline (35%) :** Exactitude des formules, théorèmes, définitions, propriétés et calculs techniques.
* **Critère 3 (C3) - Cohérence interne (15%) :** Enchaînement logique du raisonnement, rigueur de la démarche, conclusion claire et justifiée.
* **Critère 4 (C4) - Critère de perfectionnement (10%) :** Soin de la copie, clarté rédactionnelle, respect des unités (Ariary, mètres, kg).

---

## II. ÉNONCÉ DES EXERCICES PROGRESSIFS

### Exercice 1 : Restitution organisée et consolidation des savoirs (6 points)
1. **Rappeler** la définition ou la règle fondamentale relative au thème abordé en précisant son domaine d'application. *(2 pts - C2)*
2. **Application directe :** Résoudre le cas d'école élémentaire pour vérifier l'acquisition du mécanisme de base. *(2 pts - C1, C2)*
3. **Justification :** Expliquer brièvement pourquoi cette propriété s'applique dans les conditions données. *(2 pts - C3)*

### Exercice 2 : Maîtrise des techniques et raisonnement guidé (6 points)
Un enseignant de ${level} souhaite organiser une activité pratique avec ses élèves.
1. Formuler les hypothèses de travail à partir des données initiales. *(2 pts - C1)*
2. Effectuer les calculs intermédiaires en détaillant chaque étape de la démarche. *(2 pts - C2, C3)*
3. Conclure en interprétant le résultat obtenu dans le contexte de la classe. *(2 pts - C3, C4)*

### Exercice 3 : Situation d'intégration contextualisée à Madagascar (8 points)
**Contexte :** Dans une coopérative agricole de la région d'Analamanga / Vakinankaratra, un exploitant prépare sa saison rizicole et maraîchère. Il doit évaluer les rendements, les proportions d'engrais organique et la rentabilité financière en Ariary.

**Tâches de l'apprenant :**
1. **Identifier (C1)** les données pertinentes du problème et poser le modèle mathématique ou scientifique correspondant. *(2,5 pts)*
2. **Développer (C2)** la résolution complète en appliquant les théorèmes et formules appropriés. *(3 pts)*
3. **Valider & Conclure (C3)** en fournissant une recommandation chiffrée, argumentée et rédigée avec soin. *(2,5 pts)*

---

## III. ÉLÉMENTS DE CORRIGÉ ET BARÈME DÉTAILLÉ
* **Barème C1 :** Attribution des points dès que la démarche montre la sélection correcte des informations et l'amorce de la bonne formule.
* **Barème C2 :** Sanctionner les erreurs d'inattention de calcul sans pénaliser deux fois le même raisonnement (erreur propagée acceptée).
* **Barème C3 :** Vérifier que la réponse finale comporte l'unité appropriée et une phrase de conclusion explicite.
* **Remédiation didactique ("Fanarenana pedagojika") :** Prévoir une séance d'appui pour les élèves n'ayant pas validé les critères C1 et C2.`;
  }

  // Case 2: Situation-problème seule
  if (pLower.includes("situation-problème") || pLower.includes("situation probleme") || pLower.includes("sae") || pLower.includes("apc")) {
    return `> 💡 **Mode Résilience Didactique Activé :** *Situation-problème conçue selon l'Approche Par Compétences du Nouveau Programme d'Études (MEN).*

# SITUATION-PROBLÈME CONTEXTUALISÉE (APC)
**Discipline :** ${subject}  
**Classe :** ${level}  
**Contexte géographique & culturel :** Régions de Madagascar (Commerce local, agriculture et vie courante)

---

### 1. Contexte et Déclencheur (Fampidirana ny toe-javatra)
Monsieur Rivo, commerçant au marché d'Anosibe à Antananarivo, reçoit une livraison de produits agricoles transportés depuis Antsirabe. Pour rentabiliser son transport par camionnette et fixer ses prix au détail pour les familles du quartier, il doit calculer avec exactitude ses coûts de revient, le pourcentage de pertes éventuelles et la marge bénéficiaire en Ariary.

Des échantillons doivent également être mesurés et conditionnés équitablement afin d'assurer la satisfaction des clients et la viabilité de son commerce.

### 2. Données chiffrées & Contraintes
* Montant de l'investissement initial : **350 000 Ariary**.
* Frais de transport et droits de place : **45 000 Ariary**.
* Quantité brute livrée : **250 kg** conditionnés en sacs.
* Taux de perte estimé lors du tri : **4%**.

### 3. Consignes adressées aux élèves
En utilisant les notions étudiées en cours de ${subject} :
1. **Consigne 1 (Pertinence - C1) :** Sélectionne les données utiles pour déterminer la masse nette commercialisable et le coût total de revient.
2. **Consigne 2 (Outils de la discipline - C2) :** Calcule le prix de vente unitaire minimal par kilogramme permettant à Monsieur Rivo de réaliser un bénéfice de 20%.
3. **Consigne 3 (Cohérence et Communication - C3/C4) :** Rédige un compte-rendu clair et soigné présentant tes calculs ordonnés et un conseil pratique pour optimiser la vente.

---

### 4. Guide d'animation pour l'enseignant
* **Phase de recherche (15 min) :** Travail en petits groupes de 3 ou 4 élèves. L'enseignant circule pour observer les représentations initiales sans donner la solution.
* **Mise en commun (15 min) :** Deux groupes aux démarches contrastées présentent leurs pistes au tableau. Débat constructif entre pairs.
* **Synthèse et institutionnalisation (15 min) :** Formalisation de la règle mathématique et lien avec le programme officiel.`;
  }

  // Case 3 (Default): Fiche de préparation pédagogique complète
  return `> 💡 **Mode Résilience Didactique Activé :** *Fiche pédagogique générée par le moteur didactique embarqué de Monsieur FABRICEL selon le Nouveau Programme d'Études (MEN Madagascar).*

# FICHE DE PRÉPARATION PÉDAGOGIQUE
*(Conforme au Nouveau Programme d'Études - Ministère de l'Éducation Nationale de Madagascar)*

---

## I. IDENTIFICATION
- **DREN / CISCO :** [À préciser par l'enseignant]
- **Établissement :** Collège d'Enseignement Général (CEG) / Lycée
- **Discipline :** ${subject}
- **Classe / Niveau :** ${level}
- **Effectif moyen :** 45 élèves (G: 22, F: 23)
- **Durée de la séance :** 1 séance de 55 minutes
- **Titre de la leçon :** Approfondissement et maîtrise opérationnelle en ${subject}
- **Prérequis indispensables :** Notions de base des classes antérieures, calcul élémentaire et lecture de consignes.

---

## II. CADRE CURRICULAIRE DU NOUVEAU PROGRAMME D'ÉTUDES
- **Compétence visée (Palier) :** Mobiliser les connaissances, concepts et techniques de la discipline pour résoudre des situations-problèmes concrètes issues de la vie quotidienne à Madagascar.
- **Objectif d'Apprentissage (OA) mesurable :**  
  *À la fin de la séance de 55 minutes, chaque élève sera capable d'appliquer la règle méthodologique principale pour résoudre au moins 2 exercices d'application sans erreur de démarche (Critères C1 et C2 validés).*
- **Matériels didactiques & Supports :** Tableau noir, craie, règle graduée / instruments de géométrie, cahier de cours, fiches d'activités élèves (FRP).

---

## III. DÉROULEMENT DIDACTIQUE DE LA SÉANCE (DÉMARCHE EN 4 PHASES)

### Phase 1 : Motivation et Situation-Problème de départ (10 min)
* **Activité de l'enseignant :** Présente une brève situation de départ contextualisée (ex: gestion des récoltes de riz ou calcul d'échange commercial au marché local). Pose une question ouverte pour susciter le questionnement et le besoin d'un nouvel outil.
* **Activité des élèves :** Écoutent, analysent la situation, expriment leurs hypothèses et constatent l'insuffisance des outils connus.
* **Modalité :** Collectif / Échanges dirigés.

### Phase 2 : Activité de Recherche et d'Action (15 min)
* **Activité de l'enseignant :** Propose une tâche ciblée de manipulation ou de recherche guidée. Circule dans les rangs pour stimuler les élèves hésitants sans faire le travail à leur place.
* **Activité des élèves :** Travaillent en binômes, comparent leurs résultats, rédigent leurs essais sur le cahier de brouillon.
* **Modalité :** Travail en binômes (Pédagogie active / APC).

### Phase 3 : Confrontation, Synthèse et Institutionnalisation (15 min)
* **Activité de l'enseignant :** Fait noter au tableau les démarches trouvées par les élèves. Dégage la règle officielle, énonce le théorème ou la notion clé en français précis, avec traduction des notions clés en Malagasy si nécessaire pour consolider la compréhension.
* **Activité des élèves :** Participent à la formulation de la règle générale, puis recopient la trace écrite structurée dans leur cahier de cours.
* **Modalité :** Tableau interactif et prise de notes individuelle.

### Phase 4 : Évaluation formative critériée et Remédiation (15 min)
* **Activité de l'enseignant :** Fait résoudre un exercice test individuel chronométré. Évalue immédiatement sur la base des critères C1 (pertinence) et C2 (utilisation des outils).
* **Activité des élèves :** Résolvent l'exercice de façon autonome.
* **Critères retenus :** C1 (choix de la formule), C2 (exactitude du calcul), C3 (phrase de réponse claire).

---

## IV. DEVOIR À LA MAISON ET TRAVAIL PERSONNEL
* Deux exercices d'entraînement progressifs tirés du manuel officiel ou de la fiche de ressources pédagogiques (FRP).
* Prolongement : Réfléchir à une situation dans sa propre commune où cette notion mathématique ou scientifique intervient quotidiennement.

*Mazotoa amin'ny fanomanana lesona ! Mahereza daholo !*`;
}

export async function chatWithGemini(history: Message[]): Promise<string> {
  const customApiKey = getCustomApiKey();
  const latestMessage = history[history.length - 1]?.text || "";

  try {
    let res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, customApiKey }),
      cache: "no-store"
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, customApiKey }),
        cache: "no-store"
      });
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      console.warn("API returned error, engaging Didactic Resilience Engine:", errData);
      return generateDidacticFallback(latestMessage);
    }

    const data = await res.json();
    return data.text || generateDidacticFallback(latestMessage);
  } catch (error: any) {
    console.warn("Gemini API network issue, falling back to Didactic Resilience Engine:", error);
    return generateDidacticFallback(latestMessage);
  }
}

export async function* chatWithGeminiStream(history: Message[]) {
  const customApiKey = getCustomApiKey();
  const latestMessage = history[history.length - 1]?.text || "";

  try {
    let response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, customApiKey }),
      cache: "no-store"
    });

    if (!response.ok && response.status === 404) {
      response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, customApiKey }),
        cache: "no-store"
      });
    }

    if (!response.ok) {
      console.warn(`Server API stream returned status ${response.status}. Activating Didactic Resilience Engine.`);
      const fallbackContent = generateDidacticFallback(latestMessage);
      
      // Stream fallback content smoothly in progressive chunks so user experiences continuous streaming
      const chunkSize = 25;
      for (let i = 0; i < fallbackContent.length; i += chunkSize) {
        yield fallbackContent.substring(i, i + chunkSize);
        await new Promise(r => setTimeout(r, 12));
      }
      return;
    }

    if (!response.body) {
      throw new Error("Le flux de réponse est vide.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let receivedAnyText = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        
        const dataStr = trimmed.replace(/^data:\s*/, "");
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            console.warn("API SSE payload reported error:", parsed.error);
            if (!receivedAnyText) {
              const fallbackContent = generateDidacticFallback(latestMessage);
              yield fallbackContent;
            } else {
              yield `\n\n*(Fin de réponse anticipée : ${parsed.error})*`;
            }
            return;
          }
          if (parsed.text) {
            receivedAnyText = true;
            yield parsed.text;
          }
          if (parsed.done) {
            return;
          }
        } catch (e) {
          // ignore malformed SSE line
        }
      }
    }
  } catch (error: any) {
    console.warn("Gemini API Stream encountered error, engaging Didactic Resilience Engine:", error);
    const fallbackContent = generateDidacticFallback(latestMessage);
    yield fallbackContent;
  }
}
