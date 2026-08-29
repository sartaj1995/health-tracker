"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearIcon, HeartPulseIcon, HomeIcon, ListIcon, PlusIcon } from "./icons";

const TABS = [
  { href: "/", label: "Dashboard", Icon: HomeIcon },
  { href: "/add", label: "Add", Icon: PlusIcon },
  { href: "/history", label: "History", Icon: ListIcon },
  { href: "/settings", label: "Settings", Icon: GearIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Top bar on laptop, thumb-reachable tab bar on phone. */
export function Nav() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-30 hidden border-b border-border bg-surface/80 backdrop-blur md:block">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-6">
          <Link
            href="/"
            className="mr-6 flex min-h-11 items-center gap-2 font-semibold"
          >
            <HeartPulseIcon className="h-5 w-5 text-accent" />
            Health Tracker
          </Link>
          {TABS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors duration-200 ${
                isActive(pathname, href)
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/add"
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white transition-opacity duration-200 hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Add reading
          </Link>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 items-stretch">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors duration-200 ${
                  active ? "font-medium text-accent" : "text-muted"
                }`}
              >
                {/* The active tab is marked by an indicator bar as well as
                    colour, so the current location is not signalled by hue
                    alone (WCAG 1.4.1). */}
                <span
                  aria-hidden
                  className={`absolute top-0 h-0.5 w-10 rounded-full transition-opacity duration-200 ${
                    active ? "bg-accent opacity-100" : "opacity-0"
                  }`}
                />
                <Icon className="h-[22px] w-[22px]" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
