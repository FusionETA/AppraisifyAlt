import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SettingsClient({ organization }: { organization: { id: string; name: string } }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization-wide preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-sm text-muted-foreground">
            Organization name is managed in AltomateHR.
          </p>
          <p className="text-sm font-semibold text-foreground">{organization.name}</p>
        </CardContent>
      </Card>
    </div>
  )
}
