const axios = require("axios");

const LOG_API_URL = "http://20.207.122.201/evaluation-service/logs";
const ACCESS_CODE = "QkbpxH";

/**
 * @param {string} stack
 * @param {string} level
 * @param {string} pkg
 * @param {string} message
 */

async function Log(stack, level, pkg, message) {
  const validStacks = ["backend", "frontend"];
  const validLevels = ["debug", "info", "warn", "error", "fatal"];

  if (!validStacks.includes(stack)) {
    console.error(`[Logger] Invalid stack: ${stack}`);
    return;
  }
  if (!validLevels.includes(level)) {
    console.error(`[Logger] Invalid level: ${level}`);
    return;
  }

  const payload = {
    stack,
    level,
    package: pkg,
    message,
  };

  try {
    const response = await axios.post(LOG_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_CODE}`,
        "access-code": ACCESS_CODE,
      },
    });

    console.log(
      `[Logger] [${level.toUpperCase()}] [${stack}/${pkg}] ${message}`
    );
    return response.data;
  } catch (err) {
    console.error(
      `[Logger] Failed to send log: ${err.response?.data || err.message}`
    );
  }
}

module.exports = { Log };
