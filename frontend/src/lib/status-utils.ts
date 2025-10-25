import type { TaskStatusOption } from './types';

export function getFirstVisibleStatusId(project: { taskStatusOptions?: TaskStatusOption[] } | undefined): string | undefined {
  if (!project || !project.taskStatusOptions || project.taskStatusOptions.length === 0) return undefined;
  const first = project.taskStatusOptions
    .filter(s => !s.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  return first?.id;
}

export function findStatusById(statuses: TaskStatusOption[] | undefined, id?: string) {
  if (!statuses || !id) return undefined;
  return statuses.find(s => s.id === id);
}

export function buildStatusOrderMap(statuses: TaskStatusOption[] | undefined) {
  const map = new Map<string, number | null>();
  if (!statuses) return map;
  for (const s of statuses) map.set(s.id, s.order ?? null);
  return map;
}

export default { getFirstVisibleStatusId, findStatusById, buildStatusOrderMap };
