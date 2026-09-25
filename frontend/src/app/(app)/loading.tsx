import { Card, Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <Skeleton className="mb-3 h-8 w-48" />
      <Skeleton className="mb-10 h-4 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-4 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </Card>
        ))}
      </div>
      <Card className="mt-4 p-6">
        <Skeleton className="h-56 w-full rounded-md" />
      </Card>
    </div>
  );
}
