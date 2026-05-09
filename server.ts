import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure data directory exists
  const dbDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(path.join(dbDir, "database.sqlite"));

  // Initialize SQLite database
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      operation TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  // API Routes
  app.get("/api/leaderboard", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM leaderboard ORDER BY score DESC LIMIT 10");
      const entries = stmt.all();
      res.json(entries);
    } catch (error) {
      console.error("Leaderboard fetch error:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/leaderboard", (req, res) => {
    try {
      const { name, score, difficulty, operation, timestamp } = req.body;
      const stmt = db.prepare(`
        INSERT INTO leaderboard (name, score, difficulty, operation, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(name, score, difficulty, operation, timestamp);
      res.json({ success: true });
    } catch (error) {
      console.error("Leaderboard insert error:", error);
      res.status(500).json({ error: "Failed to save score" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
