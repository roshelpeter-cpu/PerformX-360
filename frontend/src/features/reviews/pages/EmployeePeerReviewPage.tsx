import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { ApiClientError } from "@/services/api/client";
import { PEER_RATINGS, reviewsApi, type PeerAssignment } from "../services/reviews.api";

export default function EmployeePeerReviewPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["peer-review", "mine"],
    queryFn: async () => (await reviewsApi.myPeerReview()).peerReview,
  });
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !query.data ? (
        <DashboardError message="Unable to load peer review." />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Peer Review</p>
            <h1 className="text-3xl font-semibold tracking-tight">Peer Review</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Peer reviews are confidential. You can see your score, but not who reviewed you.
            </p>
          </div>
          {notice ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              {notice}
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">My Peer Review</p>
              <h2 className="mt-2 text-lg font-semibold">Peer Review Score</h2>
              {query.data.received.score == null ? (
                <p className="mt-4 text-sm font-medium text-stone-700">Peer Review Not Started</p>
              ) : (
                <p className="mt-4 text-3xl font-semibold">{query.data.received.score.toFixed(2)} / 20</p>
              )}
              <p className="mt-2 text-sm text-stone-500">Two peers can contribute 10 marks each. Reviewer names are not shown.</p>
            </section>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Peer Review Assigned to Me</h2>
              {query.data.assignments.length === 0 ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
                  You have not been selected to review a colleague yet.
                </div>
              ) : (
                query.data.assignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onSubmitted={(message) => {
                      setNotice(message);
                      void client.invalidateQueries({ queryKey: ["peer-review", "mine"] });
                    }}
                  />
                ))
              )}
            </section>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function AssignmentCard({
  assignment,
  onSubmitted,
}: {
  assignment: PeerAssignment;
  onSubmitted: (message: string) => void;
}) {
  const [open, setOpen] = useState(assignment.status === "DRAFT");
  const [responses, setResponses] = useState(assignment.responses);
  const [comment, setComment] = useState(assignment.comment);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResponses(assignment.responses);
    setComment(assignment.comment);
    setOpen(assignment.status === "DRAFT");
  }, [assignment]);

  const submit = useMutation({
    mutationFn: async () => {
      await reviewsApi.savePeerReview(
        assignment.id,
        responses.map((response) => ({
          questionKey: response.questionKey,
          rating: response.rating,
          reason: response.reason,
        })).length
          ? {
              comment,
              responses: responses.map((response) => ({
                questionKey: response.questionKey,
                rating: response.rating,
                reason: response.reason,
              })),
            }
          : { comment, responses: [] }
      );
      return reviewsApi.submitPeerReview(assignment.id);
    },
    onSuccess: (result) => {
      setError(null);
      onSubmitted(result.message);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Unable to submit the peer review."),
  });

  if (assignment.status === "SUBMITTED" && !open) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-semibold text-emerald-800">Peer review submitted.</p>
        <p className="mt-1 text-sm text-stone-600">Employee reviewed: {assignment.subject.name}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Peer Review Assigned</p>
      <p className="mt-2 text-sm text-stone-500">Employee to review</p>
      <p className="font-semibold">{assignment.subject.name}</p>
      <p className="text-sm text-stone-500">
        {assignment.subject.employeeId} · {assignment.subject.department} · {assignment.subject.team}
      </p>
      {!open ? (
        <Button type="button" className="mt-4 bg-amber-400 text-stone-900 hover:bg-amber-300" onClick={() => setOpen(true)}>
          {assignment.status === "SUBMITTED" ? "Edit Peer Review" : "Complete Peer Review"}
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          {responses.map((response) => (
            <div key={response.questionKey}>
              <p className="text-sm font-medium">{response.sortOrder}. {response.question}</p>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-stone-200 px-3 text-sm"
                value={response.rating ?? ""}
                onChange={(event) => {
                  const rating = event.target.value ? Number(event.target.value) : null;
                  setResponses((current) =>
                    current.map((item) => (item.questionKey === response.questionKey ? { ...item, rating } : item))
                  );
                }}
              >
                <option value="">Select a rating</option>
                {PEER_RATINGS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <textarea
                className="mt-2 min-h-20 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                placeholder="Reason for this rating"
                value={response.reason}
                onChange={(event) => {
                  const reason = event.target.value;
                  setResponses((current) =>
                    current.map((item) => (item.questionKey === response.questionKey ? { ...item, reason } : item))
                  );
                }}
              />
            </div>
          ))}
          <textarea
            className="min-h-20 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            placeholder="Overall comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <Button
            type="button"
            className="bg-amber-400 text-stone-900 hover:bg-amber-300"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Submitting..." : "Submit Peer Review"}
          </Button>
        </div>
      )}
    </div>
  );
}
