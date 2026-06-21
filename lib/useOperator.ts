"use client";

import { useState, useEffect } from "react";
import { type Operator } from "@/lib/session";

/**
 * Client hook returning the SERVER-VERIFIED operator identity.
 *
 * The `crm_op_session` cookie is HttpOnly and cannot be read from the browser, so this
 * fetches `/api/auth/me`, which verifies the signed session server-side via
 * `verifySession`. The displayed identity is therefore always the one the server trusts —
 * never a client-decoded cookie (design Fix Implementation change 4).
 */
export function useOperator(): Operator | null {
  const [operator, setOperator] = useState<Operator | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Operator | null) => {
        if (active) setOperator(data);
      })
      .catch(() => {
        if (active) setOperator(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return operator;
}
