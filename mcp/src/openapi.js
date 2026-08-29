export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Stock Research Radar API',
    version: '0.2.0',
    description: 'Read-only deterministic stock research packets for ChatGPT Actions. No brokerage or account data is exposed.'
  },
  servers: [
    { url: 'https://stock-research-mcp.ck-market-tools.workers.dev' }
  ],
  paths: {
    '/api/v1/watchlist': {
      get: {
        operationId: 'getWatchlistPacket',
        summary: 'Get deterministic entry and valuation packets for a list of stock or ETF tickers',
        description: 'Returns compact 1-month setup, SEC-derived valuation context, deterministic target model fields, filing hints, and per-symbol failures. This endpoint is read-only and contains no brokerage/account data.',
        'x-openai-isConsequential': false,
        parameters: [
          {
            name: 'tickers',
            in: 'query',
            required: true,
            description: 'Comma-separated unique ticker symbols. Example: AAPL,MSFT,NVDA. Maximum 75 symbols.',
            schema: { type: 'string', minLength: 1, maxLength: 1200, pattern: '^[A-Za-z0-9.,-]+$' }
          }
        ],
        responses: {
          '200': {
            description: 'Watchlist research packet',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok', 'data'],
                  properties: {
                    ok: { type: 'boolean' },
                    data: {
                      type: 'object',
                      required: ['version', 'asOf', 'requested', 'succeeded', 'failed', 'rows', 'failures'],
                      properties: {
                        version: { type: 'string' },
                        asOf: { type: 'string' },
                        requested: { type: 'integer' },
                        succeeded: { type: 'integer' },
                        failed: { type: 'integer' },
                        rows: { type: 'array', items: { type: 'object', additionalProperties: true } },
                        failures: { type: 'array', items: { type: 'object', additionalProperties: true } }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Invalid ticker list' },
          '502': { description: 'Upstream research source failure' }
        }
      }
    },
    '/api/v1/entry': {
      get: {
        operationId: 'getEntrySetup',
        summary: 'Get the deterministic entry setup for one stock or ETF ticker',
        description: 'Returns the compact one-symbol packet used by Stock Entry Radar, including one-month setup, historical valuation context, modeled target fields, and data-quality gates.',
        'x-openai-isConsequential': false,
        parameters: [
          {
            name: 'ticker',
            in: 'query',
            required: true,
            description: 'Ticker symbol, for example AAPL.',
            schema: { type: 'string', minLength: 1, maxLength: 16, pattern: '^[A-Za-z0-9.-]+$' }
          }
        ],
        responses: {
          '200': {
            description: 'Single-stock entry setup',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok', 'data'],
                  properties: {
                    ok: { type: 'boolean' },
                    data: { type: 'object', additionalProperties: true }
                  }
                }
              }
            }
          },
          '400': { description: 'Invalid ticker' },
          '502': { description: 'Upstream research source failure' }
        }
      }
    },
    '/api/v1/earnings': {
      get: {
        operationId: 'getEarningsCalendar',
        summary: 'Get the Nasdaq public earnings calendar for a date',
        description: 'Returns normalized public earnings-calendar rows for the requested YYYY-MM-DD date. This endpoint is read-only.',
        'x-openai-isConsequential': false,
        parameters: [
          {
            name: 'date',
            in: 'query',
            required: true,
            description: 'Calendar date in YYYY-MM-DD format.',
            schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
          }
        ],
        responses: {
          '200': {
            description: 'Earnings calendar rows',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok', 'data'],
                  properties: {
                    ok: { type: 'boolean' },
                    data: {
                      type: 'object',
                      required: ['date', 'rows'],
                      properties: {
                        date: { type: 'string' },
                        rows: { type: 'array', items: { type: 'object', additionalProperties: true } }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Invalid date' },
          '502': { description: 'Upstream earnings-calendar source failure' }
        }
      }
    }
  }
};
