import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  getAdjacentTutorials,
  getTutorialBySlug,
  listTutorials,
  type Tutorial,
  type TutorialAudience,
} from '@/lib/tutorials'

const audienceLabels: Record<TutorialAudience, string> = {
  all: '所有人',
  user: '使用者',
  creator: '创作者',
}

type Params = Promise<{ slug: string }>

export function generateStaticParams() {
  return listTutorials().map((tutorial) => ({ slug: tutorial.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const tutorial = getTutorialBySlug(slug)
  if (!tutorial) return {}
  return {
    title: `${tutorial.title} · Skill Marketplace 教程`,
    description: tutorial.description,
  }
}

export default async function TutorialPage({ params }: { params: Params }) {
  const { slug } = await params
  const tutorial = getTutorialBySlug(slug)
  if (!tutorial) notFound()

  const tutorials = listTutorials()
  const adjacent = getAdjacentTutorials(tutorial.slug)

  return (
    <div className="docs-page tutorial-page">
      <div className="tutorial-layout">
        <aside className="tutorial-sidebar">
          <Link className="tutorial-back-link" href="/docs">
            返回教程中心
          </Link>
          <nav aria-label="教程目录">
            {tutorials.map((item) => (
              <Link
                key={item.slug}
                className={`tutorial-sidebar-link${item.slug === tutorial.slug ? ' active' : ''}`}
                href={`/docs/${item.slug}`}
              >
                <span>{item.order}</span>
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="tutorial-main">
          <header className="tutorial-header">
            <div className="docs-kicker">{tutorial.category}</div>
            <h1>{tutorial.title}</h1>
            <p>{tutorial.description}</p>
            <div className="tutorial-meta-row">
              <span>{audienceLabels[tutorial.audience]}</span>
              <span>{tutorial.difficulty}</span>
              <span>{tutorial.duration}</span>
            </div>
          </header>

          <div className="tutorial-media-strip">
            {tutorial.screenshot ? (
              <div className="tutorial-media-image">
                <Image
                  src={tutorial.screenshot}
                  alt={`${tutorial.title}截图`}
                  fill
                  sizes="(max-width: 960px) 100vw, 560px"
                />
              </div>
            ) : null}
            {tutorial.videoPlaceholder ? (
              <div className="tutorial-video-placeholder">
                <span>视频占位</span>
                <p>{tutorial.videoPlaceholder}</p>
              </div>
            ) : null}
          </div>

          <div className="tutorial-article markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                img: TutorialImage,
              }}
            >
              {tutorial.body}
            </ReactMarkdown>
          </div>

          <TutorialPager previous={adjacent.previous} next={adjacent.next} />
        </article>
      </div>
    </div>
  )
}

function TutorialImage({
  src,
  alt,
}: {
  src?: string | Blob
  alt?: string
}) {
  if (!src || typeof src !== 'string') return null
  return (
    <span className="tutorial-inline-image-frame">
      <Image src={src} alt={alt || ''} fill sizes="(max-width: 960px) 100vw, 760px" />
    </span>
  )
}

function TutorialPager({
  previous,
  next,
}: {
  previous: Tutorial | null
  next: Tutorial | null
}) {
  return (
    <div className="tutorial-pager">
      {previous ? (
        <Link href={`/docs/${previous.slug}`}>
          <span>上一篇</span>
          {previous.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={`/docs/${next.slug}`}>
          <span>下一篇</span>
          {next.title}
        </Link>
      ) : (
        <span />
      )}
    </div>
  )
}
