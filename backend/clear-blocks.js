#!/usr/bin/env node

// Clear IP blocks for development/admin use
const { threatDetectionService } = require('../dist/src/services/threatDetection');

async function clearThreatBlocks() {
  console.log('Clearing all threat detection blocks...');
  
  try {
    // Clear all blocks
    threatDetectionService.clearAllBlocks();
    console.log('✅ All IP blocks cleared successfully');
    
    // Get current stats  
    const stats = threatDetectionService.getStats();
    console.log('📊 Current threat detection stats:', stats);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing blocks:', error);
    process.exit(1);
  }
}

clearThreatBlocks();