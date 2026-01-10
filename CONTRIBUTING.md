# Contributing to Multi-Source Enterprise RAG Platform

Thank you for your interest in contributing to the Multi-Source Enterprise RAG Platform! This document provides guidelines and information for contributors.

## 🎯 Project Overview

This project showcases enterprise-grade DevOps practices while building a functional RAG (Retrieval-Augmented Generation) platform. We welcome contributions that improve the system's functionality, performance, security, or documentation.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Python 3.9+ and pip
- Docker and Docker Compose
- Git
- Basic understanding of TypeScript, Python, and containerization

### Development Environment Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/[your-username]/multi-source-rag-platform.git
   cd multi-source-rag-platform
   ```

2. **Set up Git Configuration**
   ```bash
   git config user.name "Your Name"
   git config user.email "your.email@example.com"
   ```

3. **Install Dependencies**
   ```bash
   # Frontend dependencies
   cd frontend
   npm install
   
   # Python dependencies
   cd ../services
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

4. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your development configuration
   ```

5. **Start Development Environment**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

## 🌿 Branch Strategy

We follow a GitFlow-inspired branching model:

- **`main`**: Production-ready code only
- **`develop`**: Integration branch for features
- **`feature/*`**: Individual feature development
- **`hotfix/*`**: Critical production fixes
- **`release/*`**: Release preparation branches

### Creating a Feature Branch
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

## 📝 Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring without changing functionality
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependency updates
- `perf:` - Performance improvements
- `ci:` - CI/CD pipeline changes

### Examples
```bash
feat(auth): add Google OAuth integration
fix(query): resolve vector search timeout issue
docs(api): update endpoint documentation
test(processing): add PDF processing unit tests
```

## 🧪 Testing Guidelines

### Frontend Testing
```bash
cd frontend
npm run test          # Run unit tests
npm run test:e2e      # Run end-to-end tests
npm run test:coverage # Generate coverage report
```

### Backend Testing
```bash
cd services
pytest                    # Run all tests
pytest --cov=src         # Run with coverage
pytest -m "not slow"     # Skip slow tests
```

### Property-Based Testing
We use Hypothesis for property-based testing. When adding new features:
1. Identify correctness properties
2. Implement property tests alongside unit tests
3. Ensure minimum 100 iterations per property test

## 🎨 Code Style and Quality

### Frontend (TypeScript/React)
- **ESLint**: Enforced via pre-commit hooks
- **Prettier**: Automatic code formatting
- **TypeScript**: Strict mode enabled
- **Component Structure**: Follow React best practices

```bash
npm run lint          # Check linting
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format code with Prettier
```

### Backend (Python)
- **Black**: Code formatting
- **isort**: Import sorting
- **mypy**: Type checking
- **flake8**: Linting

```bash
black src/            # Format code
isort src/            # Sort imports
mypy src/             # Type checking
flake8 src/           # Linting
```

### Pre-commit Hooks
We use pre-commit hooks to ensure code quality:
```bash
pip install pre-commit
pre-commit install
```

## 🏗️ Architecture Guidelines

### Frontend Architecture
- Use TypeScript for all new code
- Follow React functional components with hooks
- Implement proper error boundaries
- Use React Query for data fetching
- Follow atomic design principles for components

### Backend Architecture
- Use FastAPI for all microservices
- Implement async/await patterns
- Follow dependency injection principles
- Use Pydantic for data validation
- Implement proper error handling and logging

### Database Guidelines
- Use migrations for schema changes
- Follow proper indexing strategies
- Implement proper data validation
- Use transactions for data consistency

## 📋 Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clean, well-documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   # Run all tests
   npm run test && cd ../services && pytest
   
   # Check code quality
   npm run lint && black src/ && mypy src/
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Create pull request on GitHub
   - Fill out the PR template completely
   - Link related issues

6. **PR Review Process**
   - Automated checks must pass
   - At least one code review required
   - Address all feedback
   - Maintain clean commit history

## 🐛 Issue Reporting

### Bug Reports
When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, versions)
- Screenshots or logs if applicable

### Feature Requests
For feature requests, please provide:
- Clear description of the feature
- Use case and business value
- Proposed implementation approach
- Any relevant mockups or examples

## 📚 Documentation

### Code Documentation
- Use JSDoc for TypeScript functions
- Use docstrings for Python functions
- Document complex algorithms and business logic
- Keep README files updated

### API Documentation
- Use OpenAPI/Swagger for REST APIs
- Document all endpoints, parameters, and responses
- Provide example requests and responses
- Keep documentation in sync with code

## 🔒 Security Guidelines

### Security Best Practices
- Never commit secrets or credentials
- Use environment variables for configuration
- Implement proper input validation
- Follow OWASP security guidelines
- Use security scanning tools

### Reporting Security Issues
Please report security vulnerabilities privately to [security@domain.com] rather than creating public issues.

## 🌟 Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation
- Community showcases

## 📞 Getting Help

- **GitHub Discussions**: For general questions and discussions
- **GitHub Issues**: For bug reports and feature requests
- **Discord/Slack**: [Link to community chat]
- **Email**: [maintainer-email@domain.com]

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the Multi-Source Enterprise RAG Platform! 🚀