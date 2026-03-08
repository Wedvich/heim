import { Router } from "express";
import { pool } from "../db.ts";
import { lightAuthMiddleware } from "../middleware/light-auth.ts";
import { validateSlug } from "../auth/slug.ts";

export function createTenantsRouter(): Router {
  const router = Router();

  router.use(lightAuthMiddleware(pool));

  router.get("/slug-available", async (req, res) => {
    const slug = req.query.slug;
    if (typeof slug !== "string" || !slug) {
      res.status(400).json({ error: "missing_slug" });
      return;
    }

    const validation = validateSlug(slug);
    if (!validation.valid) {
      res.json({ available: false, valid: false, reason: validation.reason });
      return;
    }

    const result = await pool.query(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
    const available = result.rows.length === 0;
    res.json({ available, valid: true });
  });

  return router;
}
