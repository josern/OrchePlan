import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
    try {
        const hashedPassword = await bcrypt.hash('TaskTest123!', 10);
        
        const user = await prisma.user.upsert({
            where: { email: 'tasktest@example.com' },
            update: {
                password: hashedPassword,
                name: 'Task Test User',
                role: 'user'
            },
            create: {
                email: 'tasktest@example.com',
                password: hashedPassword,
                name: 'Task Test User',
                role: 'user'
            }
        });
        
        console.log('✅ Test user created/updated:', {
            email: user.email,
            name: user.name,
            role: user.role,
            id: user.id
        });
    } catch (error) {
        console.error('❌ Error creating test user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createTestUser();
