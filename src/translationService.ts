import { ILogger } from "./logger";

/**
 * Supported file schema formats for translation requests.
 * Used to enable schema-specific translation handling.
 */
export enum FileSchema {
  /** OpenAPI specification format */
  OpenAPI = "openApi",
  /** Flutter ARB (Application Resource Bundle) format */
  ARBFlutter = "arbFlutter",
}

// API Types based on the OpenAPI specification
export interface TranslationRequest {
  sourceStrings: string;
  targetLanguageCode: string;
  useContractions?: boolean;
  useShortening?: boolean;
  generatePluralForms?: boolean;
  returnTranslationsAsString: boolean;
  client: string;
  translateOnlyNewStrings?: boolean;
  targetStrings?: string;
  schema: FileSchema | null;
}

export interface TranslationResult {
  targetLanguageCode: string;
  translations?: string;
  usage: TranslationUsage;
  finishReason?: FinishReason;
  completedChunks: number;
  totalChunks: number;
  remainingBalance?: number;
  /**
   * Source strings that were filtered out due to content policy violations or length limits.
   * Populated when the finish reason is 'contentFilter' or 'length'.
   * The structure matches the source strings format.
   */
  filteredStrings?: Record<string, unknown>;
  filteredStringsCount?: number;
}

export interface TranslationUsage {
  charsUsed?: number;
}

export enum FinishReason {
  stop = "stop",
  length = "length",
  contentFilter = "contentFilter",
  insufficientBalance = "insufficientBalance",
  error = "error",
}

export interface Language {
  code: string;
  name: string;
}

export interface LanguagePredictionResponse {
  languages: Language[];
}

export class L10nTranslationService {
  private readonly baseUrl = "https://l10n.dev/api";
  private readonly pricingUrl = "https://l10n.dev/#pricing";

  constructor(private readonly logger: ILogger) {}

  async predictLanguages(
    input: string,
    limit: number = 10
  ): Promise<Language[]> {
    const url = new URL(`${this.baseUrl}/languages/predict`);
    url.searchParams.append("input", input);
    url.searchParams.append("limit", limit.toString());

    this.logger.logInfo(
      `Predicting languages for input (${input.length} characters)`
    );

    const response = await fetch(url.toString());

    if (!response.ok) {
      this.logger.logWarning(
        `Language prediction failed - ${response.status} ${response.statusText}`
      );
      const error = new Error(
        `Failed to predict languages: ${response.statusText}`
      );
      throw error;
    }

    const result: LanguagePredictionResponse =
      (await response.json()) as LanguagePredictionResponse;

    this.logger.logInfo(
      `Successfully predicted ${result.languages.length} languages`
    );
    return result.languages;
  }

  async translateJson(
    request: TranslationRequest,
    apiKey: string
  ): Promise<TranslationResult | null> {
    if (!apiKey) {
      throw new Error("API Key not set. Please configure your API Key first.");
    }

    this.logger.logInfo(
      `Starting translation to ${request.targetLanguageCode}`
    );

    const response = await fetch(`${this.baseUrl}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage: string;
      let errorData: any = null;

      // Try to parse error response body
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parsing errors
      }

      this.logger.logWarning(
        `Translation API error - ${response.status} ${response.statusText}`
      );
      if (errorData) {
        this.logger.logWarning(
          `API error details - ${JSON.stringify(errorData)}`
        );
      }

      switch (response.status) {
        case 400: {
          // Try to extract validation errors from the error response
          let validationMessage =
            "Invalid request. Please check your input and try again.";
          if (errorData && errorData.errors) {
            const errorDetails = errorData.errors;
            if (Array.isArray(errorDetails)) {
              validationMessage = errorDetails.join(" ");
            } else if (typeof errorDetails === "object") {
              validationMessage = Object.values(errorDetails)
                .map((v) => (Array.isArray(v) ? v.join(" ") : v))
                .join(" ");
            }
          }
          errorMessage = validationMessage;
          break;
        }
        case 401:
          errorMessage = "Unauthorized. Please check your API Key.";
          break;
        case 402: {
          // Try to extract required characters from the error response
          let message =
            "Not enough characters remaining for this translation. You can try translating a smaller portion of your file or purchase more characters.";

          const requiredBalance = errorData?.data?.requiredBalance as number;
          if (requiredBalance) {
            const currentBalance =
              (errorData?.data?.currentBalance as number) ?? 0;
            message = `This translation requires ${requiredBalance.toLocaleString()} characters, but you only have ${currentBalance.toLocaleString()} characters available. You can try translating a smaller portion of your file or purchase more characters.`;
          }

          this.logger.showAndLogError(
            message,
            errorData,
            "",
            "Visit l10n.dev",
            this.pricingUrl
          );
          return null;
        }
        case 413:
          errorMessage = "Request too large. Maximum request size is 5 MB.";
          break;
        case 500:
          errorMessage = `An internal server error occurred (Error code: ${
            errorData?.errorCode || "unknown"
          }). Please try again later.`;
          break;
        default:
          errorMessage =
            "Failed to translate. Please check your connection and try again.";
      }

      throw new Error(errorMessage);
    }

    const result = (await response.json()) as TranslationResult;

    // Handle finish reasons
    if (result.finishReason) {
      if (result.finishReason !== FinishReason.stop) {
        this.logger.logWarning(
          `Translation finished with reason: ${result.finishReason}`
        );
      }

      switch (result.finishReason) {
        case FinishReason.insufficientBalance:
          const message = `Not enough characters remaining for this translation. You can try translating a smaller portion of your file or purchase more characters.`;
          this.logger.showAndLogError(
            message,
            undefined,
            "",
            "Visit l10n.dev",
            this.pricingUrl
          );
          return null;
        case FinishReason.error:
          throw new Error("Translation failed due to an error.");
        // Note: FinishReason.contentFilter and FinishReason.length return partial results with filteredStrings
      }
    }

    if (result.filteredStrings) {
      const filteredCount = this.countAllKeys(result.filteredStrings);
      result.filteredStringsCount = filteredCount;
    }

    return result;
  }

  private countAllKeys(obj: any): number {
    let count = 0;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];

        if (typeof value === "string") {
          // Count only string values
          count += 1;
        } else if (typeof value === "object" && value !== null) {
          // Recurse into both objects AND arrays
          count += this.countAllKeys(value);
        }
      }
    }
    return count;
  }
}
