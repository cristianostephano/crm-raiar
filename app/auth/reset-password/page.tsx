import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            Salvar nova senha
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
