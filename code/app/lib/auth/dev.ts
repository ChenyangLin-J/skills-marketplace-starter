import { getUserByHandle, upsertUser, type MarketplaceUser } from '@/lib/users'

export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_LOGIN === '1'
}

export function getOrCreateDevUser(): MarketplaceUser {
  return (
    getUserByHandle('demo') ||
    upsertUser({
      open_id: 'dev_demo',
      union_id: 'dev_demo',
      tenant_key: 'dev',
      handleSeed: 'demo',
      name: 'Demo User',
      en_name: 'demo',
      avatar_url: '',
      email: 'demo@example.com',
    })
  )
}
