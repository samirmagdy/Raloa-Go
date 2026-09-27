# Web application boundary

This is the future Next.js public web application boundary. The current Vite/React application remains the default runtime at the repository root. New public rendering work should compose `@raloa/api`, `@raloa/blocks`, `@raloa/design-system`, and `@raloa/ui` rather than importing legacy server modules or provider SDKs.

No Next.js runtime has been promoted yet; this package is intentionally a migration boundary.

