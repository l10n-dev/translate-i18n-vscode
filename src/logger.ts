/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  showAndLogError(
    userMessage: string,
    error?: unknown,
    context?: string,
    linkBtnText?: string,
    url?: string
  ): void;
  logInfo(message: string): void;
  logWarning(message: string): void;
}
