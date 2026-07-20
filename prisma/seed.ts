import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MODELS = [
  "ThinkPad T14 Gen 3", "ThinkBook 15 G4", "ThinkPad X1 Carbon", "ThinkPad E14 Gen 2", "Legion 5 Pro",
  "MacBook Air M2", "Dell Latitude 5440", "HP EliteBook 840", "Dell XPS 13", "HP ProBook 450",
];
const CATEGORIES = ["laptop", "laptop", "laptop", "laptop", "desktop"] as const;
const ISSUES = [
  { code: "BATTERY_DEGRADATION", label: "Battery Degradation", type: "replace", action: "Replace in 14 days" },
  { code: "SSD_HEALTH_LOW", label: "SSD Health Low", type: "backup_replace", action: "Backup & Replace" },
  { code: "OVERHEATING", label: "Overheating Detected", type: "clean_check", action: "Clean & Check Fan" },
  { code: "RAM_ERRORS", label: "RAM Errors", type: "diagnostics", action: "Run Diagnostics" },
  { code: "FAN_NOISE", label: "Fan Noise High", type: "schedule_service", action: "Schedule Service" },
];
const LOCATIONS = ["Mumbai HQ", "Bengaluru Office", "Delhi Office", "Pune Office", "Chennai Office"];
const DEPARTMENTS = ["Engineering", "Sales", "Finance", "IT Operations", "Marketing"];
const OWNERS = ["Aditya Rao", "Priya Sharma", "Karan Mehta", "Sneha Iyer", "Vikram Singh"];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Seeding database…");

  const company = await prisma.company.upsert({
    where: { id: "seed-company-acme" },
    update: {},
    create: { id: "seed-company-acme", name: "Acme Global Corp." },
  });

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { email: "rohit.sharma@acmeglobal.com" },
    update: {},
    create: {
      name: "Rohit Sharma",
      email: "rohit.sharma@acmeglobal.com",
      passwordHash,
      role: "IT Administrator",
      companyId: company.id,
    },
  });

  // Clear existing devices for idempotent re-seeding
  await prisma.device.deleteMany({ where: { companyId: company.id } });

  const devices = [];
  for (let i = 1; i <= 38; i++) {
    const issue = rand(ISSUES);
    const health = randInt(35, 96);
    const riskLevel = health < 60 ? "high" : health < 80 ? "medium" : "low";
    const device = await prisma.device.create({
      data: {
        assetTag: `LAP-IT-${1000 + i}`,
        model: rand(MODELS),
        category: rand(CATEGORIES),
        status: "active",
        healthScore: health,
        riskLevel: riskLevel as never,
        aiConfidence: randInt(55, 98),
        issueCode: issue.code,
        issueLabel: issue.label,
        issueDetectedAt: new Date(Date.now() - randInt(1, 20) * 86400000),
        recommendedAction: issue.action,
        recommendedType: issue.type as never,
        recommendedEta: new Date(Date.now() + randInt(3, 45) * 86400000),
        ownerName: rand(OWNERS),
        ownerDepartment: rand(DEPARTMENTS),
        location: rand(LOCATIONS),
        purchaseDate: new Date("2022-01-10"),
        warrantyExpiresAt: new Date(Date.now() + randInt(-10, 120) * 86400000),
        companyId: company.id,
      },
    });
    devices.push(device);

    // Seed health history for the sparkline
    await prisma.deviceHealthPoint.createMany({
      data: Array.from({ length: 10 }, (_, d) => ({
        deviceId: device.id,
        recordedAt: new Date(Date.now() - (9 - d) * 86400000),
        value: Math.max(15, health + randInt(-10, 10)),
      })),
    });
  }

  // Alerts derived from the first few high-risk devices
  const highRisk = devices.filter((d) => d.riskLevel === "high").slice(0, 4);
  for (const device of highRisk) {
    await prisma.alert.create({
      data: {
        severity: "critical",
        title: `${device.issueLabel} on ${device.assetTag}`,
        description: `AI detected ${device.issueLabel.toLowerCase()} with ${device.aiConfidence}% confidence.`,
        deviceId: device.id,
      },
    });
  }

  // A few maintenance events referencing seeded devices
  const maintenanceDefs = [
    { title: "12 Batteries", description: "Replacement Scheduled", location: "Mumbai HQ", priority: "high" as const, daysFromNow: 2 },
    { title: "8 SSDs", description: "Maintenance Window", location: "Bengaluru Office", priority: "medium" as const, daysFromNow: 4 },
    { title: "18 Devices", description: "General Checkup", location: "Delhi Office", priority: "low" as const, daysFromNow: 7 },
  ];

  for (const def of maintenanceDefs) {
    const event = await prisma.maintenanceEvent.create({
      data: {
        title: def.title,
        description: def.description,
        location: def.location,
        priority: def.priority,
        date: new Date(Date.now() + def.daysFromNow * 86400000),
      },
    });
    const linked = devices.slice(0, 3);
    await prisma.deviceMaintenanceEvent.createMany({
      data: linked.map((d) => ({ deviceId: d.id, eventId: event.id })),
    });
  }

  // Clear existing tickets
  await prisma.ticket.deleteMany({});

  const user = await prisma.user.findFirst({
    where: { email: "rohit.sharma@acmeglobal.com" },
  });

  if (user) {
    const ticketsData = [
      {
        subject: "Overheating & Fan Noise on Laptop",
        description: "Device is running extremely hot under normal load and the fan is making grinding noises. Needs physical cleaning and potentially a thermal paste application.",
        status: "open" as const,
        priority: "high" as const,
        deviceId: devices[0]?.id || null,
        createdById: user.id,
      },
      {
        subject: "Battery degradation below threshold",
        description: "AI model flagged battery health at 37%. User reports battery lasts less than 45 minutes on a full charge. Ordering replacement battery pack.",
        status: "in_progress" as const,
        priority: "normal" as const,
        deviceId: devices[1]?.id || null,
        createdById: user.id,
      },
      {
        subject: "SSD Read/Write Speed Degraded",
        description: "Predictive diagnostics reported SMART alert on SSD. System boot times have tripled. Need to backup user data and clone onto a new NVMe drive.",
        status: "open" as const,
        priority: "urgent" as const,
        deviceId: devices[2]?.id || null,
        createdById: user.id,
      },
      {
        subject: "Warranty Claim Setup - Printer",
        description: "Fuser unit failing. Device is still under manufacturer warranty. Contacting HP support to schedule on-site technician service.",
        status: "resolved" as const,
        priority: "low" as const,
        deviceId: devices[3]?.id || null,
        createdById: user.id,
      },
    ];

    for (const t of ticketsData) {
      await prisma.ticket.create({ data: t });
    }
  }

  console.log(`Seeded 1 company, 1 user, ${devices.length} devices, and 4 tickets.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
