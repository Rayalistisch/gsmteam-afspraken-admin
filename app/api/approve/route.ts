import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safe(v: any) {
  return String(v ?? "").replace(/[<>]/g, "");
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Maak de admin client pas aan tijdens runtime (binnen request)
function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL || // fallback als je die al had staan
    "";

  if (!url) throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL fallback)");

  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("repair_requests")
      .update({ status: "approved" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Approve update error:", error);
      return NextResponse.json({ error: safe(error.message) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err: any) {
    console.error("Approve route error:", err);
    return NextResponse.json(
      { error: "Server error", detail: safe(err?.message || err) },
      { status: 500 }
    );
  }
}
