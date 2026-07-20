import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { signToken } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";
import { toUserDto } from "../services/userService";

/** POST /api/login */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };

  const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
  if (!user) throw new HttpError(401, "Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new HttpError(401, "Invalid email or password");

  const token = signToken({ userId: user.id, companyId: user.companyId, email: user.email });
  res.json({ token, user: toUserDto(user) });
}

/** POST /api/register */
export async function register(req: Request, res: Response) {
  const { name, email, password, companyName } = req.body as {
    name: string;
    email: string;
    password: string;
    companyName?: string;
  };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(400, "Email is already registered");

  // Get or create company (default to Acme Global Corp if not provided)
  const targetCompany = companyName ? companyName.trim() : "Acme Global Corp.";
  let company = await prisma.company.findFirst({ where: { name: targetCompany } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: targetCompany },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      companyId: company.id,
      role: "IT Administrator",
    },
    include: { company: true },
  });

  const token = signToken({ userId: user.id, companyId: user.companyId, email: user.email });
  res.status(201).json({ token, user: toUserDto(user) });
}

/** POST /api/logout — JWTs are stateless, so this is a client-side no-op the API acknowledges. */
export async function logout(_req: Request, res: Response) {
  res.status(204).send();
}

/** GET /api/user */
export async function getCurrentUser(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { company: true },
  });
  if (!user) throw new HttpError(404, "User not found");
  res.json(toUserDto(user));
}
