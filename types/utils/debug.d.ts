/**
 * Debug utility for conditional logging throughout the SDK
 *
 * This utility provides a centralized way to handle debug logging without
 * needing biome-ignore comments for console statements. It only logs when
 * debug mode is enabled.
 *
 * @example
 * ```typescript
 * const logger = createDebugLogger(this.debug);
 * logger.log('Connection established', { source: 'LiveKitConnection' });
 * logger.error('Failed to connect', { source: 'LiveKitConnection', error });
 * ```
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
interface LogOptions {
    source?: string;
    level?: LogLevel;
    error?: unknown;
}
/**
 * Debug logger interface
 */
export interface DebugLogger {
    /**
     * Log a debug message (only when debug mode is enabled)
     */
    log: (message: unknown, options?: LogOptions) => void;
    /**
     * Log an info message (only when debug mode is enabled)
     */
    info: (message: unknown, options?: LogOptions) => void;
    /**
     * Log a warning message (only when debug mode is enabled)
     */
    warn: (message: unknown, options?: LogOptions) => void;
    /**
     * Log an error message (always logs, regardless of debug mode)
     */
    error: (message: unknown, options?: LogOptions) => void;
}
/**
 * Creates a debug logger instance
 *
 * @param debug - Whether debug mode is enabled
 * @returns A debug logger instance
 *
 * @example
 * ```typescript
 * const logger = createDebugLogger(true);
 * logger.log('Starting connection', { source: 'LiveKitConnection' });
 * logger.error('Connection failed', { source: 'LiveKitConnection', error });
 * ```
 */
export declare const createDebugLogger: (debug: boolean) => DebugLogger;
export {};
