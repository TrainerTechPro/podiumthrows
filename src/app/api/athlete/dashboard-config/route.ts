import { NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { parseBody, AthleteDashboardConfigPatchSchema } from "@/lib/api-schemas";
import {
  WIDGET_IDS,
  PRESETS,
  type WidgetId,
  type PresetId,
} from "@/app/(dashboard)/athlete/dashboard/_widget-registry";

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(request, AthleteDashboardConfigPatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { preset, widgets, order } = parsed;

    // Preset path — widgets/order are ignored when preset is set.
    if (preset && preset in PRESETS && !widgets) {
      const presetConfig = PRESETS[preset as PresetId];
      await prisma.athleteProfile.update({
        where: { userId: session.userId },
        data: { dashboardConfig: presetConfig },
      });
      return NextResponse.json({ success: true, data: presetConfig });
    }

    if (!Array.isArray(widgets) || !Array.isArray(order)) {
      return NextResponse.json(
        { success: false, error: "widgets and order must be arrays" },
        { status: 400 }
      );
    }

    const validWidgets = widgets.filter((w): w is WidgetId => WIDGET_IDS.includes(w as WidgetId));
    const validOrder = order.filter((w): w is WidgetId => validWidgets.includes(w as WidgetId));

    // Readiness is always present and first — enforced in resolveConfig too.
    if (!validWidgets.includes("readiness")) validWidgets.unshift("readiness");
    if (!validOrder.includes("readiness")) validOrder.unshift("readiness");
    else if (validOrder[0] !== "readiness") {
      validOrder.splice(validOrder.indexOf("readiness"), 1);
      validOrder.unshift("readiness");
    }

    let resolvedPreset: string = "custom";
    for (const [name, p] of Object.entries(PRESETS)) {
      if (
        JSON.stringify(p.widgets) === JSON.stringify(validWidgets) &&
        JSON.stringify(p.order) === JSON.stringify(validOrder)
      ) {
        resolvedPreset = name;
        break;
      }
    }

    const config = {
      preset: resolvedPreset,
      widgets: validWidgets,
      order: validOrder,
    };
    await prisma.athleteProfile.update({
      where: { userId: session.userId },
      data: { dashboardConfig: config },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    logger.error("PATCH /api/athlete/dashboard-config", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update dashboard config" },
      { status: 500 }
    );
  }
}
