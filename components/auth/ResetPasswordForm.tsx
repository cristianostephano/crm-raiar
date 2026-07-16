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

// z.object({...}).superRefine() rather than a per-field .refine() — a
// per-field refine turns that field into a ZodEffects type that breaks
// zodResolver's generic FieldValues inference against zod v4 (see
// 01-04-SUMMARY.md's tech-stack pattern).
const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "As senhas não coincidem.",
        path: ["confirmPassword"],
      })
    }
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

const GENERIC_ERROR =
  "Não foi possível salvar a nova senha. Tente novamente em instantes."

export function ResetPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null)

    try {
      const supabase = createClient()
      // Requires the active session /auth/confirm's verifyOtp already
      // established (T-01-18) — without it this call fails.
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      })

      if (error) {
        setFormError(GENERIC_ERROR)
        return
      }

      // Hard navigation, matching LoginForm's convention (01-03), so the
      // next Server Component render reads the just-updated session fresh
      // rather than reusing a stale pre-update Router Cache entry.
      window.location.assign("/")
    } catch {
      setFormError(GENERIC_ERROR)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nova senha</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar nova senha</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
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
          {form.formState.isSubmitting ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </Form>
  )
}
