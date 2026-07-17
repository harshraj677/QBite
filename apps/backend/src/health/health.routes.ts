import { Router } from 'express';

import { sendSuccess } from '@response/api-response';
import { env } from '@config/env';

/**
 * Liveness/readiness endpoint for load balancers and orchestrators
 * (objective 13). This — and the Swagger UI mount in config/swagger.ts
 * — are the *only* intentional exceptions to "no routes/controllers"
 * in this phase: both are operational infrastructure, not product
 * features, so a single trivial handler here (no controller/service/
 * repository layering) is the correct amount of structure, not a
 * shortcut to copy for a real feature module later.
 *
 * Deliberately mounted unversioned at `/health`, not under `/api/v1` —
 * infra health checks should have a stable path independent of API
 * versioning, matching common load-balancer/Kubernetes-probe
 * convention.
 */
export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness/readiness check
 *     description: Returns basic process health. Used by load balancers and orchestrators, not by clients.
 *     responses:
 *       200:
 *         description: Service is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     environment:
 *                       type: string
 *                     uptimeSeconds:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
healthRouter.get('/', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
