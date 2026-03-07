You are a **senior software architect and product manager**.

Your task is to design the **architecture and product requirements** for a new internal SaaS back-office system used by an AI consulting service.

The output must be **clear, structured, and written in English**.
Use mermaid diagrams for clarity

---

# Context

The application is a **back-office platform** used by a consulting service that helps entrepreneurs who started AI projects but got stuck.

Typical client problems include:

* broken AI pipelines
* messy codebases
* poorly designed LLM integrations
* unmaintainable architectures
* lack of evaluation/testing
* prompt engineering problems
* data pipeline issues
* vendor lockin

The service offers 3 types of engagements:

1. **Diagnostic**

   * analyze the client architecture
   * identify technical problems
   * identify security issues
   * produce a diagnostic report

2. **Support / Accompaniment**

   * help the client implement improvements
   * guide the team
   * iterative consulting

3. **Problem Resolution**

   * directly fix the system
   * refactor code
   * rebuild components if necessary

Each engagement produces **structured reports** that must be **stored as data** in the database and **generated on demand**.

---

# Core Features (MVP)

The first version must include:

### Client Management

Store:

* client information
* client technical informations. Some can be sensible: code credentials
* company
* contact details
* technical stack
* notes

### Requests / Engagements

A client can create multiple requests.

Each request includes:

* engagement type (diagnostic / support / resolution)
* access type (black box: just a web url, code delivery, code credentials )
* description
* status
* creation date
* assigned consultant
* related reports

### Reports

Each step of the work produces a report.

Reports must:

* be stored as **structured data**
* allow **regeneration into formatted documents**
* track:

  * findings
  * recommendations
  * technical details
  * action items

### Billing

Basic billing system:

* invoices
* invoice status
* payment tracking
* reminders

### Dashboard

Track basic business metrics:

* number of active clients
* revenue
* open engagements
* completed diagnostics
* monthly activity

---

# Technical Constraints

The system must use the following stack:

Backend:

* Node.js
* TypeScript

Database:

* MongoDB

Validation:

* Zod

Environment:

* Docker

Architecture:

* **Microservices**
* **API-based communication**

The system must be **containerized**.  
The system shall be observable using loki, graphana, alloy, prometheus  
The system shall heavy rely on types: types shall be produce first in a dedicated folder and then use in each microservice (DRY)  

---

# Architecture Requirements

Propose a **clean microservice architecture** including:

* service boundaries
* API gateway
* internal communication
* data ownership

Example candidate services:

* client-service
* engagement-service
* report-service
* billing-service
* dashboard-service
* auth-service

But feel free to redesign if needed.

Each service should include:

* responsibilities
* database collections
* APIs
* interactions with other services

---

# Report System

Reports must:

* be stored as structured JSON
* allow versioning
* allow regeneration into formatted documents (markdown or PDF)
* support sections like:

  * executive summary
  * architecture analysis
  * problems
  * recommendations
  * action plan

---

# Testing Requirements

Testing must be first-class.

Include:

Unit testing:

* Jest or Vitest

Integration testing:

* service API tests

Contract testing between microservices.

Test coverage recommendations.

---

# Dev Infrastructure

Include recommendations for:

* repository structure (monorepo vs multi-repo)
* Docker architecture
* local development
* CI/CD
* environment configuration
* logging
* observability

---

# Deliverables

Provide the following sections:

1. **Product Requirements Document (PRD)**
2. **High-Level Architecture**
3. **Microservices Breakdown**
4. **MongoDB Data Model**
5. **API Design**
6. **Report Data Structure**
7. **Testing Strategy**
8. **DevOps / Docker Setup**
9. **Repository Structure**
10. **MVP Roadmap**

Be precise and practical.
The goal is to build a **production-grade internal platform**.
