export interface Lesson {
  id: string;
  module_id?: string;
  title: string;
  concept: string;
  example: string;
  practice_guided: string;
  practice_independent: string;
  language: string;
  dataset?: string;
  order_index?: number;
}

export interface Module {
  id: string;
  course_id?: string;
  title: string;
  lessons: Lesson[];
  order_index?: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  modules: Module[];
  progress?: number; // Calculated percentage
}

export interface Curriculum {
  id?: number;
  title: string;
  description: string;
  modules: Module[];
}

export interface StepProgress {
  lesson_id: string;
  step_id: LessonStep;
  status: 'completed' | 'not_started';
  updated_at: string;
}

export interface Progress {
  lesson_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  score: number;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  hasCodeUpdate?: boolean;
}

export type LessonStep = 'explanation' | 'example' | 'guided' | 'independent' | 'feedback';
