You are a senior backend architect specializing in Node.js and TypeScript.

I am building a **Node.js microservice architecture** where each service uses **Express** and **Zod** for request validation. I want to integrate **OpenAPI (Swagger)** documentation in a way that keeps **Zod as the single source of truth** for API schemas.

Your task is to design and implement a **production-grade OpenAPI integration** using **zod-to-openapi** and **swagger-ui-express**, following modern backend architecture principles.

The solution must ensure:

1. **Zod is the single source of truth**

   * All request and response schemas must be defined with Zod.
   * OpenAPI schemas must be generated automatically from Zod.

2. **No duplication of schema definitions**

   * Do NOT manually define OpenAPI schemas.
   * Everything must derive from Zod.

3. **Automatic OpenAPI route registration**

   * Each route should register itself in an OpenAPI registry.
   * Routes should remain easy to maintain.

4. **Microservice compatibility**

   * Each service must expose:

     * `/swagger/` → Swagger UI
     * `/openapi.json` → OpenAPI specification
   * The architecture should allow future aggregation of multiple service specs by an API gateway.


Implementation details:

* Extend Zod with OpenAPI metadata using `extendZodWithOpenApi`.
* Use `OpenAPIRegistry` to register schemas and endpoints.
* Generate the specification with `OpenApiGeneratorV3`.
* Serve documentation using `swagger-ui-express`.
* Allow Zod schemas to define:

  * descriptions
  * examples
  * parameter metadata
* Ensure the generated OpenAPI specification is compliant with **OpenAPI 3.0**.

Create at least one complete example endpoint:

With:

* request body validation via Zod
* response schema via Zod
* OpenAPI documentation generated automatically

Also include:

* middleware for validating requests using Zod
* example controller implementation
* automatic route registration
* OpenAPI schema generation logic
* Swagger UI setup
* npm dependencies list
* instructions to run the service

Code requirements:

* TypeScript
* modular
* production-ready
* easy to extend for new services and routes
* compatible with Docker-based deployments

Finally, explain briefly how this architecture allows **multiple microservices to expose their OpenAPI specs and later be aggregated by an API gateway or API catalog**.
