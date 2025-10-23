import { threatDetectionService } from '../src/services/threatDetection';
import { createComponentLogger } from '../src/utils/logger';

const logger = createComponentLogger('ClearThreatBlocks');

async function clearThreatBlocks() {
  try {
    logger.info('Clearing all threat detection blocks...');
    
    // Clear all blocks
    threatDetectionService.clearAllBlocks();
    
    logger.info('✅ All IP blocks cleared successfully');
    
    // Get current stats
    try {
      const stats = threatDetectionService.getBlockedIPs();
      logger.info('📊 Current threat detection stats', stats);
    } catch (statsError) {
      logger.warn('Could not get stats, but blocks were cleared');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error clearing blocks', {}, error);
    process.exit(1);
  }
}

clearThreatBlocks();