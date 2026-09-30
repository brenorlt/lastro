"use client";

import { Barcode, Check, Copy, CreditCard, ExternalLink, QrCode, Repeat } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { userMessage } from "@/services/api-error";
import {
  useBillingStatus,
  useCheckoutBoleto,
  useCheckoutCard,
  useCheckoutPix,
  useCheckoutSubscription,
} from "../api";

function formatTaxId(digits: string): string {
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function isValidTaxId(digits: string): boolean {
  return digits.length === 11 || digits.length === 14;
}

function PixPanel({ planPrice }: { planPrice: string }) {
  const checkout = useCheckoutPix();
  // Enquanto aguarda o pagamento, confere o status a cada 4s — o webhook da AbacatePay
  // confirma o Pix em segundos e libera o acesso automaticamente.
  useBillingStatus({ refetchInterval: checkout.data ? 4000 : false });

  if (!checkout.data) {
    return (
      <Button
        className="w-full"
        loading={checkout.isPending}
        onClick={() => checkout.mutate(undefined, { onError: (err) => toast.error(userMessage(err)) })}
      >
        Gerar Pix de {planPrice}
      </Button>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(checkout.data.brCode);
    toast.success("Código Pix copiado");
  };

  return (
    <div className="space-y-4 text-center">
      <img
        src={checkout.data.brCodeBase64}
        alt="QR Code Pix"
        className="mx-auto size-48 rounded-md ring-1 ring-line"
      />
      <p className="text-xs text-ink-3">Escaneie com o app do seu banco ou copie o código abaixo.</p>
      <Button variant="secondary" className="w-full" onClick={() => void copy()}>
        <Copy aria-hidden /> Copiar código Pix
      </Button>
      <p className="text-xs text-ink-3">Assim que o pagamento for confirmado, o acesso libera sozinho aqui.</p>
    </div>
  );
}

function BoletoPanel({ planPrice }: { planPrice: string }) {
  const checkout = useCheckoutBoleto();
  const [taxId, setTaxId] = useState("");
  // O boleto pode levar até 2 dias úteis para compensar após o pagamento.
  useBillingStatus({ refetchInterval: checkout.data ? 15000 : false });

  if (!checkout.data) {
    const digits = taxId.replace(/\D/g, "");
    return (
      <div className="space-y-3">
        <Input
          inputMode="numeric"
          placeholder="CPF ou CNPJ"
          value={taxId}
          maxLength={18}
          onChange={(e) => setTaxId(formatTaxId(e.target.value.replace(/\D/g, "").slice(0, 14)))}
          aria-label="CPF ou CNPJ"
        />
        <Button
          className="w-full"
          loading={checkout.isPending}
          disabled={!isValidTaxId(digits)}
          onClick={() =>
            checkout.mutate(digits, { onError: (err) => toast.error(userMessage(err)) })
          }
        >
          Gerar boleto de {planPrice}
        </Button>
      </div>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(checkout.data.barCode);
    toast.success("Linha digitável copiada");
  };

  return (
    <div className="space-y-4 text-center">
      <p className="break-all rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-ink-2 ring-1 ring-line">
        {checkout.data.barCode}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" className="w-full sm:w-0 sm:flex-1" onClick={() => void copy()}>
          <Copy aria-hidden /> Copiar linha digitável
        </Button>
        <a
          href={checkout.data.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-line hover:bg-surface-2 sm:w-0 sm:flex-1"
        >
          <ExternalLink aria-hidden className="size-4" /> Ver boleto
        </a>
      </div>
      <p className="text-xs text-ink-3">
        Após o pagamento, a compensação pode levar até 2 dias úteis. O acesso libera sozinho aqui.
      </p>
    </div>
  );
}

function redirect(url: string) {
  window.location.href = url;
}

export function CheckoutOptions() {
  const status = useBillingStatus();
  const [method, setMethod] = useState<"pix" | "boleto" | "card" | "subscription" | null>(null);
  const card = useCheckoutCard();
  const subscription = useCheckoutSubscription();

  const planPrice = status.data ? `R$ ${status.data.planPrice.replace(".", ",")}` : "R$ 25,00";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="relative ring-2 ring-accent">
        <Badge tone="accent" className="absolute -top-3 left-5">
          Recomendado
        </Badge>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Repeat className="size-4 text-ink-3" aria-hidden /> Cartão com recorrência
            </span>
          }
          description={`${planPrice}/mês · renova sozinho`}
        />
        <CardBody className="space-y-3">
          <ul className="space-y-1.5 text-xs text-ink-2">
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-positive" aria-hidden /> Nunca fica bloqueado por esquecimento
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-positive" aria-hidden /> Cancele quando quiser, sem multa
            </li>
          </ul>
          <Button
            className="w-full"
            // Segue "carregando" depois do sucesso: o redirect para a AbacatePay ainda vai acontecer.
            loading={subscription.isPending || (method === "subscription" && subscription.isSuccess)}
            onClick={() => {
              setMethod("subscription");
              subscription.mutate(undefined, {
                onSuccess: (data) => redirect(data.url),
                onError: (err) => toast.error(userMessage(err)),
              });
            }}
          >
            Assinar com cartão
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <CreditCard className="size-4 text-ink-3" aria-hidden /> Cartão
            </span>
          }
          description={`${planPrice} · libera 30 dias`}
        />
        <CardBody>
          <Button
            variant="secondary"
            className="w-full"
            loading={card.isPending || (method === "card" && card.isSuccess)}
            onClick={() => {
              setMethod("card");
              card.mutate(undefined, {
                onSuccess: (data) => redirect(data.url),
                onError: (err) => toast.error(userMessage(err)),
              });
            }}
          >
            Pagar com cartão
          </Button>
        </CardBody>
      </Card>

      <Card className={method === "pix" ? "ring-2 ring-accent" : undefined}>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <QrCode className="size-4 text-ink-3" aria-hidden /> Pix
            </span>
          }
          description={`${planPrice} · libera 30 dias`}
        />
        <CardBody>
          {method === "pix" ? (
            <PixPanel planPrice={planPrice} />
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setMethod("pix")}>
              Pagar com Pix
            </Button>
          )}
        </CardBody>
      </Card>

      <Card className={method === "boleto" ? "ring-2 ring-accent" : undefined}>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Barcode className="size-4 text-ink-3" aria-hidden /> Boleto
            </span>
          }
          description={`${planPrice} · libera 30 dias`}
        />
        <CardBody>
          {method === "boleto" ? (
            <BoletoPanel planPrice={planPrice} />
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setMethod("boleto")}>
              Pagar com boleto
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
