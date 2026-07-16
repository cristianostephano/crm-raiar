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
// UI-SPEC Copywriting Contract) — shown on submit regardless of outcome.
const SUCCESS_MESSAGE =
  "Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha."

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ForgotPasswordFormValues) {
    const supabase = createClient()
    // Errors are intentionally not surfaced to the caller — the same
    // non-revealing success copy is shown whether or not the email exists
    // or the send fails, so no branch on `error` here.
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    })

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
