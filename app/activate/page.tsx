import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getInviteByToken } from "@/modules/team/application/services/team.service"

import { ActivateForm } from "./activate-form"

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const invite = token ? await getInviteByToken(token) : null

  return (
    <main className="flex min-h-screen items-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-white/60">
          <CardHeader className="space-y-2 p-8 pb-0 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground">
              A
            </div>
            <CardTitle className="mt-2 text-3xl">Appraisify</CardTitle>
            {invite ? (
              <p className="text-sm text-muted-foreground">Set a password for {invite.email}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Activation link</p>
            )}
          </CardHeader>
          <CardContent className="p-8">
            {invite && token ? (
              <ActivateForm token={token} />
            ) : (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                This activation link is invalid or has expired. Ask your admin to resend the invite.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
