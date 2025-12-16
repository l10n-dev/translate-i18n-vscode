import * as vscode from "vscode";
import { ILogger } from "ai-l10n-sdk";

/**
 * Default VS Code output channel logger implementation
 */
export class OutputChannelLogger implements ILogger {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(channelName: string = "Translate i18n JSON/ARB") {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  showAndLogError(
    message: string,
    error?: unknown,
    context?: string,
    linkBtnText?: string,
    url?: string
  ): void {
    // Show user-friendly message
    const learnMoreText = linkBtnText || "Learn More";
    const options = url ? [learnMoreText] : [];
    vscode.window.showErrorMessage(message, ...options).then((selection) => {
      if (selection === learnMoreText) {
        vscode.env.openExternal(vscode.Uri.parse(url!));
      }
    });

    // Log detailed error information
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);

    if (context) {
      this.outputChannel.appendLine(`Context: ${context}`);
    }

    if (error instanceof Error) {
      this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
    }
    this.outputChannel.appendLine("---");

    // Also log to console for development
    console.error(`[Translate i18n JSON/ARB] ${message}:`, error);
  }

  logInfo(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] INFO: ${message}`);
  }

  logWarning(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] WARNING: ${message}`);

    if (error instanceof Error) {
      this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
    }
    this.outputChannel.appendLine("---");

    // Also log to console for development
    console.warn(`[Translate i18n JSON/ARB] ${message}:`, error);
  }

  logError(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);

    if (error instanceof Error) {
      this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
    }
    this.outputChannel.appendLine("---");

    // Also log to console for development
    console.error(`[Translate i18n JSON/ARB] ${message}:`, error);
  }
}
