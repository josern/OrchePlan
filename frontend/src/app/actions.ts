
'use server';

import { prioritizeTasks, PrioritizeTasksInput, PrioritizeTasksOutput } from '@/ai/flows/daily-prioritization';

export async function prioritizeDailyTasks(input: PrioritizeTasksInput): Promise<PrioritizeTasksOutput> {
  try {
    // If there are no tasks to prioritize, return an empty array to avoid an unnecessary AI call.
    if (input.tasks.length === 0) {
      return [];
    }
    const output = await prioritizeTasks(input);
    return output;
  } catch (error) {
    console.error('Error prioritizing tasks with AI:', error);
    // Fallback: If the AI call fails, return the tasks in their original order
    // with a default priority and a reason indicating the failure.
    // This ensures the application does not crash and provides a stable fallback.
    return input.tasks.map((task, index) => ({
      id: task.id,
      priority: index + 1, // Assign priority based on the original order.
      reason: 'AI prioritization failed. Displaying in default order.',
    }));
  }
}
