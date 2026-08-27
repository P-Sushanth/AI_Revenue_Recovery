import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/demo/demo-data";

export async function POST() {
  try {
    const ids = await seedDemoData();
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
