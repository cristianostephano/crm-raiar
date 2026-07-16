"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const forgotPasswordSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

// Deliberately non-revealing of whether the email exists (T-01-17 /
// UI-SPEC Copywriting Contract) — shown whenever the request itself
// succeeded, regardless of whether the address is actually registered
// (GoTrue's own /recover endpoint already returns success for unknown
// emails, so this copy never needs to branch on "user not found").
const SUCCESS_MESSAGE =
  "Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha."

// Rate-limit error codes are an infra/quota signal, not an
// account-existence signal (GoTrue never reveals "user not found" for
// /recover) — safe to surface honestly instead of the generic success
// copy, so the user knows to wait instead of assuming an email is coming.
const RATE_LIMIT_ERROR_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
])
const RATE_LIMIT_MESSAGE =
  "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente."
const GENERIC_ERROR_MESSAGE =
  "Não foi possível enviar o link agora. Tente novamente em instantes."

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ForgotPasswordFormValues) {
    setErrorMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    })

    // Only rate-limit-shaped errors are surfaced honestly — they carry no
    // information about whether the email exists. Any other outcome
    // (including "email doesn't exist", which GoTrue itself never reports)
    // still shows the same non-revealing success copy.
    if (error && RATE_LIMIT_ERROR_CODES.has(error.code ?? "")) {
      setErrorMessage(RATE_LIMIT_MESSAGE)
      return
    }
    if (error && error.status && error.status >= 500) {
      setErrorMessage(GENERIC_ERROR_MESSAGE)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {SUCCESS_MESSAGE}
      </p>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Enviando..."
            : "Enviar link de redefinição"}
        </Button>
      </form>
    </Form>
  )
}
