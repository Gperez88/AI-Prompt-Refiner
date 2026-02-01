import * as vscode from 'vscode';

/**
 * Log levels for the logger
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

/**
 * Structured logger for the Prompt Refiner extension
 * Outputs to VSCode's Output Channel instead of console
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel | undefined;
    private logLevel: LogLevel = LogLevel.INFO;

    private constructor() {
        // Private constructor to prevent direct instantiation - use getInstance()
    }

    /**
     * Get the singleton instance of the logger
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Initialize the logger with an output channel
     * @param context The extension context
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.outputChannel = vscode.window.createOutputChannel('Prompt Refiner');
        context.subscriptions.push(this.outputChannel);
        this.info('Logger initialized');
    }

    /**
     * Set the minimum log level
     * @param level The log level to set
     */
    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Check if a log level should be logged
     * @param level The level to check
     */
    private shouldLog(level: LogLevel): boolean {
        return level >= this.logLevel;
    }

    /**
     * Format a log message with timestamp and level
     * @param level The log level
     * @param message The message to log
     * @param optionalParams Optional parameters
     */
    private formatMessage(level: string, message: string, ...optionalParams: any[]): string {
        const timestamp = new Date().toISOString();
        let formattedMessage = `[${timestamp}] [${level}] ${message}`;
        
        if (optionalParams.length > 0) {
            formattedMessage += ' ' + optionalParams.map(param => {
                if (typeof param === 'object') {
                    try {
                        return JSON.stringify(param, null, 2);
                    } catch {
                        return String(param);
                    }
                }
                return String(param);
            }).join(' ');
        }
        
        return formattedMessage;
    }

    /**
     * Append message to output channel
     * @param message The message to append
     */
    private append(message: string): void {
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
    }

    /**
     * Log a debug message
     * @param message The message to log
     * @param optionalParams Optional parameters to log
     */
    public debug(message: string, ...optionalParams: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const formatted = this.formatMessage('DEBUG', message, ...optionalParams);
            this.append(formatted);
            console.debug(formatted);
        }
    }

    /**
     * Log an info message
     * @param message The message to log
     * @param optionalParams Optional parameters to log
     */
    public info(message: string, ...optionalParams: any[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            const formatted = this.formatMessage('INFO', message, ...optionalParams);
            this.append(formatted);
            console.log(formatted);
        }
    }

    /**
     * Log a warning message
     * @param message The message to log
     * @param optionalParams Optional parameters to log
     */
    public warn(message: string, ...optionalParams: any[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            const formatted = this.formatMessage('WARN', message, ...optionalParams);
            this.append(formatted);
            console.warn(formatted);
        }
    }

    /**
     * Log an error message
     * @param message The message to log
     * @param error Optional error object
     * @param optionalParams Optional parameters to log
     */
    public error(message: string, error?: Error, ...optionalParams: any[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            let formatted = this.formatMessage('ERROR', message, ...optionalParams);
            if (error) {
                formatted += `\nError: ${error.message}`;
                if (error.stack) {
                    formatted += `\nStack: ${error.stack}`;
                }
            }
            this.append(formatted);
            console.error(formatted);
        }
    }

    /**
     * Show the output channel
     */
    public show(): void {
        if (this.outputChannel) {
            this.outputChannel.show();
        }
    }

    /**
     * Dispose the output channel
     */
    public dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
}

// Export a convenience function for quick logging
export const logger = Logger.getInstance();
