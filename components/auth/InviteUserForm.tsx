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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

// D-05: papel has no default — the Supervisor must explicitly choose it,
// so `role` is required with no zod default() and no RHF defaultValue.
const inviteSchema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  sobrenome: z.string().min(1, "Informe o sobrenome."),
  email: z.string().email("Informe um e-mail válido."),
  celular: z.string().min(1, "Informe o celular."),
  role: z.enum(["supervisor", "vendedor"], {
    message: "Escolha o papel.",
  }),
})

type InviteFormValues = z.infer<typeof inviteSchema>

const DUPLICATE_EMAIL_ERROR = "Já existe uma conta com esse e-mail."
const GENERIC_ERROR = "Não foi possível enviar o convite. Tente novamente."
const SUCCESS_MESSAGE =
  "Convite enviado! A pessoa vai receber um e-mail para criar a própria senha."

/**
 * Public entry point: renders as a collapsed "Convidar" primary button
 * (top-right of the Gerenciar Equipe list). Clicking it reveals the form
 * inline, right below — per UI-SPEC this must not navigate away from the
 * member list (no route change, no separate page).
 */
export function InviteUserForm({ onInvited }: { onInvited?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="self-end">
        Convidar
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Convidar novo membro</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
        >
          Fechar
        </Button>
      </div>
      <InviteUserFields
        onInvited={() => {
          onInvited?.()
        }}
      />
    </div>
  )
}

function InviteUserFields({ onInvited }: { onInvited?: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      nome: "",
      sobrenome: "",
      email: "",
      celular: "",
      // role intentionally omitted — no pre-selected papel (D-05)
    },
  })

  async function onSubmit(values: InviteFormValues) {
    setFormError(null)
    setSuccessMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.functions.invoke("invite-user", {
        body: values,
      })

      if (error) {
        const status = (error as { context?: Response })?.context?.status
        setFormError(status === 400 ? DUPLICATE_EMAIL_ERROR : GENERIC_ERROR)
        return
      }

      setSuccessMessage(SUCCESS_MESSAGE)
      form.reset({
        nome: "",
        sobrenome: "",
        email: "",
        celular: "",
        role: undefined,
      })
      onInvited?.()
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

        {successMessage ? (
          <div
            role="status"
            className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            {successMessage}
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input autoComplete="given-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sobrenome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sobrenome</FormLabel>
              <FormControl>
                <Input autoComplete="family-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <FormField
          control={form.control}
          name="celular"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Celular</FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Papel</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Convidando..." : "Convidar"}
        </Button>
      </form>
    </Form>
  )
}
