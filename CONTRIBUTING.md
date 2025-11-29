# Contributing to WebSDR Atlas

Thank you for your interest in contributing to WebSDR Atlas! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Git

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/earth-sdr.git
   cd earth-sdr
   ```

2. **Install dependencies**

   ```bash
   npm install -g pnpm
   pnpm install
   ```

3. **Setup the database**

   ```bash
   cd apps/backend
   cp .env.example .env
   npx prisma migrate dev
   cd ../..
   ```

4. **Start the development servers**

   ```bash
   pnpm dev
   ```

   This will start:
   - Backend at http://localhost:3001
   - Frontend at http://localhost:5173

## Project Structure

```
/websdr-atlas
  /apps
    /frontend   # React + Vite + TailwindCSS
    /backend    # NestJS + Prisma
  /packages
    /shared     # Shared TypeScript types and utilities
```

## Development Guidelines

### Code Style

- We use **Prettier** for code formatting
- Run `pnpm format` to format your code
- Run `pnpm format:check` to verify formatting

### TypeScript

- Use strict TypeScript settings
- Define types in `/packages/shared` for shared types
- Avoid `any` types when possible

### Component Guidelines

- Keep components small and focused
- Use functional components with hooks
- Place shared types in the `@websdr-atlas/shared` package

### State Management

- Use Zustand for global state
- Keep state minimal and derived where possible
- Programs are stored in localStorage via Zustand persist

## Making Changes

### Branching Strategy

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit with clear messages:

   ```bash
   git commit -m "feat: add waterfall zoom controls"
   ```

3. Push your branch and create a Pull Request

### Commit Message Format

We follow conventional commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Pull Request Process

1. Ensure your code builds without errors: `pnpm build`
2. Update documentation if needed
3. Describe your changes in the PR description
4. Link any related issues

## Areas for Contribution

### High Priority

- [ ] Real WebSDR integration (streaming proxy)
- [ ] Audio streaming implementation
- [ ] Station status monitoring (online/offline detection)

### Medium Priority

- [ ] VOACAP integration for propagation
- [ ] User authentication
- [ ] Cloud sync for saved programs

### Good First Issues

- Documentation improvements
- UI/UX enhancements
- Adding more seed stations
- Unit tests

## Testing

Currently, the project has minimal test infrastructure. We welcome contributions to improve test coverage:

- Unit tests for utilities in `/packages/shared`
- Component tests for React components
- Integration tests for API endpoints

## Questions?

If you have questions or need help:

1. Check existing issues and discussions
2. Create a new issue with the `question` label
3. Reach out to maintainers

## License

By contributing to WebSDR Atlas, you agree that your contributions will be licensed under the MIT License.
