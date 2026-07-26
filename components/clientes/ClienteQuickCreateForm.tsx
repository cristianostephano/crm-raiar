"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { createCliente } from "@/app/actions/clientes"
import { Button } from "@/components/ui/button"
import { EstadoCidadeFields } from "@/components/clientes/EstadoCidadeFields"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import type { Uf } from "@/lib/clientes/ufs"
import {
  createClienteSchema,
  type CreateClienteInput,
} from "@/lib/validations/cliente"

const DUPLICATE_RAZAO_SOCIAL_ERROR =
  "Já existe um cliente cadastrado com essa razão social."
const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."
const SUCCESS_MESSAGE = "Cliente cadastrado com sucesso."
const HELPER_CAPTION =
  "Você pode completar os demais dados depois, na tela do cliente."

export type TeamMember = {
  id: string
  nome: string
  sobrenome: string
}

/**
 * "Novo cliente" quick-create Dialog (CLI-01/CLI-02/CLI-03/FUN-01). Only the
 * 3 required-field groups are rendered — razão social, endereço, responsável
 * — everything else is filled in later from the client detail screen (D-01).
 */
export function ClienteQuickCreateForm({
  currentUserId,
  currentUserName,
  isSupervisor,
  teamMembers,
}: {
  currentUserId: string
  currentUserName: string
  isSupervisor: boolean
  teamMembers: TeamMember[]
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button>Novo cliente</Button>} />
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <ClienteQuickCreateFields
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isSupervisor={isSupervisor}
          teamMembers={teamMembers}
          onCreated={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ClienteQuickCreateFields({
  currentUserId,
  currentUserName,
  isSupervisor,
  teamMembers,
  onCreated,
}: {
  currentUserId: string
  currentUserName: string
  isSupervisor: boolean
  teamMembers: TeamMember[]
  onCreated: () => void
}) {
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const defaultValues: CreateClienteInput = {
    razaoSocial: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    cidade: "",
    // "" is overwritten as soon as the user picks a UF via the Select
    // landing in 09-05; cast needed only because estado: z.enum(UFS)
    // narrows the type to Uf (09-03/LOC-01) — no valid empty-string UF.
    estado: "" as Uf,
    // Vendedor: pre-filled with own uid, rendered disabled below (CLI-04).
    // Supervisor: "" — no default responsável pre-selected, mirroring
    // InviteUserForm's D-05 controlled-Select-from-mount pattern (CLI-03).
    responsavel: isSupervisor ? "" : currentUserId,
  }

  const form = useForm<CreateClienteInput>({
    resolver: zodResolver(createClienteSchema),
    defaultValues,
  })

  async function onSubmit(values: CreateClienteInput) {
    setFormError(null)
    setSuccessMessage(null)

    try {
      const result = await createCliente(values)

      if (result.error) {
        setFormError(
          result.error.code === "duplicate_razao_social"
            ? DUPLICATE_RAZAO_SOCIAL_ERROR
            : GENERIC_ERROR
        )
        return
      }

      setSuccessMessage(SUCCESS_MESSAGE)
      form.reset(defaultValues)
      onCreated()
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
          name="razaoSocial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Razão social</FormLabel>
              <FormControl>
                <Input autoComplete="organization" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="cep"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input autoComplete="postal-code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="numero"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="rua"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rua</FormLabel>
              <FormControl>
                <Input autoComplete="address-line1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <EstadoCidadeFields
          control={form.control}
          watch={form.watch}
          setValue={form.setValue}
        />

        <FormField
          control={form.control}
          name="responsavel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responsável</FormLabel>
              {isSupervisor ? (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.nome} {member.sobrenome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <Input value={currentUserName} disabled readOnly />
                </FormControl>
              )}
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
            ? "Cadastrando..."
            : "Cadastrar cliente"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {HELPER_CAPTION}
        </p>
      </form>
    </Form>
  )
}
