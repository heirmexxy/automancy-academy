"use server";
import { requireAdmin } from "@/lib/auth";
import { hasAzureSpeech, hasSupabase } from "@/lib/config";
import { itemById } from "@/lib/course";
import { lessonAudio } from "@/lib/tts";

export type GenResult = { id: string; ok: boolean; cached?: boolean; chars?: number; error?: string };

/** Admin → Lesson audio → "Generate all": one lesson per call so the browser can show progress. */
export async function generateLessonAudio(id: string): Promise<GenResult> {
  await requireAdmin();
  if (!itemById(id)) return { id, ok: false, error: "Unknown lesson" };
  if (!hasAzureSpeech() || !hasSupabase()) return { id, ok: false, error: "Azure Speech is not configured (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)" };
  try {
    const r = await lessonAudio(id);
    return { id, ok: true, cached: r.cached, chars: r.chars };
  } catch (e) {
    return { id, ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
