# Contributing to AI Prompt Refiner

Thank you for your interest in contributing to AI Prompt Refiner! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- VS Code 1.80.0 or higher
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/prompt-refiner.git
   cd prompt-refiner
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Open in VS Code:
   ```bash
   code .
   ```

5. Run the extension:
   - Press `F5` to open a new Extension Development Host window

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/changes

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build process, dependencies, etc.

Examples:
```
feat(providers): add Azure OpenAI provider

fix(cache): resolve LRU eviction bug

docs(readme): update installation instructions
```

## Submitting Changes

1. **Create a branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:
   ```bash
   npm test
   npm run lint
   ```

4. **Commit** with a descriptive message:
   ```bash
   git add .
   git commit -m "feat(feature): description"
   ```

5. **Push** to your fork:
   ```bash
   git push origin feature/my-feature
   ```

6. **Create a Pull Request** against the `develop` branch

### Pull Request Guidelines

- Fill out the PR template completely
- Reference any related issues
- Ensure all CI checks pass
- Request review from maintainers
- Be responsive to feedback

## Coding Standards

### TypeScript Style Guide

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use async/await over callbacks
- Avoid `any` type when possible
- Use interfaces over type aliases for objects

### Code Organization

```
src/
├── commands/        # VS Code commands
├── providers/       # AI provider implementations
├── services/        # Core business logic
├── utils/          # Utility functions
├── views/          # Webview providers
└── i18n/           # Internationalization
```

### Naming Conventions

- **Files**: `PascalCase.ts` for classes, `camelCase.ts` for utilities
- **Classes**: `PascalCase`
- **Interfaces**: `PascalCase` (prefix with `I` optional)
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private members**: `_camelCase` or `#camelCase`

### Documentation

- Add JSDoc comments to all public APIs
- Include parameter types and descriptions
- Document return values
- Add examples where helpful

Example:
```typescript
/**
 * Refines a user prompt using the active AI provider.
 * 
 * @param userPrompt - The raw prompt text to refine
 * @param token - Optional cancellation token
 * @param options - Refinement options including template selection
 * @returns Promise resolving to the refinement result
 * @throws Error if service not initialized or provider fails
 * 
 * @example
 * const result = await service.refine('make a button', token, {
 *   templateId: 'coding'
 * });
 */
public async refine(
  userPrompt: string,
  token?: CancellationToken,
  options?: RefinementOptions
): Promise<RefinementResult>
```

## Testing

### Test Structure

- Co-locate tests with source files (`*.test.ts`)
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Mock external dependencies

### Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest run src/services/PromptRefinerService.test.ts
```

### Test Coverage

- Aim for >80% coverage on new code
- Critical paths should have >90% coverage
- Update tests when modifying code

## Documentation

### Code Documentation

- Document all public APIs with JSDoc
- Include usage examples
- Document error cases
- Keep comments up to date

### README Updates

Update README.md when:
- Adding new features
- Changing installation steps
- Modifying configuration options
- Adding new providers

### Changelog

Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Change description

### Fixed
- Bug fix description
```

## Provider Development

### Creating a New Provider

1. Implement `IAIProvider` interface
2. Add provider ID to configuration
3. Update settings UI
4. Add documentation
5. Include tests

Example structure:
```typescript
export class MyProvider implements IAIProvider {
  readonly id = 'myprovider';
  readonly name = 'My Provider';

  isConfigured(): boolean {
    // Check if API key exists
  }

  async refine(
    userPrompt: string,
    systemTemplate: string,
    options?: { strict?: boolean }
  ): Promise<string> {
    // Implementation
  }
}
```

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a release branch
4. Run full test suite
5. Create PR to `main`
6. After merge, create GitHub release
7. CI/CD will publish automatically

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Join our community chat (if available)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
