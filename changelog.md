# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-11-14

### Docs

- Fix examples on readme

## [0.1.0] - 2025-10-24

### Added

- Comprehensive unit test suite with 28 tests (77% coverage)
- End-to-end integration tests using real MCP Server
- Test coverage for error cases and edge scenarios
- Test coverage for middleware compatibility
- Exported `MCPContext` and `MCPMiddlewareOptions` types

### Changed

- Simplified middleware implementation for better maintainability
- Optimized query parameter and header filtering
- Improved response header merging to preserve headers from other middlewares

### Removed

- Unused `removeHeader` method from ServerResponse mock
- Unnecessary callback parameters from `write` and `end` methods
- Reduced bundle size by ~650 bytes

### Fixed

- Response headers now properly merge with other middlewares
- Null/undefined values in headers and query parameters are correctly filtered

## [0.0.3] - 2025-10-24

### Changed

- Moved `@middy/core`, `@modelcontextprotocol/sdk` and `http-errors` to peerDependencies to prevent type conflicts
- Improved TypeScript strict typing (removed all `any` types)

### Added

- Configured proper entry points (main, module, types, exports)
- Added `sideEffects: false` for better tree-shaking
- Added `prepublishOnly` script

## [0.0.4] - 2025-10-24

### Changed

- Downgraded `@middy/core` peer dependency to `>=4.0.0` for broader compatibility

## [0.0.2] - 2025-10-24

- Add README
- Configure files to export

## [0.0.1] - 2025-10-24

### Added

- Setup eslint + prettier for typescript
- Setup vitest
- Setup tsup
- Create vscode settings
