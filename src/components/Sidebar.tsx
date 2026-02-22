import React from 'react';
import { BookOpen, CheckCircle, Circle, ChevronRight, LayoutDashboard, PlusCircle, Settings, LogOut } from 'lucide-react';
import { Course, Module, StepProgress } from '../types';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  course: Course | null;
  stepProgress: StepProgress[];
  currentLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  onViewDashboard: () => void;
  onViewBuilder: () => void;
  activeView: 'lesson' | 'dashboard' | 'builder';
}

export default function Sidebar({
  course,
  stepProgress,
  currentLessonId,
  onSelectLesson,
  onViewDashboard,
  onViewBuilder,
  activeView
}: SidebarProps) {
  const getLessonStatus = (lessonId: string) => {
    const lessonSteps = stepProgress.filter(p => p.lesson_id === lessonId);
    const completedSteps = lessonSteps.filter(p => p.status === 'completed').length;
    
    if (completedSteps === 5) return 'completed';
    if (completedSteps > 0) return 'in_progress';
    return 'not_started';
  };

  return (
    <div className="w-72 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col text-zinc-300">
      <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-bold text-xl text-white tracking-tight">CodeLoom</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-1">
          <button
            onClick={onViewDashboard}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
              activeView === 'dashboard' ? "bg-zinc-800 text-white" : "hover:bg-zinc-800/50"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Learning Center
          </button>
          <button
            onClick={onViewBuilder}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
              activeView === 'builder' ? "bg-zinc-800 text-white" : "hover:bg-zinc-800/50"
            )}
          >
            <PlusCircle className="w-4 h-4" />
            Lesson Builder
          </button>
        </div>

        {course && (
          <div className="space-y-4">
            <h2 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{course.title}</h2>
            {course.modules.map((module: Module) => (
              <div key={module.id} className="space-y-1">
                <div className="px-3 py-1 flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <ChevronRight className="w-3 h-3" />
                  {module.title}
                </div>
                <div className="space-y-0.5 pl-4">
                  {module.lessons.map(lesson => {
                    const status = getLessonStatus(lesson.id);
                    const isActive = currentLessonId === lesson.id && activeView === 'lesson';
                    
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => onSelectLesson(lesson.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm text-left",
                          isActive ? "bg-indigo-600/10 text-indigo-400" : "hover:bg-zinc-800/50 text-zinc-400"
                        )}
                      >
                        {status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : status === 'in_progress' ? (
                          <Circle className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-600" />
                        )}
                        <span className="truncate">{lesson.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-sm font-medium">
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-sm font-medium text-rose-400">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
