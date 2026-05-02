# Notification System Design

---

## Stage 1

### Overview

A campus notification platform that delivers real-time updates to students regarding **Placements**, **Events**, and **Results**.

### Core Actions the Platform Must Support

1. Fetch all notifications for a logged-in student
2. Fetch a single notification by ID
3. Mark a notification as read
4. Mark all notifications as read
5. Delete a notification
6. Send/create a new notification (admin/HR action)
7. Real-time push of new notifications to connected students

---

### REST API Endpoints

#### 1. Get All Notifications for the Logged-in Student

```
GET /api/v1/notifications
```

**Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by type: `Placement`, `Event`, `Result` |
| `isRead` | boolean | Filter by read status |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
        "type": "Placement",
        "message": "CSX Corporation is hiring - Apply Now!",
        "isRead": false,
        "createdAt": "2026-04-22T17:51:18Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

#### 2. Get a Single Notification by ID

```
GET /api/v1/notifications/:id
```

**Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
    "type": "Placement",
    "message": "CSX Corporation is hiring - Apply Now!",
    "isRead": false,
    "createdAt": "2026-04-22T17:51:18Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Notification not found"
}
```

---

#### 3. Mark a Notification as Read

```
PATCH /api/v1/notifications/:id/read
```

**Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
    "isRead": true,
    "readAt": "2026-04-22T18:00:00Z"
  }
}
```

---

#### 4. Mark All Notifications as Read

```
PATCH /api/v1/notifications/read-all
```

**Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "updatedCount": 12
}
```

---

#### 5. Delete a Notification

```
DELETE /api/v1/notifications/:id
```

**Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

---

#### 6. Create / Send a Notification (Admin/HR)

```
POST /api/v1/notifications
```

**Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "type": "Placement",
  "message": "Google is hiring! Apply before May 10th.",
  "studentIds": ["student-uuid-1", "student-uuid-2"],
  "sendToAll": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Notification queued for delivery",
  "data": {
    "notificationId": "new-uuid",
    "recipientCount": 2,
    "status": "queued"
  }
}
```

---

### Real-Time Notification Mechanism

**Chosen approach: WebSockets (via Socket.IO)**

- When a student logs in, the client connects to the WebSocket server and joins a room identified by their `studentId`.
- When a new notification is created for a student, the server emits an event to that student's room instantly.
- This avoids polling and provides true real-time delivery.

**WebSocket Event — Server → Client:**
```json
{
  "event": "new_notification",
  "data": {
    "id": "uuid-here",
    "type": "Placement",
    "message": "Google is hiring!",
    "createdAt": "2026-04-22T17:51:18Z"
  }
}
```

**Client connection (pseudocode):**
```javascript
const socket = io("wss://api.campus.com", {
  auth: { token: "<jwt_token>" }
});

socket.on("new_notification", (notification) => {
  displayToast(notification);
  incrementBadgeCount();
});
```

---

## Stage 2

### Recommended Database: PostgreSQL (Relational)

**Reasons for choosing PostgreSQL:**
- Notifications have a clear relational structure: a notification belongs to a student.
- We need efficient filtering (`WHERE isRead = false`, `WHERE type = 'Placement'`) which SQL handles very well with indexes.
- ACID compliance ensures no notification is lost or duplicated during high-volume sends.
- Supports advanced features like partial indexes, JSONB for metadata, and window functions.

---

### DB Schema

```sql
-- Students table
CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  roll_number VARCHAR(100) UNIQUE NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Notification type enum
CREATE TYPE notification_type AS ENUM ('Placement', 'Event', 'Result');

-- Notifications table
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup of a student's unread notifications
CREATE INDEX idx_notifications_student_unread
  ON notifications (student_id, is_read, created_at DESC);

-- Index for filtering by type
CREATE INDEX idx_notifications_type
  ON notifications (type, created_at DESC);
```

---

### Queries for Each REST API

**GET /api/v1/notifications (paginated, with filters):**
```sql
SELECT id, type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
  AND ($2::notification_type IS NULL OR type = $2)
  AND ($3::boolean IS NULL OR is_read = $3)
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;
```

**GET /api/v1/notifications/:id:**
```sql
SELECT id, type, message, is_read, created_at
FROM notifications
WHERE id = $1 AND student_id = $2;
```

**PATCH /api/v1/notifications/:id/read:**
```sql
UPDATE notifications
SET is_read = TRUE, read_at = NOW()
WHERE id = $1 AND student_id = $2;
```

**PATCH /api/v1/notifications/read-all:**
```sql
UPDATE notifications
SET is_read = TRUE, read_at = NOW()
WHERE student_id = $1 AND is_read = FALSE;
```

