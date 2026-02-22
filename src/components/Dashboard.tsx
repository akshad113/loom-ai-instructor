import React from 'react';
import { Course } from '../types';
import { BookOpen, Target, Award, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  courses: Course[];
  onSelectCourse: (courseId: string) => void;
}

export default function Dashboard({ courses, onSelectCourse }: DashboardProps) {
  return (
    <div className="flex-1 bg-zinc-950 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white tracking-tight">Learning Center</h1>
          <p className="text-zinc-500 mt-2">Choose a course to continue your journey.</p>
        </header>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course) => (
            <CourseCard 
              key={course.id} 
              course={course} 
              onClick={() => onSelectCourse(course.id)} 
            />
          ))}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-zinc-900">
          <StatCard 
            icon={<BookOpen className="w-5 h-5 text-indigo-500" />}
            label="Available Courses"
            value={courses.length.toString()}
          />
          <StatCard 
            icon={<Target className="w-5 h-5 text-emerald-500" />}
            label="Active Learning"
            value={courses.filter(c => (c.progress || 0) > 0 && (c.progress || 0) < 100).length.toString()}
          />
          <StatCard 
            icon={<Award className="w-5 h-5 text-amber-500" />}
            label="Completed Courses"
            value={courses.filter(c => (c.progress || 0) === 100).length.toString()}
          />
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course, onClick }: { course: Course, onClick: () => void }) {
  const progress = course.progress || 0;

  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="group bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full"
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={course.image_url || `https://picsum.photos/seed/${course.id}/800/450`} 
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center justify-between text-white mb-2">
            <span className="text-xs font-bold uppercase tracking-widest bg-indigo-600 px-2 py-1 rounded">
              {course.modules.length} Modules
            </span>
            <span className="text-xs font-bold">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
          {course.title}
        </h3>
        <p className="text-zinc-400 text-sm line-clamp-2 mb-6">
          {course.description}
        </p>
        
        <button 
          onClick={onClick}
          className="mt-auto w-full py-3 bg-zinc-800 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 group/btn"
        >
          {progress > 0 ? 'Continue Learning' : 'Start Course'}
          <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
        </button>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 flex items-center gap-4">
      <div className="p-3 bg-zinc-800 rounded-xl">{icon}</div>
      <div>
        <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{label}</h4>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
