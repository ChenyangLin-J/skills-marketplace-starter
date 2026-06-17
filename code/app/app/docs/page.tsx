import Link from 'next/link'
import { listTutorials, type Tutorial, type TutorialAudience } from '@/lib/tutorials'

const audienceLabels: Record<TutorialAudience, string> = {
  all: 'Everyone',
  user: 'User',
  creator: 'Creator',
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
            <h1>Skills Marketplace Docs</h1>
            <p className="docs-lead">
              Learn how to install your first Skill, publish reusable workflows, and close the feedback loop with agents.
              Tutorials are maintained in Markdown and grouped by role.
            </p>
          </div>
          <div className="docs-status-panel" aria-label="Docs status">
            <span>P0 ready</span>
            <strong>{tutorials.length}</strong>
            <p>starter tutorials</p>
          </div>
        </section>

        <section className="docs-section">
          <div className="docs-section-head">
            <h2>Fastest path</h2>
            <p>Start with the path that matches your role.</p>
          </div>
          <div className="docs-path-grid">
            <LearningPath
              title="Use Skills"
              description="For people who want to install, run, and troubleshoot existing Skills."
              tutorials={users}
            />
            <LearningPath
              title="Create Skills"
              description="For people turning workflows, scripts, methods, or team knowledge into publishable Skills."
              tutorials={creators}
            />
          </div>
        </section>

        {grouped.map(([category, items]) => (
          <section className="docs-section" key={category}>
            <div className="docs-section-head">
              <h2>{category}</h2>
              <p>{items.length} tutorials</p>
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
            Start from the first guide
          </Link>
          <Link className="hero-btn" href="/#explore">
            Explore Skills
          </Link>
          <Link className="hero-btn" href="/publish">
            Publish a Skill
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
        <span>Read guide</span>
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
