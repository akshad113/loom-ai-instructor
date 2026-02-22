import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Terminal, Eye, Code2, Download, Share2 } from 'lucide-react';
import { Lesson } from '../types';
import { getCodeFeedback } from '../services/gemini';

interface CodeIDEProps {
  lesson: Lesson;
  code: string;
  onCodeChange: (code: string) => void;
  onFeedback: (feedback: any) => void;
}

export default function CodeIDE({
  lesson,
  code,
  onCodeChange,
  onFeedback
}: CodeIDEProps) {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [pyodide, setPyodide] = useState<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (lesson.language === 'python' && !pyodide) {
      loadPyodide();
    }
  }, [lesson.language]);

  const loadPyodide = async () => {
    if (pyodide) return;
    setOutput('Loading Python runtime...');
    try {
      // Wait for script to be ready if needed
      let attempts = 0;
      while (!(window as any).loadPyodide && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!(window as any).loadPyodide) {
        throw new Error("Pyodide script not found or failed to load. Check your internet connection.");
      }

      const py = await (window as any).loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
      });
      setPyodide(py);
      setOutput('Python runtime ready.');
    } catch (err) {
      setOutput(`Failed to load Python runtime: ${formatError(err)}`);
      console.error(err);
    }
  };

  const openInColab = () => {
    // Copy code to clipboard and open Colab
    navigator.clipboard.writeText(code);
    window.open('https://colab.research.google.com/notebook#create=true', '_blank');
    setOutput('Code copied to clipboard! You can now paste it into the new Colab notebook.');
  };

  const formatError = (err: any): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (err instanceof Event) return `Event: ${err.type}`;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');
    
    try {
      if (lesson.language === 'javascript') {
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args) => logs.push(args.map(a => String(a)).join(' '));
        
        try {
          // eslint-disable-next-line no-eval
          eval(code);
          setOutput(logs.join('\n') || 'Code executed successfully (no output).');
        } catch (err: any) {
          setOutput(`Error: ${formatError(err)}`);
        } finally {
          console.log = originalLog;
        }
      } else if (lesson.language === 'html') {
        setActiveTab('preview');
        if (iframeRef.current) {
          const doc = iframeRef.current.contentDocument;
          if (doc) {
            doc.open();
            doc.write(code);
            doc.close();
          }
        }
        setOutput('HTML rendered in preview.');
      } else if (lesson.language === 'python') {
        if (!pyodide) {
          setOutput('Python runtime not ready.');
        } else {
          try {
            const result = await pyodide.runPythonAsync(code);
            setOutput(String(result) || 'Code executed successfully.');
          } catch (err: any) {
            setOutput(`Python Error: ${formatError(err)}`);
          }
        }
      }

      // Get AI Feedback after run
      const feedback = await getCodeFeedback(lesson, code, output);
      onFeedback(feedback);
    } catch (err: any) {
      setOutput(`System Error: ${formatError(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetCode = () => {
    onCodeChange(lesson.example);
    setOutput('');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      {/* Toolbar */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'editor' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Editor
            </button>
            {lesson.language === 'html' && (
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'preview' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            )}
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {lesson.language}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetCode}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
            title="Reset Code"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={runCode}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Run Code'}
          </button>
          
          {lesson.language === 'python' && (
            <button
              onClick={openInColab}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-bold transition-all border border-zinc-700"
              title="Open in Google Colab"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-500" />
              Colab
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative">
          {activeTab === 'editor' ? (
            <Editor
              height="100%"
              language={lesson.language}
              theme="vs-dark"
              value={code}
              onChange={(val) => onCodeChange(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 }
              }}
            />
          ) : (
            <iframe
              ref={iframeRef}
              title="Preview"
              className="w-full h-full bg-white"
            />
          )}
        </div>

        {/* Console */}
        <div className="h-48 border-t border-zinc-800 bg-zinc-950 flex flex-col">
          <div className="h-8 border-b border-zinc-800 px-4 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <Terminal className="w-3 h-3" />
              Console Output
            </div>
            <button 
              onClick={() => setOutput('')}
              className="text-[10px] font-bold text-zinc-600 hover:text-zinc-400 uppercase tracking-widest"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 p-4 font-mono text-xs text-zinc-400 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-500/30">
            {output || <span className="text-zinc-700 italic">No output yet. Run your code to see results.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
