/**
 * Stage 6 - Priority Inbox
 *
 * Fetches notifications from the evaluation API and returns the top N
 * most important unread notifications using a Min-Heap of size N.
 *
 * Priority Rules:
 *   - Placement > Result > Event  (type weight)
 *   - Within same type, more recent = higher priority
 *
 * Priority Score = (typeWeight × 1_000_000) + unix_timestamp_seconds
 */

const axios = require("axios");
const { Log } = require("./src/middleware/logger");

const NOTIFICATIONS_API =
  "http://20.207.122.201/evaluation-service/notifications";
const ACCESS_CODE = "QkbpxH";

const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};


function getPriorityScore(notification) {
  const weight = TYPE_WEIGHT[notification.Type] ?? 0;
  const ts = Math.floor(new Date(notification.Timestamp).getTime() / 1000);
  return weight * 1_000_000 + ts;
}


class MinHeap {
  constructor() {
    this.heap = [];
  }

  size() {
    return this.heap.length;
  }

  peek() {
    return this.heap[0];
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].score <= this.heap[i].score) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].score < this.heap[smallest].score)
        smallest = left;
      if (right < n && this.heap[right].score < this.heap[smallest].score)
        smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

// ─── Core Logic: Get Top N Notifications ────────────────────────────────────

/**
 * Returns the top N highest-priority notifications using a Min-Heap.
 * Time complexity: O(M log N) where M = total notifications, N = top count
 *
 * @param {Array} notifications - Full list of notification objects
 * @param {number} n            - How many top notifications to return
 * @returns {Array}             - Top N notifications sorted highest-first
 */
function getTopNNotifications(notifications, n) {
  const heap = new MinHeap();

  for (const notif of notifications) {
    const score = getPriorityScore(notif);
    const entry = { score, notif };

    if (heap.size() < n) {
      heap.push(entry);
    } else if (score > heap.peek().score) {
      // New notification has higher priority than the current minimum
      heap.pop();
      heap.push(entry);
    }
  }

  // Extract from heap and sort highest-first
  const result = [];
  while (heap.size() > 0) {
    result.push(heap.pop().notif);
  }
  return result.reverse(); // highest priority first
}

// ─── Fetch from API ──────────────────────────────────────────────────────────

async function fetchNotifications() {
  await Log(
    "backend",
    "info",
    "service",
    "Fetching notifications from evaluation service"
  );

  try {
    const response = await axios.get(NOTIFICATIONS_API, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_CODE}`,
        "access-code": ACCESS_CODE,
      },
    });

    const notifications = response.data.notifications;
    await Log(
      "backend",
      "info",
      "service",
      `Fetched ${notifications.length} notifications successfully`
    );
    return notifications;
  } catch (err) {
    await Log(
      "backend",
      "error",
      "service",
      `Failed to fetch notifications: ${err.response?.status} - ${err.message}`
    );
    throw err;
  }
}

// ─── Simulate Incoming Notifications (for "how to maintain top 10 efficiently") ──

/**
 * Demonstrates maintaining a live top-N heap as new notifications arrive.
 * Each incoming notification is processed in O(log N) — no full re-sort needed.
 */
function addNotificationToTopN(heap, n, newNotification) {
  const score = getPriorityScore(newNotification);
  const entry = { score, notif: newNotification };

  if (heap.size() < n) {
    heap.push(entry);
    return true; // added
  } else if (score > heap.peek().score) {
    heap.pop();
    heap.push(entry);
    return true; // replaced lowest
  }
  return false; // not important enough
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await Log(
    "backend",
    "info",
    "handler",
    "Priority Inbox job started - finding top 10 notifications"
  );

  try {
    const notifications = await fetchNotifications();
    const TOP_N = 10;

    const top10 = getTopNNotifications(notifications, TOP_N);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`  TOP ${TOP_N} PRIORITY NOTIFICATIONS`);
    console.log(`${"=".repeat(60)}\n`);

    top10.forEach((n, idx) => {
      const weight = TYPE_WEIGHT[n.Type];
      const score = getPriorityScore(n);
      console.log(`#${idx + 1}`);
      console.log(`  ID        : ${n.ID}`);
      console.log(`  Type      : ${n.Type} (weight=${weight})`);
      console.log(`  Message   : ${n.Message}`);
      console.log(`  Timestamp : ${n.Timestamp}`);
      console.log(`  Score     : ${score}`);
      console.log();
    });

    await Log(
      "backend",
      "info",
      "handler",
      `Top ${TOP_N} notifications computed successfully`
    );

    // ── Demonstrate live update efficiency ──────────────────────────────────
    console.log(`${"=".repeat(60)}`);
    console.log("  LIVE UPDATE DEMO - New notification arriving...");
    console.log(`${"=".repeat(60)}\n`);

    // Rebuild heap from top10 results for live demo
    const liveHeap = new MinHeap();
    for (const notif of top10) {
      liveHeap.push({ score: getPriorityScore(notif), notif });
    }

    const incomingNotification = {
      ID: "live-new-uuid-0001",
      Type: "Placement",
      Message: "Microsoft is hiring! Urgent - apply today.",
      Timestamp: new Date().toISOString(),
    };

    const added = addNotificationToTopN(liveHeap, TOP_N, incomingNotification);
    console.log(
      `New notification (${incomingNotification.Type}: "${incomingNotification.Message}")`
    );
    console.log(
      added
        ? "→ Added to top 10 (replaced lowest priority item)\n"
        : "→ Not important enough to enter top 10\n"
    );

    await Log(
      "backend",
      "debug",
      "handler",
      `Live update: new notification ${added ? "entered" : "did not enter"} top ${TOP_N}`
    );
  } catch (err) {
    await Log(
      "backend",
      "fatal",
      "handler",
      `Priority inbox job failed: ${err.message}`
    );
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
