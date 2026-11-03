import { webkit } from 'playwright'
const [,, url, out, tag, wArg='393', hArg='852'] = process.argv
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const w=Number(wArg), h=Number(hArg), isPhone = w < 900
const browser = await webkit.launch()
const ctx = await browser.newContext({
  viewport:{width:w,height:h}, deviceScaleFactor: isPhone?3:2,
  isMobile:isPhone, hasTouch:isPhone, userAgent:isPhone?IPHONE_UA:undefined,
})
const page = await ctx.newPage()
await page.goto(url,{waitUntil:'load',timeout:60000})
await page.waitForTimeout(1500)
const total = await page.evaluate(()=>document.documentElement.scrollHeight)
const steps = Math.ceil(total/h)
for (let i=0;i<steps;i++){
  await page.evaluate((y)=>window.scrollTo(0,y), i*h)
  await page.waitForTimeout(900)
  await page.screenshot({path:`${out}/${tag}-s${String(i).padStart(2,'0')}.png`})
}
console.log('captured',steps,'screens; total height',total)
await browser.close()
