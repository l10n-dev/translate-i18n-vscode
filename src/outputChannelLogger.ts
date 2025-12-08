import * as vscode from "vscode";
import { ILogger } from "ai-l10n";

/**
 * Default VS Code output channel logger implementation
 */
export class OutputChannelLogger implements ILogger {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(channelName: string = "Translate i18n JSON/ARB") {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  showAndLogError(
    userMessage: string,
    error?: unknown,
    context?: string,
    linkBtnText?: string,
    url?: string
  ): void {
    // Show user-friendly message
    const learnMoreText = linkBtnText || "Learn More";
    const options = url ? [learnMoreText] : [];
    vscode.window
      .showErrorMessage(userMessage, ...options)
      .then((selection) => {
        if (selection === learnMoreText) {
          vscode.env.openExternal(vscode.Uri.parse(url!));
        }
      });

    // Log detailed error information
    const timestamp = new Date().toISOString();
    const stackTrace = error instanceof Error ? error.stack : "";

    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${userMessage}`);
    if (context) {
      this.outputChannel.appendLine(`Context: ${context}`);
    }
    if (stackTrace) {
      this.outputChannel.appendLine(`Stack trace: ${stackTrace}`);
    }
    this.outputChannel.appendLine("---");

    // Also log to console for development
    console.error(`[Translate i18n JSON/ARB] ${userMessage}:`, error);
  }

  logInfo(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] INFO: ${message}`);
  }

  logWarning(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] WARNING: ${message}`);
  }
}
