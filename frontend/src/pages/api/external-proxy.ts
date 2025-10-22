import type { NextApiRequest, NextApiResponse } from 'next'

const ALLOWED_HOSTS = ['coder.josern.com']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { pathname } = req.query
    // Expect the client to call: /api/external-proxy?target=/api/v2/applications/auth-redirect&host=coder.josern.com
    const targetPath = (req.query.target as string) || '/'
    const host = (req.query.host as string) || 'coder.josern.com'

    if (!ALLOWED_HOSTS.includes(host)) {
      return res.status(400).json({ error: 'host not allowed' })
    }

    const backendUrl = `https://${host}${targetPath}${req.url && req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''}`

    const fetchOpts: any = {
      method: req.method,
      headers: {}
    }

    // forward client headers that are safe
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue
      const key = k.toLowerCase()
      if (['host', 'connection', 'content-length'].includes(key)) continue
      if (Array.isArray(v)) fetchOpts.headers[key] = v.join(',')
      else fetchOpts.headers[key] = v
    }

    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      fetchOpts.body = req.body && JSON.stringify(req.body)
      fetchOpts.headers['content-type'] = fetchOpts.headers['content-type'] || 'application/json'
    }

    // Ask node-fetch to NOT automatically follow redirects so we can forward the Location header to the browser.
    fetchOpts.redirect = 'manual'
    const response = await fetch(backendUrl, fetchOpts)

    // If upstream returned a redirect, forward it to the browser so the navigation happens client-side.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        // Use Next's redirect helper by setting status and Location header
        res.setHeader('Location', location)
        res.status(response.status).end()
        return
      }
    }

    const text = await response.text()

    // forward status and headers (but do not forward hop-by-hop headers or CORS headers from upstream)
    res.status(response.status)
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (['transfer-encoding', 'content-encoding', 'connection'].includes(lower)) return
      res.setHeader(key, value)
    })

    if (text) {
      try {
        const json = JSON.parse(text)
        res.json(json)
      } catch (e) {
        res.send(text)
      }
    } else {
      res.end()
    }
  } catch (err: any) {
    console.error('external-proxy error', err)
    res.status(502).json({ error: 'bad gateway' })
  }
}
