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

type LogOptions = {
  source?: string;
  level?: LogLevel;
  error?: unknown;
};

/**
 * Determines if a message should be logged based on level and debug mode
 *
 * @param level - The log level
 * @param debug - Whether debug mode is enabled
 * @returns true if the message should be logged
 */
const shouldLog = (level: LogLevel, debug: boolean): boolean => {
  // Always log errors regardless of debug mode
  if (level === 'error') {
    return true;
  }

  // For all other levels, only log when debug is enabled
  return debug;
};

/**
 * Formats a log message with timestamp, level, and source
 *
 * @param _message - The message to format (unused, kept for future extension)
 * @param options - Additional options for formatting
 * @returns Formatted message string
 */
const formatMessage = (_message: unknown, options?: LogOptions): string => {
  const timestamp = new Date().toISOString();
  const source = options?.source ? `[${options.source}]` : '';
  const level = options?.level ? `[${options.level.toUpperCase()}]` : '';

  return `${timestamp} ${level} ${source}`;
};

/**
 * Debug logger interface
 */
export type DebugLogger = {
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
};

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
export const createDebugLogger = (debug: boolean): DebugLogger => ({
  log: (message: unknown, options?: LogOptions) => {
    if (!shouldLog(options?.level || 'debug', debug)) {
      return;
    }

    const formattedMessage = formatMessage(message, {
      ...options,
      level: 'debug',
    });

    // biome-ignore lint/suspicious/noConsole: This is a debug utility for conditional logging
    console.log(formattedMessage, message, options?.error || '');
  },

  info: (message: unknown, options?: LogOptions) => {
    if (!shouldLog(options?.level || 'info', debug)) {
      return;
    }

    const formattedMessage = formatMessage(message, {
      ...options,
      level: 'info',
    });

    // biome-ignore lint/suspicious/noConsole: This is a debug utility for conditional logging
    console.info(formattedMessage, message, options?.error || '');
  },

  warn: (message: unknown, options?: LogOptions) => {
    if (!shouldLog(options?.level || 'warn', debug)) {
      return;
    }

    const formattedMessage = formatMessage(message, {
      ...options,
      level: 'warn',
    });

    // biome-ignore lint/suspicious/noConsole: This is a debug utility for conditional logging
    console.warn(formattedMessage, message, options?.error || '');
  },

  error: (message: unknown, options?: LogOptions) => {
    if (!shouldLog(options?.level || 'error', debug)) {
      return;
    }

    const formattedMessage = formatMessage(message, {
      ...options,
      level: 'error',
    });

    // biome-ignore lint/suspicious/noConsole: This is a debug utility for conditional logging
    console.error(formattedMessage, message, options?.error || '');
  },
});
