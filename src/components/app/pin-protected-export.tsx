"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

const OWNER_PROFIT_PIN = "2027";

function askForPin() {
  const value = window.prompt("Enter owner PIN to generate this profit report.");
  if (value === OWNER_PROFIT_PIN) return value;
  if (value !== null) window.alert("Incorrect owner PIN.");
  return "";
}

export function PinProtectedExportLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        const pin = askForPin();
        if (!pin) {
          event.preventDefault();
          return;
        }
        const nextHref = new URL(href, window.location.origin);
        nextHref.searchParams.set("ownerPin", pin);
        event.currentTarget.href = nextHref.toString();
      }}
    >
      {children}
    </a>
  );
}

export function PinProtectedSubmitButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        const pin = askForPin();
        if (!pin) {
          event.preventDefault();
          return;
        }
        const form = event.currentTarget.form;
        if (!form) return;
        let input = form.querySelector<HTMLInputElement>('input[name="ownerPin"]');
        if (!input) {
          input = document.createElement("input");
          input.type = "hidden";
          input.name = "ownerPin";
          form.appendChild(input);
        }
        input.value = pin;
      }}
    >
      {children}
    </button>
  );
}
