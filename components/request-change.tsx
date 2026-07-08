"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Film,
  ImagePlus,
  Loader2,
  PencilLine,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  // Campo de descricao aberto (via lapis)? Comeca fechado para nao poluir a UI.
  descricaoAberta: boolean;
};

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (limite do upload do Notion)
// Aceita imagens e vídeos, um ou vários de uma vez (misturados).
const ACCEPT = "image/*,video/*";

export function RequestChange({
  pageId,
  ajustes,
  onDone,
  onCancel,
}: {
  pageId: string;
  ajustes: number;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<AnexoItem[]>([]);
  const [enviando, setEnviando] = useState(false);
  // Popup de arquivo acima do limite (20 MB).
  const [popupGrande, setPopupGrande] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);

  function onPickArquivos(e: ChangeEvent<HTMLInputElement>) {
    // Copia os arquivos ANTES de limpar o input: `e.target.files` é uma
    // referência viva que esvazia ao zerar `value` (por isso o preview sumia).
    const arquivos = e.target.files ? Array.from(e.target.files) : [];
    // Permite escolher os mesmos arquivos de novo depois.
    if (inputRef.current) inputRef.current.value = "";
    if (!arquivos.length) return;

    const novos: AnexoItem[] = [];
    let rejeitadosTipo = 0;
    let algumGrande = false;
    for (const f of arquivos) {
      const ehImagem = f.type.startsWith("image/");
      const ehVideo = f.type.startsWith("video/");
      if (!ehImagem && !ehVideo) {
        rejeitadosTipo++;
        continue;
      }
      if (f.size > MAX_BYTES) {
        algumGrande = true;
        continue;
      }
      novos.push({
        id: idRef.current++,
        file: f,
        preview: URL.createObjectURL(f),
        kind: ehVideo ? "video" : "image",
        descricao: "",
        descricaoAberta: false,
      });
    }

    if (rejeitadosTipo)
      toast.error("Alguns arquivos foram ignorados: envie apenas imagens ou vídeos.");
    if (algumGrande) setPopupGrande(true);
    if (novos.length) setAnexos((prev) => [...prev, ...novos]);
  }

  function setDescricao(id: number, descricao: string) {
    setAnexos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, descricao } : a))
    );
  }

  function toggleDescricao(id: number) {
    setAnexos((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, descricaoAberta: !a.descricaoAberta } : a
      )
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

      <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">
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
        maxLength={2000}
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
                  aria-label="Remover anexo"
                  className="absolute -right-2 -top-2 rounded-full border bg-background p-2 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground active:bg-destructive active:text-destructive-foreground disabled:opacity-50 md:p-1"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {/* Descrição da mídia: fechada por padrão, abre no ícone de lápis. */}
              <div className="flex min-w-0 flex-1 items-center">
                {a.descricaoAberta ? (
                  <div className="flex w-full items-center gap-2">
                    <Input
                      autoFocus
                      value={a.descricao}
                      onChange={(e) => setDescricao(a.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") toggleDescricao(a.id);
                      }}
                      disabled={enviando}
                      maxLength={300}
                      placeholder="Onde é e o que fazer (ex.: 0:45 do vídeo, trocar o texto)"
                    />
                    <button
                      type="button"
                      onClick={() => toggleDescricao(a.id)}
                      disabled={enviando}
                      aria-label="Concluir descrição"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent active:text-foreground disabled:opacity-50 md:h-8 md:w-8"
                    >
                      <Check className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleDescricao(a.id)}
                    disabled={enviando}
                    aria-label="Adicionar descrição desta mídia"
                    className="flex min-h-11 min-w-0 items-center gap-2 text-left text-sm text-foreground transition-colors hover:text-foreground active:text-foreground disabled:opacity-50 md:min-h-0 md:text-muted-foreground"
                  >
                    <PencilLine className="size-4 shrink-0" />
                    {a.descricao ? (
                      <span className="line-clamp-2 break-all">{a.descricao}</span>
                    ) : (
                      <span>Descrever onde esta mídia vai</span>
                    )}
                  </button>
                )}
              </div>
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
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          className="w-full sm:w-auto"
        >
          <ImagePlus className="mr-1 size-4" />
          {anexos.length ? "Adicionar mais mídias" : "Adicionar imagens ou vídeos"}
        </Button>
      </div>

      {/* Aviso de progresso enquanto as mídias sobem para o Notion. */}
      {enviando && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          {anexos.length
            ? "Enviando suas mídias, isso pode levar alguns segundos…"
            : "Enviando sua solicitação…"}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={enviando}
            onClick={() => {
              limpar();
              onCancel();
            }}
          >
            Cancelar
          </Button>
        )}
        <Button onClick={enviar} disabled={enviando} className="flex-1">
          {enviando ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Enviando…
            </>
          ) : (
            "Enviar solicitação"
          )}
        </Button>
      </div>

      {/* Popup: arquivo acima de 20 MB → orientar uso de link de drive. */}
      <AlertDialog open={popupGrande} onOpenChange={setPopupGrande}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-500/15 text-red-600 dark:text-red-400">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>Arquivo muito grande</AlertDialogTitle>
            <AlertDialogDescription>
              O tamanho máximo por arquivo é <strong>20 MB</strong> e o arquivo
              não foi adicionado. Para mídias maiores, faça o upload em um drive
              (Google Drive, Dropbox, etc.) e cole o link do drive na descrição
              da alteração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
