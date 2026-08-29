import { NextResponse } from "next/server";
import { checkOllamaHealth } from "@/lib/ai/recovery-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await checkOllamaHealth();
    return NextResponse.json({
      success: true,
      health,
    });
  } catch (error: any) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred during health check.",
      },
      { status: 500 }
    );
  }
}
