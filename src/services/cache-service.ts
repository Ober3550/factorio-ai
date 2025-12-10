import * as path from 'path'
import type { ProductionRequirement } from '../models/production-requirement.js'
import { readJsonFile, writeJsonFile, fileExists, deleteFile, listFiles } from '../lib/file-utils.js'

export interface CacheEntry {
  url: string
  result: ProductionRequirement
  cachedAt: string // ISO timestamp
  ttl: number // seconds (default: 604800 = 7 days)
}

export class CacheService {
  private cacheDir: string
  private defaultTTL: number

  constructor(cacheDir: string = '.factorio-cache/requirements', ttlSeconds: number = 604800) {
    this.cacheDir = cacheDir
    this.defaultTTL = ttlSeconds
  }

  // Get cache file path for a cache key
  private getCachePath(cacheKey: string): string {
    return path.join(this.cacheDir, `${cacheKey}.json`)
  }

  // Check if cache entry exists and is valid
  async has(cacheKey: string): Promise<boolean> {
    const cachePath = this.getCachePath(cacheKey)
    if (!(await fileExists(cachePath))) {
      return false
    }

    try {
      const entry = await readJsonFile<CacheEntry>(cachePath)
      const age = Date.now() - new Date(entry.cachedAt).getTime()
      return age < entry.ttl * 1000
    } catch {
      return false
    }
  }

  // Get cached production requirement
  async get(cacheKey: string): Promise<ProductionRequirement | null> {
    const cachePath = this.getCachePath(cacheKey)

    if (!(await fileExists(cachePath))) {
      return null
    }

    try {
      const entry = await readJsonFile<CacheEntry>(cachePath)
      const age = Date.now() - new Date(entry.cachedAt).getTime()

      if (age >= entry.ttl * 1000) {
        // Expired, delete and return null
        await deleteFile(cachePath)
        return null
      }

      return entry.result
    } catch (error) {
      console.error(`Error reading cache for key ${cacheKey}:`, error)
      return null
    }
  }

  // Save production requirement to cache
  async set(cacheKey: string, url: string, result: ProductionRequirement): Promise<void> {
    const cachePath = this.getCachePath(cacheKey)
    const entry: CacheEntry = {
      url,
      result,
      cachedAt: new Date().toISOString(),
      ttl: this.defaultTTL
    }

    await writeJsonFile(cachePath, entry)
  }

  // Delete specific cache entry
  async delete(cacheKey: string): Promise<void> {
    const cachePath = this.getCachePath(cacheKey)
    await deleteFile(cachePath)
  }

  // Clear all cache entries
  async clear(): Promise<number> {
    const files = await listFiles(this.cacheDir, /\.json$/)
    let count = 0

    for (const file of files) {
      await deleteFile(path.join(this.cacheDir, file))
      count++
    }

    return count
  }

  // Get cache statistics
  async stats(): Promise<{ total: number; expired: number; valid: number }> {
    const files = await listFiles(this.cacheDir, /\.json$/)
    let expired = 0
    let valid = 0

    for (const file of files) {
      const cachePath = path.join(this.cacheDir, file)
      try {
        const entry = await readJsonFile<CacheEntry>(cachePath)
        const age = Date.now() - new Date(entry.cachedAt).getTime()

        if (age >= entry.ttl * 1000) {
          expired++
        } else {
          valid++
        }
      } catch {
        expired++ // Corrupted entries count as expired
      }
    }

    return { total: files.length, expired, valid }
  }
}
