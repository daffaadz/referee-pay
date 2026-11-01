import { CreateDealForm } from "@/components/CreateDealForm";

export default function HomePage() {
  return (
    <main className="flex-1 min-h-0 md:h-full md:overflow-hidden flex flex-col bg-bg">
      <CreateDealForm />
    </main>
  );
}
