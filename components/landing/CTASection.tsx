import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CTASectionProps {
  title: string;
  description: string;
  primaryCTA: { text: string; href: string };
}

export function CTASection({ title, description, primaryCTA }: CTASectionProps): JSX.Element {
  return (
    <section id="cta" className="py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="rounded-3xl bg-gradient-to-r from-cyan-600 to-emerald-500 p-8 text-white shadow-xl sm:p-12">
          <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-cyan-50">{description}</p>
          <Button className="mt-7 bg-white text-cyan-700 hover:bg-cyan-50" asChild>
            <Link href={primaryCTA.href}>{primaryCTA.text}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

