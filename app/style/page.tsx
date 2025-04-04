import SitePageHeader from "@/components/site/site-page-header";
import { Button } from "@/components/ui/button";

export default function Style() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="style" />
      <main className="flex flex-col items-start justify-start gap-4">
        <section className="flex flex-col items-start justify-start gap-4">
          <h2 className="text-2xl font-bold">Typography</h2>
          <div className="flex gap-2"></div>
        </section>
        <section className="flex flex-col items-start justify-start gap-4">
          <h2 className="text-2xl font-bold">Components</h2>
          <div className="flex gap-2">
            <Button>default</Button>
            <Button variant="secondary">secondary</Button>
            <Button variant="outline">outline</Button>
            <Button variant="destructive">destructive</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="link">link</Button>
          </div>
        </section>
      </main>
    </div>
  );
}