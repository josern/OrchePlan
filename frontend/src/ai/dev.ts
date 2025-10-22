// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  try {
    const { config } = require('dotenv');
    config();
  } catch (error) {
    console.warn('dotenv not available in production build');
  }
}

import '@/ai/flows/daily-prioritization.ts';