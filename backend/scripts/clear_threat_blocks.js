#!/usr/bin/env node

// Clear IP blocks for development/admin use
// This script calls the runtime (dist) threatDetectionService so it can be
// executed without compiling TypeScript in dev environments where dist is built.

let threatDetectionService;
let logger = console;

try {
  // Prefer the compiled dist version when available
  threatDetectionService = require('../dist/src/services/threatDetection').threatDetectionService;
  try {
    logger = require('../dist/src/utils/logger').createComponentLogger('ClearThreatBlocks');
  } catch (e) {
    // Fallback to console if the compiled logger isn't available
    logger = console;
  }
} catch (e) {
  console.error('Could not load threatDetectionService from dist. Ensure project is built.', e);
  process.exit(1);
}

async function clearThreatBlocks() {
  logger.info?.('Clearing all threat detection blocks...') || console.log('Clearing all threat detection blocks...');

  try {
    // Clear in-memory blocks
    if (typeof threatDetectionService.clearAllBlocks === 'function') {
      threatDetectionService.clearAllBlocks();
      logger.info?.('✅ All IP blocks cleared successfully') || console.log('✅ All IP blocks cleared successfully');
    } else {
      logger.warn?.('threatDetectionService.clearAllBlocks is not a function');
    }

    // Fetch and log current stats if available
    try {
      const stats = typeof threatDetectionService.getStats === 'function'
        ? threatDetectionService.getStats()
        : undefined;
      logger.info?.('📊 Current threat detection stats:', stats) || console.log('📊 Current threat detection stats:', stats);
    } catch (statsError) {
      logger.warn?.('Could not retrieve threat detection stats', statsError) || console.warn('Could not retrieve threat detection stats', statsError);
    }

    process.exit(0);
  } catch (error) {
    logger.error?.('❌ Error clearing blocks:', error) || console.error('❌ Error clearing blocks:', error);
    process.exit(1);
  }
}

clearThreatBlocks();




// Clear IP blocks for development/admin use



  

  