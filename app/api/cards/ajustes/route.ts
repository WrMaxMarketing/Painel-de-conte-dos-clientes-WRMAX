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
// (opcional) quantas imagens e/ou videos quiser, cada um com uma descricao
// ("onde e e o que fazer"). Cada pedido vira COMENTARIO(s) no card do Notion,
// notifica a equipe por WhatsApp, incrementa o Nº de Ajustes e devolve o card
// para "Conteúdo aprovado". So permitido nessa etapa e para o cliente dono do card.
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
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Os anexos precisam ser imagens ou vídeos." },
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
    // Sobe os anexos (na ordem) e guarda id + descricao + tipo de cada um.
    const anexos: { id: string; descricao: string; kind: "image" | "video" }[] =
      [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = await uploadParaNotion(await f.arrayBuffer(), f.name, f.type);
      anexos.push({
        id,
        descricao: descricoes[i] ?? "",
        kind: f.type.startsWith("video/") ? "video" : "image",
      });
    }

    // Rotulo de cada anexo, numerado por tipo (Imagem 1, Imagem 2, Vídeo 1…).
    let nImg = 0;
    let nVid = 0;
    const rotulos = anexos.map((a) => {
      const sufixo = a.descricao ? `: ${a.descricao}` : "";
      return a.kind === "video"
        ? `🎬 Vídeo ${++nVid}${sufixo}`
        : `📷 Imagem ${++nImg}${sufixo}`;
    });

    // Monta os comentarios. Como o Notion aceita ate 3 anexos por comentario,
    // agrupamos em blocos de 3. O texto geral vai no primeiro comentario.
    // Sem anexos, um unico comentario de texto.
    if (anexos.length === 0) {
      await criarComentarioAjuste(pageId, `${AJUSTE_SENTINEL}\n${texto}`, []);
    } else {
      for (
        let start = 0;
        start < anexos.length;
        start += MAX_ANEXOS_POR_COMENTARIO
      ) {
        const bloco = anexos.slice(start, start + MAX_ANEXOS_POR_COMENTARIO);
        const linhas = [AJUSTE_SENTINEL];
        if (start === 0) linhas.push(texto);
        rotulos
          .slice(start, start + MAX_ANEXOS_POR_COMENTARIO)
          .forEach((r) => linhas.push(r));
        await criarComentarioAjuste(
          pageId,
          linhas.join("\n"),
          bloco.map((a) => a.id)
        );
      }
    }

    // Resumo dos anexos para o aviso (ex.: "2 imagens e 1 vídeo").
    const partesResumo: string[] = [];
    if (nImg) partesResumo.push(`${nImg} ${nImg === 1 ? "imagem" : "imagens"}`);
    if (nVid) partesResumo.push(`${nVid} ${nVid === 1 ? "vídeo" : "vídeos"}`);
    const resumoAnexos = partesResumo.join(" e ");

    // Notifica a equipe (os anexos nao vao pelo WhatsApp; apenas o aviso).
    const corpo = [
      "🔔 *Solicitação de alteração*",
      `Cliente: ${cliente || "(sem cliente)"}`,
      `Conteúdo: ${card.titulo}`,
      "",
      texto,
      anexos.length ? `📎 ${resumoAnexos} em anexo (ver no painel/Notion).` : "",
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
