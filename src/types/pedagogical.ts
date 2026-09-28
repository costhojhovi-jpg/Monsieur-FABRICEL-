export type SchoolLevel =
  | "T0"
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "T5"
  | "T6"
  | "T7"
  | "T8"
  | "T9"
  | "T10"
  | "T11L"
  | "T11S"
  | "T11OSE"
  | "T12L"
  | "T12S"
  | "T12OSE";
export type PedagogicalProductionType =
  | "question"
  | "fiche_lecon"
  | "fiche_preparation"
  | "cours"
  | "exercice"
  | "serie_exercices"
  | "evaluation"
  | "remediation"
  | "fascicule"
  | "progression"
  | "correction"
  | "autre";

export interface PedagogicalRequest {
  rawPrompt: string;
  niveau?: SchoolLevel;
  matiere?: string;
  composante?: string;
  periode?: string;
  notion?: string;
  typeProduction?: PedagogicalProductionType;
  langue?: string;
  contexte?: string;
  sourceDemandee?: string[];
  contraintes?: string[];
}

export interface CurriculumSource {
  id: string;
  niveau: SchoolLevel;
  matiere?: string;
  type: "RAPE" | "PE" | "FRP" | "LIVRET" | "MANUEL" | "MEN";
  title: string;
  content: string;
  periode?: string;
  notion?: string;
  authority?: string;
}

export interface PedagogicalContext {
  curriculum: CurriculumSource[];
  progression?: string;
  officialSources?: CurriculumSource[];
  previousLessons?: string[];
  prerequisites?: string[];
  validatedStructure?: string;
  constraints?: string[];
}

export interface ValidationIssue {
  severity: "info" | "warning" | "error";
  category:
    | "pedagogical"
    | "curriculum"
    | "mathematical"
    | "language"
    | "structure"
    | "source";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface PedagogicalResponse {
  text: string;
  request: PedagogicalRequest;
  context?: PedagogicalContext;
  validation?: ValidationResult;
}

