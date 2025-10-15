// Legacy Firestore client stub.
// The project has migrated to PostgreSQL + Prisma. This file remains as a harmless stub
// to avoid breaking imports in older code. Do not use in new code — use src/services/sqlClient.ts instead.

export class FirestoreClient {
    constructor() {
        // Intentionally empty. Using FirestoreClient in this codebase is deprecated.
    }

    async createDocument(): Promise<void> {
        throw new Error('FirestoreClient is deprecated. Use sqlClient.ts');
    }

    async readDocument(): Promise<null> {
        throw new Error('FirestoreClient is deprecated. Use sqlClient.ts');
    }

    async updateDocument(): Promise<void> {
        throw new Error('FirestoreClient is deprecated. Use sqlClient.ts');
    }

    async deleteDocument(): Promise<void> {
        throw new Error('FirestoreClient is deprecated. Use sqlClient.ts');
    }

    async getAllDocuments(): Promise<any[]> {
        throw new Error('FirestoreClient is deprecated. Use sqlClient.ts');
    }
}