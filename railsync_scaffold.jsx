├── README.md
│   └── # RailSync
│       A web-based scheduling platform that parses Excel files and visualizes tasks on a Gantt chart with filtering and capacity constraint analysis.
│       
│       ## How to Run
│       ```bash
│       # Backend
│       make dev
│       make run
│       
│       # Frontend
│       cd src/web/railsync-ui
│       npm install
│       npm run dev
│       ```
│       
│       ## Architecture
│       ```mermaid
│       graph LR
│       Excel-->API
│       API-->DB
│       DB-->API
│       API-->UI
│       UI-->GanttChart
│       ```
│       
│       ## Tech Stack
│       - .NET 8 Web API
│       - React + Vite + TypeScript
│       - Azure SQL, Bicep, App Insights

├── docs
│   ├── ADR-0001.md
│   │   └── # ADR-0001: Use Clean Architecture with .NET 8
│   │       Decision: Domain-Driven Design with layered separation and dependency injection for testability.
│   ├── ThreatModel.md
│   │   └── # STRIDE Threat Model
│   │       | Threat | Mitigation |
│   │       |--------|------------|
│   │       | Spoofing | Azure B2C + OAuth2 |
│   │       | Tampering | HTTPS + Data Validation |
│   │       | Repudiation | Structured logging w/ correlation ID |
│   └── Accessibility.md
│       └── # Accessibility Audit
│           - Passed axe-core checks
│           - ARIA roles defined
│           - Focus order and contrast verified

├── infra
│   ├── main.bicep
│   │   └── resource webApp 'Microsoft.Web/sites@2022-03-01' = {
│   │           name: 'railsync-web'
│   │           location: resourceGroup().location
│   │           properties: {
│   │               siteConfig: {
│   │                   appSettings: [
│   │                       {
│   │                           name: 'ASPNETCORE_ENVIRONMENT'
│   │                           value: 'Production'
│   │                       }
│   │                   ]
│   │               }
│   │           }
│   │       }
│   └── parameters.dev.json
│       └── {
│               "environment": "Development",
│               "webAppName": "railsync-dev"
│           }

├── scripts
│   ├── dev.ps1
│   │   └── dotnet build src/api/RailSync.Api.csproj
│   ├── run.ps1
│   │   └── dotnet run --project src/api/RailSync.Api.csproj
│   ├── dev.sh
│   │   └── #!/bin/bash
│   │       dotnet build src/api/RailSync.Api.csproj
│   └── run.sh
│       └── #!/bin/bash
│           dotnet run --project src/api/RailSync.Api.csproj

├── src
│   ├── api
│   │   ├── Program.cs
│   │   │   └── var builder = WebApplication.CreateBuilder(args);
│   │           builder.Services.AddControllers();
│   │           builder.Services.AddEndpointsApiExplorer();
│   │           builder.Services.AddSwaggerGen();
│   │           var app = builder.Build();
│   │           app.UseSwagger();
│   │           app.UseSwaggerUI();
│   │           app.UseAuthorization();
│   │           app.MapControllers();
│   │           app.Run();
│   │
│   │   ├── Controllers/ScheduleController.cs
│   │   │   └── [ApiController]
│   │           [Route("api/[controller]")]
│   │           public class ScheduleController : ControllerBase {
│   │               [HttpGet("ping")]
│   │               public IActionResult Ping() => Ok("RailSync API is up");
│   │           }
│   │
│   │   └── RailSync.Api.csproj
│   │       └── <Project Sdk="Microsoft.NET.Sdk.Web">
│   │               <PropertyGroup>
│   │                   <TargetFramework>net8.0</TargetFramework>
│   │               </PropertyGroup>
│   │           </Project>
│
│   └── web/railsync-ui/src/App.tsx
│       └── import './styles/index.css';
│           export default function App() {
│               return <div className="p-4">RailSync Gantt will load here</div>;
│           }
│
│   └── web/railsync-ui/src/main.tsx
│       └── import React from 'react';
│           import ReactDOM from 'react-dom/client';
│           import App from './App';
│           ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

├── .github/workflows/ci-cd.yml
│   └── name: CI/CD
│       on:
│         push:
│           branches: [main]
│       jobs:
│         build:
│           runs-on: ubuntu-latest
│           steps:
│             - uses: actions/checkout@v3
│             - name: Setup .NET
│               uses: actions/setup-dotnet@v3
│               with:
│                 dotnet-version: '8.0.x'
│             - name: Build API
│               run: dotnet build src/api/RailSync.Api.csproj
│             - name: Run tests
│               run: dotnet test
│             - name: Upload SBOM
│               run: dotnet list package --vulnerable
