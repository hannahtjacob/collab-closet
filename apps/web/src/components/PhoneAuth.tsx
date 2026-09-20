"use client";

import { FormEvent, useState } from "react";
import { confirmCode, formatPhone, normalizePhone, sendCode } from "@/lib/auth";

type Props = {
  onClose: () => void;
  onSignedIn?: () => void;
};

export function PhoneAuthDialog({ onClose, onSignedIn }: Props) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setError("Enter a valid phone number, e.g. (617) 555-0134.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendCode(normalized);
      setPhone(normalized);
      setStep("code");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Couldn't send that code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim().length < 4) {
      setError("Enter the code we texted you.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await confirmCode(phone, code.trim(), name);
      onSignedIn?.();
      onClose();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "That code didn't work.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={onClose}>
      <div className="auth-dialog" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">Your closet, anywhere</p>
        <h2 id="auth-title">{step === "phone" ? "Sign in with your phone" : "Enter your code"}</h2>

        {step === "phone" ? (
          <form onSubmit={handleSend} className="auth-form">
            <p className="auth-copy">We&apos;ll text you a one-time code. No password, no email.</p>
            <label htmlFor="auth-phone">Phone number</label>
            <input
              id="auth-phone"
              type="tel"
              autoComplete="tel"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              placeholder="(617) 555-0134"
            />
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Sending…" : "Send code"} <span aria-hidden="true">→</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="auth-form">
            <p className="auth-copy">Sent to {formatPhone(phone)}.</p>
            <label htmlFor="auth-code">6-digit code</label>
            <input
              id="auth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
            <label htmlFor="auth-name">Display name</label>
            <input
              id="auth-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="How friends know you"
            />
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Verifying…" : "Verify"} <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="text-button auth-secondary"
              onClick={() => { setStep("phone"); setCode(""); setError(""); }}
            >
              Use a different number
            </button>
          </form>
        )}

        {error && <p className="form-notice" role="alert">{error}</p>}
      </div>
    </div>
  );
}
