"use client";

import { Card } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <ErrorState
        title="Algo não saiu como esperado"
        description="Não conseguimos exibir esta tela agora. Seus dados não foram afetados."
        onRetry={reset}
      />
    </Card>
  );
}
