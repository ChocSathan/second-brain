import type { Note } from './Note';

export interface Category {
  id: string;
  name: string;
  description: string;
  notes: Note[];
  createdAt: Date;
  updatedAt: Date;
}

