import Link from 'next/link'
import { getMarketplaceStats, listSkills } from '@/lib/skills'
import { CATEGORIES } from '@/lib/types'
import { SkillCard } from '@/components/SkillCard'
import { ScrollOnSearch } from '@/components/ScrollOnSearch'
import { DevPlaceholder } from '@/components/DevPlaceholder'
import { SearchForm } from '@/components/SearchForm'
import { HomeHero } from '@/components/HomeHero'
import { getCurrentUserFromCookies, userIdOrAnonymous } from '@/lib/auth/session'
import { isHomeGuideCompleted } from '@/lib/user-preferences'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 9

type SearchParams = Promise<{ q?: string; category?: string; page?: string }>

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = (sp.q || '').trim()
  const category = sp.category || ''
  const page = Math.max(1, Number(sp.page) || 1)
  const isSearchMode = !!q
  const currentUser = await getCurrentUserFromCookies()
  const viewerId = userIdOrAnonymous(currentUser)

  const offset = (page - 1) * PAGE_SIZE
  const { items: allItems, total } = listSkills(
    {
      q,
      category,
      sort: 'installs',
      limit: PAGE_SIZE,
      offset,
    },
    viewerId,
    currentUser?.handle,
  )
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const { items: weeklyTrending } = listSkills(
    { sort: 'weekly', limit: 3 },
    viewerId,
    currentUser?.handle,
  )
  const stats = getMarketplaceStats()
  const homeGuideCompleted = currentUser ? isHomeGuideCompleted(currentUser.open_id) : false

  return (
    <>
      <ScrollOnSearch targetId="explore" />
      <HomeHero
        accountGuideCompleted={homeGuideCompleted}
        persistenceMode={currentUser ? 'account' : 'local'}
        skillCount={stats.skillCount}
        installCount={stats.installCount}
      />

      <main className="home-main">
        <section style={{ margin: '8px 0 40px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2 className="section-title">
              Trending this week
              <span className="section-subtitle">by weekly installs</span>
            </h2>
          </div>
          {weeklyTrending.length === 0 ? (
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: 13,
                padding: 24,
                background: 'var(--bg-soft)',
                borderRadius: 8,
              }}
            >
              No installs yet. Be the first to try a seed Skill.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 16,
              }}
            >
              {weeklyTrending.map((s) => (
                <SkillCard key={s.slug} skill={s} />
              ))}
            </div>
          )}
        </section>

        <DevPlaceholder>
          <section style={{ margin: '40px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2 className="section-title">
                Curated picks
                <span className="section-subtitle">maintainer reviewed</span>
              </h2>
            </div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: 13,
                padding: 24,
                background: 'var(--bg-soft)',
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              Curated picks are enabled in the demo placeholder. Skills with strong usage and clean feedback can appear here.
            </div>
          </section>
        </DevPlaceholder>

        <section id="explore" style={{ margin: '40px 0 0', scrollMarginTop: 80 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2 className="section-title">
              {isSearchMode ? 'Search results' : 'All Skills'}
            </h2>
            <span className="section-action">
              {total} total · page {safePage} of {totalPages}
            </span>
          </div>

          <SearchForm initialQuery={q} category={category} />

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            <CategoryPill href={buildHref(q, '')} active={!category}>
              All
            </CategoryPill>
            {CATEGORIES.map((c) => (
              <CategoryPill key={c.value} href={buildHref(q, c.value)} active={category === c.value}>
                {c.label}
              </CategoryPill>
            ))}
          </div>

          {/* Fixed 3 x 3 grid; keep trailing space on short pages and show empty states above the grid. */}
          <div className="all-skills-grid">
            {allItems.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: 64,
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                }}
              >
                  <p style={{ fontSize: 16, marginBottom: 8 }}>No matching Skill found</p>
                <p style={{ fontSize: 13 }}>
                  <Link href="/publish">Publish the first Skill {'->'}</Link>
                </p>
              </div>
            ) : (
              allItems.map((s) => <SkillCard key={s.slug} skill={s} q={q} />)
            )}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 24,
              }}
            >
              <PageLink page={safePage - 1} disabled={safePage <= 1} q={q} category={category}>
                Previous
              </PageLink>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PageLink
                  key={p}
                  page={p}
                  active={p === safePage}
                  q={q}
                  category={category}
                >
                  {p}
                </PageLink>
              ))}
              <PageLink
                page={safePage + 1}
                disabled={safePage >= totalPages}
                q={q}
                category={category}
              >
                Next
              </PageLink>
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function buildHref(q: string, category: string, page?: number): string {
  const usp = new URLSearchParams()
  if (q) usp.set('q', q)
  if (category) usp.set('category', category)
  if (page && page > 1) usp.set('page', String(page))
  const qs = usp.toString()
  return qs ? `/?${qs}#explore` : '/#explore'
}

function CategoryPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        fontSize: 13,
        background: active ? 'var(--text-primary)' : 'var(--bg)',
        color: active ? 'white' : 'var(--text-secondary)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}

function PageLink({
  page,
  q,
  category,
  active,
  disabled,
  children,
}: {
  page: number
  q: string
  category: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span
        style={{
          padding: '6px 12px',
          fontSize: 13,
          color: 'var(--text-muted)',
          opacity: 0.4,
        }}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={buildHref(q, category, page)}
      scroll={false}
      style={{
        padding: '6px 12px',
        fontSize: 13,
        background: active ? 'var(--text-primary)' : 'var(--bg)',
        color: active ? 'white' : 'var(--text-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        textDecoration: 'none',
        minWidth: 32,
        textAlign: 'center',
      }}
    >
      {children}
    </Link>
  )
}
