import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { HttpError } from "../middleware/errorHandler";
import { toDeviceDto } from "../services/deviceMapper";

const SORT_COLUMN: Record<string, string> = {
  model: "model",
  health: "healthScore",
  riskLevel: "riskLevel",
  aiConfidence: "aiConfidence",
};

import { getDaysOffset, adjustDevice } from "../services/dashboardService";

/** GET /api/devices */
export async function listDevices(req: Request, res: Response) {
  const { page = 1, pageSize = 10, search, riskLevel = "all", category = "all", sortBy = "health", sortDir = "asc", date } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
    riskLevel: string;
    category: string;
    sortBy: string;
    sortDir: "asc" | "desc";
    date?: string;
  };

  const rawRows = await prisma.device.findMany({
    where: { companyId: req.auth!.companyId },
  });

  const offset = getDaysOffset(date);
  let rows = rawRows.map((d) => adjustDevice(d, offset));

  // In-memory search filtering
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (d) =>
        d.model.toLowerCase().includes(q) ||
        d.assetTag.toLowerCase().includes(q) ||
        d.issueLabel.toLowerCase().includes(q)
    );
  }

  // In-memory riskLevel filtering
  if (riskLevel !== "all") {
    rows = rows.filter((d) => d.riskLevel === riskLevel);
  }

  // In-memory category filtering
  if (category !== "all") {
    rows = rows.filter((d) => d.category === category);
  }

  // In-memory sorting
  const dir = sortDir === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    const key = SORT_COLUMN[sortBy] ?? "healthScore";
    const av = (a as unknown as Record<string, unknown>)[key];
    const bv = (b as unknown as Record<string, unknown>)[key];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + Number(pageSize));

  res.json({ data: paged.map(toDeviceDto), total, page: Number(page), pageSize: Number(pageSize) });
}

/** GET /api/devices/:id */
export async function getDeviceById(req: Request, res: Response) {
  const device = await prisma.device.findFirst({
    where: { id: req.params.id, companyId: req.auth!.companyId },
    include: { healthHistory: { orderBy: { recordedAt: "asc" }, take: 20 } },
  });
  if (!device) throw new HttpError(404, "Device not found");
  res.json(toDeviceDto(device));
}
