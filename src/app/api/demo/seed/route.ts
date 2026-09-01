import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/demo/demo-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (process.env.DISABLE_DEMO_ROUTES === "true") {
    return NextResponse.json({
      success: false,
      message: "Forbidden: Demo endpoints are explicitly disabled.",
    }, { status: 403 });
  }

  try {
    const ids = await seedDemoData(true);
    return NextResponse.json({
      success: true,
      message: "Database cleanup complete and demo customer profiles seeded successfully.",
      data: ids,
    });
  } catch (error: any) {
    console.error("Database seeding failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SEEDING_FAILED",
          message: error.message || "An unexpected error occurred during database seeding.",
        },
      },
      { status: 500 }
    );
  }
}

// Allow GET request for easier manual browser seeding during development
export async function GET() {
  return POST();
}
