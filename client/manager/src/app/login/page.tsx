"use client";

import { LoginFormCard } from "./components/LoginFormCard";

export default function LoginPage() {
  return (
    <main className="manager-login-shell">
      <section className="manager-login-panel">
        <LoginFormCard />
      </section>
    </main>
  );
}
