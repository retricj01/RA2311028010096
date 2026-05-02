const express = require("express");
const app = express();
app.use(express.json());

    app.post("/evaluation-service/logs", (req, res) => {
    console.log("\n Log received:");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    const accessCode = req.headers["access-code"] || 
                        req.headers["authorization"]?.replace("Bearer ", "");

    if (accessCode !== "QkbpxH") {
        return res.status(401).json({ error: "Unauthorized - invalid access code" });
    }

    const { stack, level, package: pkg, message } = req.body;
    const validStacks = ["backend", "frontend"];
    const validLevels = ["debug", "info", "warn", "error", "fatal"];

    if (!validStacks.includes(stack)) {
    return res.status(400).json({ error: `Invalid stack: ${stack}` });
    }
    if (!validLevels.includes(level)) {
        return res.status(400).json({ error: `Invalid level: ${level}` });
    }
    if (!pkg || !message) {
        return res.status(400).json({ error: "package and message are required" });
    }

    const logID = require("crypto").randomUUID();
    return res.status(200).json({
        logID,
        message: "log created successfully",
    });
    });

app.listen(8080, () => {
  console.log("server running at http://localhost:8080");
});