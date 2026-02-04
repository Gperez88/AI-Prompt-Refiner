/**
 * CLI script to update supported models from provider APIs
 * Usage: npm run update-models [-- --all | --providers github,openai]
 */

import { ModelRegistry } from '../src/services/ModelRegistry';
import { logger } from '../src/services/Logger';

async function main() {
    const args = process.argv.slice(2);
    const updateAll = args.includes('--all');
    const providersArg = args.find(arg => arg.startsWith('--providers='));
    
    let providers: string[];
    
    if (updateAll || !providersArg) {
        providers = ['github', 'openai', 'gemini', 'groq'];
        logger.info('Updating all providers', { providers });
    } else {
        providers = providersArg.replace('--providers=', '').split(',').map(p => p.trim());
        logger.info('Updating specific providers', { providers });
    }
    
    const registry = ModelRegistry.getInstance();
    
    // Initialize with current models
    await registry.initialize();
    
    // Force refresh for specified providers
    for (const provider of providers) {
        try {
            logger.info(`Updating models for ${provider}...`);
            await (registry as any).forceRefreshProvider(provider);
            logger.info(`✓ Updated ${provider}`);
        } catch (error) {
            logger.error(`✗ Failed to update ${provider}`, error as Error);
        }
    }
    
    logger.info('Model update completed');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
