import { NextResponse } from "next/server";
import { generateRecoveryEmailCopy } from "@/lib/ai/recovery-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Workflow ID parameter is required." },
        { status: 400 }
      );
    }

    const emailCopy = await generateRecoveryEmailCopy(id);

    return NextResponse.json({
      success: true,
      data: emailCopy,
    });
  } catch (error: any) {
    console.error("Failed to generate AI recovery email copy:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate AI recovery email copy.",
      },
      { status: 500 }
    );
  }
}
