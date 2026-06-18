import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCardWrite, setArquivos, uploadParaNotion } from "@/lib/notion";
import { STATUS_EDITAVEL } from "@/lib/board";

// Upload de midia para a propriedade "Files & media" de um card.
// So permitido na etapa editavel e para o cliente dono do card.
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (upload de parte unica do Notion)

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const cliente = (user.app_metadata?.cliente as string | undefined) ?? "";

  const form = await req.formData();
  const pageId = String(form.get("pageId") ?? "");
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!pageId || !files.length) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `"${f.name}" excede o limite de 20 MB.` },
        { status: 413 }
      );
    }
  }

  // Checagem de dono + etapa (estado fresco do Notion).
  const card = await getCardWrite(pageId);
  if (card.cliente !== cliente) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (card.status !== STATUS_EDITAVEL) {
    return NextResponse.json(
      { error: "Esta etapa não permite edição de mídia." },
      { status: 403 }
    );
  }

  try {
    const novos = [];
    for (const f of files) {
      const id = await uploadParaNotion(await f.arrayBuffer(), f.name, f.type);
      novos.push({ type: "file_upload", file_upload: { id }, name: f.name });
    }
    // Preserva os existentes (reenviados como vem do GET) + anexa os novos.
    await setArquivos(pageId, [...card.files, ...novos]);
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no upload.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
