export type MessageRole = "user" | "model";

export interface Attachment {
  mimeType: string;
  data: string;
  name?: string;
}

export interface Message {
  id?: string;
  role: MessageRole;
  text: string;
  attachments?: Attachment[];
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
