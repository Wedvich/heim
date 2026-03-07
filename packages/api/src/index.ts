import express from "express";
import { pool } from "./db.ts";
import "./session-context.ts";
import { sessionMiddleware } from "./middleware/session.ts";
import { authRouter } from "./routes/auth.ts";

const app = express();
const port = 5244;

app.use(express.json());
app.use(sessionMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