**DELETE /api/v1/notifications/:id:**
```sql
DELETE FROM notifications
WHERE id = $1 AND student_id = $2;
```

**POST /api/v1/notifications (bulk insert):**
```sql
INSERT INTO notifications (student_id, type, message)
SELECT unnest($1::uuid[]), $2::notification_type, $3::text;
```

---

### Scaling Problems and Solutions

| Problem | Cause | Solution |
|---|---|---|
| Slow reads | Table grows to millions of rows | Composite indexes on `(student_id, is_read, created_at)` |
| Slow bulk inserts | Inserting 50,000 rows one by one | Batch insert with `unnest()` or `COPY` command |
| Single DB overload | All reads/writes on one server | Read replicas for read-heavy queries |
| Table bloat | Deleted/read notifications accumulate | Archive old notifications to a cold table or partition by month |
| Connection exhaustion | Too many concurrent connections | Use PgBouncer (connection pooling) |

---

## Stage 3

### Is the query accurate?

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

The query is **logically correct** — it retrieves the right data. However, it has **performance problems** at scale.

---

### Why is it slow?

1. **No index on `(studentID, isRead)`** — With 5,000,000 rows, the DB does a full sequential scan across the entire table to find rows matching `studentID = 1042 AND isRead = false`. This is O(n) in time.
2. **`SELECT *`** — Fetches all columns including large text fields unnecessarily, increasing I/O and memory usage.
3. **No pagination (`LIMIT`)** — A student could have thousands of unread notifications; returning all of them at once is wasteful.

---

### What to change and likely computation cost

**Fix 1: Add a composite index**
```sql
CREATE INDEX idx_notifications_student_unread
  ON notifications (studentID, isRead, createdAt DESC);
```
With this index, the DB uses an **index scan** instead of a full table scan. Cost drops from O(n) to O(log n + k) where k is the number of matching rows.

**Fix 2: Select only needed columns and add pagination**
```sql
SELECT id, type, message, createdAt
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC
LIMIT 20 OFFSET 0;
```

**Likely computation cost improvement:** From scanning 5,000,000 rows → scanning only the matching rows for that student via index. For a student with 200 unread notifications, the DB touches ~200 rows instead of 5,000,000.

---

### Should we add indexes on every column?

**No. This advice is not effective.**

Adding indexes on every column is harmful:
- Every `INSERT`, `UPDATE`, and `DELETE` must update **all indexes**, slowing down writes significantly.
- Indexes consume disk space. 5M rows × many indexes = gigabytes of overhead.
- The query planner may pick the wrong index or ignore unused indexes entirely.

**Best practice:** Add indexes only on columns that appear in `WHERE`, `ORDER BY`, or `JOIN` clauses for the most common and expensive queries.

---

### Query: Find all students who received a Placement notification in the last 7 days

```sql
SELECT DISTINCT student_id
FROM notifications
WHERE "notificationType" = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### Problem

Notifications are fetched fresh from the database on every page load for every student. With 50,000 students, this causes DB overload and high latency.

---

### Solutions and Tradeoffs

#### Solution 1: Server-Side Caching with Redis (Recommended Primary Solution)

Cache each student's notification list in Redis with a short TTL (e.g., 60 seconds).

```
Cache key: notifications:<studentId>
TTL: 60 seconds
```

**Flow:**
1. Request comes in → Check Redis for `notifications:<studentId>`
2. Cache hit → Return cached data instantly (< 1ms)
3. Cache miss → Query DB → Store result in Redis → Return

**When a new notification is created or marked as read → Invalidate the cache key.**

**Tradeoffs:**
| Pro | Con |
|---|---|
| Sub-millisecond reads | Stale data for up to TTL duration |
| Dramatic DB load reduction | Cache invalidation logic required |
| Horizontally scalable | Added infrastructure (Redis server) |

---

#### Solution 2: Database Read Replicas

Route all read queries (`GET /notifications`) to a read replica. Only writes go to the primary.

**Tradeoffs:**
| Pro | Con |
|---|---|
| No code change needed | Replication lag (slight staleness) |
| Scales read throughput linearly | More expensive infrastructure |

---

#### Solution 3: Pagination + Infinite Scroll (Quick Win, No Infrastructure)

Instead of loading all notifications at once, load 20 at a time. Students rarely scroll past page 1.

**Tradeoffs:**
| Pro | Con |
|---|---|
| Zero infrastructure cost | Still hits DB per request |
| Immediate UX improvement | DB still under load at peak hours |

---

#### Solution 4: Client-Side Caching with ETags / Cache-Control Headers

Send `ETag` and `Cache-Control: max-age=30` headers. The browser won't re-fetch if nothing changed.

**Tradeoffs:**
| Pro | Con |
|---|---|
| Reduces redundant requests | Client must support cache headers |
| No server-side change needed | Not real-time |

---

### Recommended Combined Strategy

1. **Redis cache** for notifications per student (primary fix)
2. **Pagination** on all list endpoints (immediate DB relief)
3. **Read replica** if scale exceeds single DB capacity
4. **WebSocket push** (from Stage 1) to invalidate cache and push new items in real-time, so the cache is only hit on first load

---

## Stage 5

### Shortcomings of the Current Implementation

```
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)   # calls Email API
        save_to_db(student_id, message)   # DB insert
        push_to_app(student_id, message)  # WebSocket push
