import { Dashboard } from 'common/dashboard'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { z } from 'zod'
import { Json, MaybeAuthedEndpoint, validate } from './helpers'

const bodySchema = z.object({
  term: z.string(),
  offset: z.number().gte(0),
  limit: z.number().gt(0),
})

export const supabasesearchdashboards = MaybeAuthedEndpoint(
  async (req, auth) => {
    const { term, offset, limit } = validate(bodySchema, req.body)

    const pg = createSupabaseDirectClient()

    const searchDashboardSql = getSearchDashboardSQL({
      term,
      offset,
      limit,
    })
    const dashboards = await pg.map(
      searchDashboardSql,
      [term],
      (d) => d as Dashboard
    )

    return (dashboards ?? []) as unknown as Json
  }
)

function getSearchDashboardSQL(input: {
  term: string
  offset: number
  limit: number
}) {
  const { term, offset, limit } = input

  let query = ''
  const emptyTerm = term.length === 0

  if (emptyTerm) {
    query = `
        select *
        from dashboards
        order by importance_score desc
      `
  } else {
    query = `
        SELECT dashboards.*
        FROM dashboards,
        LATERAL websearch_to_tsquery('english', $1) as query
        WHERE dashboards.title_fts @@ query
        ORDER BY importance_score DESC
      `
  }
  return query + `LIMIT ${limit} OFFSET ${offset}`
}