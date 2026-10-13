"use client"

import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * AltomateHR's "Launch Appraisify" button opens this app in a new tab, so
 * the AltomateHR tab is usually still open behind it — closing this tab is
 * the real "go back". window.close() is only honoured for script-opened
 * tabs, though; arriving any other way (a notification link, a bookmark)
 * it silently does nothing, so fall through to navigating to `href`. If the
 * close succeeds the page is gone and the timeout never fires.
 */
export function BackToAltomateButton({ href }: { href: string }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <a
        href={href}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
          event.preventDefault()
          window.close()
          window.setTimeout(() => {
            window.location.href = href
          }, 150)
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        <span>
          <span className="hidden sm:inline">Back to </span>AltomateHR
        </span>
      </a>
    </Button>
  )
}
