import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("codeloom.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    order_index INTEGER,
    FOREIGN KEY(course_id) REFERENCES courses(id)
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL,
    title TEXT NOT NULL,
    concept TEXT,
    example TEXT,
    practice_guided TEXT,
    practice_independent TEXT,
    language TEXT,
    order_index INTEGER,
    FOREIGN KEY(module_id) REFERENCES modules(id)
  );

  CREATE TABLE IF NOT EXISTS step_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    status TEXT DEFAULT 'not_started',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lesson_id, step_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    theme TEXT DEFAULT 'dark',
    voice_enabled INTEGER DEFAULT 1
  );
`);

// Seed initial courses if empty
const courseCount = db.prepare("SELECT COUNT(*) as count FROM courses").get() as { count: number };
if (courseCount.count === 0) {
  const courses = [
    {
      id: "c1",
      title: "Web Development Fundamentals",
      description: "Master the core technologies of the web: HTML, CSS, and JavaScript.",
      image_url: "https://picsum.photos/seed/web/800/450",
      modules: [
        {
          id: "m1",
          title: "HTML Basics",
          lessons: [
            {
              id: "l1",
              title: "What is HTML?",
              concept: "HTML (HyperText Markup Language) is the standard markup language for documents designed to be displayed in a web browser.",
              example: "<!DOCTYPE html>\n<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>",
              practice_guided: "Add a paragraph tag below the heading.",
              practice_independent: "Create a list of your favorite fruits.",
              language: "html"
            }
          ]
        },
        {
          id: "m2",
          title: "CSS Styling",
          lessons: [
            {
              id: "l2",
              title: "CSS Selectors",
              concept: "CSS is used to style HTML elements. Selectors are used to 'find' (or select) the HTML elements you want to style.",
              example: "h1 {\n  color: blue;\n  text-align: center;\n}",
              practice_guided: "Change the color of h1 to red.",
              practice_independent: "Style a paragraph with a green background and white text.",
              language: "css"
            }
          ]
        }
      ]
    },
    {
      id: "c2",
      title: "Python for Beginners",
      description: "Start your coding journey with one of the most popular programming languages.",
      image_url: "https://picsum.photos/seed/python/800/450",
      modules: [
        {
          id: "m3",
          title: "Python Basics",
          lessons: [
            {
              id: "l3",
              title: "Variables and Types",
              concept: "Python is a high-level, interpreted programming language. Variables are containers for storing data values.",
              example: "name = 'Loom'\nage = 1\nprint(f'{name} is {age} year old.')",
              practice_guided: "Create a variable 'city' and assign it your city name.",
              practice_independent: "Calculate the area of a rectangle with width 5 and height 10.",
              language: "python"
            }
          ]
        }
      ]
    }
  ];

  for (const course of courses) {
    db.prepare("INSERT INTO courses (id, title, description, image_url) VALUES (?, ?, ?, ?)").run(
      course.id, course.title, course.description, course.image_url
    );
    for (const mod of course.modules) {
      db.prepare("INSERT INTO modules (id, course_id, title) VALUES (?, ?, ?)").run(
        mod.id, course.id, mod.title
      );
      for (const lesson of mod.lessons) {
        db.prepare("INSERT INTO lessons (id, module_id, title, concept, example, practice_guided, practice_independent, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
          lesson.id, mod.id, lesson.title, lesson.concept, lesson.example, lesson.practice_guided, lesson.practice_independent, lesson.language
        );
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/courses", (req, res) => {
    const courses = db.prepare("SELECT * FROM courses").all() as any[];
    const result = courses.map(course => {
      const modules = db.prepare("SELECT * FROM modules WHERE course_id = ?").all(course.id) as any[];
      const fullModules = modules.map(mod => {
        const lessons = db.prepare("SELECT * FROM lessons WHERE module_id = ?").all(mod.id);
        return { ...mod, lessons };
      });

      // Calculate progress
      const allLessonIds = fullModules.flatMap(m => m.lessons.map((l: any) => l.id));
      const totalSteps = allLessonIds.length * 5; // 5 steps per lesson
      
      let completedCount = 0;
      if (allLessonIds.length > 0) {
        const placeholders = allLessonIds.map(() => '?').join(',');
        const completedSteps = db.prepare(`
          SELECT COUNT(*) as count FROM step_progress 
          WHERE lesson_id IN (${placeholders}) 
          AND status = 'completed'
        `).get(...allLessonIds) as { count: number };
        completedCount = completedSteps.count;
      }

      const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

      return { ...course, modules: fullModules, progress };
    });
    res.json(result);
  });

  app.post("/api/courses", (req, res) => {
    const { title, description, image_url, modules } = req.body;
    const courseId = `c${Date.now()}`;
    
    db.prepare("INSERT INTO courses (id, title, description, image_url) VALUES (?, ?, ?, ?)").run(
      courseId, title, description, image_url || `https://picsum.photos/seed/${courseId}/800/450`
    );

    for (const mod of modules) {
      const moduleId = mod.id || `m${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      db.prepare("INSERT INTO modules (id, course_id, title) VALUES (?, ?, ?)").run(
        moduleId, courseId, mod.title
      );
      for (const lesson of mod.lessons) {
        const lessonId = lesson.id || `l${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        db.prepare("INSERT INTO lessons (id, module_id, title, concept, example, practice_guided, practice_independent, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
          lessonId, moduleId, lesson.title, lesson.concept, lesson.example, lesson.practice_guided, lesson.practice_independent, lesson.language
        );
      }
    }
    res.json({ id: courseId });
  });

  app.get("/api/progress", (req, res) => {
    const progress = db.prepare("SELECT * FROM step_progress").all();
    res.json(progress);
  });

  app.post("/api/progress", (req, res) => {
    const { lesson_id, step_id, status } = req.body;
    const existing = db.prepare("SELECT * FROM step_progress WHERE lesson_id = ? AND step_id = ?").get();
    if (existing) {
      db.prepare("UPDATE step_progress SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE lesson_id = ? AND step_id = ?").run(
        status, lesson_id, step_id
      );
    } else {
      db.prepare("INSERT INTO step_progress (lesson_id, step_id, status) VALUES (?, ?, ?)").run(
        lesson_id, step_id, status
      );
    }
    res.json({ success: true });
  });

  app.get("/api/settings", (req, res) => {
    let settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (!settings) {
      db.prepare("INSERT INTO settings (id) VALUES (1)").run();
      settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    }
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { theme, voice_enabled } = req.body;
    db.prepare("UPDATE settings SET theme = ?, voice_enabled = ? WHERE id = 1").run(
      theme, voice_enabled ? 1 : 0
    );
    res.json({ success: true });
  });

  app.post("/api/modal-chat", async (req, res) => {
    const { messages } = req.body;
    const modalApiKey = process.env.MODAL_API_KEY;

    if (!modalApiKey) {
      return res.status(500).json({ error: "MODAL_API_KEY is not configured." });
    }

    try {
      const modalResponse = await fetch("https://api.us-west-2.modal.direct/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${modalApiKey}`,
        },
        body: JSON.stringify({
          model: "zai-org/GLM-5-FP8", // Using the model specified in your curl command
          messages: messages,
          max_tokens: 500,
        }),
      });

      if (!modalResponse.ok) {
        const errorText = await modalResponse.text();
        console.error("Modal API error:", modalResponse.status, errorText);
        return res.status(modalResponse.status).json({ error: "Failed to get response from Modal API", details: errorText });
      }

      const data = await modalResponse.json();
      res.json(data);
    } catch (error) {
      console.error("Server error when calling Modal API:", error);
      res.status(500).json({ error: "Internal server error when proxying to Modal API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
