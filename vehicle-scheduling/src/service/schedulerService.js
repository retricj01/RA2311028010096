const { Log } = require("../middleware/logger");

async function knapsack(tasks, capacity) {
  await Log("backend", "debug", "service",
    `Running knapsack: ${tasks.length} tasks, capacity=${capacity}`);

  const n = tasks.length;
  const dp = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  const selectedTasks = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedTasks.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }

  const totalImpact = dp[n][capacity];
  const totalDuration = selectedTasks.reduce((sum, t) => sum + t.Duration, 0);

  await Log("backend", "info", "service",
    `Knapsack done: ${selectedTasks.length} tasks, impact=${totalImpact}, hours=${totalDuration}/${capacity}`);

  return { selectedTasks, totalImpact, totalDuration };
}

module.exports = { knapsack };