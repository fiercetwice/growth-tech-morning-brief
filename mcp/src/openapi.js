export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Stock Research Radar API',
    version: '0.1.0',
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
            schema: {
              type: 'string',
              minLength: 1,
              maxLength: 1200,
              pattern: '^[A-Za-z0-9.,-]+$'
            }
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
                        rows: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: true,
                            properties: {
                              ticker: { type: 'string' },
                              last: { type: ['number', 'null'] },
                              observations1m: { type: ['integer', 'null'] },
                              return5d: { type: ['number', 'null'] },
                              return1m: { type: ['number', 'null'] },
                              monthHigh: { type: ['number', 'null'] },
                              monthLow: { type: ['number', 'null'] },
                              drawdownFromMonthHigh: { type: ['number', 'null'] },
                              distanceFromMonthLow: { type: ['number', 'null'] },
                              avgVolume1m: { type: ['number', 'null'] },
                              valuationBasis: { type: ['string', 'null'] },
                              pePercentile: { type: ['number', 'null'] },
                              psPercentile: { type: ['number', 'null'] },
                              targetBase: { type: ['number', 'null'] },
                              targetUpside: { type: ['number', 'null'] },
                              targetConfidence: { type: ['string', 'null'] },
                              completeOneMonth: { type: 'boolean' },
                              secAvailable: { type: 'boolean' },
                              targetAvailable: { type: 'boolean' },
                              ttmAvailable: { type: 'boolean' },
                              recentFilingCount: { type: 'integer' },
                              buyNowDataGate: { type: 'boolean' },
                              cacheHit: { type: 'boolean' }
                            }
                          }
                        },
                        failures: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid ticker list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    error: { type: 'string' }
                  }
                }
              }
            }
          },
          '502': {
            description: 'Upstream research source failure',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    error: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
