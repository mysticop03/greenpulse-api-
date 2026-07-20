import type { Request, Response } from "express";
import { computeDashboardSummary } from "../services/dashboardService";
import { prisma } from "../config/prisma";

import { getCompanyId } from "../utils/company";

/** GET /api/dashboard */
export async function getDashboardSummary(req: Request, res: Response) {
  const { date } = req.query as { date?: string };
  const companyId = await getCompanyId(req);
  const summary = await computeDashboardSummary(companyId, date);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  res.json({ ...summary, userName: user?.name.split(" ")[0] ?? "there" });
}
