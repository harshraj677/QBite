import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

import { env } from './env';

/**
 * OpenAPI/Swagger foundation (objectives 23-24).
 *
 * `swagger-jsdoc` scans the glob patterns in `apis` for `@openapi`
 * JSDoc comment blocks and assembles them into the spec — so a future
 * module documents itself by adding a comment above its route
 * definition (see `health/health.routes.ts` for the one example that
 * exists today, proving the pipeline works end-to-end) rather than
 * maintaining a hand-written spec file that drifts from the code.
 *
 * `paths` starts empty beyond that one example, correctly — there are
 * no feature routes yet.
 */
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QBite API',
      version: '1.0.0',
      description:
        'QBite backend API. See docs/API_SPECIFICATION.md for the full contract this spec documents.',
    },
    servers: [{ url: `http://localhost:${env.port}`, description: env.nodeEnv }],
  },
  apis: [
    'src/health/*.routes.ts',
    'src/modules/**/*.routes.ts',
    'dist/health/*.routes.js',
    'dist/modules/**/*.routes.js',
  ],
});

export function mountApiDocs(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
