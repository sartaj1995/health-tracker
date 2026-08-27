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
          <Link href="/" className="mr-6 flex items-center gap-2 font-semibold">
            <HeartPulseIcon className="h-5 w-5 text-accent" />
            Health Tracker
          </Link>
          {TABS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                isActive(pathname, href)
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-text"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/add"
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
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
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
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
