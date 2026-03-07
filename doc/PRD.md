# Product Requirements Document (PRD)

## Product Name

AI Consulting Back-Office Platform

## Version

MVP v1

## Author

Product Owner

## Last Updated

March 2026

---

# 1. Overview

The AI Consulting Back-Office Platform is an internal SaaS tool designed to manage the workflow of an AI consulting business that helps entrepreneurs and companies who encounter technical difficulties in their AI projects.

The platform centralizes:

* client management
* consulting engagements
* diagnostic reports
* consulting deliverables
* invoicing
* financial tracking
* operational dashboards

The goal is to standardize consulting workflows, improve productivity, and ensure professional reporting and billing.

This platform will initially be used internally but should be designed with potential SaaS scalability in mind.

---

# 2. Objectives

## Business Objectives

1. Structure the consulting workflow.
2. Reduce time spent on administrative work.
3. Standardize diagnostic reports.
4. Improve traceability of consulting work.
5. Track revenue and activity.

## Product Objectives

1. Manage clients and engagements in one system.
2. Generate structured consulting reports.
3. Produce professional PDF reports.
4. Manage invoices and payment tracking.
5. Provide business performance dashboards.

---

# 3. Target Users

### Primary User

AI Consultant / Founder

Responsibilities:

* manage clients
* track engagements
* produce reports
* issue invoices
* monitor business performance

### Secondary Users (future)

Consultants working for the consulting firm.

---

# 4. Core Concepts

## Client

A company receiving consulting services.

A client may have multiple contacts and multiple engagements.

## Engagement

A consulting mission requested by a client.

Three engagement types exist:

* Diagnostic
* Support / Accompaniment
* Problem Resolution

Each engagement may produce multiple reports.

## Report

A structured consulting document describing:

* findings
* problems
* recommendations
* action plans

Reports are stored as structured data and can be regenerated into formatted documents (PDF).

## Invoice

A billing document linked to an engagement and issued to a client.

---

# 5. Functional Requirements

## 5.1 Client Management

The system must allow the user to:

Create a client

Store:

* company name
* website
* industry
* technical stack
* notes

Manage contacts associated with a client:

* name
* role
* email
* phone

### Key Actions

Create client
Edit client
List clients
View client details

---

## 5.2 Engagement Management

An engagement represents a consulting mission.

Each engagement must contain:

* client
* engagement type
* description
* priority
* status
* assigned consultant
* timeline

### Engagement Types

Diagnostic
Support / Accompaniment
Problem Resolution

### Engagement Status

Requested
Diagnosis
In Progress
Waiting for Client
Completed

### Key Actions

Create engagement
Update engagement status
Assign engagement
View engagement history

---

## 5.3 Report Management

Reports are generated during consulting work.

Each report is linked to:

* a client
* an engagement

Reports must support versioning.

Reports are stored as structured JSON data and rendered using markdown templates.

### Report Structure

Reports include:

Executive Summary
Architecture Overview
Problems
Recommendations
Action Plan

### Key Actions

Create report
Edit report data
Generate markdown report
Generate PDF report
View report versions

---

## 5.4 Report Generation

Reports must be generated using a templating system.

The process:

Structured JSON Data
→ Markdown Template
→ HTML Rendering
→ PDF Generation

PDF reports must include:

* professional layout
* company logo
* sections
* headers
* pagination

---

## 5.5 Billing and Invoices

The system must allow the creation of invoices linked to engagements.

Invoices must include:

* client
* engagement
* amount
* currency
* status
* issue date
* due date

### Invoice Status

Draft
Issued
Pending Payment
Paid
Overdue

### Key Actions

Create invoice
Send invoice
Mark invoice as paid
Send payment reminder

---

## 5.6 Dashboard

The dashboard provides a high-level overview of the consulting activity.

Metrics include:

Number of active clients
Number of open engagements
Number of diagnostics completed
Revenue (monthly)
Revenue (total)
Outstanding invoices

---

# 6. Non-Functional Requirements

## Performance

The system must support fast response times for CRUD operations.

Report generation should complete within a few seconds.

## Reliability

All data must be stored reliably with consistent backups.

## Scalability

The architecture must support microservices and horizontal scaling.

## Security

Authentication must be required for all endpoints.

Role-based access control may be implemented in future versions.

---

