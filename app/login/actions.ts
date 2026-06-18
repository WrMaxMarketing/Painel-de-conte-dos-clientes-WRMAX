"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

// Sessao do cliente expira 20min apos o login (limite absoluto, independente de atividade).
const SESSION_MAX_AGE_SECONDS = 20 * 60;
const SESSION_START_COOKIE = "client_session_start";

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe email e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou senha inválidos." };
  }

  // Marca o inicio da sessao para o middleware impor o limite de 6h.
  const cookieStore = await cookies();
  cookieStore.set(SESSION_START_COOKIE, Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_START_COOKIE);
  redirect("/login");
}
