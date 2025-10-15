import { Firestore } from '@google-cloud/firestore';

export class FirestoreClient {
    private firestore: Firestore;

    constructor() {
        this.firestore = new Firestore({
            projectId: 'your-project-id',
            host: 'localhost:8080',
            ssl: false,
        });
    }

    async createDocument(collection: string, documentId: string, data: object) {
        const docRef = this.firestore.collection(collection).doc(documentId);
        await docRef.set(data);
    }

    async readDocument(collection: string, documentId: string) {
        const docRef = this.firestore.collection(collection).doc(documentId);
        const doc = await docRef.get();
        return doc.exists ? doc.data() : null;
    }

    async updateDocument(collection: string, documentId: string, data: object) {
        const docRef = this.firestore.collection(collection).doc(documentId);
        await docRef.update(data);
    }

    async deleteDocument(collection: string, documentId: string) {
        const docRef = this.firestore.collection(collection).doc(documentId);
        await docRef.delete();
    }

    async getAllDocuments(collection: string) {
        const snapshot = await this.firestore.collection(collection).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}