import { Request, Response } from 'express';

export class IndexController {
    constructor(private dataClient: any) {}

    async getAllItems(req: Request, res: Response) {
        try {
            const items = await this.dataClient.getAllItems();
            res.status(200).json(items);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch items' });
        }
    }

    async getItemById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const item = await this.dataClient.getItemById(id);
            if (item) {
                res.status(200).json(item);
            } else {
                res.status(404).json({ error: 'Item not found' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch item' });
        }
    }

    async createItem(req: Request, res: Response) {
        const newItem = req.body;
        try {
            const createdItem = await this.dataClient.createItem(newItem);
            res.status(201).json(createdItem);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create item' });
        }
    }

    async updateItem(req: Request, res: Response) {
        const { id } = req.params;
        const updatedData = req.body;
        try {
            const updatedItem = await this.dataClient.updateItem(id, updatedData);
            if (updatedItem) {
                res.status(200).json(updatedItem);
            } else {
                res.status(404).json({ error: 'Item not found' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to update item' });
        }
    }

    async deleteItem(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const deleted = await this.dataClient.deleteItem(id);
            if (deleted) {
                res.status(204).send();
            } else {
                res.status(404).json({ error: 'Item not found' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete item' });
        }
    }
}