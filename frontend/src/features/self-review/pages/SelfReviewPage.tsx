import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { formatShortDate } from "@/features/hr/utils/dates";
import { ApiClientError } from "@/services/api/client";
import {
  liveSelfReviewScore,
  RATING_OPTIONS,
  selfReviewApi,
  type SelfReviewResponse,
} from "../services/selfReview.api";

function isComplete(response: SelfReviewResponse) {
  return Boolean(
    response.rating &&
      response.reason.trim() &&
      (!response.evidenceRequired || response.evidenceFiles.length > 0)
  );
}

export default function SelfReviewPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["self-review", "mine"],
    queryFn: async () => (await selfReviewApi.getMine()).selfReview,
  });
  const [responses, setResponses] = useState<SelfReviewResponse[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data?.review) setResponses(query.data.review.responses);
  }, [query.data]);

  const upload = useMutation({
    mutationFn: async (args: { questionKey: string; file: File }) =>
      (await selfReviewApi.uploadEvidence(args.questionKey, args.file)).selfReview,
    onSuccess: (payload) => {
      client.setQueryData(["self-review", "mine"], payload);
      if (payload.review) setResponses(payload.review.responses);
    },
  });

  const submit = useMutation({
    mutationFn: async (next: SelfReviewResponse[]) => {
      await selfReviewApi.save(
        next.map((response) => ({
          questionKey: response.questionKey,
          rating: response.rating,
          reason: response.reason,
        }))
      );
      return (await selfReviewApi.submit()).selfReview;
    },
    onSuccess: (payload) => {
      client.setQueryData(["self-review", "mine"], payload);
      if (payload.review) setResponses(payload.review.responses);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(error instanceof ApiClientError ? error.message : "Unable to submit the self review.");
    },
  });

  const score = useMemo(() => liveSelfReviewScore(responses), [responses]);
  const completed = responses.filter(isComplete).length;
  const ready = responses.length === 20 && responses.every(isComplete);
  const data = query.data;
  const submitted = data?.review?.status === "SUBMITTED";

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !data ? (
        <DashboardError message="Unable to load your self review." />
      ) : (
        <div className="mx-auto max-w-4xl space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Self Review</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Self Review</h1>
            <p className="mt-1 text-sm text-stone-500">Appraisal Cycle: {data.cycle.name}</p>
            <p className="text-sm text-stone-500">PDP Period: {data.periodLabel}</p>
          </div>

          {!data.available ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
              <p className="text-lg font-semibold">Self Review Not Available</p>
              <p className="mt-2 text-sm">{data.unavailableReason}</p>
              <p className="mt-4 text-sm">
                PDP Period: <span className="font-medium">{data.periodLabel}</span>
              </p>
              <p className="mt-1 text-sm font-medium">Status: Not Available</p>
            </section>
          ) : submitted && data.review ? (
            <SubmittedReview
              cycleName={data.cycle.name}
              periodLabel={data.periodLabel}
              responses={data.review.responses}
              totalScore={data.review.totalScore}
              percentage={data.review.percentage}
              submittedAt={data.review.submittedAt}
            />
          ) : (
            <>
              <section className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-700">
                      {completed} / 20 Completed
                    </p>
                    <p className="mt-1 text-xs text-stone-400">20 Questions · maximum 20 marks</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-stone-400">Self Review Score</p>
                    <p className="text-2xl font-semibold text-stone-900">
                      {score.totalScore.toFixed(2)} / 20
                    </p>
                    <p className="text-sm text-stone-500">{score.percentage}%</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${(completed / 20) * 100}%` }} />
                </div>
              </section>

              <div className="space-y-4">
                {responses.map((response) => {
                  const missingReason = response.rating != null && !response.reason.trim();
                  const missingEvidence = response.evidenceRequired && response.evidenceFiles.length === 0;
                  return (
                    <section key={response.questionKey} className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Question {response.sortOrder}
                      </p>
                      <h2 className="mt-1 font-medium text-stone-900">{response.question}</h2>
                      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-stone-400">
                        Rating
                        <select
                          className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800"
                          value={response.rating ?? ""}
                          onChange={(event) => {
                            const rating = event.target.value ? Number(event.target.value) : null;
                            setResponses((current) =>
                              current.map((item) =>
                                item.questionKey === response.questionKey ? { ...item, rating } : item
                              )
                            );
                          }}
                        >
                          <option value="">Select a rating</option>
                          {RATING_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-stone-400">
                        Reason
                        <textarea
                          className="mt-1 min-h-24 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800"
                          value={response.reason}
                          placeholder="Explain the work that supports this rating."
                          onChange={(event) => {
                            const reason = event.target.value;
                            setResponses((current) =>
                              current.map((item) =>
                                item.questionKey === response.questionKey ? { ...item, reason } : item
                              )
                            );
                          }}
                        />
                      </label>
                      {missingReason ? (
                        <p className="mt-1 text-xs text-rose-700">Please provide a reason for this response.</p>
                      ) : null}
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                          Evidence {response.evidenceRequired ? "(required)" : "(optional)"}
                        </p>
                        {response.evidenceFiles.length > 0 ? (
                          <ul className="mt-1 text-sm text-stone-700">
                            {response.evidenceFiles.map((file) => (
                              <li key={file.storedName}>{file.fileName}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-sm text-stone-500">No evidence uploaded.</p>
                        )}
                        <input
                          type="file"
                          className="mt-2 block w-full text-sm text-stone-600"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            void upload.mutate({ questionKey: response.questionKey, file });
                          }}
                        />
                        {missingEvidence ? (
                          <p className="mt-1 text-xs text-rose-700">Please upload supporting evidence.</p>
                        ) : null}
                      </div>
                      {response.rating ? (
                        <p className="mt-3 text-xs text-stone-500">
                          Score: {(response.rating / 5).toFixed(2)} / 1
                        </p>
                      ) : null}
                    </section>
                  );
                })}
              </div>

              <section className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryItem label="Total Questions" value="20" />
                  <SummaryItem label="Answered" value={`${completed} / 20`} />
                  <SummaryItem label="Total Score" value={`${score.totalScore.toFixed(2)} / 20`} />
                  <SummaryItem label="Percentage" value={`${score.percentage}%`} />
                  <SummaryItem label="Status" value="Draft" />
                </div>
                {formError ? <p className="mt-3 text-sm text-rose-700">{formError}</p> : null}
                <Button
                  type="button"
                  className="mt-4 bg-amber-400 text-stone-900 hover:bg-amber-300"
                  disabled={!ready || submit.isPending || upload.isPending}
                  onClick={() => submit.mutate(responses)}
                >
                  {submit.isPending ? "Submitting..." : "Submit Self Review"}
                </Button>
              </section>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 font-medium text-stone-900">{value}</p>
    </div>
  );
}

function SubmittedReview({
  cycleName,
  periodLabel,
  responses,
  totalScore,
  percentage,
  submittedAt,
}: {
  cycleName: string;
  periodLabel: string;
  responses: SelfReviewResponse[];
  totalScore: number;
  percentage: number;
  submittedAt: string | null;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Self Review</p>
        <h2 className="mt-1 text-2xl font-semibold text-emerald-950">Submitted</h2>
        <p className="mt-1 text-sm text-emerald-900">
          {cycleName} · PDP Period {periodLabel}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <SummaryItem label="Score" value={`${totalScore.toFixed(2)} / 20`} />
          <SummaryItem label="Percentage" value={`${percentage}%`} />
          <SummaryItem label="Questions" value="20 / 20" />
          <SummaryItem label="Submitted" value={submittedAt ? formatShortDate(submittedAt) : "—"} />
        </div>
        <p className="mt-3 text-sm font-medium text-emerald-900">Status: Submitted</p>
      </section>
      {responses.map((response) => (
        <section key={response.questionKey} className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            {response.sortOrder}. {response.question}
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <p>
              <span className="text-stone-400">Rating: </span>
              {response.rating ?? "—"} / 5
            </p>
            <p>
              <span className="text-stone-400">Score: </span>
              {response.score.toFixed(2)} / 1
            </p>
            <p>
              <span className="text-stone-400">Evidence: </span>
              {response.evidenceFiles.length
                ? response.evidenceFiles.map((file) => file.fileName).join(", ")
                : "—"}
            </p>
          </div>
          <p className="mt-3 text-sm text-stone-700">
            <span className="text-stone-400">Reason: </span>
            {response.reason}
          </p>
        </section>
      ))}
    </div>
  );
}
