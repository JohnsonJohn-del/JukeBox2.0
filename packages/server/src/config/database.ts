import fs from 'fs'
import path from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './index'

interface TableData {
  [tableName: string]: any[]
}

class LocalQueryBuilder {
  public tableName: string
  public store: LocalDatabase
  public filters: Array<(item: any) => boolean> = []
  public selectedFields: string[] | null = null
  public sortField: string | null = null
  public sortAscending: boolean = true
  public limitCount: number | null = null

  constructor(tableName: string, store: LocalDatabase) {
    this.tableName = tableName
    this.store = store
  }

  select(fields?: string) {
    if (fields && fields !== '*') {
      this.selectedFields = fields.split(',').map((f) => f.trim())
    }
    return this
  }

  eq(field: string, value: any) {
    this.filters.push((item) => item[field] === value)
    return this
  }

  in(field: string, values: any[]) {
    this.filters.push((item) => values.includes(item[field]))
    return this
  }

  or(filterStr: string) {
    const conditions = filterStr.split(',').map((cond) => {
      const parts = cond.split('.eq.')
      return { field: parts[0]?.trim(), val: parts[1]?.trim() }
    })
    this.filters.push((item) => {
      return conditions.some((c) => String(item[c.field]) === String(c.val))
    })
    return this
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sortField = field
    this.sortAscending = options?.ascending !== false
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  public filterAndProject(items: any[]): any[] {
    let result = items.filter((item) => this.filters.every((fn) => fn(item)))

    if (this.sortField) {
      const field = this.sortField
      const asc = this.sortAscending
      result.sort((a, b) => {
        if (a[field] < b[field]) return asc ? -1 : 1
        if (a[field] > b[field]) return asc ? 1 : -1
        return 0
      })
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount)
    }

    if (this.selectedFields) {
      result = result.map((item) => {
        const projected: any = {}
        for (const f of this.selectedFields!) {
          if (f in item) projected[f] = item[f]
        }
        return projected
      })
    }

    return JSON.parse(JSON.stringify(result))
  }

  insert(recordOrRecords: any | any[]) {
    const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords]
    const inserted = this.store.insertRows(this.tableName, records)

    const self = this
    const thenable = {
      select: (fields?: string) => {
        self.select(fields)
        return thenable
      },
      single: async () => ({
        data: JSON.parse(JSON.stringify(inserted[0] || null)),
        error: null,
      }),
      maybeSingle: async () => ({
        data: JSON.parse(JSON.stringify(inserted[0] || null)),
        error: null,
      }),
      then: (resolve: (res: any) => void) => {
        return Promise.resolve({
          data: Array.isArray(recordOrRecords) ? inserted : inserted[0],
          error: null,
        }).then(resolve)
      },
    }
    return thenable as any
  }

  update(updates: any) {
    const self = this
    const thenable = {
      eq: (field: string, val: any) => {
        self.eq(field, val)
        return thenable
      },
      select: (fields?: string) => {
        self.select(fields)
        return thenable
      },
      single: async () => {
        const updated = self.store.updateRows(self.tableName, self.filters, updates)
        return {
          data: JSON.parse(JSON.stringify(updated[0] || null)),
          error: null,
        }
      },
      maybeSingle: async () => {
        const updated = self.store.updateRows(self.tableName, self.filters, updates)
        return {
          data: JSON.parse(JSON.stringify(updated[0] || null)),
          error: null,
        }
      },
      then: (resolve: (res: any) => void) => {
        const updated = self.store.updateRows(self.tableName, self.filters, updates)
        return Promise.resolve({
          data: updated,
          error: null,
        }).then(resolve)
      },
    }
    return thenable as any
  }

  delete() {
    const self = this
    const thenable = {
      eq: (field: string, val: any) => {
        self.eq(field, val)
        return thenable
      },
      then: (resolve: (res: any) => void) => {
        self.store.deleteRows(self.tableName, self.filters)
        return Promise.resolve({
          data: null,
          error: null,
        }).then(resolve)
      },
    }
    return thenable as any
  }

  async single() {
    const items = this.store.getTable(this.tableName)
    const filtered = this.filterAndProject(items)
    return { data: filtered[0] || null, error: null }
  }

  async maybeSingle() {
    const items = this.store.getTable(this.tableName)
    const filtered = this.filterAndProject(items)
    return { data: filtered[0] || null, error: null }
  }

  then(resolve: (res: { data: any; error: any }) => void) {
    const items = this.store.getTable(this.tableName)
    const filtered = this.filterAndProject(items)
    return Promise.resolve({ data: filtered, error: null }).then(resolve)
  }
}

class LocalDatabase {
  private dataFilePath: string
  private tables: TableData = {
    users: [],
    rooms: [],
    room_members: [],
    queue_items: [],
  }

  constructor(filePath?: string) {
    this.dataFilePath = filePath || path.join(process.cwd(), 'data', 'local_jukebox_db.json')
    this.load()
  }

  private load() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf8')
        this.tables = { ...this.tables, ...JSON.parse(raw) }
        console.log(`[LocalDatabase] Loaded persistent data from ${this.dataFilePath}`)
      }
    } catch {
      console.warn('[LocalDatabase] Initialized new persistent store')
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.dataFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.tables, null, 2), 'utf8')
    } catch (e) {
      console.error('[LocalDatabase] Failed to write database file:', e)
    }
  }

  getTable(name: string): any[] {
    if (!this.tables[name]) {
      this.tables[name] = []
    }
    return this.tables[name]
  }

  insertRows(tableName: string, rows: any[]): any[] {
    const table = this.getTable(tableName)
    table.push(...rows)
    this.save()
    return rows
  }

  updateRows(tableName: string, filters: Array<(item: any) => boolean>, updates: any): any[] {
    const table = this.getTable(tableName)
    const updated: any[] = []
    for (const item of table) {
      if (filters.every((fn) => fn(item))) {
        Object.assign(item, updates)
        updated.push(item)
      }
    }
    this.save()
    return updated
  }

  deleteRows(tableName: string, filters: Array<(item: any) => boolean>): void {
    const table = this.getTable(tableName)
    this.tables[tableName] = table.filter((item) => !filters.every((fn) => fn(item)))
    this.save()
  }

  from(tableName: string) {
    return new LocalQueryBuilder(tableName, this)
  }
}

let dbClient: any = null
let localDbInstance: LocalDatabase | null = null

export function createDbClient(): any {
  return getDbClient()
}

export function getDbClient(): any {
  if (dbClient) {
    return dbClient
  }

  const supabaseUrl = config.database.supabaseUrl
  const supabaseKey = config.database.supabaseServiceKey || config.database.supabaseAnonKey

  // Check if valid Supabase credentials were provided
  const hasRealSupabase =
    Boolean(supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('your-project') &&
    supabaseUrl.startsWith('https://'))

  if (hasRealSupabase) {
    console.log('[Database] Connecting to remote Supabase instance:', supabaseUrl)
    dbClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    })
    return dbClient
  }

  // 100% Local PC Self-Contained Database
  if (!localDbInstance) {
    console.log('[Database] Running in 100% Local PC Mode (file-backed persistent local database)')
    localDbInstance = new LocalDatabase()
  }
  dbClient = localDbInstance
  return dbClient
}
