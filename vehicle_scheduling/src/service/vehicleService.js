
const axios = require("axios");
const { Log, getToken } = require("../middleware/logger");

const BASE_URL = "http://20.207.122.201/evaluation-service";

async function getAuthHeaders() {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots from evaluation service");
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${BASE_URL}/depots`, { headers });
    const depots = response.data.depots;
    await Log("backend", "info", "service", `Fetched ${depots.length} depots`);
    return depots;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch depots: ${err.message}`);
    throw err;
  }
}

async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles from evaluation service");
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${BASE_URL}/vehicles`, { headers });
    const vehicles = response.data.vehicles;
    await Log("backend", "info", "service", `Fetched ${vehicles.length} vehicles`);
    return vehicles;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch vehicles: ${err.message}`);
    throw err;
  }
}

module.exports = { fetchDepots, fetchVehicles };