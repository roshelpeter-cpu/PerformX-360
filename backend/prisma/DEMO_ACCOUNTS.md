# Development demo accounts

These credentials are for local development only. All passwords are bcrypt-hashed in PostgreSQL and are never stored in frontend source.

Shared development password for every seeded account: `DevTest@2026`

## Named accounts

| Name | Employee ID | Role | Password |
| --- | --- | --- | --- |
| Alex Perera | EMP000001 | EMPLOYEE | DevTest@2026 |
| Nethmi Silva | EMP000901 | EMPLOYEE | DevTest@2026 |
| Kevin Fernando | EMP000902 | EMPLOYEE | DevTest@2026 |
| Amaya Peris | EMP000903 | EMPLOYEE | DevTest@2026 |
| Ryan De Silva | EMP000904 | EMPLOYEE | DevTest@2026 |
| Sarah Fernando | SUP000001 | SUPERVISOR (displayed as Immediate Supervisor) | DevTest@2026 |
| HR Administrator | HR000001 | HR | DevTest@2026 |
| Nadeesha Bandara | HR000002 | HR | DevTest@2026 |
| Maya Wickramasinghe | HRM000001 | HR_MANAGER | DevTest@2026 |
| Daniel Perera | LED000001 | LEADERSHIP | DevTest@2026 |

Bulk-generated employees and supervisors from `prisma/seed.ts` also use `DevTest@2026`.
