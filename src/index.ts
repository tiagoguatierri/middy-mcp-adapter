import type middy from '@middy/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  APIGatewayEventRequestContext,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context
} from 'aws-lambda'

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { IncomingMessage, ServerResponse } from 'http'

import createHttpError from 'http-errors'

type MCPMiddlewareOptions = {
  server: McpServer
}

type MCPContext = Context & {
  mcpTransport?: StreamableHTTPServerTransport
}

type AuthorizerData = APIGatewayEventRequestContext['authorizer']

type IncomingMessageWithAuth = IncomingMessage & {
  auth?: AuthorizerData
}

type EventListener = (...args: unknown[]) => void

type WriteCallback = (error?: Error | null) => void

type WriteData = string | Buffer

type EndCallback = (error?: Error | null) => void

type EndData = string | Buffer

interface MockServerResponse extends Omit<ServerResponse, 'headersSent'> {
  statusCode: number
  headersSent: boolean
}

function createIncomingMessage(
  event: APIGatewayProxyEvent
): IncomingMessageWithAuth {
  let url = event.path
  if (event.queryStringParameters) {
    const params = Object.entries(event.queryStringParameters)
      .filter((entries) => entries.every(Boolean))
      .map((entries) => entries as [string, string])
      .reduce(
        (acc, [key, value]) => {
          acc[key] = value
          return acc
        },
        {} as Record<string, string>
      )

    const queryString = new URLSearchParams(params).toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  const normalizedHeaders: Record<string, string> = {}
  if (event.headers) {
    Object.entries(event.headers)
      .filter((entries) => entries.every(Boolean))
      .map((entries) => entries as [string, string])
      .forEach(([key, value]) => {
        normalizedHeaders[key.toLowerCase()] = value
      })
  }

  const req = {
    method: event.httpMethod,
    url,
    headers: normalizedHeaders,
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1
  } as IncomingMessageWithAuth

  if (event.requestContext.authorizer) {
    req.auth = event.requestContext.authorizer
  }

  return req
}

function createServerResponse(): {
  response: ServerResponse
  getResult: () => Promise<APIGatewayProxyResult>
} {
  const headers: Record<string, string> = {}
  const bodyChunks: string[] = []
  let finished = false
  let headersSent = false
  let resolveFinish: (() => void) | null = null
  const finishPromise = new Promise<void>((resolve) => {
    resolveFinish = resolve
  })

  const eventListeners: Record<string, EventListener[]> = {}

  const res = {
    statusCode: 200,
    get headersSent(): boolean {
      return headersSent
    },

    on: (event: string, listener: EventListener): MockServerResponse => {
      if (!eventListeners[event]) {
        eventListeners[event] = []
      }
      eventListeners[event].push(listener)
      return res as unknown as MockServerResponse
    },

    once: (event: string, listener: EventListener): MockServerResponse => {
      const onceWrapper: EventListener = (...args: unknown[]) => {
        listener(...args)
        res.removeListener(event, onceWrapper)
      }
      return res.on(event, onceWrapper)
    },

    removeListener: (
      event: string,
      listener: EventListener
    ): MockServerResponse => {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(
          (l) => l !== listener
        )
      }
      return res as unknown as MockServerResponse
    },

    emit: (event: string, ...args: unknown[]): boolean => {
      if (eventListeners[event]) {
        eventListeners[event].forEach((listener) => listener(...args))
        return true
      }
      return false
    },

    setHeader: (
      name: string,
      value: string | string[] | number
    ): MockServerResponse => {
      headers[name.toLowerCase()] = Array.isArray(value)
        ? value.join(', ')
        : String(value)
      return res as unknown as MockServerResponse
    },

    getHeader: (name: string): string | undefined => {
      return headers[name.toLowerCase()]
    },

    removeHeader: (name: string): MockServerResponse => {
      delete headers[name.toLowerCase()]
      return res as unknown as MockServerResponse
    },

    hasHeader: (name: string): boolean => {
      return name.toLowerCase() in headers
    },

    getHeaders: (): Record<string, string> => {
      return { ...headers }
    },

    writeHead: (
      code: number,
      headersArg?: Record<string, string>
    ): MockServerResponse => {
      res.statusCode = code
      if (headersArg) {
        Object.entries(headersArg).forEach(([key, value]) => {
          res.setHeader(key, value)
        })
      }
      headersSent = true
      return res as unknown as MockServerResponse
    },

    flushHeaders: (): MockServerResponse => {
      headersSent = true
      return res as unknown as MockServerResponse
    },

    write: (
      chunk: WriteData,
      encodingOrCallback?: BufferEncoding | WriteCallback,
      callback?: WriteCallback
    ): boolean => {
      if (chunk) {
        if (typeof chunk === 'string') {
          bodyChunks.push(chunk)
        } else if (Buffer.isBuffer(chunk)) {
          bodyChunks.push(chunk.toString())
        }
      }

      if (typeof encodingOrCallback === 'function') {
        encodingOrCallback()
      } else if (typeof callback === 'function') {
        callback()
      }
      return true
    },

    end: (
      chunkOrCallback?: EndData | EndCallback,
      encodingOrCallback?: BufferEncoding | EndCallback,
      callback?: EndCallback
    ): MockServerResponse => {
      let chunk: EndData | undefined
      let finalCallback: EndCallback | undefined

      if (typeof chunkOrCallback === 'function') {
        finalCallback = chunkOrCallback
      } else {
        chunk = chunkOrCallback

        if (typeof encodingOrCallback === 'function') {
          finalCallback = encodingOrCallback
        } else if (typeof callback === 'function') {
          finalCallback = callback
        }
      }

      if (chunk) {
        if (typeof chunk === 'string') {
          bodyChunks.push(chunk)
        } else if (Buffer.isBuffer(chunk)) {
          bodyChunks.push(chunk.toString())
        }
      }

      finished = true
      if (resolveFinish) {
        resolveFinish()
      }

      res.emit('finish')

      if (finalCallback) {
        finalCallback()
      }

      return res as unknown as MockServerResponse
    }
  } as unknown as ServerResponse

  const getResult = async (): Promise<APIGatewayProxyResult> => {
    if (!finished) {
      await finishPromise
    }

    return {
      statusCode: res.statusCode,
      headers,
      body: bodyChunks.join('')
    }
  }

  return {
    response: res,
    getResult
  }
}

