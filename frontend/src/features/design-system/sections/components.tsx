"use client";

import { Archive, Download, Inbox, MoreHorizontal, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/finance/amount";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger, DrawerContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar, Badge, Card, CardBody, CardHeader, Kbd, Skeleton } from "@/components/ui/primitives";
import { budgetTone, Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { ListRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { budgets, recentTransactions } from "../demo-data";
import { DsExample, DsSection } from "../section";

export function ComponentsSection() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DsSection id="botoes" eyebrow="Componentes" title="Ações" description="Um botão primário por contexto. Rótulos dizem o que acontece. Ações destrutivas sempre pedem confirmação.">
        <div className="grid gap-8 md:grid-cols-2">
          <DsExample label="Variantes">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Salvar lançamento</Button>
              <Button variant="secondary">Cancelar</Button>
              <Button variant="subtle">Adicionar meta</Button>
              <Button variant="ghost">Ver todos</Button>
              <Button variant="danger">Excluir</Button>
              <Button variant="link">Saiba mais</Button>
            </div>
          </DsExample>
          <DsExample label="Tamanhos, ícone e carregamento">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm"><Plus aria-hidden /> Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
              <Button loading>Salvando</Button>
              <IconButton label="Exportar" variant="secondary"><Download /></IconButton>
            </div>
          </DsExample>
          <DsExample label="Menu de ações">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Mais ações" variant="secondary"><MoreHorizontal /></IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem><Pencil aria-hidden /> Editar <DropdownMenuShortcut>E</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuItem><Archive aria-hidden /> Arquivar</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}><Trash2 aria-hidden /> Excluir conta</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Excluir “Conta principal”?"
              description="Os 214 lançamentos desta conta também serão excluídos. Esta ação não pode ser desfeita — se quiser apenas ocultá-la, arquive."
              confirmLabel="Excluir conta"
              onConfirm={() => {
                setConfirmOpen(false);
                toast.success("Conta excluída");
              }}
            />
          </DsExample>
          <DsExample label="Feedback (toasts)">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => toast.success("Lançamento salvo", { description: "Mercado · R$ 412,80" })}>Sucesso</Button>
              <Button variant="secondary" onClick={() => toast.error("Não foi possível salvar", { description: "Verifique a data e tente novamente." })}>Erro</Button>
              <Button variant="secondary" onClick={() => toast("Lançamento excluído", { action: { label: "Desfazer", onClick: () => toast.success("Restaurado") } })}>Com desfazer</Button>
            </div>
          </DsExample>
        </div>
      </DsSection>

      <DsSection id="formularios" eyebrow="Componentes" title="Formulários" description="Rótulo sempre visível, dica abaixo do campo, erro que diz como corrigir. Teclado numérico para valores.">
        <Card className="grid gap-5 p-6 md:grid-cols-2">
          <Field label="Valor" hint="Use vírgula para os centavos.">
            <Input inputMode="decimal" placeholder="0,00" leading={<span className="text-xs font-medium">R$</span>} className="num" />
          </Field>
          <Field label="Descrição" error="Informe uma descrição com até 80 caracteres.">
            <Input defaultValue="" />
          </Field>
          <Field label="Categoria">
            <Select>
              <SelectTrigger><SelectValue placeholder="Escolha uma categoria" /></SelectTrigger>
              <SelectContent>
                {["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Buscar">
            <Input type="search" placeholder="Mercado, aluguel…" leading={<Search />} />
          </Field>
          <Field label="Observação" optional className="md:col-span-2">
            <Textarea placeholder="Visível só para você" />
          </Field>
          <label className="flex items-center justify-between gap-4 rounded-md bg-surface-sunken px-4 py-3 md:col-span-2">
            <span>
              <span className="block text-sm font-medium text-ink">Lançamento recorrente</span>
              <span className="block text-xs text-ink-3">Repetir todo mês na mesma data</span>
            </span>
            <Switch aria-label="Lançamento recorrente" defaultChecked />
          </label>
        </Card>
      </DsSection>

      <DsSection id="overlays" eyebrow="Componentes" title="Modais, drawers e tooltips" description="Modal para tarefas curtas; drawer para formulários longos e detalhes (no celular vira uma folha inferior).">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Abrir modal</Button></DialogTrigger>
            <DialogContent
              title="Transferir entre contas"
              description="O valor sai de uma conta e entra na outra no mesmo dia."
              footer={<><DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose><Button>Transferir</Button></>}
            >
              <Field label="Valor"><Input inputMode="decimal" placeholder="0,00" className="num" /></Field>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Abrir drawer</Button></DialogTrigger>
            <DrawerContent
              title="Nova despesa"
              footer={<><DialogClose asChild><Button variant="secondary" className="flex-1 sm:flex-none">Cancelar</Button></DialogClose><Button className="flex-1 sm:flex-none">Salvar despesa</Button></>}
            >
              <div className="space-y-5">
                <Field label="Valor"><Input inputMode="decimal" placeholder="0,00" className="num" /></Field>
                <Field label="Descrição"><Input /></Field>
                <Field label="Data"><Input type="date" /></Field>
              </div>
            </DrawerContent>
          </Dialog>
          <Tooltip content="Taxa de poupança = (receitas − despesas) ÷ receitas">
            <Button variant="ghost">Passe o mouse</Button>
          </Tooltip>
        </div>
      </DsSection>

      <DsSection id="dados" eyebrow="Componentes" title="Dados: tabelas, listas, progresso" description="Tabela no desktop, lista no celular — nunca uma tabela espremida. Progresso de orçamento muda de tom em 80% e 100%, sempre com número ao lado.">
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader title="Últimos lançamentos" action={<Button variant="ghost" size="sm">Ver todos</Button>} />
            <div className="hidden px-2 pb-2 pt-3 md:block">
              <Table>
                <THead><TR className="hover:bg-transparent"><TH>Descrição</TH><TH>Categoria</TH><TH>Data</TH><TH align="right">Valor</TH></TR></THead>
                <TBody>
                  {recentTransactions.map((t) => (
                    <TR key={t.id}>
                      <TD><span className="font-medium">{t.description}</span><span className="block text-xs text-ink-3">{t.account}</span></TD>
                      <TD><Badge>{t.category}</Badge></TD>
                      <TD className="text-ink-2">{formatDate(t.date)}</TD>
                      <TD align="right"><Amount value={t.amount} flow={t.flow} className="font-medium" /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="divide-y divide-line px-5 pb-2 md:hidden">
              {recentTransactions.map((t) => (
                <ListRow
                  key={t.id}
                  leading={<span className="flex size-9 items-center justify-center rounded-md bg-surface-sunken text-ink-2"><Wallet className="size-4" aria-hidden /></span>}
                  title={t.description}
                  subtitle={`${t.category} · ${formatDate(t.date, "short")}`}
                  trailing={<Amount value={t.amount} flow={t.flow} className="text-sm font-medium" />}
                />
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Orçamento de setembro" description="Alertas em 50%, 80% e 100%" />
            <CardBody className="space-y-5">
              {budgets.map((b) => {
                const pct = (b.used / b.limit) * 100;
                const tone = budgetTone(pct);
                return (
                  <div key={b.category} className="space-y-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-ink">{b.category}</span>
                      <span className="num text-xs text-ink-2">
                        {formatCurrency(b.used)} <span className="text-ink-3">de {formatCurrency(b.limit)}</span>
                      </span>
                    </div>
                    <Progress value={b.used} max={b.limit} tone={tone} label={`Orçamento de ${b.category}`} markers={[50, 80]} />
                    <p className={`num text-xs ${tone === "negative" ? "text-negative" : tone === "warning" ? "text-warning" : "text-ink-3"}`}>
                      {pct >= 100
                        ? `Excedido em ${formatCurrency(b.used - b.limit)} (${formatPercent(pct, { fractionDigits: 0 })})`
                        : `Disponível: ${formatCurrency(b.limit - b.used)} · ${formatPercent(pct, { fractionDigits: 0 })} usado`}
                    </p>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      </DsSection>

      <DsSection id="navegacao" eyebrow="Componentes" title="Navegação e identidade" description="Abas segmentadas alternam vistas do mesmo conteúdo; nunca substituem a navegação principal.">
        <div className="grid gap-8 md:grid-cols-2">
          <DsExample label="Abas (controle segmentado)">
            <Tabs defaultValue="mes">
              <TabsList>
                <TabsTrigger value="mes">Mês</TabsTrigger>
                <TabsTrigger value="tri">Trimestre</TabsTrigger>
                <TabsTrigger value="ano">12 meses</TabsTrigger>
              </TabsList>
              <TabsContent value="mes" className="pt-3 text-sm text-ink-2">Visão do mês corrente.</TabsContent>
              <TabsContent value="tri" className="pt-3 text-sm text-ink-2">Últimos três meses.</TabsContent>
              <TabsContent value="ano" className="pt-3 text-sm text-ink-2">Últimos doze meses.</TabsContent>
            </Tabs>
          </DsExample>
          <DsExample label="Breadcrumbs, badges, atalhos, avatar">
            <div className="space-y-4">
              <Breadcrumbs items={[{ label: "Patrimônio", href: "#" }, { label: "Investimentos", href: "#" }, { label: "Tesouro IPCA+ 2035" }]} />
              <div className="flex flex-wrap gap-1.5">
                <Badge>Neutro</Badge><Badge tone="accent">Agendado</Badge><Badge tone="positive">Pago</Badge>
                <Badge tone="warning">Vence em 3 dias</Badge><Badge tone="negative">Atrasado</Badge><Badge tone="brass">Patrimônio</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-2">
                <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd> Buscar</span>
                <span className="flex items-center gap-1"><Kbd>N</Kbd> Novo lançamento</span>
                <Avatar name="Marina Couto" />
              </div>
            </div>
          </DsExample>
        </div>
      </DsSection>

      <DsSection id="estados" eyebrow="Componentes" title="Carregamento, vazio e erro" description="Algo aparece imediatamente. Estados vazios explicam o que virá e convidam à próxima ação. Erros dizem o que fazer, sem jargão.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-4 p-6" aria-busy="true" aria-label="Exemplo de carregamento">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full rounded-md" />
            <div className="flex gap-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-24" /></div>
          </Card>
          <Card>
            <EmptyState
              compact
              icon={Inbox}
              title="Nenhum lançamento em setembro"
              description="Registre receitas e despesas para ver para onde vai seu dinheiro. Leva menos de 10 segundos."
              action={<Button size="sm"><Plus aria-hidden /> Novo lançamento</Button>}
            />
          </Card>
          <Card><ErrorState onRetry={() => toast("Tentando novamente…")} /></Card>
        </div>
      </DsSection>
    </>
  );
}
