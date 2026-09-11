"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, v2 } from "@/lib/v2-client";
import { formatBrPhone, formatCnpj, isValidBrPhone, isValidCnpjInput, onlyDigits } from "@/lib/br-contact";
import { isValidEmail } from "@/lib/onboarding";
import type { Client } from "@/types";

export type ClientDataValues = {
  name: string;
  contactEmail: string;
  phone: string;
  whatsapp: string;
  cnpj: string;
  company: string;
  segment: string;
  notes: string;
};

export const EMPTY_CLIENT_DATA: ClientDataValues = {
  name: "",
  contactEmail: "",
  phone: "",
  whatsapp: "",
  cnpj: "",
  company: "",
  segment: "",
  notes: "",
};

export function clientToFormValues(client: Client): ClientDataValues {
  return {
    name: client.name ?? "",
    contactEmail: client.contactEmail ?? "",
    phone: formatBrPhone(client.phone ?? ""),
    whatsapp: formatBrPhone(client.whatsapp ?? ""),
    cnpj: formatCnpj(client.cnpj ?? ""),
    company: client.company ?? "",
    segment: client.segment ?? "",
    notes: client.notes ?? "",
  };
}

export function clientDataError(values: ClientDataValues): string | null {
  if (!values.name.trim()) return "Informe o nome.";
  if (!isValidEmail(values.contactEmail)) return "Informe um e-mail válido.";
  if (!isValidBrPhone(values.phone)) return "Informe um telefone válido.";
  if (!isValidBrPhone(values.whatsapp)) return "Informe um WhatsApp válido.";
  if (!isValidCnpjInput(values.cnpj)) return "CNPJ deve ter 14 dígitos.";
  return null;
}

export function clientDataPayload(values: ClientDataValues) {
  return {
    name: values.name.trim(),
    contactEmail: values.contactEmail.trim(),
    phone: onlyDigits(values.phone),
    whatsapp: onlyDigits(values.whatsapp),
    company: values.company.trim(),
    segment: values.segment.trim(),
    cnpj: onlyDigits(values.cnpj),
    notes: values.notes.trim(),
  };
}

type CnpjStatus = "idle" | "loading" | "found" | "not_found" | "error";

export function ClientDataFields({
  values,
  onChange,
  disabled,
  idPrefix,
}: {
  values: ClientDataValues;
  onChange: (patch: Partial<ClientDataValues>) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const [cnpjStatus, setCnpjStatus] = useState<CnpjStatus>("idle");
  const lastLookup = useRef("");
  const companyRef = useRef(values.company);
  const onChangeRef = useRef(onChange);
  companyRef.current = values.company;
  onChangeRef.current = onChange;

  useEffect(() => {
    const digits = onlyDigits(values.cnpj);
    if (digits.length !== 14) {
      setCnpjStatus("idle");
      lastLookup.current = "";
      return;
    }
    if (lastLookup.current === digits) return;

    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setCnpjStatus("loading");
      try {
        const res = await v2<{ company: string; tradeName: string }>(`/clients/cnpj/${digits}`, {
          signal: ac.signal,
        });
        lastLookup.current = digits;
        setCnpjStatus("found");
        if (!companyRef.current.trim()) {
          onChangeRef.current({ company: res.tradeName || res.company || "" });
        }
      } catch (err) {
        if (ac.signal.aborted) return;
        lastLookup.current = digits;
        if (err instanceof ApiError && err.status === 404) {
          setCnpjStatus("not_found");
          return;
        }
        setCnpjStatus("error");
      }
    }, 400);

    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [values.cnpj]);

  const field = (key: keyof ClientDataValues, next: string) => onChange({ [key]: next });

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Contato</p>
        <div>
          <Label htmlFor={`${idPrefix}-name`}>Nome *</Label>
          <Input
            id={`${idPrefix}-name`}
            className="mt-1.5"
            value={values.name}
            onChange={(e) => field("name", e.target.value)}
            autoComplete="name"
            required
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-email`}>E-mail *</Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            className="mt-1.5"
            value={values.contactEmail}
            onChange={(e) => field("contactEmail", e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
            disabled={disabled}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-phone`}>Telefone *</Label>
            <Input
              id={`${idPrefix}-phone`}
              className="mt-1.5"
              value={values.phone}
              onChange={(e) => field("phone", formatBrPhone(e.target.value))}
              autoComplete="tel"
              inputMode="tel"
              required
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-whatsapp`}>WhatsApp *</Label>
            <Input
              id={`${idPrefix}-whatsapp`}
              className="mt-1.5"
              value={values.whatsapp}
              onChange={(e) => field("whatsapp", formatBrPhone(e.target.value))}
              autoComplete="tel"
              inputMode="tel"
              required
              disabled={disabled}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Empresa (opcional)
        </p>
        <div>
          <Label htmlFor={`${idPrefix}-cnpj`}>CNPJ</Label>
          <Input
            id={`${idPrefix}-cnpj`}
            className="mt-1.5"
            value={values.cnpj}
            onChange={(e) => field("cnpj", formatCnpj(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            disabled={disabled}
          />
          {cnpjStatus === "loading" ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">Buscando CNPJ…</p>
          ) : null}
          {cnpjStatus === "not_found" ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              CNPJ não encontrado — preencha a empresa à mão.
            </p>
          ) : null}
          {cnpjStatus === "error" ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Não foi possível consultar o CNPJ. Preencha à mão.
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-company`}>Empresa</Label>
          <Input
            id={`${idPrefix}-company`}
            className="mt-1.5"
            value={values.company}
            onChange={(e) => field("company", e.target.value)}
            autoComplete="organization"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-segment`}>Segmento</Label>
          <Input
            id={`${idPrefix}-segment`}
            className="mt-1.5"
            value={values.segment}
            onChange={(e) => field("segment", e.target.value)}
            placeholder="Ex.: Varejo"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-notes`}>Mais informações</Label>
          <Textarea
            id={`${idPrefix}-notes`}
            className="mt-1.5"
            value={values.notes}
            onChange={(e) => field("notes", e.target.value)}
            maxLength={2000}
            disabled={disabled}
          />
        </div>
      </section>
    </div>
  );
}