async function adaptLambdaToHTTP(
  event: APIGatewayProxyEvent,
  handleRequest: (
    req: IncomingMessage,
    res: ServerResponse,
    parsedBody?: unknown
  ) => Promise<void>
): Promise<APIGatewayProxyResult> {
  const req = createIncomingMessage(event)
  const { response: res, getResult } = createServerResponse()

  let parsedBody: unknown
  if (event.body) {
    try {
      parsedBody = JSON.parse(event.body)
    } catch {
      parsedBody = event.body
    }
  }

  await handleRequest(req, res, parsedBody)
  return getResult()
}

const mcpMiddleware = ({
  server
}: MCPMiddlewareOptions): middy.MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Error,
  MCPContext
> => {
  let transport: StreamableHTTPServerTransport | null = null
  let isConnected = false

  const ensureTransportConnected = async () => {
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      })
    }

    if (!isConnected) {
      await server.connect(transport)
      isConnected = true
    }

    return transport
  }

  return {
    before: async (request) => {
      try {
        const connectedTransport = await ensureTransportConnected()
        request.context.mcpTransport = connectedTransport
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        throw createHttpError(
          500,
          `Failed to initialize MCP transport: ${message}`
        )
      }
    },
    after: async (request) => {
      if (!request.context.mcpTransport) {
        throw createHttpError(500, 'MCP Transport not initialized')
      }

      const result = await adaptLambdaToHTTP(
        request.event,
        (req, res, parsedBody) =>
          request.context.mcpTransport!.handleRequest(req, res, parsedBody)
      )

      request.response = {
        ...result,
        headers: {
          ...request.response?.headers,
          ...result.headers
        }
      }
    }
  }
}

export default mcpMiddleware
export type { MCPContext, MCPMiddlewareOptions }
