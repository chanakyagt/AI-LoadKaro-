"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Submission = {
  id: string;
  status: string;
  review_decision: string | null;
  created_at: string;
};

type DocRow = {
  id: string;
  doc_key: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  bucket: string;
  path: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  entityType: "user" | "truck";
  entityId: string;
  onDecisionMade?: () => void;
};

function formatBytes(b: number | null): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function VerificationDocsModal({
  open,
  onClose,
  entityType,
  entityId,
  onDecisionMade,
}: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/verification/submissions?entity_type=${entityType}&entity_id=${entityId}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load submissions");
      setSubmissions(json.data ?? []);
      if (json.data?.length > 0) {
        setSelectedSub(json.data[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (open && entityId) {
      setSelectedSub(null);
      setDocs([]);
      setShowRejectInput(false);
      setRejectReason("");
      void fetchSubmissions();
    }
  }, [open, entityId, fetchSubmissions]);

  const fetchDocs = useCallback(async (submissionId: string) => {
    setDocsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/verification/documents?submission_id=${submissionId}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load documents");
      setDocs(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSub?.id) {
      void fetchDocs(selectedSub.id);
    }
  }, [selectedSub, fetchDocs]);

  const viewDoc = useCallback(async (doc: DocRow) => {
    try {
      const res = await fetch("/api/admin/verification/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: doc.bucket, path: doc.path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get URL");
      window.open(json.signedUrl, "_blank", "noopener");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not open document");
    }
  }, []);

  const submitDecision = useCallback(
    async (decision: "verified" | "rejected") => {
      if (!selectedSub) return;
      setDeciding(true);
      try {
        const res = await fetch("/api/admin/verification/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            submission_id: selectedSub.id,
            decision,
            reason: decision === "rejected" ? rejectReason : undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Decision failed");
        onDecisionMade?.();
        onClose();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Decision failed");
      } finally {
        setDeciding(false);
      }
    },
    [selectedSub, entityType, entityId, rejectReason, onDecisionMade, onClose]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verification documents</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Loading submissions…</p>
        ) : submissions.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No verification documents have been submitted yet.
          </p>
        ) : (
          <>
            {submissions.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Submission</Label>
                <select
                  className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"
                  value={selectedSub?.id ?? ""}
                  onChange={(e) => {
                    const sub = submissions.find((s) => s.id === e.target.value);
                    if (sub) setSelectedSub(sub);
                  }}
                >
                  {submissions.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      #{submissions.length - i} — {formatDate(s.created_at)} (
                      {s.review_decision ?? s.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedSub && (
              <div className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                <p>
                  <span className="font-medium">Submitted:</span>{" "}
                  {formatDate(selectedSub.created_at)}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  {selectedSub.review_decision ?? selectedSub.status}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Documents</Label>
              {docsLoading ? (
                <p className="text-center text-sm text-gray-400">Loading…</p>
              ) : docs.length === 0 ? (
                <p className="text-center text-sm text-gray-400">No documents in this submission.</p>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {doc.doc_key.replace(/_/g, " ")}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {doc.original_filename ?? "—"} · {formatBytes(doc.size_bytes)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void viewDoc(doc)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedSub?.status === "submitted" && (
              <>
                {showRejectInput && (
                  <div className="space-y-1">
                    <Label className="text-xs">Rejection reason (optional)</Label>
                    <Input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter reason…"
                      className="border-gray-200"
                    />
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  {showRejectInput ? (
                    <Button
                      variant="destructive"
                      disabled={deciding}
                      onClick={() => void submitDecision("rejected")}
                    >
                      Confirm reject
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      disabled={deciding}
                      onClick={() => setShowRejectInput(true)}
                    >
                      Reject
                    </Button>
                  )}
                  <Button
                    disabled={deciding}
                    onClick={() => void submitDecision("verified")}
                  >
                    Approve
                  </Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
