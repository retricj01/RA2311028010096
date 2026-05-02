const express = require("express");
const { Log } = require("./middleware/logger");
const scheduleRouter = require("./handler/scheduleHandler");

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(async (req, res, next) => {
  await Log("backend", "info", "middleware",
    `${req.method} ${req.path}`);
  next();
});

app.use("/api/vehicle-scheduling", scheduleRouter);

app.get("/health", async (req, res) => {
  await Log("backend", "debug", "handler", "Health check");
  res.json({ status: "ok" });
});

app.listen(PORT, async () => {
  await Log("backend", "info", "config", "Scheduler started on port 3000");
  console.log(`Server running on http://localhost:${PORT}`);
});

