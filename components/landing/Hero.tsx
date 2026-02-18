import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HeroProps {
  headline: string;
  subheadline: string;
  primaryCTA: { text: string; href: string };
  secondaryCTA?: { text: string; href: string };
  imageSrc?: string;
}

export function Hero({
  headline,
  subheadline,
  primaryCTA,
  secondaryCTA,
  imageSrc,
}: HeroProps): JSX.Element {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 py-20 sm:py-28">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-200/40 blur-3xl" aria-hidden="true" />

      <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">VideoFeedback</p>
          <h1 className="text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl lg:text-6xl">{headline}</h1>
          <p className="mt-5 max-w-xl text-base text-neutral-700 sm:text-lg">{subheadline}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href={primaryCTA.href}>{primaryCTA.text}</Link>
            </Button>
            {secondaryCTA ? (
              <Button variant="outline" asChild>
                <Link href={secondaryCTA.href}>
                  <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  {secondaryCTA.text}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-xl">
            {imageSrc ? (
              <img src={imageSrc} alt="Интерфейс VideoFeedback" className="h-full w-full object-cover" />
            ) : (
              <div className="grid min-h-72 place-items-center bg-gradient-to-br from-cyan-100 to-emerald-100 p-10">
                <div className="w-full max-w-sm rounded-xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
                  <p className="text-sm font-medium text-neutral-900">Новый фидбек от клиента</p>
                  <p className="mt-2 text-sm text-neutral-700">"Сделайте вступление динамичнее и добавьте субтитры"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

