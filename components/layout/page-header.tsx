import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function PageHeader({ title, description, actions, breadcrumbs, className }: PageHeaderProps): JSX.Element {
  return (
    <div className={cn("border-b border-neutral-200 bg-white px-6 py-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center text-sm text-neutral-600">
          {breadcrumbs.map((item, index) => (
            <span key={`${item.label}-${index}`} className="inline-flex items-center">
              {item.href ? (
                <Link href={item.href} className="hover:text-neutral-900 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="text-neutral-700">{item.label}</span>
              )}
              {index < breadcrumbs.length - 1 ? <span className="mx-2 text-neutral-400">/</span> : null}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
        </div>
        {actions ? <div className="md:ml-4">{actions}</div> : null}
      </div>
    </div>
  );
}
