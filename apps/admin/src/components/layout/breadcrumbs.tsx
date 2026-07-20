'use client';

import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { NAV_SECTIONS } from './nav-config';

/** Derives "Section / Page" straight from the same NAV_SECTIONS data the sidebar renders — never a per-page hardcoded title to keep in sync. */
export function Breadcrumbs() {
  const pathname = usePathname();

  for (const section of NAV_SECTIONS) {
    const item = section.items.find(
      (candidate) => pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
    );
    if (item) {
      return (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">{section.title}</BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{item.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      );
    }
  }

  return null;
}
