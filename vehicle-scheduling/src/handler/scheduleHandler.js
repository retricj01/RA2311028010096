const express = require("express");
const router = express.Router();
const { Log } = require("../middleware/logger");
const { fetchDepots, fetchVehicles } = require("../service/vehicleService");
const { knapsack } = require("../service/schedulerService");

router.get("/schedule", async (req, res) => {
  await Log("backend", "info", "handler", "Request received: compute schedule for all depots");
  try {
    const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);

    const results = [];
    for (const depot of depots) {
      await Log("backend", "info", "handler",
        `Computing schedule for Depot ${depot.ID} with ${depot.MechanicHours} hours`);
      const { selectedTasks, totalImpact, totalDuration } = await knapsack(vehicles, depot.MechanicHours);
      results.push({
        depotID: depot.ID,
        mechanicHoursBudget: depot.MechanicHours,
        totalHoursUsed: totalDuration,
        totalImpactScore: totalImpact,
        selectedTasks: selectedTasks.map((t) => ({
          taskID: t.TaskID,
          duration: t.Duration,
          impact: t.Impact,
        })),
      });
    }

    await Log("backend", "info", "handler", "All depot schedules computed");
    return res.status(200).json({ success: true, schedules: results });
  } catch (err) {
    await Log("backend", "error", "handler", `Schedule failed: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;