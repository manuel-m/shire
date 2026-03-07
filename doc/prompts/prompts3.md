You are a senior Node.js and TypeScript platform engineer.

I have a **Node.js microservices backend organized as a PNPM workspace monorepo**.
The repository contains multiple services (e.g. `auth-service`, `customer-service`) and shared packages.

I want to implement a **modern code quality and security stack** across the entire monorepo to ensure:

* consistent code style
* detection of duplicated code
* static code analysis
* security scanning
* dependency validation
* automated checks in CI
* pre-commit validation

Your task is to design and configure a **complete code quality pipeline** for this repository.

### Tools to integrate

Implement the following tools:

Code quality and linting:

* ESLint
* @typescript-eslint
* eslint-plugin-sonarjs

Code formatting:

* Prettier

Duplicate code detection:

* jscpd

Security static analysis:

* Semgrep

Dependency validation:

* depcheck

Git hooks:

* Husky
* lint-staged

Type checking:

* TypeScript (`tsc --noEmit`)

### Project assumptions

* The repository is a **PNPM workspace**
* The codebase is written in **TypeScript**
* Services use **Express**
* Zod is used for validation
* The repo structure is similar to:

```
/services
  /auth-service
  /client-service

/packages
  /shared

pnpm-workspace.yaml
```

### Implementation requirements

1. Configure **ESLint** for TypeScript with SonarJS rules to detect:

   * code smells
   * excessive complexity
   * duplicate strings
   * bad practices

2. Configure **Prettier** to enforce consistent formatting across the repository.

3. Configure **jscpd** to detect duplicated code across all services and packages.

4. Configure **Semgrep** with standard security rules for Node.js.

5. Configure **depcheck** to detect unused dependencies.

6. Configure **Husky** with Git hooks:

   * pre-commit → run lint-staged
   * pre-push → run lint + typecheck

7. Configure **lint-staged** to run ESLint and Prettier only on staged files.

8. Add scripts in the root `package.json` such as:

* lint
* format
* duplicates
* security
* typecheck
* validate (runs everything)

9. Provide configuration files such as:

* `.eslintrc`
* `.prettierrc`
* `.jscpd.json`
* `semgrep.yml`
* `.lintstagedrc`

10. Ensure all tools work correctly with **PNPM workspaces** and scan the entire repository.

11. Provide an example **CI pipeline** (GitHub Actions or similar) that runs:

* install dependencies
* type checking
* linting
* duplication detection
* security scan
* tests

12. Explain briefly how each tool contributes to improving the quality of the codebase.

### Constraints

* The setup must work with PNPM
* It must support monorepo structures
* It should scale to many microservices
* Avoid redundant configurations per service (prefer root-level configuration)

The final output should include:

* the commands to install dependencies
* all configuration files
* the updated `package.json` scripts
* example Git hooks
* CI pipeline example
* explanations of key design decisions.
