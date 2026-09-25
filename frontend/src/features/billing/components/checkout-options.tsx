"use client";

import { Check, Copy, CreditCard, QrCode, Repeat } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { userMessage } from "@/services/api-error";
import { useBillingStatus, useCheckoutCard, useCheckoutPix, useCheckoutSubscription } from "../api";

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

function redirect(url: string) {
  window.location.href = url;
}

export function CheckoutOptions() {
  const status = useBillingStatus();
  const [method, setMethod] = useState<"pix" | "card" | "subscription" | null>(null);
  const card = useCheckoutCard();
  const subscription = useCheckoutSubscription();

  const planPrice = status.data ? `R$ ${status.data.planPrice.replace(".", ",")}` : "R$ 25,00";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
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
            loading={card.isPending}
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
              <Check className="size-3.5 shrink-0 text-positive" aria-hidden /> Nunca mais fica bloqueado por esquecimento
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-positive" aria-hidden /> Cancele quando quiser, sem multa
            </li>
          </ul>
          <Button
            className="w-full"
            loading={subscription.isPending}
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
    </div>
  );
}
