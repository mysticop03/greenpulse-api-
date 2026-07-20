import type { Request } from "express";
import { prisma } from "../config/prisma";

/**
 * Resolves the company ID based on the X-Company-Name header passed by the frontend.
 * Falls back to the logged-in user's companyId.
 */
export async function getCompanyId(req: Request): Promise<string> {
  const headerCompany = req.headers["x-company-name"] as string;
  if (headerCompany) {
    const company = await prisma.company.findFirst({
      where: { name: headerCompany.trim() },
    });
    if (company) return company.id;
  }
  return req.auth!.companyId;
}
