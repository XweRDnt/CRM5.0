interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  title: string;
  subtitle: string;
  items: FAQItem[];
}

export function FAQ({ title, subtitle, items }: FAQProps): JSX.Element {
  return (
    <section id="faq" className="bg-neutral-50 py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">{title}</h2>
          <p className="mt-3 text-neutral-600">{subtitle}</p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-4">
          {items.map((item) => (
            <details key={item.question} className="rounded-xl border border-neutral-200 bg-white p-5">
              <summary className="cursor-pointer list-none text-left font-semibold text-neutral-900">{item.question}</summary>
              <p className="mt-3 text-sm leading-6 text-neutral-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

