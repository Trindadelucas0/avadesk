import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type TicketPdfInput = {
  id: string;
  projectName: string;
  type: string;
  title: string;
  fields: Record<string, unknown>;
  stage: string;
  origin: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  clientConfirmedAt: string | null;
  events: Array<{
    fromStage: string | null;
    toStage: string;
    note: string;
    actorName: string;
    createdAt: string;
  }>;
  attachments: Array<{ originalName: string }>;
  messages: Array<{
    actorName: string;
    kind: string;
    body: string;
    createdAt: string;
  }>;
};

const TYPE_LABEL: Record<string, string> = {
  bug: "Bug",
  implementation: "Implementação",
  feature: "Funcionalidade nova",
  routine: "Atualização de rotina",
  other: "Outra coisa",
};

const FIELD_DEFS: Record<string, Array<{ key: string; label: string }>> = {
  bug: [
    { key: "problem", label: "O que está acontecendo?" },
    { key: "where", label: "Onde (tela / módulo)" },
    { key: "repro", label: "Como reproduzir" },
    { key: "expected", label: "O que deveria acontecer" },
  ],
  implementation: [
    { key: "what", label: "O que implementar" },
    { key: "why", label: "Por quê" },
  ],
  feature: [
    { key: "whatUserDoes", label: "O que o usuário passa a fazer" },
    { key: "whoUses", label: "Quem usa" },
    { key: "doneWhen", label: "Quando está pronto" },
  ],
  routine: [
    { key: "routineName", label: "Qual rotina" },
    { key: "whatChanges", label: "O que muda" },
    { key: "when", label: "Quando / frequência" },
  ],
  other: [
    { key: "customName", label: "Como você chama isso?" },
    { key: "what", label: "O que você precisa?" },
  ],
};

function stageLabels(type: string): Record<string, string> {
  if (type === "bug") return { fix: "Correção", production: "Produção", resolved: "Resolvido", closed: "Encerrado" };
  if (type === "routine") {
    return { fix: "Executando", production: "Produção", resolved: "Concluída", closed: "Encerrado" };
  }
  return { fix: "Implementando", production: "Produção", resolved: "Pronto", closed: "Encerrado" };
}

function originLabel(origin: string): string {
  return origin === "admin_report" ? "Relato do cliente" : "Portal";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function winAnsi(text: string): string {
  return text.replace(/[^\u0000-\u00ff]/g, "?");
}

export function ticketPdfFilename(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `chamado-${slug || "avadesk"}.pdf`;
}

export function ticketPdfDisposition(title: string): string {
  const name = ticketPdfFilename(title).replace(/"/g, "");
  return `attachment; filename="${name}"`;
}

export async function buildTicketPdf(ticket: TicketPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 48;
  const maxWidth = pageSize[0] - margin * 2;
  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;
  const ink = rgb(0.12, 0.14, 0.18);
  const muted = rgb(0.35, 0.38, 0.42);

  const ensure = (need: number) => {
    if (y - need < margin) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };

  const wrap = (text: string, size: number, face: typeof font): string[] => {
    const raw = winAnsi(text).replace(/\r\n/g, "\n").split("\n");
    const lines: string[] = [];
    for (const paragraph of raw) {
      if (!paragraph) {
        lines.push("");
        continue;
      }
      const words = paragraph.split(/\s+/);
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (face.widthOfTextAtSize(next, size) <= maxWidth) {
          current = next;
        } else {
          if (current) lines.push(current);
          current = word;
          while (face.widthOfTextAtSize(current, size) > maxWidth && current.length > 1) {
            let cut = current.length - 1;
            while (cut > 1 && face.widthOfTextAtSize(current.slice(0, cut), size) > maxWidth) cut -= 1;
            lines.push(current.slice(0, cut));
            current = current.slice(cut);
          }
        }
      }
      if (current) lines.push(current);
    }
    return lines.length ? lines : [""];
  };

  const write = (text: string, size: number, face: typeof font, color = ink) => {
    const lines = wrap(text, size, face);
    const lineH = size + 4;
    for (const line of lines) {
      ensure(lineH);
      page.drawText(line, { x: margin, y, size, font: face, color });
      y -= lineH;
    }
  };

  const gap = (n = 8) => {
    y -= n;
  };

  write("Avadesk — Chamado", 16, bold);
  gap(6);
  write("Use este PDF no Cursor como demanda. Nao peca para redigitar os campos.", 9, font, muted);
  gap(14);

  const labels = stageLabels(ticket.type);
  const meta: Array<[string, string]> = [
    ["ID", ticket.id],
    ["Projeto", ticket.projectName || "—"],
    ["Tipo", TYPE_LABEL[ticket.type] ?? ticket.type],
    ["Etapa", labels[ticket.stage] ?? ticket.stage],
    ["Origem", originLabel(ticket.origin)],
    ["Aberto por", ticket.createdByName || "—"],
    ["Criado em", formatWhen(ticket.createdAt)],
    ["Atualizado em", formatWhen(ticket.updatedAt)],
  ];
  if (ticket.clientConfirmedAt) {
    meta.push(["Confirmado em", formatWhen(ticket.clientConfirmedAt)]);
  }
  for (const [k, v] of meta) {
    write(`${k}: ${v}`, 10, font);
  }
  gap(10);
  write("Titulo do chamado", 11, bold);
  write(ticket.title || "—", 11, font);
  gap(12);

  const defs = FIELD_DEFS[ticket.type] ?? [];
  for (const def of defs) {
    const raw = ticket.fields[def.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    write(def.label, 11, bold);
    write(value || "—", 10, font);
    gap(8);
  }

  if (ticket.events.length > 0) {
    write("Historico de etapas", 11, bold);
    for (const ev of ticket.events) {
      const step =
        !ev.fromStage && ev.toStage === "fix"
          ? "Aberto"
          : ev.toStage === "closed"
            ? "Confirmado"
            : labels[ev.toStage] ?? ev.toStage;
      const note = ev.note && !["open", "confirm", "reopen"].includes(ev.note) ? ` — ${ev.note}` : "";
      write(`${formatWhen(ev.createdAt)} · ${step}${ev.actorName ? ` · ${ev.actorName}` : ""}${note}`, 9, font);
    }
    gap(8);
  }

  if (ticket.messages.length > 0) {
    write("Conversa", 11, bold);
    for (const m of ticket.messages) {
      const who = m.actorName || (m.kind === "request" ? "Time" : "Cliente");
      write(`${formatWhen(m.createdAt)} · ${who}`, 9, bold);
      write(m.body || "—", 10, font);
      gap(6);
    }
  }

  write("Imagens", 11, bold);
  if (ticket.attachments.length === 0) {
    write("Nenhuma (prints nao entram neste PDF).", 10, font, muted);
  } else {
    for (const att of ticket.attachments) {
      write(`- ${att.originalName || "imagem"}`, 10, font);
    }
    write("Anexe os prints no Cursor se precisar (este PDF e so texto).", 9, font, muted);
  }
  gap(16);
  write("PARA O CURSOR", 11, bold);
  write(
    "Isto e uma demanda do Avadesk. Classifique o tipo se for Outra coisa. Nao peca para reescrever os campos. Implemente ou entregue o plano a partir deste conteudo.",
    10,
    font
  );

  return doc.save();
}
