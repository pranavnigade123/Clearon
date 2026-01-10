# Project Structure

This document outlines the monorepo structure for Clearon - the Multi-Source Enterprise RAG Platform.

## Repository Structure

```
clearon/
├── .github/                    # GitHub configuration
│   ├── workflows/             # GitHub Actions CI/CD
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                      # Project documentation
│   ├── api.md                # API documentation
│   ├── deployment.md         # Deployment guides
│   └── architecture.md       # System architecture
├── app/                       # Next.js frontend + API gateway
│   ├── src/
│   │   ├── app/              # Next.js 14 app directory
│   │   ├── components/       # React components
│   │   ├── lib/              # Utility functions
│   │   └── types/            # TypeScript type definitions
│   ├── public/               # Static assets
│   ├── package.json
│   ├── next.config.js
│   └── Dockerfile
├── services/                  # Python microservices
│   ├── document-processing/   # Document ingestion service
│   │   ├── src/
│   │   │   ├── api/          # FastAPI routes
│   │   │   ├── core/         # Business logic
│   │   │   ├── models/       # Data models
│   │   │   └── utils/        # Utility functions
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── query-processing/      # Query processing service
│   │   ├── src/
│   │   │   ├── api/          # FastAPI routes
│   │   │   ├── core/         # Query engine
│   │   │   ├── models/       # Data models
│   │   │   └── utils/        # Utility functions
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── shared/               # Shared Python utilities
│       ├── database/         # Database connections
│       ├── models/           # Shared data models
│       └── utils/            # Common utilities
├── infrastructure/            # Infrastructure as Code
│   ├── terraform/            # Terraform configurations
│   │   ├── aws/              # AWS resources
│   │   ├── gcp/              # GCP resources
│   │   └── modules/          # Reusable modules
│   ├── kubernetes/           # Kubernetes manifests
│   │   ├── base/             # Base configurations
│   │   ├── overlays/         # Environment-specific
│   │   └── helm/             # Helm charts
│   └── docker/               # Docker configurations
│       └── docker-compose.yml
├── monitoring/               # Observability configurations
│   ├── prometheus/           # Prometheus configs
│   ├── grafana/              # Grafana dashboards
│   └── jaeger/               # Jaeger tracing
├── scripts/                  # Automation scripts
│   ├── setup.sh              # Development setup
│   ├── deploy.sh             # Deployment scripts
│   └── test.sh               # Testing scripts
├── .env.example              # Environment variables template
├── .gitignore
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── docker-compose.yml        # Local development
```

## Component Overview

### Main Application (`/app`)
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **State Management**: React Query + Zustand
- **Testing**: Jest + React Testing Library

### Document Processing Service (`/services/document-processing`)
- **Framework**: FastAPI with async/await
- **Document Processing**: PyPDF2, BeautifulSoup, pandas
- **Embeddings**: Sentence Transformers
- **Storage**: Amazon S3 integration
- **Testing**: pytest + Hypothesis

### Query Processing Service (`/services/query-processing`)
- **Framework**: FastAPI with async/await
- **Vector Search**: Supabase pgvector
- **Response Generation**: LlamaIndex
- **Real-time**: Supabase real-time subscriptions
- **Testing**: pytest + Hypothesis

### Infrastructure (`/infrastructure`)
- **IaC**: Terraform for multi-cloud deployment
- **Orchestration**: Kubernetes (EKS + GKE)
- **Service Mesh**: Istio configurations
- **Monitoring**: Prometheus, Grafana, Jaeger

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature development
- `hotfix/*` - Critical fixes
- `release/*` - Release preparation

### Environment Setup
1. Clone repository
2. Run setup script: `./scripts/setup.sh`
3. Copy environment variables: `cp .env.example .env`
4. Start development: `docker-compose up -d`

### Testing Strategy
- **Unit Tests**: Individual component testing
- **Integration Tests**: Service-to-service testing
- **Property Tests**: Correctness validation
- **E2E Tests**: Full workflow testing

## Deployment Environments

### Development
- Local Docker Compose
- Hot reloading enabled
- Debug logging
- Test databases

### Staging
- Kubernetes cluster
- Production-like configuration
- Integration testing
- Performance monitoring

### Production
- Multi-cloud deployment
- Auto-scaling enabled
- Comprehensive monitoring
- Security hardening

## Security Considerations

- Environment variables for secrets
- Container security scanning
- Network policies
- RBAC implementation
- Secrets management with Vault