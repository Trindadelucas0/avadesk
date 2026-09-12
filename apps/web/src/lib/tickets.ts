import type { Ticket, TicketStage, TicketType } from "@/types";

export const TICKET_TYPES: { value: TicketType; label: string; hint: string }[] = [
  { value: "bug", label: "Bug", hint: "Algo quebrou" },
  { value: "implementation", label: "Implementação", hint: "Pedido para o time implementar" },
  { value: "feature", label: "Funcionalidade nova", hint: "O usuário passa a fazer algo novo" },
  { value: "routine", label: "Atualização de rotina", hint: "Mudança em uma rotina existente" },
  { value: "other", label: "Outra coisa", hint: "Dê um nome e descreva" },
];

export const CLIENT_TICKET_TYPE_VALUES: TicketType[] = ["bug", "other"];

export function ticketTypeLabel(type: TicketType): string {
  return TICKET_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function ticketStageLabels(type: TicketType): Record<"fix" | "production" | "resolved", string> {
  if (type === "bug") {
    return { fix: "Correção", production: "Produção", resolved: "Resolvido" };
  }
  if (type === "routine") {
    return { fix: "Executando", production: "Produção", resolved: "Concluída" };
  }
  return { fix: "Implementando", production: "Produção", resolved: "Pronto" };
}

export const PIPELINE_STAGES: Array<"fix" | "production" | "resolved"> = [
  "fix",
  "production",
  "resolved",
];

export function stageIndex(stage: TicketStage): number {
  if (stage === "closed") return 3;
  return PIPELINE_STAGES.indexOf(stage);
}

export function canMoveTicketStage(from: TicketStage, to: TicketStage): boolean {
  if (from === "closed" || to === "closed") return false;
  const fi = PIPELINE_STAGES.indexOf(from as "fix");
  const ti = PIPELINE_STAGES.indexOf(to as "fix");
  if (fi < 0 || ti < 0) return false;
  return Math.abs(ti - fi) === 1;
}

export type TicketFieldDef = {
  key: string;
  label: string;
  required: boolean;
  kind: "input" | "textarea";
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
};

export function ticketFieldDefs(type: TicketType): TicketFieldDef[] {
  switch (type) {
    case "bug":
      return [
        { key: "problem", label: "O que está acontecendo?", required: true, kind: "textarea" },
        { key: "where", label: "Onde (tela / módulo)", required: true, kind: "input" },
        { key: "repro", label: "Como reproduzir", required: false, kind: "textarea" },
        { key: "expected", label: "O que deveria acontecer", required: false, kind: "textarea" },
      ];
    case "implementation":
      return [
        { key: "what", label: "O que implementar", required: true, kind: "textarea" },
        { key: "why", label: "Por quê", required: true, kind: "textarea" },
      ];
    case "feature":
      return [
        { key: "whatUserDoes", label: "O que o usuário passa a fazer", required: true, kind: "textarea" },
        { key: "whoUses", label: "Quem usa", required: false, kind: "input" },
        { key: "doneWhen", label: "Quando está pronto", required: false, kind: "textarea" },
      ];
    case "routine":
      return [
        { key: "routineName", label: "Qual rotina", required: true, kind: "input" },
        { key: "whatChanges", label: "O que muda", required: true, kind: "textarea" },
        { key: "when", label: "Quando / frequência", required: false, kind: "input" },
      ];
    case "other":
      return [
        {
          key: "customName",
          label: "Como você chama isso?",
          required: true,
          kind: "input",
          maxLength: 60,
          minLength: 2,
          placeholder: "ex. Relatório de estoque que falta",
        },
        {
          key: "what",
          label: "O que você precisa?",
          required: true,
          kind: "textarea",
          maxLength: 4000,
          placeholder: "Descreva com o máximo de detalhe…",
        },
      ];
  }
}

export function originLabel(origin: string): string {
  return origin === "admin_report" ? "registrado pelo time" : "portal";
}

export const TICKET_IMAGE_MAX = 4;
export const TICKET_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const TICKET_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

const TICKET_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);
const TICKET_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp"]);

export function ticketImageMime(file: File): string {
  const raw = file.type.toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw === "image/png" || raw === "image/jpeg" || raw === "image/webp") return raw;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "";
}

export function isTicketImageFile(file: File): boolean {
  const mime = ticketImageMime(file);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk = TICKET_IMAGE_MIME.has(file.type.toLowerCase()) || Boolean(mime);
  const extOk = !ext || TICKET_IMAGE_EXT.has(ext);
  return mimeOk && extOk && mime.startsWith("image/");
}

export function ticketAttachmentUrl(ticketId: string, attachmentId: string): string {
  return `/api/v2/tickets/${ticketId}/attachments/${attachmentId}/download`;
}

export function canEditTicketContent(ticket: Ticket, userId: string | undefined): boolean {
  if (!userId || !ticket.createdByUserId || ticket.createdByUserId !== userId) return false;
  if (ticket.stage !== "fix") return false;
  const events = ticket.events ?? [];
  return !events.some((ev) => ev.fromStage);
}

export function isTicketOpen(ticket: Ticket): boolean {
  return ticket.stage !== "closed";
}

export function isoDateLocal(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function firstDayOfMonthLocal(date = new Date()): string {
  return isoDateLocal(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function closedDateRangeError(from: string, to: string): string | null {
  if (!from || !to) return "Informe as duas datas para consultar os concluídos.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return "Use datas no formato dia/mês/ano.";
  }
  if (from > to) return "A data inicial não pode ser depois da final.";
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  const inclusive = Math.floor((toMs - fromMs) / 86_400_000) + 1;
  if (inclusive > 366) return "O intervalo máximo é de 366 dias.";
  return null;
}
