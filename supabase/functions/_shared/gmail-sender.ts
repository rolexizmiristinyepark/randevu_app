// Gmail SMTP ile email gönderimi
// App Password kullanır (2FA aktif Gmail hesabı gerekir)
// Env: GMAIL_USER, GMAIL_APP_PASSWORD

import { createTransport } from 'npm:nodemailer@6';

interface GmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Gmail SMTP üzerinden email gönder
 */
export async function sendGmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<GmailResult> {
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

  if (!gmailUser || !gmailAppPassword) {
    return { success: false, error: 'GMAIL_USER veya GMAIL_APP_PASSWORD ayarlanmamış' };
  }

  const fromAddress = params.from || `"İstinyepark Rolex İzmir" <${gmailUser}>`;

  try {
    const transporter = createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    await transporter.close();

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Gmail SMTP hatası:', err);
    return { success: false, error: String(err) };
  }
}
