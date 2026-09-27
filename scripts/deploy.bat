@echo off
echo Starting Backend Deployment to Google Cloud Run...

cd backend

echo [1/3] Building NestJS application...
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

echo [2/3] Submitting optimized container build to Google Cloud Build...
call "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" builds submit --config cloudbuild.yaml --region=us-central1 --project=project-8d23d91b-6c41-4eea-8cf
if %errorlevel% neq 0 exit /b %errorlevel%

echo [3/3] Deploying to Cloud Run with Secure Cloud SQL Auth Proxy...
call "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy quickmechanic-api ^
  --image us-central1-docker.pkg.dev/project-8d23d91b-6c41-4eea-8cf/quickmechanic-repo/quickmechanic-api:latest ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --add-cloudsql-instances "project-8d23d91b-6c41-4eea-8cf:us-central1:quickmechanic-db" ^
  --set-env-vars="DB_HOST=/cloudsql/project-8d23d91b-6c41-4eea-8cf:us-central1:quickmechanic-db,DB_USER=postgres,DB_NAME=postgres,NODE_ENV=production" ^
  --set-secrets="DB_PASSWORD=quickmechanic-db-password:latest" ^
  --quiet
if %errorlevel% neq 0 exit /b %errorlevel%

echo Deployment Successful!
cd ..
