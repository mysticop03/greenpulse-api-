import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding tickets...");

  // Find the seeded user
  const user = await prisma.user.findFirst({
    where: { email: "rohit.sharma@acmeglobal.com" },
  });

  if (!user) {
    throw new Error("Seed user not found. Run the main seed script first.");
  }

  // Get a few devices to link to tickets
  const devices = await prisma.device.findMany({
    where: { companyId: user.companyId },
    take: 4,
  });

  // Define 4 mock tickets
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

  // Clear existing tickets first
  await prisma.ticket.deleteMany({});

  for (const t of ticketsData) {
    const ticket = await prisma.ticket.create({
      data: t,
    });
    console.log(`Created ticket: "${ticket.subject}" (Priority: ${ticket.priority})`);
  }

  console.log("Seeding tickets completed!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
