import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createComponentLogger } from '../src/utils/logger';
import readline from 'readline';

const prisma = new PrismaClient();
const logger = createComponentLogger('CreateSuperuser');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function askPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    
    let password = '';
    process.stdin.on('data', (buffer) => {
      const char = buffer.toString();
      
      if (char === '\n' || char === '\r' || char === '\u0004') {
        // Enter key pressed
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u007f' || char === '\u0008') {
        // Backspace pressed
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        // Regular character
        password += char;
        process.stdout.write('*');
      }
    });
  });
}

async function createSuperuser() {
  try {
  logger.info('🔐 Superuser Creation Tool');
    
    // Get user input
    const email = await askQuestion('Email: ');
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }
    
    const name = await askQuestion('Full Name: ');
    if (!name) {
      throw new Error('Name is required');
    }
    
    const password = await askPassword('Password: ');
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    const confirmPassword = await askPassword('Confirm Password: ');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    
  logger.info('');
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      const updateExisting = await askQuestion(`User with email ${email} already exists. Update to superuser? (y/N): `);
      if (updateExisting.toLowerCase() === 'y' || updateExisting.toLowerCase() === 'yes') {
        // Update existing user to superuser
        await prisma.user.update({
          where: { email },
          data: { role: 'superuser' }
        });
        
        logger.info(`User ${email} has been promoted to superuser`);
        logger.info('User promoted to superuser', { email, updatedBy: 'script' });
      } else {
        logger.info('Operation cancelled by user');
      }
    } else {
      // Create new superuser
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: 'superuser'
        }
      });
      
      logger.info('Superuser created', { userId: user.id, email: user.email, name: user.name, role: user.role });
    }
    
  } catch (error) {
    logger.error('Error creating superuser', {}, error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Handle command line arguments for non-interactive mode
const args = process.argv.slice(2);
if (args.length >= 3) {
  // Non-interactive mode: npm run create-superuser email name password
  const [email, name, password] = args;
  
  (async () => {
    try {
      if (!email || !email.includes('@')) {
        throw new Error('Valid email is required');
      }
      
      if (!name) {
        throw new Error('Name is required');
      }
      
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingUser) {
        await prisma.user.update({
          where: { email },
          data: { role: 'superuser' }
        });
        
  logger.info(`User ${email} has been promoted to superuser`);
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
          data: {
            email,
            name,
            password: hashedPassword,
            role: 'superuser'
          }
        });
        
  logger.info(`Superuser created: ${user.email} (ID: ${user.id})`);
      }
      
    } catch (error) {
      logger.error('Error creating superuser (non-interactive)', {}, error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
} else {
  // Interactive mode
  createSuperuser();
}