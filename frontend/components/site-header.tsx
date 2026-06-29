"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { WriteUnlock } from "@/components/write-unlock"

const LINKS = [
  { href: "/", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/analytics", label: "Analytics" },
  { href: "/pricing", label: "Pricing" },
  { href: "/timetravel", label: "Time travel" },
  { href: "/webhooks", label: "Webhooks" },
]

export function SiteHeader() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/") return pathname === "/" || pathname.startsWith("/customers")
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-md bg-primary"
          >
            <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            Ledgerline
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive(link.href)
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <WriteUnlock />
        </div>
      </div>
    </header>
  )
}
