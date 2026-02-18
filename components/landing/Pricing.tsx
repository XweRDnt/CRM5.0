import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface PricingPlan {
  name: string;
  description: string;
  price: number;
  highlighted?: boolean;
  cta: { text: string; href: string };
  features: string[];
}

interface PricingProps {
  title: string;
  subtitle: string;
  plans: PricingPlan[];
}

export function Pricing({ title, subtitle, plans }: PricingProps): JSX.Element {
  return (
    <section id="pricing" className="py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">{title}</h2>
          <p className="mt-3 text-neutral-600">{subtitle}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm",
                plan.highlighted ? "border-cyan-500 ring-2 ring-cyan-100" : "",
              )}
            >
              {plan.highlighted ? (
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">Популярный</span>
              ) : null}

              <h3 className="mt-4 text-xl font-semibold text-neutral-900">{plan.name}</h3>
              <p className="mt-2 text-sm text-neutral-600">{plan.description}</p>
              <div className="mt-6 text-4xl font-bold text-neutral-900">${plan.price}</div>
              <p className="text-sm text-neutral-500">в месяц</p>

              <Button className="mt-6 w-full" variant={plan.highlighted ? "default" : "outline"} asChild>
                <Link href={plan.cta.href}>{plan.cta.text}</Link>
              </Button>

              <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-cyan-600" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

