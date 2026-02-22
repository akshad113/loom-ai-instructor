import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import InstructorPanel from './components/InstructorPanel';
import CodeIDE from './components/CodeIDE';
import Dashboard from './components/Dashboard';
import LessonBuilder from './components/LessonBuilder';
import { Course, StepProgress, Lesson, LessonStep } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stepProgress, setStepProgress] = useState<StepProgress[]>([]);
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'home' | 'lesson' | 'dashboard' | 'builder'>('home');
  const [currentStep, setCurrentStep] = useState<LessonStep>('explanation');
  const [userCode, setUserCode] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [coursesRes, progressRes, settRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/progress'),
        fetch('/api/settings')
      ]);
      
      const coursesData = await coursesRes.json();
      const progressData = await progressRes.json();
      const sett = await settRes.json();

      setCourses(coursesData);
      setStepProgress(progressData);
      setVoiceEnabled(sett.voice_enabled === 1);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCourse = (courseId: string) => {
    setCurrentCourseId(courseId);
    const course = courses.find(c => c.id === courseId);
    if (course && course.modules.length > 0 && course.modules[0].lessons.length > 0) {
      handleSelectLesson(course.modules[0].lessons[0].id);
    }
  };

  const handleSelectLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setActiveView('lesson');
    setCurrentStep('explanation');
    
    // Find lesson and set initial code
    const lesson = findLesson(lessonId);
    if (lesson) {
      setUserCode(lesson.example);
    }
  };

  const findLesson = (lessonId: string): Lesson | null => {
    for (const course of courses) {
      for (const mod of course.modules) {
        const lesson = mod.lessons.find(l => l.id === lessonId);
        if (lesson) return lesson;
      }
    }
    return null;
  };

  const handleSaveCourse = async (newCourse: any) => {
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse)
      });
      if (res.ok) {
        await fetchData();
        setActiveView('home');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepChange = async (step: LessonStep) => {
    setCurrentStep(step);
    if (currentLessonId) {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lesson_id: currentLessonId,
            step_id: step,
            status: 'completed'
          })
        });
        // Refresh courses and progress to update UI
        const [coursesRes, progressRes] = await Promise.all([
          fetch('/api/courses'),
          fetch('/api/progress')
        ]);
        const coursesData = await coursesRes.json();
        const progressData = await progressRes.json();
        setCourses(coursesData);
        setStepProgress(progressData);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const currentCourse = currentCourseId ? courses.find(c => c.id === currentCourseId) : null;
  const currentLesson = currentLessonId ? findLesson(currentLessonId) : null;

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium animate-pulse">Initializing Loom AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30">
      <Sidebar
        course={currentCourse}
        stepProgress={stepProgress}
        currentLessonId={currentLessonId}
        onSelectLesson={handleSelectLesson}
        onViewDashboard={() => setActiveView('home')}
        onViewBuilder={() => setActiveView('builder')}
        activeView={activeView === 'home' ? 'dashboard' : activeView}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <Dashboard courses={courses} onSelectCourse={handleSelectCourse} />
            </motion.div>
          )}

          {activeView === 'builder' && (
            <motion.div
              key="builder"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 overflow-hidden flex flex-col"
            >
              <LessonBuilder onSave={handleSaveCourse} />
            </motion.div>
          )}

          {activeView === 'lesson' && currentLesson && (
            <motion.div
              key="lesson"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex overflow-hidden"
            >
              <div className="w-1/3 min-w-[400px]">
                <InstructorPanel
                  lesson={currentLesson}
                  currentStep={currentStep}
                  onStepChange={handleStepChange}
                  onCodeUpdate={setUserCode}
                  userCode={userCode}
                  voiceEnabled={voiceEnabled}
                />
              </div>
              <div className="flex-1">
                <CodeIDE
                  lesson={currentLesson}
                  code={userCode}
                  onCodeChange={setUserCode}
                  onFeedback={() => {}} // Feedback logic can be added here
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
