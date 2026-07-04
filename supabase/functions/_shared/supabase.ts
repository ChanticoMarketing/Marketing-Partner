// Supabase client for Edge Functions — service role + user extraction
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos");
}

// Service role client — bypass RLS for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Extract user from Authorization header (JWT)
export async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function createHttpError(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function getErrorStatus(error: unknown, fallback = 500) {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isFinite(status)) return status;
  }
  return fallback;
}

export async function isAdminUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("is_primary, role")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.is_primary === true || data.role === "admin";
}

export async function hasProjectAccess(projectId: number, userId: string) {
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, name, client, created_by")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw createHttpError("Proyecto no encontrado", 404);
  }

  if (project.created_by === userId) {
    return project;
  }

  const [admin, member, assignment] = await Promise.all([
    isAdminUser(userId),
    supabaseAdmin
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (admin || member.data || assignment.data) {
    return project;
  }

  throw createHttpError("No tienes acceso a este proyecto", 403);
}

export async function canApproveProjectKnowledge(projectId: number, userId: string) {
  const project = await hasProjectAccess(projectId, userId);
  if (project.created_by === userId) return true;
  return await isAdminUser(userId);
}

export async function assertProjectKnowledgeApproval(projectId: number, userId: string) {
  const allowed = await canApproveProjectKnowledge(projectId, userId);
  if (!allowed) {
    throw createHttpError("No tienes permiso para aprobar o eliminar conocimiento", 403);
  }
}

// CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
