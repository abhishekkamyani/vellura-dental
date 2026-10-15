"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { useActionState, useState } from "react";
import { login, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <motion.form
      action={formAction}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="you@velluradental.com"
          className="h-12 rounded-xl bg-white px-4 text-base tracking-wide md:text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-12 rounded-xl bg-white px-4 pr-12 text-base tracking-wide md:text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:text-vellura-cyan focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm tracking-wide text-rose-700">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-1 h-12 rounded-full text-sm tracking-[0.14em] uppercase shadow-soft hover:bg-vellura-deep"
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LockKeyhole aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </motion.form>
  );
}
