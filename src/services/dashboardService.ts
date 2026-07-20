import { prisma } from "../config/prisma";
import type { Device } from "@prisma/client";

const SAVINGS_PER_HEALTH_POINT_INR = 350; // rough heuristic: lower health -> higher potential savings if acted on now
const REPAIR_COST_PER_CRITICAL_DEVICE_INR = 31000; // heuristic average repair ticket cost

export function getDaysOffset(dateStr?: string): number {
  if (!dateStr) return 0;
  const baseDate = new Date("2025-05-18");
  const currentDate = new Date(dateStr);
  if (isNaN(currentDate.getTime())) return 0;
  const diffTime = currentDate.getTime() - baseDate.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function adjustDevice(device: Device, daysOffset: number): Device {
  if (daysOffset === 0) return device;
  const healthDelta = Math.round(daysOffset * -2); // degrade health by 2 points per day
  let newHealth = device.healthScore + healthDelta;
  if (newHealth < 10) newHealth = 10;
  if (newHealth > 100) newHealth = 100;
  const newRiskLevel = newHealth < 60 ? "high" : newHealth < 80 ? "medium" : "low";
  return {
    ...device,
    healthScore: newHealth,
    riskLevel: newRiskLevel as any,
  };
}

/**
 * Computes the /dashboard payload live from current Device rows, dynamically shifted
 * based on the chosen snapshot date.
 */
export async function computeDashboardSummary(companyId: string, dateStr?: string) {
  const rawDevices = await prisma.device.findMany({ where: { companyId } });
  const offset = getDaysOffset(dateStr);
  
  // Adjust device health and risk levels dynamically based on selected date
  const devices = rawDevices.map((d) => adjustDevice(d, offset));

  const totalDevices = devices.length || 1;
  const avgHealth = Math.round(devices.reduce((sum, d) => sum + d.healthScore, 0) / totalDevices);
  const criticalDevices = devices.filter((d) => d.riskLevel === "high");
  const criticalCount = criticalDevices.length;
  const percentCritical = Number(((criticalCount / totalDevices) * 100).toFixed(2));

  const repairCostLakhs = Number(
    ((criticalCount * REPAIR_COST_PER_CRITICAL_DEVICE_INR) / 100000).toFixed(1)
  );

  const estimatedSavingsInr = devices
    .filter((d) => d.riskLevel !== "low")
    .reduce((sum, d) => sum + (100 - d.healthScore) * SAVINGS_PER_HEALTH_POINT_INR, 0);

  const batteryIssues = devices.filter((d) => d.issueCode === "BATTERY_DEGRADATION").length;
  const ssdIssues = devices.filter((d) => d.issueCode === "SSD_HEALTH_LOW").length;
  const expiringWarranties = devices.filter(
    (d) => d.warrantyExpiresAt && d.warrantyExpiresAt.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
  ).length;

  const flatTrend = (value: number) =>
    Array.from({ length: 8 }, (_, i) => ({
      date: new Date(Date.now() - (7 - i) * 86400000).toISOString().slice(0, 10),
      value,
    }));

  return {
    userName: "there",
    dateLabel: dateStr || new Date().toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" }),
    actionPlan: {
      devicesAnalyzed: totalDevices,
      summaryText: `AI analyzed ${totalDevices.toLocaleString(
        "en-IN"
      )} devices overnight. Taking action on the recommended items can save ₹${(
        estimatedSavingsInr / 100000
      ).toFixed(1)} Lakhs and prevent e-waste.`,
      estimatedSavingsInr,
      ewastePreventedKg: Math.round(criticalCount * 0.7),
      quickWins: [
        { icon: "battery", label: `${batteryIssues} batteries need replacement` },
        { icon: "check", label: `${ssdIssues} SSDs showing early failure signs` },
        { icon: "warranty", label: `${expiringWarranties} warranties expiring this month` },
      ],
    },
    fleetHealth: { score: avgHealth, deltaVsLastWeek: 3, trend: flatTrend(avgHealth) },
    criticalDevices: { count: criticalCount, percentOfFleet: percentCritical, trend: flatTrend(criticalCount) },
    repairCost: { amountInrLakhs: repairCostLakhs, horizonLabel: "Next 30 days", trend: flatTrend(repairCostLakhs) },
    sustainability: {
      ewastePreventedKg: Math.round(criticalCount * 4.7),
      co2AvoidedKg: Math.round(criticalCount * 8.4),
    },
  };
}
