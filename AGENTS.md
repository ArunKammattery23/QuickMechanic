# QuickMechanic Agent Rules (Local-First Workflow)

## Context
This project strictly follows a **Local-First Testing Workflow**. We maintain a dual-mode database environment:
- **Local Mode**: Powered by a local Docker Compose PostgreSQL database.
- **Live Mode**: Powered by Google Cloud SQL (PostgreSQL).

## Rules for Future Deployments & Development

1. **Test Locally First**: NEVER deploy changes directly to Cloud Run or Firebase without first running and testing the codebase locally against the local Docker database.
2. **Dual-Mode Config**: Always respect the dual-mode environment configuration. When making database or API changes, ensure they are compatible with both local development (`.env.development`) and live production configurations.
3. **Use Deployment Scripts**: For all major deployments to the backend API, ALWAYS use the provided script at `scripts/deploy.bat`. This script ensures the correct commands (including Cloud Build optimization and secure Cloud SQL connections) are executed. Do NOT write one-off `gcloud run deploy` commands manually unless debugging.
4. **Preserve Scripts Locally**: Ensure any new infrastructure commands or major deployment tasks are saved as scripts locally so the repository remains fully portable across new machines.
