import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Standalone CSS geometry reproduction, not a substitute for installed DSH acceptance.
// Usage: node browser-repro.mjs <plugin-source-checkout>
// Install Playwright + Chromium, or set PLAYWRIGHT_MODULE to an existing module URL.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core')
const checkout = resolve(process.argv[2] || '.')
const { STYLE: candidate } = await import(pathToFileURL(resolve(checkout, 'src/client-styles.js')).href)
const baselineModule = execFileSync('git', ['show', '5c326ff497a86f9327edb12317d18a5239aa3154:src/client-styles.js'], { cwd: checkout, encoding: 'utf8' })
const { STYLE: baseline } = await import(`data:text/javascript;base64,${Buffer.from(baselineModule).toString('base64')}`)
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const records = []
const cases = [
  { name: 'search-long-catalog', height: 720, search: true, count: 24 },
  { name: 'viewport-height-constraint', height: 400, search: true, count: 24 },
  { name: 'loading-and-warning', height: 720, search: true, count: 24, status: true },
  { name: 'no-search-short-catalog', height: 720, search: false, count: 4 },
]
try {
  for (const [version, css] of [['baseline', baseline], ['candidate', candidate]]) {
    for (const c of cases) {
      const page = await browser.newPage({ viewport: { width: 1024, height: c.height } })
      try {
        await page.setContent(`<style>${css}
          :root{--dsw-alias-border-inverted:#555}
          body{font:14px/20px sans-serif;margin:0}
          .fixture{position:fixed;top:48px;left:200px;right:auto;bottom:auto;width:240px}
        </style><div class="codexModelSelectSubmenu codexModelSelectModelMenu fixture" role="menu">
          ${c.status ? '<div class="codexModelSelectStatus">Loading models...</div><div class="codexModelSelectWarning">Example provider warning</div>' : ''}
          ${c.search ? '<input class="codexModelSelectSearch" placeholder="Search models">' : ''}
          <div class="codexModelSelectGroups scrollable"><section class="codexModelSelectGroup">
            <div class="codexModelSelectGroupTitle">Example provider</div>
            ${Array.from({ length: c.count }, (_, i) => `<button class="codexModelSelectOption" role="menuitemradio" onclick="this.dataset.clicked='true'"><span class="codexModelSelectOptionName">Model ${i + 1}</span></button>`).join('')}
          </section></div>
        </div>`)
        const box = await page.locator('[role=menu]').boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8)
        await page.mouse.wheel(0, 10000)
        await page.waitForFunction(() => {
          const list = document.querySelector('.codexModelSelectGroups')
          return list.scrollTop >= list.scrollHeight - list.clientHeight - 1
        })
        const geometry = await page.evaluate(() => {
          const menu = document.querySelector('[role=menu]')
          const list = document.querySelector('.codexModelSelectGroups')
          const last = list.querySelector('button:last-child')
          const m = menu.getBoundingClientRect(), l = list.getBoundingClientRect(), r = last.getBoundingClientRect()
          const search = document.querySelector('input')
          return {
            menuBottom: m.bottom, listBottom: l.bottom, listHeight: list.clientHeight,
            scrollTop: list.scrollTop, maxScroll: list.scrollHeight - list.clientHeight,
            lastTop: r.top, lastBottom: r.bottom,
            fullRowVisible: r.top >= l.top && r.bottom <= m.bottom - 5 && r.bottom <= innerHeight,
            hit: last.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
            outerScrollTop: menu.scrollTop, searchHeight: search?.getBoundingClientRect().height ?? null,
          }
        })
        records.push({ version, case: c.name, ...geometry })
        if (version === 'baseline' && c.search) {
          assert.equal(geometry.fullRowVisible, false, 'unpatched source must reproduce the clipping')
        } else {
          assert.equal(geometry.fullRowVisible, true, `the complete last row must fit inside the menu: ${JSON.stringify({ version, case: c.name, ...geometry })}`)
          assert.equal(geometry.hit, true, 'the last row must receive pointer input')
          assert.equal(geometry.outerScrollTop, 0, 'hidden outer menu must not scroll')
          if (c.search) assert.equal(geometry.searchHeight, 32)
          const last = page.locator('.codexModelSelectGroups button').last()
          const r = await last.boundingBox()
          await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2)
          assert.equal(await last.getAttribute('data-clicked'), 'true')
        }
      } finally {
        await page.close()
      }
    }
  }
  console.log(JSON.stringify({ browser: browser.version(), status: 'PASS', evidence: records }, null, 2))
} finally {
  await browser.close()
}
