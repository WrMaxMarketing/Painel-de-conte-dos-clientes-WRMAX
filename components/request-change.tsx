"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Film, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Campo de "solicitar alteração" exibido na etapa "Edição/arte finalizada".
// Ao enviar: cria um comentário no card do Notion (texto + imagens/vídeos com
// descrição), notifica a equipe por WhatsApp, registra a alteração (Nº de
// Ajustes +1) e devolve o card para "Conteúdo aprovado".
type AnexoItem = {
  id: number;
  file: File;
  preview: string;
  kind: "image" | "video";
  descricao: string;
};

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (limite do upload do Notion)
// Aceita imagens e vídeos, um ou vários de uma vez (misturados).
const ACCEPT = "image/*,video/*";

export function RequestChange({
  pageId,
  ajustes,
  onDone,
}: {
  pageId: string;
  ajustes: number;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<AnexoItem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);

  function onPickArquivos(e: ChangeEvent<HTMLInputElement>) {
    const lista = e.target.files;
    // Permite escolher os mesmos arquivos de novo depois.
    if (inputRef.current) inputRef.current.value = "";
    if (!lista?.length) return;

    const novos: AnexoItem[] = [];
    let rejeitadosTipo = 0;
    let rejeitadosTamanho = 0;
    for (const f of Array.from(lista)) {
      const ehImagem = f.type.startsWith("image/");
      const ehVideo = f.type.startsWith("video/");
      if (!ehImagem && !ehVideo) {
        rejeitadosTipo++;
        continue;
      }
      if (f.size > MAX_BYTES) {
        rejeitadosTamanho++;
        continue;
      }
      novos.push({
        id: idRef.current++,
        file: f,
        preview: URL.createObjectURL(f),
        kind: ehVideo ? "video" : "image",
        descricao: "",
      });
    }

    if (rejeitadosTipo)
      toast.error("Alguns arquivos foram ignorados: envie apenas imagens ou vídeos.");
    if (rejeitadosTamanho)
      toast.error("Alguns arquivos foram ignorados: cada um deve ter até 20 MB.");
    if (novos.length) setAnexos((prev) => [...prev, ...novos]);
  }

  function setDescricao(id: number, descricao: string) {
    setAnexos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, descricao } : a))
    );
  }

  function removerAnexo(id: number) {
    setAnexos((prev) => {
      const alvo = prev.find((a) => a.id === id);
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return prev.filter((a) => a.id !== id);
    });
  }

  function limpar() {
    setTexto("");
    setAnexos((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function enviar() {
    const msg = texto.trim();
    if (!msg) {
      toast.error("Descreva a alteração desejada.");
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("pageId", pageId);
      fd.append("texto", msg);
      // Cada anexo vai com a sua descrição, na mesma ordem (pares alinhados).
      for (const a of anexos) {
        fd.append("file", a.file);
        fd.append("imagemDescricao", a.descricao.trim());
      }

      const res = await fetch("/api/cards/ajustes", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível enviar.");

      toast.success("Solicitação enviada à equipe.");
      limpar();
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível enviar."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div>
        <p className="text-sm font-semibold">Solicitar alteração</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Descreva o ajuste desejado (ex.: “trocar o texto X” ou “substituir a
          imagem Y”). A equipe será notificada.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Atenção: são aceitas apenas <strong>2 alterações</strong>. Alterações
          adicionais serão cobradas como taxa extra.
        </span>
      </div>

      {ajustes > 0 && (
        <p className="text-xs text-muted-foreground">
          Você já solicitou{" "}
          <strong className="text-foreground">
            {ajustes} {ajustes === 1 ? "alteração" : "alterações"}
          </strong>{" "}
          neste conteúdo.
        </p>
      )}

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={enviando}
        placeholder="Descreva aqui a alteração que deseja…"
      />

      {/* Anexos de referência (opcional): imagens e/ou vídeos, cada um com descrição */}
      {anexos.length > 0 && (
        <div className="space-y-3">
          {anexos.map((a) => (
            <div
              key={a.id}
              className="flex gap-3 rounded-md border bg-card p-3"
            >
              <div className="relative shrink-0">
                {a.kind === "video" ? (
                  <>
                    <video
                      src={a.preview}
                      muted
                      preload="metadata"
                      className="size-20 rounded bg-black object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-background/80 p-0.5 text-muted-foreground backdrop-blur">
                      <Film className="size-3.5" />
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.preview}
                    alt={a.file.name}
                    className="size-20 rounded object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removerAnexo(a.id)}
                  disabled={enviando}
                  title="Remover anexo"
                  className="absolute -right-2 -top-2 rounded-full border bg-background p-1 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <Input
                value={a.descricao}
                onChange={(e) => setDescricao(a.id, e.target.value)}
                disabled={enviando}
                placeholder="Onde é e o que fazer (ex.: 0:45 do vídeo, trocar o texto)"
                className="self-center"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={onPickArquivos}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-1 size-4" />
          {anexos.length ? "Adicionar mais mídias" : "Adicionar imagens ou vídeos"}
        </Button>
      </div>

      <Button onClick={enviar} disabled={enviando} className="w-full">
        {enviando ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </div>
  );
}
