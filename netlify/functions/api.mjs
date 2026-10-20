/* /api/* — one function, routed by netlify/lib/router.mjs. */

import { handle } from "../lib/router.mjs";

export default async (req, context) => handle(req, context);

export const config = { path: ["/api/*"] };
