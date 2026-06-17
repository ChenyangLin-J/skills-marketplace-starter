import Link from 'next/link'
import {
  getOwnerSkillStats,
  listFeedbackForOwner,
  listSkills,
  type OwnerFeedback,
} from '@/lib/skills'
import { CATEGORIES, type Skill } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { getCurrentUserFromCookies, userIdOrAnonymous } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function MinePage() {
  const currentUser = await getCurrentUserFromCookies()

  if (!currentUser) {
    return (
      <main className="mine-page">
        <section className="mine-login-panel">
          <span className="docs-kicker">Creator Console</span>
          <h1>Sign in to manage your Skills and feedback</h1>
          <p>Publishing, updates, archiving, and feedback inboxes are scoped to the signed-in user.</p>
          <a className="mine-primary-action" href="/api/auth/dev-login?next=%2Fmine">
            Demo login
          </a>
        </section>
      </main>
    )
  }

  const viewerId = userIdOrAnonymous(currentUser)
  const allManagedSkills = listSkills(
    {
      sort: 'updated',
      includeArchived: true,
      ownerHandle: currentUser.handle,
      limit: 100,
    },
    viewerId,
  ).items
  const activeSkills = allManagedSkills.filter((skill) => skill.status === 'active')
  const archivedSkills = allManagedSkills.filter((skill) => skill.status === 'archived')
  const feedbackItems = listFeedbackForOwner(currentUser.handle, 50)
  const stats = getOwnerSkillStats(currentUser.handle)

  return (
    <main className="mine-page">
      <section className="mine-hero">
        <div>
          <span className="docs-kicker">Creator Console</span>
          <h1>{currentUser.name}</h1>
          <p>@{currentUser.handle}</p>
        </div>
        <Link className="mine-primary-action" href="/publish">
          Publish Skill
        </Link>
      </section>

      <section className="mine-stat-grid" aria-label="My Skills overview">
        <StatCard label="Managed Skills" value={stats.totalSkills} detail={`${stats.activeSkills} active`} />
        <StatCard label="Total installs" value={stats.installCount} detail="Managed scope" />
        <StatCard label="Total likes" value={stats.likeCount} detail="Managed scope" />
        <StatCard label="Open feedback" value={stats.openFeedbackCount} detail="Open status" />
      </section>

      <div className="mine-layout">
        <section className="mine-main-column">
          <SectionHeader title="Managed Skills" count={activeSkills.length} />
          {activeSkills.length === 0 ? (
            <EmptyState text="You do not have active Skills yet." actionHref="/publish" actionLabel="Publish the first Skill" />
          ) : (
            <div className="mine-skill-list">
              {activeSkills.map((skill) => (
                <SkillManageRow key={skill.slug} skill={skill} />
              ))}
            </div>
          )}

          <SectionHeader title="Archived" count={archivedSkills.length} />
          {archivedSkills.length === 0 ? (
            <EmptyState text="No archived Skills yet." />
          ) : (
            <div className="mine-skill-list">
              {archivedSkills.map((skill) => (
                <SkillManageRow key={skill.slug} skill={skill} />
              ))}
            </div>
          )}
        </section>

        <aside className="mine-side-column">
          <SectionHeader title="Received feedback" count={feedbackItems.length} />
          {feedbackItems.length === 0 ? (
            <EmptyState text="No feedback yet." />
          ) : (
            <div className="mine-feedback-list">
              {feedbackItems.map((item) => (
                <FeedbackItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
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

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mine-section-header">
      <h2>{title}</h2>
      <span>{count}</span>
    </div>
  )
}

function EmptyState({
  text,
  actionHref,
  actionLabel,
}: {
  text: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="mine-empty">
      <span>{text}</span>
      {actionHref && actionLabel && <Link href={actionHref}>{actionLabel}</Link>}
    </div>
  )
}

function SkillManageRow({ skill }: { skill: Skill }) {
  const category = CATEGORIES.find((item) => item.value === skill.category)
  const detailHref = `/skills/${encodeURIComponent(skill.slug)}`
  const mineDetailHref = `${detailHref}?from=mine`
  const manageHref = `${detailHref}?tab=manage&from=mine`

  return (
    <article className="mine-skill-row">
      <div className="mine-skill-main">
        <div className="mine-skill-title">
          <strong>{skill.name}</strong>
          <span className={`skill-status ${skill.status}`}>
            {skill.status === 'archived' ? 'Archived' : 'Active'}
          </span>
        </div>
        <p>{skill.description}</p>
        <div className="mine-skill-meta">
          <span>{category ? `${category.emoji} ${category.label}` : skill.category}</span>
          <span>v{skill.version}</span>
          <span>⬇ {skill.install_count}</span>
          <span>❤ {skill.like_count}</span>
          <span>{formatRelativeTime(skill.updated_at)}</span>
        </div>
      </div>
      <div className="mine-row-actions">
        <Link href={mineDetailHref}>Details</Link>
        <Link href={manageHref}>Manage</Link>
      </div>
    </article>
  )
}

function FeedbackItem({ item }: { item: OwnerFeedback }) {
  const detailHref = `/skills/${encodeURIComponent(item.skill_slug)}?from=mine`

  return (
    <article className="mine-feedback-item">
      <div className="mine-feedback-meta">
        <Link href={detailHref}>{item.skill_name}</Link>
        <span>{item.source === 'cli' ? 'CLI' : 'Web'}</span>
        {item.version && <span>v{item.version}</span>}
        <span>{formatRelativeTime(item.created_at)}</span>
      </div>
      <p>{item.message}</p>
      {item.context && <pre>{item.context}</pre>}
      <div className="mine-feedback-user">
        {item.user_handle ? `@${item.user_handle}` : item.user_id}
      </div>
    </article>
  )
}
