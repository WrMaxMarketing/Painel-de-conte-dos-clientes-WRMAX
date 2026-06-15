"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createClientAccess,
  type CreateAccessState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initial: CreateAccessState = {};

export function CreateAccessForm({ clientes }: { clientes: string[] }) {
  const [state, action, pending] = useActionState(createClientAccess, initial);
  const [cliente, setCliente] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa o form depois de criar com sucesso (reset intencional pos-submit).
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCliente("");
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {/* Carrega o cliente selecionado no FormData */}
      <input type="hidden" name="cliente" value={cliente} />

      <div className="space-y-2">
        <Label htmlFor="email">Email do cliente</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="contato@cliente.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="text"
          autoComplete="off"
          placeholder="mínimo 6 caracteres"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Cliente (do Notion)</Label>
        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o cliente…" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-500" role="status">
          {state.success}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending || !cliente}>
        {pending ? "Criando…" : "Criar acesso do cliente"}
      </Button>
    </form>
  );
}
