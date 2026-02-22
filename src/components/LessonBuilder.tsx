import React, { useState, useRef } from 'react';
import { Save, Plus, Trash2, Upload, FileJson, AlertCircle, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { Course, Module, Lesson } from '../types';
import { parseCurriculumFromFile } from '../services/gemini';

interface LessonBuilderProps {
  onSave: (course: Course) => void;
}

export default function LessonBuilder({ onSave }: LessonBuilderProps) {
  const [course, setCourse] = useState<Course>({
    id: '',
    title: '',
    description: '',
    modules: []
  });
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddModule = () => {
    const newModule: Module = {
      id: `m${Date.now()}`,
      title: 'New Module',
      lessons: []
    };
    setCourse(prev => ({ ...prev, modules: [...prev.modules, newModule] }));
  };

  const handleAddLesson = (moduleId: string) => {
    const newLesson: Lesson = {
      id: `l${Date.now()}`,
      title: 'New Lesson',
      concept: '',
      example: '',
      practice_guided: '',
      practice_independent: '',
      language: 'javascript'
    };
    setCourse(prev => ({
      ...prev,
      modules: prev.modules.map(m => m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m)
    }));
  };

  const handleUpdateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setCourse(prev => ({
      ...prev,
      modules: prev.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l)
      } : m)
    }));
  };

  const handleRemoveLesson = (moduleId: string, lessonId: string) => {
    setCourse(prev => ({
      ...prev,
      modules: prev.modules.map(m => m.id === moduleId ? {
        ...m,
        lessons: m.lessons.filter(l => l.id !== lessonId)
      } : m)
    }));
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.title && parsed.modules) {
        setCourse(parsed);
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        throw new Error('Invalid course format');
      }
    } catch (err) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('loading');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = (event.target?.result as string).split(',')[1];
          
          if (file.type === 'application/json') {
            const text = atob(base64);
            const parsed = JSON.parse(text);
            setCourse(parsed);
            setStatus('success');
          } else {
            const parsed = await parseCurriculumFromFile(base64, file.type);
            if (parsed && parsed.title) {
              setCourse(parsed);
              setStatus('success');
            } else {
              throw new Error('Failed to parse course');
            }
          }
        } catch (err: any) {
          console.error(err);
          const isQuota = err?.message?.includes("quota") || err?.message?.includes("429");
          alert(isQuota 
            ? "The AI is currently at its limit. Please wait a minute before trying to upload another document." 
            : "We couldn't process this file. Please ensure it's a valid PDF or Text file.");
          setStatus('error');
        } finally {
          setTimeout(() => setStatus('idle'), 3000);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className="flex-1 bg-zinc-950 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Course Builder</h1>
            <p className="text-zinc-500 mt-2">Create or import a structured course for your students.</p>
          </div>
          <button
            onClick={() => onSave(course)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20"
          >
            <Save className="w-4 h-4" />
            Save Course
          </button>
        </header>

        {/* Import Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              Upload Document
            </h3>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center p-8 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer group"
            >
              {status === 'loading' ? (
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              ) : (
                <FileText className="w-10 h-10 text-zinc-600 group-hover:text-indigo-400 mb-4 transition-colors" />
              )}
              <p className="text-sm text-zinc-400 text-center">
                {status === 'loading' ? 'AI is analyzing your document...' : 'Click to upload PDF, TXT, or JSON'}
              </p>
              <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-widest">Max size: 10MB</p>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept=".pdf,.txt,.json"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileJson className="w-5 h-5 text-indigo-400" />
              Paste JSON
            </h3>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='Paste your curriculum JSON here...'
              className="flex-1 w-full min-h-[120px] bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status === 'success' && <span className="text-emerald-500 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Imported!</span>}
                {status === 'error' && <span className="text-rose-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Failed.</span>}
              </div>
              <button
                onClick={handleImportJson}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Parse JSON
              </button>
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <input
              type="text"
              value={course.title}
              onChange={(e) => setCourse({ ...course, title: e.target.value })}
              placeholder="Course Title"
              className="w-full bg-transparent text-2xl font-bold text-white border-b border-zinc-800 pb-2 focus:outline-none focus:border-indigo-500"
            />
            <textarea
              value={course.description}
              onChange={(e) => setCourse({ ...course, description: e.target.value })}
              placeholder="Course Description"
              className="w-full bg-transparent text-zinc-400 focus:outline-none resize-none"
            />
          </div>

          {course.modules.map((module) => (
            <div key={module.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 bg-zinc-800/50 flex items-center justify-between border-b border-zinc-800">
                <input
                  type="text"
                  value={module.title}
                  onChange={(e) => setCourse({
                    ...course,
                    modules: course.modules.map(m => m.id === module.id ? { ...m, title: e.target.value } : m)
                  })}
                  className="bg-transparent font-bold text-white focus:outline-none"
                />
                <button
                  onClick={() => handleAddLesson(module.id)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Lesson
                </button>
              </div>
              <div className="p-4 space-y-4">
                {module.lessons.map((lesson) => (
                  <div key={lesson.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4 relative group">
                    <button
                      onClick={() => handleRemoveLesson(module.id, lesson.id)}
                      className="absolute top-4 right-4 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Title</label>
                        <input
                          type="text"
                          value={lesson.title}
                          onChange={(e) => handleUpdateLesson(module.id, lesson.id, { title: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Language</label>
                        <select
                          value={lesson.language}
                          onChange={(e) => handleUpdateLesson(module.id, lesson.id, { language: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="javascript">JavaScript</option>
                          <option value="html">HTML</option>
                          <option value="css">CSS</option>
                          <option value="python">Python</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Concept Explanation</label>
                      <textarea
                        value={lesson.concept}
                        onChange={(e) => handleUpdateLesson(module.id, lesson.id, { concept: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-24"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Worked Example</label>
                        <textarea
                          value={lesson.example}
                          onChange={(e) => handleUpdateLesson(module.id, lesson.id, { example: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-32"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Independent Task</label>
                        <textarea
                          value={lesson.practice_independent}
                          onChange={(e) => handleUpdateLesson(module.id, lesson.id, { practice_independent: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 h-32"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {module.lessons.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-zinc-800 rounded-xl">
                    <p className="text-sm text-zinc-600">No lessons in this module yet.</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={handleAddModule}
            className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 font-bold"
          >
            <Plus className="w-5 h-5" />
            Add New Module
          </button>
        </div>
      </div>
    </div>
  );
}
