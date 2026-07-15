import Link from "next/link"

import { LoginForm } from "@/components/auth/LoginForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Entrar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoginForm />
          <Link
            href="/forgot-password"
            className="self-end text-sm text-primary underline-offset-4 hover:underline"
          >
            Esqueci minha senha?
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
