import * as assert from "assert";
import * as sinon from "sinon";
import { URLS } from "../constants";
import { ILogger } from "../logger";

// Import the service and types
const translationServiceModule = require("../translationService");
const L10nTranslationService = translationServiceModule.L10nTranslationService;

// Mock fetch globally
const mockFetch = sinon.stub();
(global as any).fetch = mockFetch;

// Mock URL constructor
(global as any).URL = function (url: string) {
  this.searchParams = {
    append: sinon.stub(),
  };
  this.toString = () => url;
};

suite("L10nTranslationService Test Suite", () => {
  let service: any;
  let mockLogger: ILogger;

  setup(() => {
    // Reset all stubs
    sinon.resetHistory();

    // Reset fetch mock
    mockFetch.reset();

    // Create mock logger
    mockLogger = {
      logInfo: sinon.stub(),
      logWarning: sinon.stub(),
      showAndLogError: sinon.stub(),
    };

    // Create service instance with mocked logger only
    service = new L10nTranslationService(mockLogger);
  });

  teardown(() => {
    sinon.restore();
  });

  suite("Language Prediction", () => {
    test("predictLanguages returns parsed results on success", async () => {
      const mockResponse = {
        languages: [
          { code: "es", name: "Spanish" },
          { code: "fr", name: "French" },
        ],
      };

      const mockFetchResponse = {
        ok: true,
        json: sinon.stub().resolves(mockResponse),
      };

      mockFetch.resolves(mockFetchResponse);

      const result = await service.predictLanguages("spanish", 5);

      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result, mockResponse.languages);
    });

    test("predictLanguages throws error on failed API call", async () => {
      const mockFetchResponse = {
        ok: false,
        statusText: "Bad Request",
      };

      mockFetch.resolves(mockFetchResponse);

      await assert.rejects(
        async () => await service.predictLanguages("test"),
        /Failed to predict languages: Bad Request/
      );
    });
  });

  suite("JSON Translation", () => {
    test("translateJson throws error when no API Key is set", async () => {
      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            "" // empty API key
          ),
        /API Key not set. Please configure your API Key first./
      );
    });

    test("translateJson makes correct API call with valid API Key", async () => {
      const apiKey = "valid-api-key";

      const sourceStrings = { hello: "Hello", world: "World" };
      const targetLanguage = "es";
      const useContractions = false;
      const useShortening = true;
      const request = {
        sourceStrings,
        targetLanguageCode: targetLanguage,
        useContractions,
        useShortening,
      };

      const mockTranslationResult = {
        targetLanguageCode: "es",
        translations: { hello: "Hola", world: "Mundo" },
        usage: { charsUsed: 10 },
        completedChunks: 1,
        totalChunks: 1,
      };

      const mockFetchResponse = {
        ok: true,
        json: sinon.stub().resolves(mockTranslationResult),
      };

      mockFetch.resolves(mockFetchResponse);

      const result = await service.translateJson(request, apiKey);

      assert.deepStrictEqual(result, mockTranslationResult);

      // Verify fetch was called with correct parameters
      assert.ok(mockFetch.called);
      const fetchCall = mockFetch.getCall(0);
      assert.strictEqual(fetchCall.args[0], `${URLS.API_BASE}/translate`);

      const requestOptions = fetchCall.args[1];
      assert.strictEqual(requestOptions.method, "POST");
      assert.strictEqual(
        requestOptions.headers["Content-Type"],
        "application/json"
      );
      assert.strictEqual(requestOptions.headers["X-API-Key"], apiKey);

      const requestBody = JSON.parse(requestOptions.body);
      assert.deepStrictEqual(requestBody.sourceStrings, sourceStrings);
      assert.strictEqual(requestBody.targetLanguageCode, targetLanguage);
      assert.strictEqual(requestBody.useContractions, false);
      assert.strictEqual(requestBody.useShortening, true);
    });

    test("translateJson handles 400 Bad Request error", async () => {
      const apiKey = "valid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: sinon.stub().resolves({
          errors: ["Invalid source strings format"],
        }),
      };

      mockFetch.resolves(mockErrorResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /Invalid source strings format/
      );
    });

    test("translateJson handles 401 Unauthorized error", async () => {
      const apiKey = "invalid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 401,
        json: sinon.stub().resolves({}),
      };

      mockFetch.resolves(mockErrorResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /Unauthorized. Please check your API Key./
      );
    });

    test("translateJson handles 402 Payment Required error with specific message", async () => {
      const apiKey = "valid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 402,
        json: sinon.stub().resolves({
          data: {
            requiredCharactersForTranslation: 1000,
          },
        }),
      };

      mockFetch.resolves(mockErrorResponse);

      const result = await service.translateJson(
        {
          sourceStrings: {},
          targetLanguageCode: "es",
          useContractions: false,
          useShortening: false,
        },
        apiKey
      );

      // 402 errors now return null instead of throwing
      assert.strictEqual(result, null);
    });

    test("translateJson handles 413 Request Too Large error", async () => {
      const apiKey = "valid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 413,
        json: sinon.stub().resolves({}),
      };

      mockFetch.resolves(mockErrorResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /Request too large. Maximum request size is 5 MB./
      );
    });

    test("translateJson handles 500 Internal Server Error", async () => {
      const apiKey = "valid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 500,
        json: sinon.stub().resolves({
          errorCode: "INTERNAL_ERROR_123",
        }),
      };

      mockFetch.resolves(mockErrorResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /An internal server error occurred \(Error code: INTERNAL_ERROR_123\)/
      );
    });
  });

  suite("Error Handling", () => {
    test("handles complex validation error structure", async () => {
      const apiKey = "valid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: sinon.stub().resolves({
          errors: {
            sourceStrings: ["is required"],
            targetLanguageCode: ["is invalid", "must be BCP-47 format"],
          },
        }),
      };

      mockFetch.resolves(mockErrorResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /is required is invalid must be BCP-47 format/
      );
    });

    test("handles array validation error structure", async () => {
      const apiKey = "valid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: sinon.stub().resolves({
          errors: ["Field validation failed", "Invalid input format"],
        }),
      };

      mockFetch.resolves(mockErrorResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /Field validation failed Invalid input format/
      );
    });

    test("handles JSON parsing failure in error response", async () => {
      const apiKey = "valid-api-key";

      const mockErrorResponse = {
        ok: false,
        status: 500,
        json: sinon.stub().rejects(new Error("JSON parse error")),
      };

      mockFetch.resolves(mockErrorResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /An internal server error occurred \(Error code: unknown\)/
      );
    });
  });

  suite("Finish Reason Handling", () => {
    test("handles insufficientBalance finish reason", async () => {
      const apiKey = "valid-api-key";

      const mockResponse = {
        ok: true,
        json: sinon.stub().resolves({
          targetLanguageCode: "es",
          translations: { hello: "hola" },
          usage: { charsUsed: 5 },
          finishReason: "insufficientBalance",
          completedChunks: 1,
          totalChunks: 1,
        }),
      };

      mockFetch.resolves(mockResponse);

      const result = await service.translateJson(
        {
          sourceStrings: {},
          targetLanguageCode: "es",
          useContractions: false,
          useShortening: false,
        },
        apiKey
      );

      // insufficientBalance finish reason now returns null instead of throwing
      assert.strictEqual(result, null);
    });

    test("throws error for error finish reason", async () => {
      const apiKey = "valid-api-key";

      const mockResponse = {
        ok: true,
        json: sinon.stub().resolves({
          targetLanguageCode: "es",
          translations: { hello: "hola" },
          usage: { charsUsed: 5 },
          finishReason: "error",
          completedChunks: 1,
          totalChunks: 1,
        }),
      };

      mockFetch.resolves(mockResponse);

      await assert.rejects(
        async () =>
          await service.translateJson(
            {
              sourceStrings: {},
              targetLanguageCode: "es",
              useContractions: false,
              useShortening: false,
            },
            apiKey
          ),
        /Translation failed due to an error\./
      );
    });

    test("does not throw error for length finish reason", async () => {
      const apiKey = "valid-api-key";

      const expectedResult = {
        targetLanguageCode: "es",
        translations: { hello: "hola" },
        usage: { charsUsed: 5 },
        finishReason: "length",
        filteredStrings: { hello: "hola" },
        completedChunks: 1,
        totalChunks: 1,
      };

      const mockResponse = {
        ok: true,
        json: sinon.stub().resolves(expectedResult),
      };

      mockFetch.resolves(mockResponse);

      const result = await service.translateJson(
        {
          sourceStrings: {},
          targetLanguageCode: "es",
          useContractions: false,
          useShortening: false,
        },
        apiKey
      );
      assert.deepStrictEqual(result, expectedResult);
    });

    test("does not throw error for contentFilter finish reason", async () => {
      const apiKey = "valid-api-key";

      const expectedResult = {
        targetLanguageCode: "es",
        translations: { hello: "hola" },
        usage: { charsUsed: 5 },
        finishReason: "contentFilter",
        filteredStrings: { hello: "hola" },
        completedChunks: 1,
        totalChunks: 1,
      };

      const mockResponse = {
        ok: true,
        json: sinon.stub().resolves(expectedResult),
      };

      mockFetch.resolves(mockResponse);

      const result = await service.translateJson(
        {
          sourceStrings: {},
          targetLanguageCode: "es",
          useContractions: false,
          useShortening: false,
        },
        apiKey
      );
      assert.deepStrictEqual(result, expectedResult);
    });

    test("does not throw error for stop finish reason", async () => {
      const apiKey = "valid-api-key";

      const expectedResult = {
        targetLanguageCode: "es",
        translations: { hello: "hola" },
        usage: { charsUsed: 5 },
        finishReason: "stop",
        completedChunks: 1,
        totalChunks: 1,
      };

      const mockResponse = {
        ok: true,
        json: sinon.stub().resolves(expectedResult),
      };

      mockFetch.resolves(mockResponse);

      const result = await service.translateJson(
        {
          sourceStrings: {},
          targetLanguageCode: "es",
          useContractions: false,
          useShortening: false,
        },
        apiKey
      );
      assert.deepStrictEqual(result, expectedResult);
    });

    test("works normally when no finish reason is present", async () => {
      const apiKey = "valid-api-key";

      const expectedResult = {
        targetLanguageCode: "es",
        translations: { hello: "hola" },
        usage: { charsUsed: 5 },
        completedChunks: 1,
        totalChunks: 1,
      };

      const mockResponse = {
        ok: true,
        json: sinon.stub().resolves(expectedResult),
      };

      mockFetch.resolves(mockResponse);

      const result = await service.translateJson(
        {
          sourceStrings: {},
          targetLanguageCode: "es",
          useContractions: false,
          useShortening: false,
        },
        apiKey
      );
      assert.deepStrictEqual(result, expectedResult);
    });
  });
});
