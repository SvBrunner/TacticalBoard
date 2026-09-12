# 2. Architecture Constraints

## Technical Constraints

- **Containerized deployment.** The app must be deployable as OCI/Docker containers, so it can run on any container runtime.
- **Self-hostable.** No dependency on proprietary managed cloud/SaaS services (auth, database, storage, ...) that would prevent someone from running the entire stack themselves.
- **Self-hostable database.** The database must be something that can be self-hosted (e.g. Postgres, SQLite) rather than a managed-cloud-only service.
- **Reverse proxy assumed.** Deployment assumes a reverse proxy in front of the app that handles TLS termination and routing; the app itself does not manage certificates.
- **Browser support.** Current evergreen browsers only (latest ~2 versions of Chrome, Firefox, Safari, Edge). No support for legacy browsers. Supports the usability quality goal from chapter 1.
- **Development environment.** The Nix flake (`flake.nix`) must provide everything a developer needs to work on the project — no required tool installs outside the flake.

## Organizational Constraints

- **Solo project, free time.** Developed by a single person (Sven) with no fixed budget or deadline. This favors simplicity and maintainability over solving problems at a scale (many teams, high concurrency) that doesn't yet exist.
- **License.** MIT, open source.
