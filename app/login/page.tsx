import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMode } from "@/lib/altomatehr/client"
import { isAltomateDevToolsEnabled } from "@/lib/altomatehr/dev-tools"

// Without this, Next.js statically prerenders the page at `next build`
// time and bakes in whatever ALTOMATE_DEV_TOOLS resolved to THEN — a
// runtime env change + pm2 restart would never take effect. Forces the
// dev-tools check to run fresh on every request instead.
export const dynamic = "force-dynamic"

const ERROR_MESSAGES: Record<string, string> = {
  "missing-ticket": "That link is missing its sign-in ticket. Please return to AltomateHR and launch Appraisify again.",
  "invalid-ticket": "That sign-in link has expired or already been used. Please return to AltomateHR and launch Appraisify again.",
  "refresh-failed": "Your AltomateHR session expired. Please return to AltomateHR and launch Appraisify again.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>
}) {
  const devToolsEnabled = isAltomateDevToolsEnabled()
  const mode = devToolsEnabled ? getMode() : null

  const { error, reason } = await searchParams
  const errorMessage =
    error === "sso"
      ? (reason && ERROR_MESSAGES[reason]) ??
        "We couldn't verify your AltomateHR sign-in link. Please return to AltomateHR and launch Appraisify again."
      : null

  return (
    <main className="flex min-h-screen items-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-white/60">
          <CardHeader className="space-y-2 p-8 pb-0 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground">
              A
            </div>
            <CardTitle className="mt-2 text-3xl">Appraisify</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-8">
            {errorMessage ? (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <p className="text-center text-sm text-muted-foreground">
              Appraisify is launched from AltomateHR. Sign in to AltomateHR and click{" "}
              <span className="font-medium text-foreground">Launch Appraisify</span> from your dashboard to
              continue.
            </p>
          </CardContent>
        </Card>
        {devToolsEnabled && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Dev tools:</span>
            <a
              href="/dev/altomate-mode"
              className="flex items-center gap-1.5 underline hover:text-foreground"
            >
              Integration mode
              <Badge variant={mode === "stub" ? "success" : "outline"} className="!px-2 !py-0.5 !text-[10px]">
                {mode}
              </Badge>
            </a>
            <a href="/dev/altomate-launch" className="underline hover:text-foreground">
              Test accounts
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
