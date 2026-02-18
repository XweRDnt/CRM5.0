interface HowItWorksStep {
  title: string;
  description: string;
}

interface HowItWorksProps {
  title: string;
  subtitle: string;
  steps: HowItWorksStep[];
}

export function HowItWorks({ title, subtitle, steps }: HowItWorksProps): JSX.Element {
  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">{title}</h2>
          <p className="mt-3 text-neutral-600">{subtitle}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-neutral-900">{step.title}</h3>
              <p className="mt-2 text-sm text-neutral-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

