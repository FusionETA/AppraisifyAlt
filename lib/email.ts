import "server-only"

/**
 * Minimal Brevo transactional email sender. When BREVO_API_KEY isn't
 * configured (e.g. local dev before Phase E's manual prerequisite is
 * provisioned), this logs the email to the server console instead of
 * throwing — matches the rest of the app's "missing external config
 * degrades gracefully" convention (see lib/redis.ts, lib/ai/providers/*).
 */
export async function sendEmail(input: { to: string; toName?: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME || "Appraisify"

  if (!apiKey || !senderEmail) {
    console.log(`[email] BREVO not configured — would send to ${input.to}: ${input.subject}\n${input.html}`)
    return
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: input.to, name: input.toName }],
      subject: input.subject,
      htmlContent: input.html,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Brevo send failed (${response.status}): ${body.slice(0, 300)}`)
  }
}
