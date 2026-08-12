import { LoginForm } from "@/app/login/login-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-white/60">
          <CardHeader className="space-y-2 p-8 pb-0 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground">
              A
            </div>
            <CardTitle className="mt-2 text-3xl">Appraisify</CardTitle>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </CardHeader>
          <CardContent className="p-8">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
