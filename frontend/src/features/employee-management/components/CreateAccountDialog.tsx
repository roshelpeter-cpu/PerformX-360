import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/features/hr/components/ActionMenu";
import {
  useCreateAccount,
  useEligibleTeams,
  useNextEmployeeId,
} from "@/features/employee-management/hooks/useEmployeeManagement";

const ROLES = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "HR", label: "HR" },
  { value: "HR_MANAGER", label: "HR Manager" },
  { value: "LEADERSHIP", label: "Leadership" },
] as const;

export function CreateAccountDialog({
  open,
  onClose,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  departments: Array<{ id: string; name: string }>;
}) {
  const create = useCreateAccount();
  const [role, setRole] = useState("EMPLOYEE");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("Sri Lankan");
  const [contactNumber, setContactNumber] = useState("");
  const [employmentType, setEmploymentType] = useState("Permanent");
  const [workLocation, setWorkLocation] = useState("Colombo, Sri Lanka");
  const [dateJoined, setDateJoined] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [emergencyNumber, setEmergencyNumber] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const isLeadership = role === "LEADERSHIP";
  const isHr = role === "HR";
  const needsSingleTeam = role === "EMPLOYEE" || role === "SUPERVISOR";
  const needsDepartment = !isLeadership;
  const nextIdQuery = useNextEmployeeId(role, open);
  const teamsQuery = useEligibleTeams(
    open && Boolean(departmentId) && (needsSingleTeam || isHr),
    departmentId || undefined
  );
  const teams = teamsQuery.data ?? [];
  const selectedTeam = teams.find((team) => team.id === teamId);

  function reset(nextRole = "EMPLOYEE") {
    setRole(nextRole);
    setName("");
    setEmail("");
    setJobTitle(
      nextRole === "HR"
        ? "HR Officer"
        : nextRole === "HR_MANAGER"
          ? "HR Manager"
          : nextRole === "SUPERVISOR"
            ? "Supervisor"
            : nextRole === "LEADERSHIP"
              ? "Leadership"
              : ""
    );
    setDepartmentId("");
    setTeamId("");
    setTeamIds([]);
    setDateOfBirth("");
    setGender("");
    setNationality("Sri Lankan");
    setContactNumber("");
    setEmploymentType("Permanent");
    setWorkLocation("Colombo, Sri Lanka");
    setDateJoined("");
    setEmergencyName("");
    setEmergencyRelationship("");
    setEmergencyNumber("");
  }

  function toggleTeam(id: string) {
    setTeamIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function submit() {
    const body: Record<string, unknown> = {
      name,
      companyEmail: email,
      role,
      nationality,
      employmentType,
      workLocation,
    };
    if (jobTitle) body.jobTitle = jobTitle;
    if (!isLeadership && departmentId) body.departmentId = departmentId;
    if (needsSingleTeam && teamId) body.teamId = teamId;
    if (isHr && teamIds.length > 0) body.teamIds = teamIds;
    if (dateOfBirth) body.dateOfBirth = dateOfBirth;
    if (gender) body.gender = gender;
    if (contactNumber) body.contactNumber = contactNumber;
    if (dateJoined) body.dateJoined = dateJoined;
    if (emergencyName) body.emergencyContactName = emergencyName;
    if (emergencyRelationship) body.emergencyContactRelationship = emergencyRelationship;
    if (emergencyNumber) body.emergencyContactNumber = emergencyNumber;

    const result = await create.mutateAsync(body);
    setTemporaryPassword(result.temporaryPassword);
    toast.success(`${result.profile.name} was created as ${result.profile.employeeId}.`);
  }

  const canSubmit =
    name.trim() &&
    email.trim() &&
    (role !== "EMPLOYEE" || Boolean(teamId)) &&
    (role !== "SUPERVISOR" || Boolean(departmentId)) &&
    (role !== "HR" || Boolean(departmentId));

  return (
    <Dialog
      open={open}
      onClose={() => {
        setTemporaryPassword(null);
        reset();
        onClose();
      }}
      title="Add Employee"
      description="Create any account type. Employee ID is generated from the selected role. Department determines available teams."
      className="max-w-3xl"
    >
      {temporaryPassword ? (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Share this one-time password. The person must change it at first login.
          </p>
          <p className="rounded-xl bg-amber-50 px-4 py-3 font-mono text-sm">{temporaryPassword}</p>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setTemporaryPassword(null);
                reset();
                onClose();
              }}
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">Account role</span>
              <select
                className={fieldClass}
                value={role}
                onChange={(event) => reset(event.target.value)}
              >
                {ROLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Full name</span>
              <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Work email</span>
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Employee ID</span>
              <input
                className={fieldClass}
                readOnly
                value={nextIdQuery.data ?? "Auto-generated"}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Job title</span>
              <input className={fieldClass} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Date of birth</span>
              <input
                className={fieldClass}
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Gender</span>
              <select className={fieldClass} value={gender} onChange={(event) => setGender(event.target.value)}>
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Nationality</span>
              <input
                className={fieldClass}
                value={nationality}
                onChange={(event) => setNationality(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Contact number</span>
              <input
                className={fieldClass}
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
              />
            </label>
          </section>

          {needsDepartment ? (
            <section className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Department</span>
                <select
                  className={fieldClass}
                  value={departmentId}
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setTeamId("");
                    setTeamIds([]);
                  }}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              {needsSingleTeam ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">Team</span>
                  <select
                    className={fieldClass}
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                    disabled={!departmentId}
                  >
                    <option value="">{departmentId ? "Select team" : "Select a department first"}</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {role === "EMPLOYEE" ? (
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-stone-500">Supervisor</span>
                  <input
                    className={fieldClass}
                    readOnly
                    value={
                      selectedTeam?.supervisor
                        ? `${selectedTeam.supervisor.name} (${selectedTeam.supervisor.employeeId})`
                        : "Assigned automatically from the selected team"
                    }
                  />
                </label>
              ) : null}
              {isHr ? (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm text-stone-500">Teams in this department</p>
                  {!departmentId ? (
                    <p className="text-sm text-stone-400">Select a department to see teams.</p>
                  ) : teams.length === 0 ? (
                    <p className="text-sm text-stone-400">No teams in this department.</p>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                      {teams.map((team) => (
                        <label key={team.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-amber-500"
                            checked={teamIds.includes(team.id)}
                            onChange={() => toggleTeam(team.id)}
                          />
                          <span>{team.name}</span>
                          {team.supervisor ? (
                            <span className="text-xs text-stone-400">· {team.supervisor.name}</span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-stone-400">
                    {teamIds.length} team{teamIds.length === 1 ? "" : "s"} selected. There is no maximum.
                  </p>
                </div>
              ) : null}
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Employment type</span>
                <input
                  className={fieldClass}
                  value={employmentType}
                  onChange={(event) => setEmploymentType(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Joining date</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={dateJoined}
                  onChange={(event) => setDateJoined(event.target.value)}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Work location</span>
                <input
                  className={fieldClass}
                  value={workLocation}
                  onChange={(event) => setWorkLocation(event.target.value)}
                />
              </label>
            </section>
          ) : (
            <section className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Employment type</span>
                <input
                  className={fieldClass}
                  value={employmentType}
                  onChange={(event) => setEmploymentType(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Joining date</span>
                <input
                  className={fieldClass}
                  type="date"
                  value={dateJoined}
                  onChange={(event) => setDateJoined(event.target.value)}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Work location</span>
                <input
                  className={fieldClass}
                  value={workLocation}
                  onChange={(event) => setWorkLocation(event.target.value)}
                />
              </label>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Emergency contact name</span>
              <input
                className={fieldClass}
                value={emergencyName}
                onChange={(event) => setEmergencyName(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Relationship</span>
              <input
                className={fieldClass}
                value={emergencyRelationship}
                onChange={(event) => setEmergencyRelationship(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Emergency number</span>
              <input
                className={fieldClass}
                value={emergencyNumber}
                onChange={(event) => setEmergencyNumber(event.target.value)}
              />
            </label>
          </section>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSubmit || create.isPending}
              onClick={() => void submit()}
            >
              Create account
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
