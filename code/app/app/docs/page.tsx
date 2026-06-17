import Link from 'next/link'
import { listTutorials, type Tutorial, type TutorialAudience } from '@/lib/tutorials'

const audienceLabels: Record<TutorialAudience, string> = {
  all: '所有人',
  user: '使用者',
  creator: '创作者',
}

export default function DocsPage() {
  const tutorials = listTutorials()
  const users = tutorials.filter((tutorial) => tutorial.audience === 'user')
  const creators = tutorials.filter((tutorial) => tutorial.audience === 'creator')
  const grouped = groupByCategory(tutorials)

  return (
    <div className="docs-page">
      <div className="docs-shell docs-shell-wide">
        <section className="docs-hero">
          <div>
            <div className="docs-kicker">Learn</div>
            <h1>Skill Marketplace 教程中心</h1>
            <p className="docs-lead">
              从安装第一个 Skill 到发布团队能力，P0 教程已经按使用者和创作者路径整理好。
              内容用 Markdown 维护，按角色路径快速进入。
            </p>
          </div>
          <div className="docs-status-panel" aria-label="教程状态">
            <span>P0 ready</span>
            <strong>{tutorials.length}</strong>
            <p>篇基础教程</p>
          </div>
        </section>

        <section className="docs-section">
          <div className="docs-section-head">
            <h2>最快路径</h2>
            <p>按你现在的角色直接开始。</p>
          </div>
          <div className="docs-path-grid">
            <LearningPath
              title="我要使用 Skill"
              description="适合只想安装、运行和排查现成 Skill 的同学。"
              tutorials={users}
            />
            <LearningPath
              title="我要创建 Skill"
              description="适合准备沉淀工作流、脚本、方法论并发布给团队的人。"
              tutorials={creators}
            />
          </div>
        </section>

        {grouped.map(([category, items]) => (
          <section className="docs-section" key={category}>
            <div className="docs-section-head">
              <h2>{category}</h2>
              <p>{items.length} 篇教程</p>
            </div>
            <div className="tutorial-grid">
              {items.map((tutorial) => (
                <TutorialCard key={tutorial.slug} tutorial={tutorial} />
              ))}
            </div>
          </section>
        ))}

        <div className="docs-actions">
          <Link className="hero-btn primary" href="/docs/what-is-skill-marketplace">
            从第一篇开始
          </Link>
          <Link className="hero-btn" href="/#explore">
            去发布墙
          </Link>
          <Link className="hero-btn" href="/publish">
            我要发布
          </Link>
        </div>
      </div>
    </div>
  )
}

function LearningPath({
  title,
  description,
  tutorials,
}: {
  title: string
  description: string
  tutorials: Tutorial[]
}) {
  return (
    <div className="learning-path">
      <h3>{title}</h3>
      <p>{description}</p>
      <ol>
        {tutorials.map((tutorial) => (
          <li key={tutorial.slug}>
            <Link href={`/docs/${tutorial.slug}`}>{tutorial.title}</Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  return (
    <Link className="tutorial-card" href={`/docs/${tutorial.slug}`}>
      <div className="tutorial-card-meta">
        <span>{audienceLabels[tutorial.audience]}</span>
        <span>{tutorial.duration}</span>
      </div>
      <h3>{tutorial.title}</h3>
      <p>{tutorial.description}</p>
      <div className="tutorial-card-footer">
        <span>{tutorial.difficulty}</span>
        <span>阅读教程</span>
      </div>
    </Link>
  )
}

function groupByCategory(tutorials: Tutorial[]): Array<[string, Tutorial[]]> {
  const grouped = new Map<string, Tutorial[]>()
  for (const tutorial of tutorials) {
    grouped.set(tutorial.category, [...(grouped.get(tutorial.category) || []), tutorial])
  }
  return Array.from(grouped.entries())
}
