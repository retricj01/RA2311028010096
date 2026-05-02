const axios = require("axios");

const BASE_URL = "http://20.207.122.201/evaluation-service";

const CREDENTIALS = {
  email: "sg8081@srmist.edu.in",
  name: "srimadhavan g",
  rollNo: "ra2311028010096",
  accessCode: "QkbpxH",
  clientID: "a00c6a36-2a6b-49c9-ba2e-027c6672d1df",
  clientSecret: "cQNsmyWUhmmNNFUH",
};

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiresAt - 60) {
    return cachedToken;
  }
  console.log("[Auth] Fetching new token...");
  const response = await axios.post(`${BASE_URL}/auth`, CREDENTIALS, {
    headers: { "Content-Type": "application/json" },
  });
  cachedToken = response.data.access_token;
  tokenExpiresAt = response.data.expires_in;
  console.log("[Auth] Token obtained successfully");
  return cachedToken;
}

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

  try {
    const token = await getToken();
    const response = await axios.post(
      `${BASE_URL}/logs`,
      { stack, level, package: pkg, message },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log(`[Logger] [${level.toUpperCase()}] [${stack}/${pkg}] ${message}`);
    return response.data;
  } catch (err) {
    console.error(
      `[Logger] Failed to send log: ${JSON.stringify(err.response?.data) || err.message}`
    );
  }
}

module.exports = { Log, getToken };