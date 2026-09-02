import { NextResponse } from "next/server";
import { chatWithBillingAgent } from "@/lib/ai/recovery-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
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

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Field 'messages' array is required." },
        { status: 400 }
      );
    }

    const result = await chatWithBillingAgent({
      workflowId: id,
      messages,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("AI Billing Agent chat failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to chat with AI Billing Agent.",
      },
      { status: 500 }
    );
  }
}
