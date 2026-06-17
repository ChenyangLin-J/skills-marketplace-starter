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
          <span className="docs-kicker">我的管理中心</span>
          <h1>登录后查看你的 Skill 和反馈</h1>
          <p>发布、更新、下架和反馈收件箱都按当前登录用户归属。</p>
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
          <span className="docs-kicker">我的管理中心</span>
          <h1>{currentUser.name}</h1>
          <p>@{currentUser.handle}</p>
        </div>
        <Link className="mine-primary-action" href="/publish">
          发布 Skill
        </Link>
      </section>

      <section className="mine-stat-grid" aria-label="我的 Skill 概览">
        <StatCard label="管理 Skill" value={stats.totalSkills} detail={`${stats.activeSkills} 个上架中`} />
        <StatCard label="总装机" value={stats.installCount} detail="当前管理范围" />
        <StatCard label="总点赞" value={stats.likeCount} detail="当前管理范围" />
        <StatCard label="收到反馈" value={stats.openFeedbackCount} detail="open 状态" />
      </section>

      <div className="mine-layout">
        <section className="mine-main-column">
          <SectionHeader title="我管理的 Skill" count={activeSkills.length} />
          {activeSkills.length === 0 ? (
            <EmptyState text="你还没有上架中的 Skill。" actionHref="/publish" actionLabel="发布第一个 Skill" />
          ) : (
            <div className="mine-skill-list">
              {activeSkills.map((skill) => (
                <SkillManageRow key={skill.slug} skill={skill} />
              ))}
            </div>
          )}

          <SectionHeader title="已下架" count={archivedSkills.length} />
          {archivedSkills.length === 0 ? (
            <EmptyState text="当前没有已下架的 Skill。" />
          ) : (
            <div className="mine-skill-list">
              {archivedSkills.map((skill) => (
                <SkillManageRow key={skill.slug} skill={skill} />
              ))}
            </div>
          )}
        </section>

        <aside className="mine-side-column">
          <SectionHeader title="收到的反馈" count={feedbackItems.length} />
          {feedbackItems.length === 0 ? (
            <EmptyState text="还没有收到反馈。" />
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
            {skill.status === 'archived' ? '已下架' : '上架中'}
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
        <Link href={mineDetailHref}>详情</Link>
        <Link href={manageHref}>管理</Link>
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
