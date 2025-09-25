
'use server';

/**
 * @fileOverview AI-powered task prioritization flow for daily overviews.
 *
 * - prioritizeTasks - A function that takes tasks and resource availability as input and returns a prioritized list of tasks.
 * - PrioritizeTasksInput - The input type for the prioritizeTasks function.
 * - PrioritizeTasksOutput - The return type for the prioritizeTasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';


const PrioritizeTasksInputSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().describe('Unique identifier for the task.'),
      title: z.string().describe('Title of the task.'),
      description: z.string().optional().describe('Description of the task.'),
      dueTime: z.string().describe('Due time for the task (e.g., YYYY-MM-DDTHH:mm:ssZ).'),
      status: z.string().describe('Current status of the task.'),
      projectId: z.string().optional().describe('The project this task belongs to.'),
      assigneeId: z.string().optional().describe('The ID of the user this task is assigned to.'),
    })
  ).describe('List of tasks to prioritize.'),
  resourceAvailability: z.string().describe('Information about available resources (e.g., team members, budget).'),
});
export type PrioritizeTasksInput = z.infer<typeof PrioritizeTasksInputSchema>;

const PrioritizeTasksOutputSchema = z.array(
  z.object({
    id: z.string().describe('Unique identifier of the task.'),
    priority: z.number().describe('The priority of the task (lower is higher priority).'),
    reason: z.string().describe('The reason for the assigned priority.'),
  })
).describe('Prioritized list of tasks with reasons.');
export type PrioritizeTasksOutput = z.infer<typeof PrioritizeTasksOutputSchema>;

export async function prioritizeTasks(input: PrioritizeTasksInput): Promise<PrioritizeTasksOutput> {
  return prioritizeTasksFlow(input);
}

const prioritizeTasksPrompt = ai.definePrompt({
  name: 'prioritizeTasksPrompt',
  input: {schema: PrioritizeTasksInputSchema},
  output: {
    schema: PrioritizeTasksOutputSchema,
    format: 'json', // Explicitly request a non-streaming JSON object.
  },
  prompt: `You are an AI task prioritization expert. Given a list of tasks and resource availability, determine the priority of each task for the day.

Tasks:
{{#each tasks}}
- ID: {{id}}
  Title: {{title}}
  Description: {{description}}
  Due Time: {{dueTime}}
  Status: {{status}}
  Project ID: {{projectId}}
  Assignee ID: {{assigneeId}}
{{/each}}

Resource Availability: {{resourceAvailability}}

Consider deadlines, status (e.g., 'blocked' tasks might need attention but can't be worked on), and resource constraints to assign a priority to each task. Tasks with status 'done' should have the lowest priority.

Output a JSON array where each object contains the task ID, a numerical priority (lower is higher priority), and a brief explanation for the assigned priority.`,
});

const prioritizeTasksFlow = ai.defineFlow(
  {
    name: 'prioritizeTasksFlow',
    inputSchema: PrioritizeTasksInputSchema,
    outputSchema: PrioritizeTasksOutputSchema,
  },
  async input => {
    const {output} = await prioritizeTasksPrompt(input);
    return output!;
  }
);
