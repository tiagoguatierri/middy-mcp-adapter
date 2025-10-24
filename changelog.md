# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-10-24

### Added

- Setup eslint + prettier for typescript
- Setup vitest
- Setup tsup
- Create vscode settings

## [0.0.2] - 2025-10-24

- Add README
- Configure files to export

## [0.0.3] - 2025-10-24

### Changed

- Moved `@middy/core`, `@modelcontextprotocol/sdk` and `http-errors` to peerDependencies to prevent type conflicts
- Improved TypeScript strict typing (removed all `any` types)

### Added

- Configured proper entry points (main, module, types, exports)
- Added `sideEffects: false` for better tree-shaking
- Added `prepublishOnly` script
