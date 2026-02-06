import * as vscode from 'vscode';
import { logger } from './Logger';

/**
 * Simple analytics service for tracking role usage
 * MVP implementation - stores data locally in globalState
 */

interface RoleMetrics {
    roleId: string;
    roleName: string;
    sessionCount: number;
    refinementCount: number;
    lastUsed: number;
    firstUsed: number;
}

interface AnalyticsData {
    roles: Record<string, RoleMetrics>;
    totalRefinements: number;
    totalSessions: number;
    lastUpdated: number;
}

export class Analytics {
    private static instance: Analytics;
    private context?: vscode.ExtensionContext;
    private readonly STORAGE_KEY = 'promptRefiner.analytics.v1';

    private constructor() {
        // Private constructor for singleton pattern
    }

    public static getInstance(): Analytics {
        if (!Analytics.instance) {
            Analytics.instance = new Analytics();
        }
        return Analytics.instance;
    }

    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        logger.debug('Analytics service initialized');
    }

    /**
     * Track when a session is created with a specific role
     */
    public trackSessionCreated(roleId: string, roleName: string): void {
        if (!this.context) return;

        const data = this.getData();
        
        if (!data.roles[roleId]) {
            data.roles[roleId] = {
                roleId,
                roleName,
                sessionCount: 0,
                refinementCount: 0,
                lastUsed: Date.now(),
                firstUsed: Date.now()
            };
        }

        data.roles[roleId].sessionCount++;
        data.roles[roleId].lastUsed = Date.now();
        data.totalSessions++;
        data.lastUpdated = Date.now();

        this.saveData(data);
        logger.debug('Analytics: Session created tracked', { roleId, roleName });
    }

    /**
     * Track when a refinement is performed with a specific role
     */
    public trackRefinement(roleId: string, roleName: string): void {
        if (!this.context) return;

        const data = this.getData();
        
        if (!data.roles[roleId]) {
            data.roles[roleId] = {
                roleId,
                roleName,
                sessionCount: 0,
                refinementCount: 0,
                lastUsed: Date.now(),
                firstUsed: Date.now()
            };
        }

        data.roles[roleId].refinementCount++;
        data.roles[roleId].lastUsed = Date.now();
        data.totalRefinements++;
        data.lastUpdated = Date.now();

        this.saveData(data);
        logger.debug('Analytics: Refinement tracked', { roleId, roleName });
    }

    /**
     * Get analytics data
     */
    public getData(): AnalyticsData {
        if (!this.context) {
            return {
                roles: {},
                totalRefinements: 0,
                totalSessions: 0,
                lastUpdated: Date.now()
            };
        }

        return this.context.globalState.get<AnalyticsData>(this.STORAGE_KEY, {
            roles: {},
            totalRefinements: 0,
            totalSessions: 0,
            lastUpdated: Date.now()
        });
    }

    /**
     * Get role statistics sorted by usage
     */
    public getRoleStats(): RoleMetrics[] {
        const data = this.getData();
        return Object.values(data.roles).sort((a, b) => b.sessionCount - a.sessionCount);
    }

    /**
     * Generate a simple report
     */
    public generateReport(): string {
        const data = this.getData();
        const roles = this.getRoleStats();

        if (roles.length === 0) {
            return '📊 No usage data yet. Start creating sessions to see analytics!';
        }

        let report = '📊 Role Usage Analytics\n';
        report += '═'.repeat(50) + '\n\n';
        
        report += `Total Sessions: ${data.totalSessions}\n`;
        report += `Total Refinements: ${data.totalRefinements}\n`;
        report += `Last Updated: ${new Date(data.lastUpdated).toLocaleDateString()}\n\n`;
        
        report += 'Role Breakdown:\n';
        report += '-'.repeat(50) + '\n';
        
        roles.forEach((role, index) => {
            const sessionPercent = data.totalSessions > 0 
                ? Math.round((role.sessionCount / data.totalSessions) * 100) 
                : 0;
            const refinePercent = data.totalRefinements > 0 
                ? Math.round((role.refinementCount / data.totalRefinements) * 100) 
                : 0;
            
            report += `${index + 1}. ${role.roleName} (${role.roleId})\n`;
            report += `   Sessions: ${role.sessionCount} (${sessionPercent}%)\n`;
            report += `   Refinements: ${role.refinementCount} (${refinePercent}%)\n`;
            report += `   Last used: ${new Date(role.lastUsed).toLocaleDateString()}\n\n`;
        });

        return report;
    }

    /**
     * Show analytics report in output channel
     */
    public showReport(): void {
        const report = this.generateReport();
        logger.info('Analytics Report:\n' + report);
        
        // Also show in output channel
        const outputChannel = vscode.window.createOutputChannel('Prompt Refiner Analytics');
        outputChannel.clear();
        outputChannel.appendLine(report);
        outputChannel.show();
    }

    /**
     * Reset all analytics data
     */
    public async resetData(): Promise<void> {
        if (!this.context) return;
        
        const answer = await vscode.window.showWarningMessage(
            'Are you sure you want to reset all analytics data? This cannot be undone.',
            'Yes', 'Cancel'
        );
        
        if (answer === 'Yes') {
            await this.context.globalState.update(this.STORAGE_KEY, undefined);
            logger.info('Analytics data reset');
            vscode.window.showInformationMessage('Analytics data has been reset');
        }
    }

    private saveData(data: AnalyticsData): void {
        if (!this.context) return;
        this.context.globalState.update(this.STORAGE_KEY, data);
    }
}
