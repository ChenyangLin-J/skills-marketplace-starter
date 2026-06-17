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
          Demo 页 — 下方原本是「本周热门 / 官方推荐 / 全部 Skill」列表，
          这里省略以便对比 Hero 改造效果。访问 <code>/</code> 查看现版。
        </div>
      </main>
    </>
  )
}
