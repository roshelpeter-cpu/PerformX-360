import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/app/layouts/DashboardLayout";
import { DashboardError, DashboardLoading } from "@/features/dashboard/components/DashboardUi";
import { reviewsApi, type EmployeeFinalEvaluation } from "../services/reviews.api";

function money(amount: number) {
  return amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function labelStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function EmployeeFinalEvaluationPage() {
  const query = useQuery({
    queryKey: ["evaluations", "mine"],
    queryFn: async () => (await reviewsApi.myFinalEvaluation()).evaluation,
  });

  return (
    <DashboardLayout>
      {query.isLoading ? (
        <DashboardLoading />
      ) : query.isError || !query.data ? (
        <DashboardError message="Unable to load final evaluation." />
      ) : query.data.started && query.data.employee && query.data.finalScore ? (
        <FinalDashboard data={query.data} />
      ) : (
        <section className="mx-auto max-w-2xl rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Final Evaluation</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Final evaluation has not started yet.</h1>
          <p className="mt-3 text-sm text-stone-500">
            The final evaluation details will become available once the appraisal review process is completed.
          </p>
        </section>
      )}
    </DashboardLayout>
  );
}

function FinalDashboard({ data }: { data: EmployeeFinalEvaluation }) {
  const employee = data.employee!;
  const score = data.finalScore!;
  const pip = data.pip;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Final Evaluation</p>
        <h1 className="text-3xl font-semibold tracking-tight">FINAL EVALUATION</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Employee Information</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Name" value={employee.name} />
          <Card label="ID" value={employee.employeeId} />
          <Card label="Department" value={employee.department} />
          <Card label="Team" value={employee.team} />
          <Card label="Supervisor" value={employee.supervisor} />
          <Card label="Appraisal Cycle" value={data.cycle?.name ?? "—"} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Evaluation Summary</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            label="PDP Score"
            value={
              data.pdp
                ? `${data.pdp.earnedPoints.toFixed(2)} / 100 · ${data.pdp.supervisorScore.toFixed(2)} / 60`
                : "Not available"
            }
          />
          <Card
            label="Self Review"
            value={data.selfReview ? `${data.selfReview.score.toFixed(2)} / ${data.selfReview.maxScore}` : "Not available"}
          />
          <Card
            label="Peer Review Score"
            value={data.peerReview ? `${data.peerReview.score.toFixed(2)} / ${data.peerReview.maxScore}` : "Not available"}
          />
          <Card
            label="Supervisor Review"
            value={
              data.supervisorReview
                ? `${data.supervisorReview.score.toFixed(2)} / ${data.supervisorReview.maxScore} · ${labelStatus(data.supervisorReview.decision)}`
                : "Not available"
            }
          />
          <Card
            label="HR Review"
            value={data.hrReview ? labelStatus(data.hrReview.status) : "Not available"}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Final Result</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
          FINAL SCORE {score.total.toFixed(2)} / 100
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Self {score.self.toFixed(2)} / 20 + Peer {score.peer.toFixed(2)} / 20 + Supervisor PDP {score.supervisorPdp.toFixed(2)} / 60
        </p>
        <p className="mt-3 text-lg font-semibold text-stone-900">PERFORMANCE BAND · {score.band}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Supervisor Review</h2>
          <p className="mt-2 text-sm text-stone-500">{data.supervisorReview?.supervisor ?? "—"}</p>
          <p className="mt-3 text-sm text-stone-700">
            {data.supervisorReview?.comment?.trim() || "No supervisor comment has been recorded."}
          </p>
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">HR Review</h2>
          <p className="mt-2 text-sm text-stone-500">{data.hrReview ? labelStatus(data.hrReview.status) : "Not recorded"}</p>
          <p className="mt-3 text-sm text-stone-700">
            {data.hrReview?.comment?.trim() || "HR comments will appear here when a review is recorded."}
          </p>
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Bonus & Rewards</h2>
          {data.bonus ? (
            <dl className="mt-3 space-y-1 text-sm text-stone-700">
              <div>Final score: {data.bonus.finalScore.toFixed(2)} / 100</div>
              <div>Band: {data.bonus.band}</div>
              <div>Eligibility: {data.bonus.eligible ? "Eligible" : "Not eligible"}</div>
              <div>Calculated bonus: {money(data.bonus.amount)}</div>
              <div>Status: {labelStatus(data.bonus.status)}</div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Bonus calculation is not available yet.</p>
          )}
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Promotion</h2>
          {data.promotion ? (
            <div className="mt-3 space-y-2 text-sm text-stone-700">
              <p>Recommended position: {data.promotion.recommendedPosition || "Not specified"}</p>
              <p>Supervisor reason: {data.promotion.reason}</p>
              <p>HR decision: {labelStatus(data.promotion.status)}</p>
              {data.promotion.hrReason ? <p>HR note: {data.promotion.hrReason}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No promotion recommendation for this cycle.</p>
          )}
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Awards</h2>
          {data.awards && data.awards.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-stone-700">
              {data.awards.map((award) => (
                <li key={award.title}>
                  <span className="font-medium">{award.title}</span>
                  <span className="text-stone-500"> · {labelStatus(award.category)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No approved awards.</p>
          )}
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">PIP</h2>
          <p className="mt-3 text-sm font-medium text-stone-800">
            {pip?.required ? "PIP Required" : "No PIP Required"}
          </p>
          {pip?.required ? (
            <div className="mt-2 space-y-1 text-sm text-stone-600">
              {pip.title ? <p>{pip.title}</p> : null}
              <p>Status: {pip.status ? labelStatus(pip.status) : "—"}</p>
              {pip.summary ? <p>{pip.summary}</p> : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 font-semibold text-stone-900">{value}</p>
    </div>
  );
}
