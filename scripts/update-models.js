"use strict";
/**
 * CLI script to update supported models from provider APIs
 * Usage: npm run update-models [-- --all | --providers github,openai]
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ModelRegistry_1 = require("../src/services/ModelRegistry");
const Logger_1 = require("../src/services/Logger");
async function main() {
    const args = process.argv.slice(2);
    const updateAll = args.includes('--all');
    const providersArg = args.find(arg => arg.startsWith('--providers='));
    let providers;
    if (updateAll || !providersArg) {
        providers = ['github', 'openai', 'gemini', 'groq'];
        Logger_1.logger.info('Updating all providers', { providers });
    }
    else {
        providers = providersArg.replace('--providers=', '').split(',').map(p => p.trim());
        Logger_1.logger.info('Updating specific providers', { providers });
    }
    const registry = ModelRegistry_1.ModelRegistry.getInstance();
    // Initialize with current models
    await registry.initialize();
    // Force refresh for specified providers
    for (const provider of providers) {
        try {
            Logger_1.logger.info(`Updating models for ${provider}...`);
            await registry.forceRefreshProvider(provider);
            Logger_1.logger.info(`✓ Updated ${provider}`);
        }
        catch (error) {
            Logger_1.logger.error(`✗ Failed to update ${provider}`, error);
        }
    }
    Logger_1.logger.info('Model update completed');
}
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=update-models.js.map