# 7. System Architecture

The platform uses a microservices architecture with containerized services.

Core components:

API Gateway
Client Service
Engagement Service
Report Service
Billing Service
Analytics Service

Services communicate through REST APIs.

Webhooks may be used for asynchronous notifications.

All services are containerized using Docker.

---

# 8. Technology Stack

Backend

Node.js
TypeScript

Validation

Zod

Database

MongoDB

Infrastructure

Docker
WSL2 development environment

Testing

Unit testing
Integration testing
API contract testing

---

# 9. Data Storage

Primary storage is MongoDB.

Main collections:

clients
contacts
engagements
reports
invoices

Each microservice owns its data model.

---

# 10. Testing Strategy

The platform must include automated testing.

### Unit Tests

Service logic
Data validation
Report generation logic

### Integration Tests

API endpoints
Database operations

### Contract Tests

API communication between services.

---

# 11. MVP Scope

The MVP includes:

Client management
Engagement tracking
Report creation
PDF report generation
Invoice management
Business dashboard

The MVP will be used internally by a single consultant.

---

# 12. Future Enhancements

Potential future capabilities:

Automatic repository analysis
AI architecture diagnostics
GitHub integration
AI evaluation pipelines
LLM-assisted report generation
Automated consulting templates
Multi-consultant collaboration
SaaS commercialization

---

# 13. Success Metrics

The platform is considered successful if it:

Reduces consulting administrative time by at least 50%.

Allows reports to be generated in under 10 minutes.

Provides clear visibility into revenue and consulting activity.

Standardizes consulting deliverables across engagements.

# 14. Observability and Monitoring

Given the microservices architecture of the platform, full observability must be implemented from the beginning of the project in order to ensure system reliability, maintainability, and operational visibility.

The system must provide centralized logging, metrics collection, and monitoring capabilities across all services.

## Objectives

The observability stack must allow the system operators to:

* monitor the health of all microservices
* detect errors and performance issues
* analyze system behavior over time
* debug failures quickly
* track API usage and system load
* monitor infrastructure and application metrics

Observability must be implemented in a standardized and consistent way across all services.

---

## Logging

All services must produce structured logs.

Logs must include at minimum:

* timestamp
* service name
* log level
* request identifier
* message
* relevant metadata

Logs must be centralized in a log aggregation system.

The system must support:

* log search
* filtering
* correlation between services
* debugging distributed requests

Logs must be exported to a centralized logging platform using an agent-based log collector.

---

## Metrics

Each service must expose operational metrics.

Metrics must include:

Application metrics:

* request rate
* request latency
* error rate
* service uptime

Business metrics:

* number of clients
* number of engagements
* reports generated
* invoices issued

Infrastructure metrics:

* CPU usage
* memory usage
* container health

Metrics must be collected and stored in a time-series monitoring system.

---

## Dashboards

Operational dashboards must be available to visualize system health.

Dashboards must include:

System health overview
API performance metrics
Error rates
Service latency
Infrastructure utilization

Dashboards must allow filtering by service and time period.

---

## Alerting (Future Phase)

Alerting capabilities should be planned for future versions of the system.

Alerts may include:

* service downtime
* high error rates
* excessive latency
* infrastructure resource exhaustion

Alerts may be delivered through external communication systems (email, messaging platforms, etc.).

---

## Observability Stack

The system must use the following observability stack:

Metrics Collection:
Prometheus

Visualization and Dashboards:
Grafana

Log Aggregation:
Loki

Telemetry Collection and Processing:
Grafana Alloy

This stack must be deployed as part of the containerized infrastructure.

---

## Instrumentation Requirements

All microservices must include instrumentation to export metrics and logs.

Instrumentation should include:

* HTTP request metrics
* service-level metrics
* custom application metrics

Metrics must be exposed through a standard endpoint (e.g., `/metrics`) for scraping by the monitoring system.

---

## Traceability (Future Enhancement)

Distributed tracing may be introduced in a future version of the system to trace requests across multiple microservices.

This would allow deeper performance analysis and root cause identification in distributed workflows.

---

## Local Development Observability

The observability stack must be available in the local development environment through Docker Compose.

Developers must be able to:

* inspect service logs
* visualize metrics
* debug system behavior locally

This ensures that observability is part of the development workflow and not only production infrastructure.
