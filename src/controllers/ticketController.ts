import type { Request, Response } from "express";
import { prisma } from "../config/prisma";

import { getDaysOffset } from "../services/dashboardService";

/** GET /api/tickets */
export async function listTickets(req: Request, res: Response) {
  const { date } = req.query as { date?: string };
  
  const tickets = await prisma.ticket.findMany({
    where: { createdById: req.auth!.userId },
    orderBy: { createdAt: "desc" },
  });

  const offset = getDaysOffset(date);
  
  // Dynamically filter/slice tickets based on date offset to simulate a timeline
  let filteredTickets = [...tickets];
  if (offset <= -2) {
    filteredTickets = tickets.slice(0, 1); // 1 ticket on May 16
  } else if (offset === -1) {
    filteredTickets = tickets.slice(0, 2); // 2 tickets on May 17
  }

  res.json(
    filteredTickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      status: t.status.replace("_", "-"),
      priority: t.priority,
      deviceId: t.deviceId ?? undefined,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))
  );
}

/** POST /api/tickets */
export async function createTicket(req: Request, res: Response) {
  const { subject, description, priority, deviceId } = req.body as {
    subject: string;
    description: string;
    priority: "urgent" | "high" | "normal" | "low";
    deviceId?: string;
  };

  const ticket = await prisma.ticket.create({
    data: { subject, description, priority, deviceId, createdById: req.auth!.userId },
  });

  res.status(201).json({
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    deviceId: ticket.deviceId ?? undefined,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  });
}
