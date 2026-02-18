import { Card, CardContent } from "@/components/ui/card";

export interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FeaturesProps {
  title: string;
  subtitle: string;
  features: Feature[];
}

export function Features({ title, subtitle, features }: FeaturesProps): JSX.Element {
  return (
    <section id="features" className="py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">{title}</h2>
          <p className="mt-3 text-neutral-600">{subtitle}</p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-neutral-200 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

