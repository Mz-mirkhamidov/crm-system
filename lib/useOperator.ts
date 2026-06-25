"use client";

import { useState, useEffect } from "react";
import { type Operator } from "@/lib/session";

/**
 * Client hook returning the server-verified operator identity.
 *
 * Fetches `/api/auth/me`, which validates the Supabase Auth session on the server and
 * returns the operator's profile (id / name / phone / role). The displayed identity is
 * therefore always the one the server trusts, never a value read directly from the browser.
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
