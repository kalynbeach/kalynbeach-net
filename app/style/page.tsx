import SitePageHeader from "@/components/site/site-page-header";
import { Button } from "@/components/ui/button";

export default function Style() {
  return (
    <div className="w-full flex flex-col items-start justify-start gap-4">
      <SitePageHeader title="style" />
      <main className="flex flex-col items-start justify-start gap-4 font-mono">
        {/* TODO: build typography section */}
        {/* <section className="flex flex-col items-start justify-start gap-4">
          <h2 className="font-mono text-xl font-bold">Typography</h2>
          <div className="flex gap-2"></div>
        </section> */}

        {/* TODO: build colors section */}
        {/* <section className="flex flex-col items-start justify-start gap-4">
          <h2 className="font-mono text-xl font-bold">Colors</h2>
          <div className="flex gap-2"></div>
        </section> */}

        {/* TODO: continue building components section */}
        <section className="flex flex-col items-start justify-start gap-4">
          <h2 className="font-mono text-xl font-bold">Components</h2>
          <h3 className="font-mono text-lg font-semibold">Button</h3>
          <div className="flex flex-row flex-wrap gap-2">
            <Button>default</Button>
            <Button variant="secondary">secondary</Button>
            <Button variant="outline">outline</Button>
            <Button variant="destructive">destructive</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="link">link</Button>
          </div>
          <div className="flex flex-row flex-wrap gap-2">
            <Button size="sm">sm</Button>
            <Button>default</Button>
            <Button size="lg">lg</Button>
            <Button size="icon">icon</Button>
          </div>
        </section>
      </main>
    </div>
  );
}