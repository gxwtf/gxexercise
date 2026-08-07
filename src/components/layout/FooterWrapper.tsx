"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

const HIDDEN_PATTERNS = [
  /^\/question\/[^/]+$/,
  /^\/question\/[^/]+\/review/,
  /^\/test-paper\/[^/]+$/,
  /^\/test-paper\/[^/]+\/practice/,
  /^\/test-paper\/[^/]+\/result/,
];

export default function FooterWrapper() {
  const pathname = usePathname();

  if (HIDDEN_PATTERNS.some((p) => p.test(pathname))) {
    return null;
  }

  return <Footer />;
}