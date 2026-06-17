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
          <span className="docs-kicker">权限目录</span>
          <h1>管理员登录后查看</h1>
          <p>这里用于查看 Skill 的作者、管理者、来源和上下架状态。</p>
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
          <span className="docs-kicker">权限目录</span>
          <h1>Skill 归属与可管理范围</h1>
          <p>仅 @{ADMIN_HANDLE} 可见。当前页面只读，用来核对作者和管理者归属。</p>
        </div>
        <Link className="mine-primary-action" href="/mine">
          我的管理中心
        </Link>
      </section>

      <section className="mine-stat-grid" aria-label="权限目录概览">
        <StatCard label="全部记录" value={skills.length} detail="active + archived" />
        <StatCard label="上架中" value={activeCount} detail={`${archivedCount} 个已下架`} />
        <StatCard label="官方" value={officialCount} detail="@community 展示口径" />
        <StatCard label="外部" value={externalCount} detail="当前默认隐藏" />
      </section>

      <section className="admin-table-card">
        <div className="mine-section-header">
          <h2>Skill 权限目录</h2>
          <span>{skills.length}</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-permission-table">
            <thead>
              <tr>
                <th>Skill</th>
                <th>展示作者</th>
                <th>管理者</th>
                <th>来源</th>
                <th>状态</th>
                <th>安装权限</th>
                <th>可见性</th>
                <th>版本</th>
                <th>更新</th>
                <th>操作</th>
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
          {skill.status === 'archived' ? '已下架' : '上架中'}
        </span>
      </td>
      <td>{installAccessLabel(skill.install_access)}</td>
      <td>{visibilityLabel(skill.visibility)}</td>
      <td>v{skill.version}</td>
      <td>{formatRelativeTime(skill.updated_at)}</td>
      <td>
        <div className="admin-row-actions">
          <Link href={detailHref}>详情</Link>
          <Link href={manageHref}>管理</Link>
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
  if (source === 'official') return '官方'
  if (source === 'external') return '外部'
  return '用户'
}
