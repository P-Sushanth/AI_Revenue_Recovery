import { NextResponse } from "next/server";
import { analyzeRawBankLog } from "@/lib/ai/recovery-agent";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rawMessage } = body;

    if (!rawMessage || typeof rawMessage !== "string" || !rawMessage.trim()) {
      return NextResponse.json(
        { success: false, error: "Field 'rawMessage' is required." },
        { status: 400 }
      );
    }

    const result = await analyzeRawBankLog(rawMessage);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Raw bank log analysis failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to analyze raw bank log using local Ollama model.",
      },
      { status: 500 }
    );
  }
}
