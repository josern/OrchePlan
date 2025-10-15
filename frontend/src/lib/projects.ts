import type { Project } from './types';

// Helper function to find a project (including sub-projects) by ID
export const findProjectById = (projects: Project[], id: string): Project | undefined => {
    for (const project of projects) {
        if (project.id === id) {
            return project;
        }
        if (project.subProjects && project.subProjects.length > 0) {
            const foundInSub = findProjectById(project.subProjects, id);
            if (foundInSub) {
                return foundInSub;
            }
        }
    }
    return undefined;
};
