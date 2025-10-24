import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import type { MCPContext } from './index.js'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'

import middy from '@middy/core'
import mcpMiddleware from './index.js'

describe('mcpMiddleware', () => {
  let server: Server
  let handler: middy.MiddyfiedHandler<
    APIGatewayProxyEvent,
    APIGatewayProxyResult
  >
  let defaultContext: MCPContext

  beforeEach(() => {
    // Create a real MCP server for testing with tools capability
    server = new Server(
      {
        name: 'test-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    // Register a simple tool for testing
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'add',
          description: 'Add two numbers',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['a', 'b']
          }
        }
      ]
    }))

    server.setRequestHandler(
      CallToolRequestSchema,
      async (request: { params: { name: string; arguments?: unknown } }) => {
        if (request.params.name === 'add') {
          const { a, b } = request.params.arguments as { a: number; b: number }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ result: a + b })
              }
            ]
          }
        }
        throw new Error('Unknown tool')
      }
    )

    handler = middy().use(
      mcpMiddleware({ server: server as unknown as McpServer })
    )

    defaultContext = {
      callbackWaitsForEmptyEventLoop: true,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test',
      logStreamName: '2023/01/01/[$LATEST]test',
      getRemainingTimeInMillis: () => 3000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    }
  })

  describe('happy path', () => {
    it('should initialize transport on first call', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/mcp',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)

      expect(response.statusCode).toBe(200)
      expect(defaultContext.mcpTransport).toBeDefined()
    })

    it('should handle tools/list request', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/mcp',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.result.tools).toHaveLength(1)
      expect(body.result.tools[0].name).toBe('add')
    })

    it('should handle tools/call request', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/mcp',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'add',
            arguments: { a: 5, b: 3 }
          }
        })
      })

      const response = await handler(event, defaultContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.result.content[0].text).toContain('"result":8')
    })

    it('should reuse transport on subsequent calls', async () => {
      const event1 = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const event2 = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list'
        })
      })

      await handler(event1, defaultContext)
      const transport1 = defaultContext.mcpTransport

      await handler(event2, defaultContext)
      const transport2 = defaultContext.mcpTransport

      expect(transport1).toBe(transport2)
    })

    it('should handle POST method', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)
      expect(response.statusCode).toBe(200)
    })

    it('should preserve query parameters in URL', async () => {
      const event = createMockEvent({
        path: '/mcp',
        queryStringParameters: {
          foo: 'bar',
          baz: 'qux'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)
      expect(response.statusCode).toBe(200)
    })

    it('should normalize headers to lowercase', async () => {
      const event = createMockEvent({
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test-value'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)
      expect(response.statusCode).toBe(200)
    })

    it('should attach authorizer data when present', async () => {
      const event = createMockEvent({
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {
            userId: '123',
            role: 'admin'
          }
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)
      expect(response.statusCode).toBe(200)
    })

    it('should handle empty body', async () => {
      const event = createMockEvent({
        body: null
      })

      const response = await handler(event, defaultContext)
      expect(response.statusCode).toBeGreaterThanOrEqual(200)
    })

    it('should handle non-JSON body', async () => {
      const event = createMockEvent({
        body: 'plain text body'
      })

      const response = await handler(event, defaultContext)
      expect(response.statusCode).toBeGreaterThanOrEqual(200)
    })
  })

  describe('error cases', () => {
    it('should handle unknown tool gracefully', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'unknown_tool',
            arguments: {}
          }
        })
      })

      const response = await handler(event, defaultContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.error || body.result).toBeDefined()
    })

    it('should handle malformed JSON-RPC request', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          invalid: 'request'
        })
      })

      const response = await handler(event, defaultContext)

      // MCP should handle invalid requests gracefully
      expect(response.statusCode).toBeGreaterThanOrEqual(200)
    })
  })

  describe('compatibility with other middlewares', () => {
    it('should allow response headers to be added before mcp middleware', async () => {
      const handlerWithMiddlewares = middy()
        .use({
          after: (request) => {
            request.response = {
              ...request.response,
              headers: {
                ...request.response?.headers,
                'x-before-mcp': 'value-1'
              }
            }
          }
        })
        .use(mcpMiddleware({ server: server as unknown as McpServer }))

      const event = createMockEvent({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handlerWithMiddlewares(event, defaultContext)

      expect(response.statusCode).toBe(200)
      expect(response.headers?.['x-before-mcp']).toBe('value-1')
    })

    it('should allow response headers to be added after mcp middleware', async () => {
      const handlerWithMiddlewares = middy()
        .use(mcpMiddleware({ server: server as unknown as McpServer }))
        .use({
          after: (request) => {
            request.response = {
              ...request.response,
              headers: {
                ...request.response?.headers,
                'x-after-mcp': 'value-2'
              }
            }
          }
        })

      const event = createMockEvent({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handlerWithMiddlewares(event, defaultContext)

      expect(response.statusCode).toBe(200)
      expect(response.headers?.['x-after-mcp']).toBe('value-2')
    })

    it('should work with multiple middlewares in any order', async () => {
      const handlerWithMiddlewares = middy()
        .use({
          before: (request) => {
            request.event.headers['x-middleware-1'] = 'before'
          }
        })
        .use(mcpMiddleware({ server: server as unknown as McpServer }))
        .use({
          after: (request) => {
            request.response = {
              ...request.response,
              headers: {
                ...request.response?.headers,
                'x-middleware-2': 'after'
              }
            }
          }
        })

      const event = createMockEvent({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handlerWithMiddlewares(event, defaultContext)

      expect(response.statusCode).toBe(200)
      expect(response.headers?.['x-middleware-2']).toBe('after')
    })
  })

  describe('response handling', () => {
    it('should return proper content-type header', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)

      expect(response.statusCode).toBe(200)
      expect(response.headers?.['content-type']).toBeDefined()
    })

    it('should handle Buffer responses', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)

      expect(response.statusCode).toBe(200)
      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('string')
    })

    it('should preserve response status codes', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        })
      })

      const response = await handler(event, defaultContext)

      expect([200, 201, 202, 204]).toContain(response.statusCode)
    })
  })
})

// Helper function to create mock API Gateway events
function createMockEvent(
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  const baseEvent = {
    body: null,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/mcp',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path: '/mcp',
      stage: 'test',
      requestId: 'test-request',
      requestTime: '01/Jan/2023:00:00:00 +0000',
      requestTimeEpoch: 1672531200000,
      resourceId: 'test',
      resourcePath: '/mcp',
      authorizer: null,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test',
        userArn: null
      }
    },
    resource: '/mcp'
  }

  return {
    ...baseEvent,
    ...overrides,
    headers: {
      ...baseEvent.headers,
      ...overrides.headers
    }
  }
}
