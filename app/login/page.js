"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaving(false);
        setError(data.error || "Could not log in");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setSaving(false);
      setError("Could not reach the server. Check your internet connection and try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      >
        <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Besttt Hisaab</h1>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Enter your username and password to continue.</p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
          className="mb-4 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
        />

        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
        />

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Checking..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
