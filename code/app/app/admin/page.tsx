import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUserFromCookies, userIdOrAnonymous } from '@/lib/auth/session'
import { listSkills } from '@/lib/skills'
import { formatRelativeTime } from '@/lib/format'
import { installAccessLabel, visibilityLabel } from '@/lib/access-labels'
import type { Skill } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ADMIN_HANDLE = 'demo'

export default async function AdminPage() {
  const currentUser = await getCurrentUserFromCookies()

  if (!currentUser) {
    return (
      <main className="admin-page">
        <section className="mine-login-panel">
          <span className="docs-kicker">Admin</span>
          <h1>Sign in as admin</h1>
          <p>Use this page to inspect Skill authors, owners, sources, and archive state.</p>
          <a className="mine-primary-action" href="/api/auth/dev-login?next=%2Fadmin">
            Demo login
          </a>
        </section>
      </main>
    )
  }

  if (currentUser.handle !== ADMIN_HANDLE) notFound()

  const viewerId = userIdOrAnonymous(currentUser)
  const skills = listSkills(
    {
      sort: 'updated',
      includeArchived: true,
      limit: 100,
    },
    viewerId,
    currentUser.handle,
  ).items
  const activeCount = skills.filter((skill) => skill.status === 'active').length
  const archivedCount = skills.filter((skill) => skill.status === 'archived').length
  const officialCount = skills.filter((skill) => skill.source === 'official').length
  const externalCount = skills.filter((skill) => skill.source === 'external').length

  return (
    <main className="admin-page">
      <section className="mine-hero">
        <div>
          <span className="docs-kicker">Admin</span>
          <h1>Skill ownership and management scope</h1>
          <p>Visible only to @{ADMIN_HANDLE}. This read-only page helps audit author and owner assignments.</p>
        </div>
        <Link className="mine-primary-action" href="/mine">
          Creator Console
        </Link>
      </section>

      <section className="mine-stat-grid" aria-label="Admin overview">
        <StatCard label="All records" value={skills.length} detail="Active + archived" />
        <StatCard label="Active" value={activeCount} detail={`${archivedCount} archived`} />
        <StatCard label="Official" value={officialCount} detail="@community display scope" />
        <StatCard label="External" value={externalCount} detail="Hidden by default" />
      </section>

      <section className="admin-table-card">
        <div className="mine-section-header">
          <h2>Skill permission directory</h2>
          <span>{skills.length}</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-permission-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Display author</th>
                <th>Owner</th>
                <th>Source</th>
                <th>Status</th>
                <th>Install access</th>
                <th>Visibility</th>
                <th>Version</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <PermissionRow key={skill.slug} skill={skill} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function PermissionRow({ skill }: { skill: Skill }) {
  const skillHref = `/skills/${encodeURIComponent(skill.slug)}`
  const detailHref = `${skillHref}?from=admin`
  const manageHref = `${skillHref}?tab=manage&from=admin`
  const owner = skill.owner_handle || skill.author

  return (
    <tr>
      <td>
        <strong>{skill.name}</strong>
        <code>{skill.slug}</code>
      </td>
      <td>@{skill.author}</td>
      <td>@{owner}</td>
      <td>
        <span className={`admin-source ${skill.source}`}>{sourceLabel(skill.source)}</span>
      </td>
      <td>
        <span className={`skill-status ${skill.status}`}>
          {skill.status === 'archived' ? 'Archived' : 'Active'}
        </span>
      </td>
      <td>{installAccessLabel(skill.install_access)}</td>
      <td>{visibilityLabel(skill.visibility)}</td>
      <td>v{skill.version}</td>
      <td>{formatRelativeTime(skill.updated_at)}</td>
      <td>
        <div className="admin-row-actions">
          <Link href={detailHref}>Details</Link>
          <Link href={manageHref}>Manage</Link>
        </div>
      </td>
    </tr>
  )
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="mine-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </div>
  )
}

function sourceLabel(source: Skill['source']): string {
  if (source === 'official') return 'Official'
  if (source === 'external') return 'External'
  return 'User'
}