```

**Problems:**

1. **Sequential processing** — Iterating over 50,000 students one by one is extremely slow. If each iteration takes 100ms, the whole loop takes ~83 minutes.
2. **No error handling / fault tolerance** — If `send_email` fails for student 25,000, the loop breaks and the remaining 25,000 students get nothing.
3. **Tight coupling of operations** — Email sending, DB insert, and push notification are all in one synchronous block. If the email API is slow, it blocks the DB insert too.
4. **No retry mechanism** — A transient email API failure causes permanent loss for those students.
5. **No atomicity guarantee** — `save_to_db` may succeed but `send_email` may fail, leaving the DB and email state inconsistent.

---

### The Failed Email Scenario

Logs show `send_email` failed for 200 students midway. With the current design:
- Those 200 students are silently skipped.
- No retry is attempted.
- No record of failure is kept.

---

### Should saving to DB and sending email happen together?

**No — they should NOT be tightly coupled.**

- The DB insert should be treated as the **source of truth** — it should always succeed first.
- Email delivery is a **side effect** that can fail and be retried independently.
- Coupling them means a flaky email API can prevent notifications from being saved at all.

---

### Redesigned Solution: Message Queue Architecture

Use a message queue (e.g., **BullMQ** with Redis, or **RabbitMQ**) to decouple the steps.

**Revised Pseudocode:**

```
function notify_all(student_ids: array, message: string):
    # Step 1: Bulk insert all notifications to DB first (single transaction)
    notifications = bulk_insert_to_db(student_ids, message)  # fast, atomic

    # Step 2: Enqueue each notification as a background job
    for notification in notifications:
        queue.add("send_email_job", {
            student_id: notification.student_id,
            notification_id: notification.id,
            message: message
        }, {
            attempts: 3,          # retry up to 3 times
            backoff: 5000         # wait 5s between retries
        })

        queue.add("push_to_app_job", {
            student_id: notification.student_id,
            notification_id: notification.id,
            message: message
        })

# Background workers process jobs concurrently
worker.process("send_email_job", async (job):
    try:
        send_email(job.student_id, job.message)
        mark_email_sent(job.notification_id)
    except EmailAPIError:
        throw error  # BullMQ will retry automatically

worker.process("push_to_app_job", async (job):
    push_to_app(job.student_id, job.message)  # WebSocket emit
```

---

### Why This Is Better

| Issue | Old Design | New Design |
|---|---|---|
| Speed | Sequential, ~83 min | Concurrent workers, minutes |
| Fault tolerance | None | Auto-retry with backoff |
| Partial failure | Silent data loss | Failed jobs tracked in dead-letter queue |
| Coupling | Tight | Decoupled via queue |
| DB consistency | At risk | DB insert is atomic and happens first |
| Observability | None | Job status visible in queue dashboard |

---

## Stage 6

### Priority Inbox — Approach

The goal is to always show the top N most important unread notifications, where priority is determined by:
1. **Type weight:** `Placement (3) > Result (2) > Event (1)`
2. **Recency:** More recent notifications rank higher within the same weight

**Algorithm: Min-Heap of size N**

To efficiently maintain the top N notifications as new ones arrive, a **min-heap of size N** is used:

- Min-heap always keeps the N highest-priority items.
- When a new notification arrives, compare it with the heap's minimum.
- If the new notification has higher priority → pop the min, push the new one.
- This gives O(log N) insertion per notification and O(N log N) for the initial build.

This is far more efficient than sorting the full list every time a new notification arrives.

**Priority Score Formula:**
```
score = (typeWeight × 1,000,000) + timestamp_unix_seconds
```

This ensures type dominates, but within the same type, recency breaks ties.

### See `priority_inbox.js` for the working implementation.
