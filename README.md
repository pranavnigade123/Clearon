# Clearon - Multi-Source Enterprise RAG Platform

A modern, cloud-native Retrieval-Augmented Generation system that processes multiple document types (PDFs, websites, CSV files) and provides accurate, cited responses to user queries. Built with Next.js + TypeScript frontend and Python FastAPI microservices, showcasing enterprise-grade DevOps practices.

## 🚀 Features

- **Multi-Source Document Processing**: PDFs, websites, and CSV files
- **Intelligent Chunking**: Semantic-aware document segmentation
- **Vector Search**: Powered by Supabase pgvector for similarity matching
- **Precise Citations**: Source attribution with page numbers, URLs, and row identifiers
- **Real-time Updates**: Live processing status via Supabase real-time
- **Enterprise Authentication**: NextAuth.js with multiple providers
- **Cloud Storage**: Amazon S3 integration for scalable file storage

## 🏗️ Architecture

### Hybrid Microservices Architecture
- **Frontend & API Gateway**: Next.js 14 + TypeScript + NextAuth.js
- **Backend Microservices**: Python FastAPI for AI/ML operations
- **Database**: Supabase (PostgreSQL + pgvector + real-time)
- **Storage**: Amazon S3 for file storage
- **Infrastructure**: Multi-cloud (AWS + GCP) with Kubernetes

### DevOps Stack
- **Container Orchestration**: Kubernetes (EKS + GKE)
- **Infrastructure as Code**: Terraform
- **CI/CD**: GitLab CI + ArgoCD (GitOps)
- **Service Mesh**: Istio
- **Monitoring**: Prometheus + Grafana + ELK + Jaeger
- **Secrets Management**: HashiCorp Vault

## 🛠️ Tech Stack

### Frontend
- Next.js 14 with TypeScript
- Tailwind CSS for styling
- NextAuth.js for authentication
- React Query for data fetching

### Backend
- Python FastAPI microservices
- LlamaIndex for RAG framework
- Sentence Transformers for embeddings
- Pydantic for data validation

### Data & Storage
- Supabase (PostgreSQL + pgvector)
- Amazon S3 for file storage
- Redis for caching

### DevOps & Infrastructure
- Docker & Kubernetes
- Terraform (IaC)
- GitLab CI/CD + ArgoCD
- Multi-cloud: AWS + GCP
- Comprehensive observability stack

## 📋 Project Phases

### Phase 1: Core RAG Platform (Current)
- ✅ Project setup and documentation
- 🔄 Next.js frontend with document upload
- 🔄 Python microservices for document processing
- 🔄 Vector search and query processing
- 🔄 S3 storage integration

### Phase 2: Advanced RAG Features
- Sentence window retrieval
- Hybrid search capabilities
- Re-ranking and deduplication
- Asynchronous job processing

### Phase 3: Containerization & Kubernetes
- Production Docker containers
- Local Kubernetes deployment
- Helm charts and service mesh

### Phase 4: Multi-Cloud DevOps
- Multi-cloud infrastructure (AWS + GCP)
- Auto-scaling and managed services
- GitOps workflows

### Phase 5: Production Hardening
- Comprehensive observability
- Security hardening
- SRE practices and chaos engineering

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Python 3.9+ and pip
- Docker and Docker Compose
- Git

### Development Setup
```bash
# Clone the repository
git clone https://github.com/pranavnigade123/Clearon.git
cd clearon

# Install frontend dependencies
cd frontend
npm install

# Install Python dependencies
cd ../services
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development environment
docker-compose up -d
```

## 📚 Documentation

- [Design Document](docs/design.md) - System architecture and component design
- [Requirements](docs/requirements.md) - Detailed functional requirements
- [API Documentation](docs/api.md) - REST API endpoints and schemas
- [Deployment Guide](docs/deployment.md) - Production deployment instructions
- [Contributing Guide](CONTRIBUTING.md) - Development workflow and guidelines

## 🔒 Security

This project implements enterprise-grade security practices:
- Multi-factor authentication
- Role-based access control
- Data encryption at rest and in transit
- Container security scanning
- Network policies and service mesh security

## 📊 Monitoring & Observability

- **Metrics**: Prometheus for metrics collection
- **Dashboards**: Grafana for visualization
- **Logging**: ELK Stack for centralized logging
- **Tracing**: Jaeger for distributed tracing
- **Alerting**: PagerDuty integration for incident response

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Development workflow
- Code standards and testing
- Pull request process
- Issue reporting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- 📧 Email: [your-email@domain.com]
- 💬 Discussions: [GitHub Discussions](https://github.com/pranavnigade123/Clearon/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/pranavnigade123/Clearon/issues)

## 🎯 Project Goals

This project demonstrates:
- **Full-Stack Development**: Modern web application with AI/ML integration
- **DevOps Excellence**: Enterprise-grade infrastructure and deployment practices
- **Cloud Architecture**: Multi-cloud deployment with Kubernetes orchestration
- **Observability**: Comprehensive monitoring and logging strategies
- **Security**: Production-ready security implementations

---

**Built with ❤️ for the developer community**