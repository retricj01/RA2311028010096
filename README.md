# Vehicle Maintenance Scheduler

## API Endpoints I am fat

### GET /api/vehicle-scheduling/schedule

Returns optimal schedule for **all depots**.

**Response:**

```json
{
  "success": true,
  "schedules": \[
    {
      "depotID": 1,
      "mechanicHoursBudget": 60,
      "totalHoursUsed": 58,
      "totalImpactScore": 95,
      "selectedTasks": \[
        { "taskID": "...", "duration": 5, "impact": 9 }
      ]
    }
  ]
}
```

### GET /api/vehicle-scheduling/schedule/:depotId

Returns optimal schedule for a **specific depot**.

### GET /health

Health check.

Hi I am Keshava
