// Resend HTTP API ile email gönderimi
// Env: RESEND_API_KEY
// Gönderici: istinyepark@kulahcioglu.com

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Resend API üzerinden email gönder
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{ filename: string; content: string }>;
}): Promise<EmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY ayarlanmamış' };
  }

  const fromAddress = params.from || 'İstinye Rolex İzmir <istinye@kulahcioglu.com>';

  // deno-lint-ignore no-explicit-any
  const emailPayload: Record<string, any> = {
    from: fromAddress,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };

  if (params.attachments && params.attachments.length > 0) {
    emailPayload.attachments = params.attachments;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await response.json();

    if (response.ok && result.id) {
      return { success: true, messageId: result.id };
    }

    return { success: false, error: JSON.stringify(result) };
  } catch (err) {
    console.error('Resend API hatası:', err);
    return { success: false, error: String(err) };
  }
}

// Geriye uyumluluk: sendGmail -> sendEmail
export const sendGmail = sendEmail;
