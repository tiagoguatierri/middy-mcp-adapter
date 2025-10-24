# middy-mcp-adapter

[![npm version](https://img.shields.io/npm/v/middy-mcp-adapter.svg)](https://www.npmjs.com/package/middy-mcp-adapter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Middy middleware for Model Context Protocol (MCP) server integration with AWS Lambda functions.

## Description

middy-mcp-adapter is a middleware that enables seamless integration between AWS Lambda functions and Model Context Protocol servers. It provides a convenient way to handle MCP requests and responses within your Lambda functions using the Middy middleware framework. It supports requests sent to AWS Lambda from API Gateway (both REST API / v1 and HTTP API / v2) using the Proxy integration, as well as requests sent from an ALB.

## Install

```bash
npm install middy-mcp-adapter
```

## Requirements

- Node.js >= 18.0.0
- Middy >= 6.0.0

## Usage

This middleware can throw HTTP exceptions, so it can be convenient to use it in combination with `@middy/http-error-handler`.

### Basic Example

Hereafter is an example of a minimal Lambda function handler file. Deploy this Lambda as a proxy integration on a POST route of your API Gateway and you're good to go.

```typescript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import mcpMiddleware from 'middy-mcp-adapter'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'

// Create an MCP server
const server = new Server({
  name: 'Lambda hosted MCP Server',
  version: '1.0.0'
})

export const handler = middy()
  .use(mcpMiddleware({ server }))
  .use(httpErrorHandler())
```

### With Tools

```typescript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import mcpMiddleware from 'middy-mcp-adapter'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

const server = new Server({
  name: 'Lambda hosted MCP Server',
  version: '1.0.0'
})

server.registerTool(
  'add',
  {
    title: 'Addition Tool',
    description: 'Add two numbers',
    inputSchema: { a: z.number(), b: z.number() },
    outputSchema: { result: z.number() }
  },
  async ({ a, b }) => {
    const output = { result: a + b }
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    }
  }
)

server.registerTool(
  'multiply',
  {
    title: 'Multiplication Tool',
    description: 'Multiply two numbers',
    inputSchema: { a: z.number(), b: z.number() },
    outputSchema: { result: z.number() }
  },
  async ({ a, b }) => {
    const output = { result: a * b }
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    }
  }
)

export const handler = middy()
  .use(mcpMiddleware({ server }))
  .use(httpErrorHandler())
```

## API

### `mcpMiddleware(options)`

Creates a Middy middleware that adapts an MCP server to AWS Lambda.

#### Options

- `server` (required): `McpServer` - Your MCP server instance

#### Returns

A Middy middleware object with `before` and `after` hooks.

## How It Works

The middleware performs the following operations:

1. **Before Hook**: Initializes the MCP StreamableHTTPServerTransport connection
2. **Request Adaptation**: Converts API Gateway events to HTTP IncomingMessage format
3. **Response Handling**: Converts HTTP ServerResponse back to API Gateway format
4. **After Hook**: Processes the MCP server response and formats it for Lambda

## Error Handling

The middleware throws HTTP errors that can be caught by `@middy/http-error-handler`:

- **500**: Transport initialization failures or missing MCP transport
- Standard HTTP error codes from `http-errors`

## TypeScript

This package includes TypeScript definitions.

```typescript
import mcpMiddleware, {
  type MCPMiddlewareOptions,
  type MCPContext
} from 'middy-mcp-adapter'
```

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENCE) file for details.

## Contributing

Contributions are welcome! Please feel free to open an issue or to submit a pull request.

## Links

- [GitHub Repository](https://github.com/tiagoguatierri/middy-mcp-adapter)
- [npm Package](https://www.npmjs.com/package/middy-mcp-adapter)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Middy](https://middy.js.org/)

## Related Projects

- [@middy/core](https://www.npmjs.com/package/@middy/core) - The Middy middleware engine
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - MCP SDK
- [AWS Lambda](https://aws.amazon.com/lambda/) - AWS Lambda Documentation

## Author

Tiago Guatierri - [GitHub](https://github.com/tiagoguatierri)
