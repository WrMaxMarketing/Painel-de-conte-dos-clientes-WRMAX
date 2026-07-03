"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Film, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ZoomableImage } from "@/components/zoomable-image";
import { removerArquivo } from "@/app/actions";
import type { MediaFile } from "@/lib/notion";

// Exibe as midias da propriedade "Files & media": imagens e videos com preview
// inline, demais arquivos como anexo. Todos com link de download.
// Em `editable` (etapa "Conteúdo para aprovação") permite adicionar/remover.
export function MediaGallery({
  arquivos,
  editable = false,
  pageId,
}: {
  arquivos: MediaFile[];
  editable?: boolean;
  pageId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();
  const ocupado = uploading || removing;

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const lista = e.target.files;
    if (!lista?.length || !pageId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("pageId", pageId);
      for (const f of Array.from(lista)) fd.append("file", f);
      const res = await fetch("/api/cards/files", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha no upload.");
      toast.success("Mídia adicionada.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onRemove(index: number, name: string) {
    if (!pageId) return;
    startRemove(async () => {
      try {
        await removerArquivo(pageId, index, name);
        toast.success("Mídia removida.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível remover."
        );
      }
    });
  }

  if (!arquivos.length && !editable) return null;

  return (
    <div className="space-y-3">
      {arquivos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {arquivos.map((f, i) => (
            <figure
              key={`${f.name}-${i}`}
              className="group relative overflow-hidden rounded-lg border bg-card"
            >
              {f.kind === "image" ? (
                <ZoomableImage
                  src={f.url}
                  alt={f.name}
                  className="aspect-square w-full object-cover"
                />
              ) : f.kind === "video" ? (
                <video
                  src={f.url}
                  controls
                  preload="metadata"
                  className="aspect-square w-full bg-black object-contain"
                />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground">
                  <FileText className="size-8" />
                  <span className="line-clamp-2 break-all text-xs">{f.name}</span>
                </div>
              )}

              {editable && (
                <button
                  type="button"
                  onClick={() => onRemove(i, f.name)}
                  disabled={ocupado}
                  title="Remover"
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              )}

              {/* Rodape: nome + download */}
              <figcaption className="flex items-center justify-between gap-2 border-t bg-card/80 px-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  {f.kind === "video" && <Film className="size-3 shrink-0" />}
                  <span className="truncate">{f.name}</span>
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={f.name}
                  title="Baixar"
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Download className="size-4" />
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {editable && (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
          >
            <Plus className="mr-1 size-4" />
            {uploading ? "Enviando…" : "Adicionar mídia"}
          </Button>
        </div>
      )}
    </div>
  );
}
