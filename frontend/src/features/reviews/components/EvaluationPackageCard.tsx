import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api/client";
import { reviewsApi, type EvaluationPackage } from "../services/reviews.api";

export function EvaluationPackageCard({
  employeeId,
  canDecide = false,
  canApproveFinal = false,
  hideScores = false,
  showFullDetail = false,
}: {
  employeeId: string;
  canDecide?: boolean;
  canApproveFinal?: boolean;
  hideScores?: boolean;
  showFullDetail?: boolean;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["evaluation", employeeId],
    queryFn: async () => (await reviewsApi.getPackage(employeeId)).evaluation,
  });
  const [decision, setDecision] = useState<"APPROVED" | "DECLINED">("APPROVED");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: async () => (await reviewsApi.decide(employeeId, { decision, comment })).package,
    onSuccess: (evaluation) => {
      client.setQueryData(["evaluation", employeeId], evaluation);
      setMessage("Supervisor review sent to the employee and HR.");
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to save the supervisor review."),
  });
  const approve = useMutation({
    mutationFn: async () => (await reviewsApi.approveFinal(employeeId)).evaluation,
    onSuccess: (evaluation) => {
      client.setQueryData(["evaluation", employeeId], evaluation);
      setMessage("Final evaluation approved.");
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Unable to approve the evaluation."),
  });

  if (query.isLoading) return <p className="text-sm text-stone-500">Loading evaluation package...</p>;
  if (query.isError || !query.data) return <p className="text-sm text-rose-700">Unable to load the evaluation package.</p>;
  const data = query.data;

  return (
    <section className="mb-5 space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">Evaluation package</p>
          <h2 className="text-xl font-semibold">{data.employee.name}</h2>
          <p className="text-sm text-stone-500">
            {data.employee.employeeId} · {data.employee.department} · {data.employee.team}
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">{data.status}</span>
      </div>

      {hideScores ? null : <ScoreGrid data={data} />}

      {hideScores ? (
        <Info
          label="Supervisor review"
          value={`${data.supervisorReview.decision}${data.supervisorReview.comment ? ` — ${data.supervisorReview.comment}` : ""}`}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <Info label="Self review" value={`${data.selfReview.score.toFixed(2)} / 20 · ${data.selfReview.status}`} />
          <Info label="Peer review" value={`${data.peerReview.score.toFixed(2)} / 20 · ${data.peerReview.status}`} />
          <Info
            label="Supervisor review"
            value={`${data.supervisorReview.decision}${data.supervisorReview.comment ? ` — ${data.supervisorReview.comment}` : ""}`}
          />
        </div>
      )}

      {showFullDetail && data.selfReview.responses && data.selfReview.responses.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Self Review answers</p>
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {data.selfReview.responses.map((response) => (
              <li key={response.question} className="rounded-xl border border-stone-100 px-3 py-2 text-sm">
                <p className="font-medium">{response.question}</p>
                <p className="text-stone-600">
                  Rating {response.rating ?? "—"} · {response.score.toFixed(2)}
                </p>
                {response.reason ? <p className="text-stone-500">{response.reason}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hideScores && data.peerReview.reviewers.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Peer review detail</p>
          <ul className="mt-2 space-y-2">
            {data.peerReview.reviewers.map((reviewer) => (
              <li key={reviewer.employeeId} className="rounded-xl border border-stone-100 px-3 py-2 text-sm">
                <p className="font-medium">
                  {reviewer.name} · {reviewer.employeeId} · {reviewer.score.toFixed(2)} / 10 · {reviewer.status}
                </p>
                {reviewer.comment ? <p className="text-stone-600">{reviewer.comment}</p> : null}
                {showFullDetail
                  ? reviewer.responses.map((response) => (
                      <p key={response.question} className="mt-1 text-xs text-stone-500">
                        {response.question} — {response.rating ?? "—"} ({response.score.toFixed(2)}) {response.reason}
                      </p>
                    ))
                  : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-sm text-stone-500">
        PDP evidence items: {data.pdp?.evidenceCount ?? 0}. Pending sub-goal approvals: {data.pdp?.pendingReviews ?? 0}.
      </p>

      {canDecide ? (
        <div className="rounded-xl border border-stone-200 p-3">
          <p className="text-sm font-semibold">Supervisor decision</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant={decision === "APPROVED" ? "default" : "outline"} onClick={() => setDecision("APPROVED")}>
              Approve
            </Button>
            <Button type="button" variant={decision === "DECLINED" ? "default" : "outline"} onClick={() => setDecision("DECLINED")}>
              Decline
            </Button>
          </div>
          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            placeholder="Write the review comment that will be sent to the employee and HR."
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <Button
            type="button"
            className="mt-3 bg-amber-400 text-stone-900 hover:bg-amber-300"
            disabled={decide.isPending || comment.trim().length < 8}
            onClick={() => decide.mutate()}
          >
            {decide.isPending
              ? "Saving..."
              : decision === "APPROVED"
                ? "Approve PDP / Supervisor Review"
                : "Decline supervisor review"}
          </Button>
        </div>
      ) : null}

      {canApproveFinal && data.finalApproval.status !== "FINAL_APPROVED" ? (
        <Button type="button" className="bg-stone-900 text-white hover:bg-stone-800" disabled={approve.isPending} onClick={() => approve.mutate()}>
          {approve.isPending ? "Approving..." : "Approve Final Appraisal"}
        </Button>
      ) : null}
      {data.finalApproval.status === "FINAL_APPROVED" ? (
        <p className="text-sm font-medium text-emerald-800">Final Approved</p>
      ) : null}
      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </section>
  );
}

function ScoreGrid({ data }: { data: EvaluationPackage }) {
  const items = [
    ["Self review", `${data.scores.self.toFixed(2)} / 20`],
    ["Peer review", `${data.scores.peer.toFixed(2)} / 20`],
    ["Supervisor / PDP", `${data.scores.supervisorPdp.toFixed(2)} / 60`],
    ["Final score", `${data.scores.total.toFixed(2)} / 100`],
    ["Performance band", data.scores.band],
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-stone-50 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
          <p className="mt-1 font-semibold text-stone-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-100 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm text-stone-800">{value}</p>
    </div>
  );
}
