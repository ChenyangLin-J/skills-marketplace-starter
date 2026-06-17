import { HeroDemo, HeroDemoFeatures } from '@/components/HeroDemo'
import { getMarketplaceStats } from '@/lib/skills'

export const dynamic = 'force-dynamic'

export default function HeroDemoPage() {
  const stats = getMarketplaceStats()

  return (
    <>
      <HeroDemo skillCount={stats.skillCount} installCount={stats.installCount} />
      <main className="home-main">
        <HeroDemoFeatures />
        <div
          style={{
            margin: '40px 0',
            padding: 24,
            border: '1px dashed var(--border)',
            borderRadius: 8,
            background: 'var(--bg-soft)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Demo page. The real homepage continues with Trending / Recommended / All Skills lists.
          They are omitted here to compare the hero treatment. Visit <code>/</code> for the current page.
        </div>
      </main>
    </>
  )
}
