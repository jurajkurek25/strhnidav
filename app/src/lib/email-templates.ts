const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kurz.strhnidav.sk";

function wrapper(bodyHtml: string): string {
  return `<!doctype html>
<html lang="sk">
  <body style="margin:0;padding:0;background:#0b0a08;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0a08;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#1b1712;border:1px solid rgba(201,161,48,0.16);border-radius:4px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:32px 32px 8px;font-family:-apple-system,Helvetica,Arial,sans-serif;">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#ece5d6;">
                  Strhni<span style="color:#c9a130;">Dav</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#ece5d6;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="max-width:480px;margin:20px 0 0;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:12px;color:#8f8779;">
            Ngroup, s. r. o. — dostávaš tento e-mail, lebo máš vytvorený účet v členskej sekcii Strhni Dav.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;background:#c9a130;color:#0b0a08;font-weight:600;font-size:14px;padding:13px 26px;border-radius:2px;text-decoration:none;">${label}</a>`;
}

export function unlockEmail(opts: { firstName: string; dayNumber: number; lessonTitle: string }) {
  const url = `${SITE_URL}/lesson/${opts.dayNumber}`;
  const subject = `Lekcia ${opts.dayNumber} je odomknutá — ${opts.lessonTitle}`;
  const html = wrapper(`
    <p style="margin:0 0 14px;">Ahoj${opts.firstName ? ` ${opts.firstName}` : ""},</p>
    <p style="margin:0 0 14px;">tvoja ďalšia lekcia je pripravená:</p>
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#8f8779;">Deň ${opts.dayNumber}</p>
    <p style="margin:0;font-size:19px;font-weight:600;color:#ece5d6;">${opts.lessonTitle}</p>
    ${button(url, "Otvoriť lekciu")}
  `);
  const text = `Ahoj${opts.firstName ? ` ${opts.firstName}` : ""}, tvoja ďalšia lekcia je pripravená: Deň ${opts.dayNumber} — ${opts.lessonTitle}. Otvor ju tu: ${url}`;
  return { subject, html, text };
}

export function nudgeEmail(opts: { firstName: string; dayNumber: number; lessonTitle: string }) {
  const url = `${SITE_URL}/lesson/${opts.dayNumber}`;
  const subject = "Nezabudni pokračovať v kurze Strhni Dav";
  const html = wrapper(`
    <p style="margin:0 0 14px;">Ahoj${opts.firstName ? ` ${opts.firstName}` : ""},</p>
    <p style="margin:0 0 14px;">už pár dní na teba čaká rozpozeraná lekcia — žiadny stres, len jemné pripomenutie, keby si na ňu zabudol/-a:</p>
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#8f8779;">Deň ${opts.dayNumber}</p>
    <p style="margin:0;font-size:19px;font-weight:600;color:#ece5d6;">${opts.lessonTitle}</p>
    ${button(url, "Pokračovať v kurze")}
  `);
  const text = `Ahoj${opts.firstName ? ` ${opts.firstName}` : ""}, už pár dní na teba čaká lekcia Deň ${opts.dayNumber} — ${opts.lessonTitle}. Pokračuj tu: ${url}`;
  return { subject, html, text };
}
