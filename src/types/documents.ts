export type DocumentFormat = "pdf" | "docx";

export interface DocumentRequest {
  format: DocumentFormat;
  title: string;
  content: string;
  filename?: string;
}

export interface GeneratedDocument {
  format: DocumentFormat;
  filename: string;
  url: string;
  mimeType?: string;
}

export interface SavedDocument {
  id: string;
  userId?: string;
  filename: string;
  title: string;
  format: DocumentFormat;
  url?: string;
  content?: string;
  createdAt?: unknown;
}
