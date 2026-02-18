import Link from "next/link";

interface FooterLinkGroup {
  title: string;
  links: Array<{ label: string; href: string }>;
}

interface FooterProps {
  brandName: string;
  description: string;
  linkGroups: FooterLinkGroup[];
}

export function Footer({ brandName, description, linkGroups }: FooterProps): JSX.Element {
  return (
    <footer className="bg-neutral-900 py-12 text-neutral-300">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <p className="text-xl font-semibold text-white">{brandName}</p>
            <p className="mt-3 text-sm text-neutral-400">{description}</p>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{group.title}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link className="text-neutral-400 transition-colors hover:text-white" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-neutral-800 pt-6 text-sm text-neutral-500">
          © 2026 VideoFeedback. Все права защищены.
        </div>
      </div>
    </footer>
  );
}

