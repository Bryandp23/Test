"use client";
import { useActionState, useState } from "react";
import { login, sendMagicLink, type LoginState } from "./actions";
import { Loader2 } from "lucide-react";

export function LoginForm({ next, supabase, initialError }: { next: string; supabase: boolean; initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: initialError });
  const [mState, mAction, mPending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const [magic, setMagic] = useState(false);
  const err = magic ? mState.error : state.error;
  return (
    <form action={magic ? mAction : action} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1 block text-2xs font-medium text-muted">Email</span>
        <input name="email" type="email" autoComplete="username" required className="h-9 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-accent" />
      </label>
      {!magic && (
        <label className="block">
          <span className="mb-1 block text-2xs font-medium text-muted">Mot de passe</span>
          <input name="password" type="password" autoComplete="current-password" required className="h-9 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-accent" />
        </label>
      )}
      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      {magic && mState.info && <p className="text-[12px] text-accent">{mState.info}</p>}
      <button
        disabled={pending || mPending}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent font-medium text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {(pending || mPending) && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {magic ? "Recevoir un lien de connexion" : "Se connecter"}
      </button>
      {supabase && (
        <button type="button" onClick={() => setMagic(!magic)} className="w-full text-center text-2xs text-muted hover:text-fg">
          {magic ? "Utiliser mon mot de passe" : "Recevoir un lien par email"}
        </button>
      )}
    </form>
  );
}
