# Bulk Task Import Usage Guide

## Overview
The bulk import functionality allows you to create multiple tasks efficiently without triggering security blocks. This is especially useful when importing tasks from CSV files or creating large numbers of tasks at once.

## Usage

### Option 1: Using the Bulk Import Endpoint (Recommended)

```typescript
import { bulkImportTasks } from '@/lib/bulk-operations';

const tasks = [
  {
    title: 'Setup Database',
    description: 'Configure PostgreSQL database',
    priority: 'high',
    dueDate: '2025-10-25'
  },
  {
    title: 'Create API Routes',
    description: 'Implement REST endpoints',
    priority: 'medium'
  },
  {
    title: 'Frontend Components',
    description: 'Build React components',
    priority: 'medium'
  }
];

try {
  const result = await bulkImportTasks('project-id-123', tasks);
  console.log(`Successfully imported ${result.imported} tasks`);
  if (result.failed > 0) {
    console.log('Failed tasks:', result.errors);
  }
} catch (error) {
  console.error('Bulk import failed:', error);
}
```

### Option 2: CSV Import

```typescript
import { parseTasksFromCSV, bulkImportTasks } from '@/lib/bulk-operations';

// CSV format: title,description,priority,duedate
const csvContent = `
title,description,priority,duedate
Setup Database,Configure PostgreSQL,high,2025-10-25
Create API Routes,Implement REST endpoints,medium,
Frontend Components,Build React components,medium,2025-10-30
`;

const tasks = parseTasksFromCSV(csvContent);
const result = await bulkImportTasks('project-id-123', tasks);
```

### Option 3: Legacy Throttled Import (Fallback)

```typescript
import { throttledTaskImport } from '@/lib/bulk-operations';

const result = await throttledTaskImport('project-id-123', tasks, {
  delay: 200,        // 200ms between requests
  batchSize: 3,      // 3 tasks per batch
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
});
```

## API Endpoint Details

### POST /api/tasks/bulk-import

**Request Body:**
```json
{
  "projectId": "string",
  "tasks": [
    {
      "title": "string (required)",
      "description": "string (optional)",
      "priority": "low|medium|high (optional, default: medium)",
      "dueDate": "ISO date string (optional)",
      "statusId": "string (optional)",
      "assignedTo": "string (optional - user ID)"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "imported": 3,
  "failed": 0,
  "tasks": [...], // Successfully created tasks
  "errors": []    // Any errors that occurred
}
```

## Rate Limiting

- **Bulk Import Endpoint**: 10 operations per 5 minutes (authenticated users)
- **Individual Task Creation**: 1000 requests per 15 minutes (general limit)
- **Auth Endpoints**: 5 requests per 15 minutes

## Security Features

The bulk import endpoint is designed to work safely with the threat detection system:

- ✅ Single API call prevents rapid-fire request patterns
- ✅ Proper authentication and authorization checks
- ✅ Rate limiting for bulk operations
- ✅ Real-time SSE broadcasting for each task creation
- ✅ Comprehensive error handling and reporting

## Best Practices

1. **Use Bulk Import for Multiple Tasks**: Always prefer the bulk endpoint when creating more than 2-3 tasks
2. **Validate Data First**: Check required fields (title, projectId) before sending
3. **Handle Partial Failures**: Check the response for both successful and failed tasks
4. **Monitor Rate Limits**: Space out bulk operations if importing very large datasets
5. **Use Appropriate Priorities**: Set meaningful priority levels for better project management

## Troubleshooting

### "Your IP has been temporarily blocked"
- Use the bulk import endpoint instead of individual task creation
- Wait for the rate limit window to reset
- Contact admin to clear IP blocks if needed

### "Project ID is required"
- Ensure projectId is included in the request
- Verify the project exists and you have access

### "Permission denied"
- Verify you're authenticated
- Check you have editor or owner permissions on the project
- Ensure the project ID is correct

### Tasks not appearing in real-time
- Each bulk imported task is broadcast via SSE automatically
- Check your SSE connection status
- Verify you're subscribed to the correct project updates