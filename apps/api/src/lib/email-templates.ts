const COLORS = {
  bg: "#07090d",
  card: "#0f1318",
  border: "#2a303a",
  text: "#f4f6f8",
  muted: "#a7b0bc",
  dim: "#6b7380",
  accent: "#6b8cff",
  accentMuted: "#1a2347",
} as const;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function httpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    /* ignore */
  }
  return null;
}

function paragraphHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

export function wrapAvadeskEmail(opts: {
  title: string;
  previewText: string;
  paragraphs: string[];
  items?: string[];
  ctaUrl?: string;
  ctaLabel?: string;
  footerNote?: string;
}): { html: string; text: string } {
  const title = escapeHtml(opts.title);
  const preview = escapeHtml(opts.previewText);
  const safeCta = opts.ctaUrl ? httpUrl(opts.ctaUrl) : null;
  const ctaLabel = opts.ctaLabel ? escapeHtml(opts.ctaLabel) : "";
  const footerNote = opts.footerNote ? opts.footerNote : "Avadesk · uso interno";

  const bodyRows = opts.paragraphs
    .map(
      (p) =>
        `<tr><td style="padding:0 32px 16px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${COLORS.text};">${paragraphHtml(p)}</td></tr>`
    )
    .join("");

  const itemsRow =
    opts.items && opts.items.length > 0
      ? `<tr><td style="padding:0 32px 16px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${COLORS.text};">
          <ol style="margin:0;padding-left:20px;color:${COLORS.text};">
            ${opts.items.map((item) => `<li style="margin-bottom:8px;">${paragraphHtml(item)}</li>`).join("")}
          </ol>
        </td></tr>`
      : "";

  const ctaRow =
    safeCta && ctaLabel
      ? `<tr><td style="padding:8px 32px 24px;" align="left">
          <a href="${escapeHtml(safeCta)}" style="display:inline-block;background-color:${COLORS.accent};color:#ffffff;text-decoration:none;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">${ctaLabel}</a>
        </td></tr>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;">
          <tr>
            <td style="padding:28px 32px 8px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              <span style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border-radius:10px;background:${COLORS.accentMuted};color:${COLORS.accent};font-size:18px;">&#9672;</span>
              <span style="display:inline-block;margin-left:10px;vertical-align:middle;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.dim};font-weight:600;">Avadesk</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 8px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;color:${COLORS.text};">${title}</td>
          </tr>
          ${bodyRows}
          ${itemsRow}
          ${ctaRow}
          <tr>
            <td style="padding:20px 32px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${COLORS.muted};border-top:1px solid ${COLORS.border};">${paragraphHtml(footerNote)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts = [opts.title, "", ...opts.paragraphs];
  if (opts.items?.length) {
    textParts.push("");
    opts.items.forEach((item, i) => textParts.push(`${i + 1}. ${item}`));
  }
  if (safeCta && opts.ctaLabel) {
    textParts.push("", `${opts.ctaLabel}: ${safeCta}`);
  }
  textParts.push("", footerNote);

  return { html, text: textParts.join("\n") };
}

export function passwordResetEmail(resetUrl: string): { html: string; text: string; subject: string } {
  const subject = "Redefinição de senha";
  const wrapped = wrapAvadeskEmail({
    title: subject,
    previewText: "Use o link para redefinir sua senha. Expira em 1 hora.",
    paragraphs: [
      "Recebemos um pedido para redefinir a senha da sua conta Avadesk.",
      "Por segurança, o link abaixo expira em 1 hora e só pode ser usado uma vez. Não compartilhe este e-mail.",
      "Se você não pediu esta redefinição, ignore esta mensagem — sua senha permanece a mesma.",
    ],
    ctaUrl: resetUrl,
    ctaLabel: "Redefinir senha",
    footerNote: "Se você não pediu esta redefinição, ignore este e-mail.\nAvadesk · uso interno",
  });
  return { subject, ...wrapped };
}

export function projectUpdateEmail(opts: {
  projectName: string;
  title?: string;
  content: string;
  status: string;
  portalUrl: string;
}): { html: string; text: string; subject: string } {
  const subject = `Atualização: ${opts.projectName}`;
  const paragraphs = [
    `Há uma nova atualização visível no projeto ${opts.projectName}.`,
    "Acompanhe o andamento (agora, próximo e histórico) no portal.",
  ];
  if (opts.title) paragraphs.push(opts.title);
  paragraphs.push(`Status: ${opts.status}`, opts.content);
  const wrapped = wrapAvadeskEmail({
    title: subject,
    previewText: `Há uma nova atualização no projeto ${opts.projectName}.`,
    paragraphs,
    ctaUrl: opts.portalUrl,
    ctaLabel: "Abrir portal",
    footerNote: "Avadesk · uso interno",
  });
  return { subject, ...wrapped };
}

export function welcomeEmail(opts: {
  name: string;
  loginUrl: string;
}): { html: string; text: string; subject: string } {
  const first = opts.name.trim().split(/\s+/)[0] || "olá";
  const subject = "Bem-vindo à Avadesk";
  const wrapped = wrapAvadeskEmail({
    title: subject,
    previewText: `${first}, sua conta na Avadesk está pronta. Obrigado por estar conosco.`,
    paragraphs: [
      `Olá, ${opts.name.trim() || first}. Obrigado por confiar na Avadesk para acompanhar a evolução do seu sistema.`,
      "A Avadesk é o portal em que você vê o que está acontecendo agora, o que vem a seguir e o histórico do projeto — e abre chamados quando algo não estiver ok.",
      "Sua conta já foi criada. A senha temporária foi passada por quem liberou o seu acesso (não enviamos senha por e-mail).",
      "Como começar:",
    ],
    items: [
      "Entre no portal com o e-mail desta mensagem.",
      "No primeiro acesso, complete seu nome e defina uma senha nova.",
      "Use Chamados para bugs, implementações, funcionalidades e rotinas. Você será avisado quando o chamado for para correção, produção ou resolvido.",
    ],
    ctaUrl: opts.loginUrl,
    ctaLabel: "Entrar no portal",
    footerNote:
      "A senha temporária foi informada por quem criou o seu acesso — não vai neste e-mail.\nAvadesk · uso interno",
  });
  return { subject, ...wrapped };
}

export type TicketEmailKind =
  | "opened_staff"
  | "opened_client"
  | "fix"
  | "production"
  | "resolved"
  | "closed"
  | "reopened"
  | "info_requested"
  | "info_replied";

export function ticketStageEmail(opts: {
  kind: TicketEmailKind;
  ticketTitle: string;
  projectName: string;
  note?: string;
  ctaUrl: string;
}): { subject: string; title: string; body: string; html: string; text: string } {
  const title = opts.ticketTitle;
  const project = opts.projectName;
  const note = opts.note?.trim();

  const copy: Record<
    TicketEmailKind,
    { subject: string; paragraphs: string[]; ctaLabel: string }
  > = {
    opened_staff: {
      subject: "Novo chamado recebido",
      paragraphs: [
        `O cliente abriu o chamado “${title}” no projeto ${project}.`,
        "A etapa inicial é Correção. Avance para Produção quando a correção estiver publicada, e para Resolvido quando puder pedir a confirmação do cliente.",
      ],
      ctaLabel: "Ver chamados",
    },
    opened_client: {
      subject: "Abrimos um chamado para você",
      paragraphs: [
        `Registramos o chamado “${title}” no projeto ${project}.`,
        "Você pode acompanhar as etapas (Correção → Produção → Resolvido) no portal. Quando estiver resolvido, pediremos que você confirme se está ok.",
      ],
      ctaLabel: "Ver chamado",
    },
    fix: {
      subject: "Chamado em correção",
      paragraphs: [
        `O chamado “${title}” do projeto ${project} está em Correção.`,
        "A equipe está atuando. O próximo passo é Produção, quando a correção for publicada no ambiente.",
      ],
      ctaLabel: "Ver chamado",
    },
    production: {
      subject: "Chamado em produção",
      paragraphs: [
        `O chamado “${title}” saiu de Correção e entrou em Produção no projeto ${project}.`,
        "A correção está sendo publicada no ambiente. Em seguida o chamado vai para Resolvido, e você poderá confirmar se está ok.",
      ],
      ctaLabel: "Ver chamado",
    },
    resolved: {
      subject: "Chamado resolvido — confirme se está ok",
      paragraphs: [
        `O chamado “${title}” do projeto ${project} foi marcado como Resolvido.`,
        "Abra o portal e confirme se está ok. Se ainda não estiver, você pode reabrir e explicar o que falta.",
      ],
      ctaLabel: "Confirmar no portal",
    },
    closed: {
      subject: "Chamado encerrado",
      paragraphs: [
        `O cliente confirmou o chamado “${title}” do projeto ${project}. O chamado foi encerrado.`,
        "Obrigado — isso fecha o ciclo Correção → Produção → Resolvido.",
      ],
      ctaLabel: "Ver chamados",
    },
    reopened: {
      subject: "Chamado reaberto",
      paragraphs: [
        `O chamado “${title}” do projeto ${project} voltou para Correção.`,
        "O ciclo recomeça: Correção → Produção → Resolvido.",
      ],
      ctaLabel: "Ver chamado",
    },
    info_requested: {
      subject: "O time precisa da sua resposta",
      paragraphs: [
        `O time pediu mais informações no chamado “${title}” do projeto ${project}.`,
        "Abra o chamado no portal, leia a pergunta e responda. Enquanto isso o chamado fica como pendência: Aguardando resposta.",
      ],
      ctaLabel: "Responder no portal",
    },
    info_replied: {
      subject: "Cliente respondeu o chamado",
      paragraphs: [
        `O cliente respondeu o chamado “${title}” do projeto ${project}.`,
        "A pendência foi liberada. Abra o chamado para ler a resposta e seguir.",
      ],
      ctaLabel: "Ver chamado",
    },
  };

  const selected = copy[opts.kind];
  const paragraphs = [...selected.paragraphs];
  if (note) paragraphs.push(`Observação: ${note}`);

  const wrapped = wrapAvadeskEmail({
    title: selected.subject,
    previewText: selected.paragraphs[0] ?? selected.subject,
    paragraphs,
    ctaUrl: opts.ctaUrl,
    ctaLabel: selected.ctaLabel,
    footerNote: "Avadesk · uso interno",
  });

  return {
    subject: selected.subject,
    title: selected.subject,
    body: title,
    ...wrapped,
  };
}
