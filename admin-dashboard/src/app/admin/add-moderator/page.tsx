"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "phone" | "otp" | "done";

export default function AddModeratorPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const sendOtp = useCallback(async () => {
    setError(null);
    const p = phone.trim();
    if (!p || p.length < 10) {
      setError("Enter a valid phone number in international format (e.g. +919876543210).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/moderator/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to send OTP.");
        return;
      }
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const createModerator = useCallback(async () => {
    setError(null);
    const p = phone.trim();
    const o = otp.trim();
    const n = name.trim();
    if (!o || o.length < 4) {
      setError("Enter the OTP sent to the phone.");
      return;
    }
    if (!n) {
      setError("Enter the moderator's name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/moderator/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p, otp: o, name: n }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to create moderator.");
        return;
      }
      setSuccessMsg(json.message ?? "Moderator created successfully.");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }, [phone, otp, name]);

  const reset = () => {
    setStep("phone");
    setPhone("+91");
    setOtp("");
    setName("");
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-[#111827]">Add Moderator</h1>
      <p className="mt-1 text-sm text-[#6b7280]">
        Create a new moderator account. The phone number will be verified via OTP before the account is created.
      </p>

      <div className="mt-8 rounded-xl border border-[#e5e7eb] bg-white p-6">
        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          <StepDot active={step === "phone"} done={step === "otp" || step === "done"} label="1" />
          <div className="h-px flex-1 bg-[#e5e7eb]" />
          <StepDot active={step === "otp"} done={step === "done"} label="2" />
          <div className="h-px flex-1 bg-[#e5e7eb]" />
          <StepDot active={step === "done"} done={false} label="3" />
        </div>

        {step === "phone" && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void sendOtp();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border-[#e5e7eb]"
              />
              <p className="text-xs text-[#9ca3af]">
                International format with country code (e.g. +91 for India).
              </p>
            </div>
            {error && <ErrorBox message={error} />}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111827] text-white hover:bg-[#111827]/90"
            >
              {loading ? "Sending OTP…" : "Send OTP"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void createModerator();
            }}
          >
            <div className="rounded-lg bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
              OTP sent to <span className="font-semibold">{phone}</span>. Ask the person to share the code.
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">OTP Code</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="border-[#e5e7eb] text-center text-lg tracking-widest"
                maxLength={6}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-name">Moderator name</Label>
              <Input
                id="mod-name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-[#e5e7eb]"
              />
            </div>

            {error && <ErrorBox message={error} />}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[#e5e7eb]"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                  setOtp("");
                }}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#111827] text-white hover:bg-[#111827]/90"
              >
                {loading ? "Creating…" : "Verify & Create"}
              </Button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d1fae5]">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm font-medium text-[#111827]">{successMsg}</p>
            <p className="text-xs text-[#6b7280]">
              The moderator can now log in to the mobile app with this phone number via OTP.
              To access the admin dashboard they need email/password credentials set up separately.
            </p>
            <Button
              type="button"
              className="w-full bg-[#111827] text-white hover:bg-[#111827]/90"
              onClick={reset}
            >
              Add another moderator
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
        done
          ? "bg-[#111827] text-white"
          : active
            ? "border-2 border-[#111827] text-[#111827]"
            : "border border-[#d1d5db] text-[#9ca3af]"
      }`}
    >
      {done ? "✓" : label}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
      {message}
    </div>
  );
}
