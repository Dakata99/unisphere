
export interface Course {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
}

export interface Note {
  id: string;
  courseId: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface Material {
  id: string;
  courseId: string;
  noteId?: string; // Optional: can belong to a specific note
  name: string;
  type: 'Link' | 'File' | 'Reference';
  url: string;
  addedAt: number;
}

export type View = 'catalog' | 'course-detail' | 'add-course';
