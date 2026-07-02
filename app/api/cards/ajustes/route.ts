import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCardWrite,
  uploadParaNotion,
  criarComentarioAjuste,
  registrarSolicitacaoAlteracao,
  AJUSTE_SENTINEL,
} from "@/lib/notion";
import { modoDoStatus } from "@/lib/board";
import { enviarWhatsApp } from "@/lib/whatsapp";

// Solicitacao de alteracao na etapa "Concluido Designer/Arte": texto livre +
// (opcional) quantas imagens quiser, cada uma com uma descricao ("onde e e o que
// fazer"). Cada pedido vira COMENTARIO(s) no card do Notion, notifica a equipe
// por WhatsApp, incrementa o Nº de Ajustes e devolve o card para "Conteúdo
// aprovado". So permitido nessa etapa e para o cliente dono do card.
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (upload de parte unica do Notion)
const MAX_ANEXOS_POR_COMENTARIO = 3; // limite da API de comentarios do Notion

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
  const texto = String(form.get("texto") ?? "").trim();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  // Descricao alinhada por indice com cada arquivo (pode vir vazia).
  const descricoes = form.getAll("imagemDescricao").map((d) => String(d).trim());

  if (!pageId || !texto) {
    return NextResponse.json(
      { error: "Descreva a alteração desejada." },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Os anexos precisam ser imagens." },
        { status: 400 }
      );
    }
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
  if (modoDoStatus(card.status) !== "aprovar-arte") {
    return NextResponse.json(
      { error: "Esta etapa não permite solicitar alteração." },
      { status: 403 }
    );
  }

  try {
    // Sobe as imagens (na ordem) e guarda id + descricao de cada uma.
    const imagens: { id: string; descricao: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = await uploadParaNotion(await f.arrayBuffer(), f.name, f.type);
      imagens.push({ id, descricao: descricoes[i] ?? "" });
    }

    // Monta os comentarios. Como o Notion aceita ate 3 anexos por comentario,
    // agrupamos as imagens em blocos de 3 (numeradas globalmente). O texto geral
    // vai no primeiro comentario. Sem imagens, um unico comentario de texto.
    if (imagens.length === 0) {
      await criarComentarioAjuste(pageId, `${AJUSTE_SENTINEL}\n${texto}`, []);
    } else {
      for (
        let start = 0;
        start < imagens.length;
        start += MAX_ANEXOS_POR_COMENTARIO
      ) {
        const bloco = imagens.slice(start, start + MAX_ANEXOS_POR_COMENTARIO);
        const linhas = [AJUSTE_SENTINEL];
        if (start === 0) linhas.push(texto);
        bloco.forEach((img, i) => {
          const n = start + i + 1;
          linhas.push(`📷 Imagem ${n}${img.descricao ? `: ${img.descricao}` : ""}`);
        });
        await criarComentarioAjuste(
          pageId,
          linhas.join("\n"),
          bloco.map((img) => img.id)
        );
      }
    }

    // Notifica a equipe (as imagens nao vao pelo WhatsApp; apenas o aviso).
    const corpo = [
      "🔔 *Solicitação de alteração*",
      `Cliente: ${cliente || "(sem cliente)"}`,
      `Conteúdo: ${card.titulo}`,
      "",
      texto,
      imagens.length
        ? `📎 ${imagens.length} ${
            imagens.length === 1 ? "imagem anexada" : "imagens anexadas"
          } (ver no painel/Notion).`
        : "",
      card.url ? `🔗 ${card.url}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await enviarWhatsApp(corpo);

    // Registra (Nº de Ajustes +1 + data) e devolve o card 1 etapa.
    await registrarSolicitacaoAlteracao(
      pageId,
      card.ajustes,
      new Date().toISOString()
    );

    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não foi possível enviar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
