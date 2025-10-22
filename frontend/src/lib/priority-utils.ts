// Priority-based sorting utilities

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Get numerical priority weight for sorting
 * Higher numbers = higher priority
 */
export const getPriorityWeight = (priority: Priority): number => {
  switch (priority) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 2;
    case 'low':
      return 1;
    default:
      return 2; // Default to normal
  }
};

/**
 * Compare function for sorting tasks by priority (urgent first, then high, medium, low)
 * Returns negative if a has higher priority than b, positive if b has higher priority than a
 */
export const comparePriority = (a: { priority?: Priority }, b: { priority?: Priority }): number => {
  const priorityA = a.priority || 'normal';
  const priorityB = b.priority || 'normal';
  return getPriorityWeight(priorityB) - getPriorityWeight(priorityA);
};

/**
 * Multi-level sorting function that sorts by priority first, then by a secondary comparator
 */
export const sortByPriorityThen = <T extends { priority?: Priority }>(
  items: T[],
  secondaryComparator: (a: T, b: T) => number
): T[] => {
  return [...items].sort((a, b) => {
    // First sort by priority
    const priorityComparison = comparePriority(a, b);
    if (priorityComparison !== 0) {
      return priorityComparison;
    }
    // If priorities are equal, use secondary comparator
    return secondaryComparator(a, b);
  });
};