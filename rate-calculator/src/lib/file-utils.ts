import { promises as fs } from 'fs'
import * as path from 'path'

// Read JSON file and parse
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content) as T
}

// Write object to JSON file
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  // Write with pretty formatting
  const content = JSON.stringify(data, null, 2)
  await fs.writeFile(filePath, content, 'utf8')
}

// Check if file exists
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// Delete file if it exists
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

// List files in directory matching pattern
export async function listFiles(dirPath: string, pattern?: RegExp): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const files = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name)

    if (pattern) {
      return files.filter(name => pattern.test(name))
    }

    return files
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}
