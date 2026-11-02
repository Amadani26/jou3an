/**
 * The branded photo placeholder — a solid #141414 canvas with the official
 * wordmark centred (800x600 PNG, ~5 KB).
 *
 * Served by the photo proxy whenever an image cannot be produced any other
 * way (expired photo name that self-healing could not refresh, Google down,
 * key unconfigured). The app must NEVER receive a broken image response:
 * every mobile surface renders whatever bytes this route returns, and an
 * error status paints an empty grey box on RN's <Image>.
 *
 * Embedded as base64 rather than shipped as a file on purpose: tsc does not
 * copy assets into dist/, and Railway builds in a fresh container — a
 * path-resolved asset is a deploy-shaped foot-gun, a constant is not.
 *
 * Regenerate (from the repo root) after a wordmark change:
 *   node -e "const s=require('./node_modules/sharp');(async()=>{const mark=await s('client/public/brand/jou3an-logo.png').resize({width:300}).toBuffer();const m=await s(mark).metadata();const png=await s({create:{width:800,height:600,channels:3,background:{r:0x14,g:0x14,b:0x14}}}).composite([{input:mark,left:Math.round((800-m.width)/2),top:Math.round((600-m.height)/2)}]).png({compressionLevel:9,palette:true}).toBuffer();console.log(png.toString('base64'))})()"
 */

const PHOTO_PLACEHOLDER_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAyAAAAJYCAMAAACtqHJCAAADAFBMVEUUFBQXFxf/MTMUExMWFhb9/f0VFRX////7+/v+/v76+vod' +
  'HR0rKysYGBgTExTm5ub7LzH+MDEUExMTFBP09PQVFBP39/e3t7f9LzGnp6caGhr5+fkVExVDQ0MbGxv9MC7j4+MTExX+MC//Njj/' +
  'NDMTExNVVVUWExP+LjD/NjXu7u6enp7/MzX/NTceHh719fUiIiI8PDwlJSWAgIAwMDD7LzAXExTX19fy8vL7Ly4tLS0yMjIfHx+k' +
  'pKSfn5//MjT7MDH/MDHb29tLS0s3NzcpKin/MzH+LzMjFRUaExT/MjIeEhKpqamHh4d0dHTp6enBwcF3d3f/MTIWFRRLHBz/Ly3/' +
  'NDUfFBTs7OxYWFjLy8tcXFx5eXknJyewsLBhYWHh4eH7LzJdXV3/MDP/MC8qFRUcFBRsbGycnJzT09NOTk5AQEDd3d3V1dX4+Pha' +
  'Wlq/v789PT2mpqY1NTWysrL+MS0mFBQXExbQMS/g4OBubm6CgoLl5eW1tbU5OTnNzc3IyMigoKCsrKzf399mZmYWFhZbHR9mICFJ' +
  'GxvDLi3nMjX/ODo3Fxj/MjDTLi7c3NyWlpZFRUXGxsa2trZWVlaPj4/Dw8PQ0NC9vb26urqyKirILi8UFBX7LTHgMC+UJilvISE7' +
  'GBnaLzL1MjT+MjT5NTb7LS7MMjGNjY3v7++QkJDr6+uKioqYmJhTU1O7u7u4uLi0Ki2bJSSjKiv7MS2fKCj7Li1THB1AGBfuMjR+' +
  'IyQuFhbQMDTdMjK+Ky2tKirW1taEhITR0dFycnJISEhwcHC4KyyVlZVpaWl8fHyurq6pKSzLLzGzLSzgLy64Li7fMzf5MC4YFhZG' +
  'GRrsNTb7MzbUMTEzGBrBKSuEIiFfX1/o6OiTk5OhoaGwKSqhJyf/My7zNjaNKSq7MDFhHiD7MjLsNTzwMjb7LypVHBv+NTflMi+O' +
  'JSN5IiB4ICB+KChyHh2JIyOVKS/hMz71NTmZKSqSLC4jICHWLy2hJiPWNTHZKChrHx7pKCljHyGXJCdp1FxiAAAACXBIWXMAAAPo' +
  'AAAD6AG1e1JrAAAQ8UlEQVR42u3dB3iV5b0A8DecnHznRALmiWiEsEJQsAQQAYOAAwS0V1TAAlJQuS7cOBD3oFaryK2rat17b2u1' +
  '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' +
  'P7HvlNx85X24Obmq3HRfcGacrVgZYes7tylXU6FP7t+72IJoDA9UZwDnc30nDFa+z+VHfK4QuJmSYTPD9+49I37ce+8Z373jhT/e' +
  'OWncuPd3bd7c/alLn42dvLFJUu3BSk/dW665UnFbklay6lSxSivAwvTts0nv65Ig9C5Chl+fVKri6dtwvtd78LzBlZbuyJW1df6a' +
  '5SC9VhjGWtOUHcoh1jT8sZqD99qnepa0cPl8327gzMYVf1Fy+pHPXf6R216cdM8nf/eBLRu6vvF0zJDGcGhlXku2zsKt8qBmz3lx' +
  '04ESJH17CPNX1XT5ShD6m3Nu/YWCaTGxardKb1JjOO6E9Ln8GywpzOfiPocdW9mnKbTE3rA32iefnqWnuB697abYIN8ndfo+maaZ' +
  'vXux9n2xa9bo0e0z7pn02jNx6zWl9n3Mx+2OvWaH6JrC58Kjg4+pDMAcGK+hbhWr3JUWmo4eEy9RgjBgGRJe/mHhzb3SXiguPI/T' +
  'du8bVdPb2hgmf6ynENHZevGe7hNf2GbdtJoAa2pM4y+fGzHQMvZYa8uftndxj2XhHy/72i1fu+WWW772T79Kn2gbG1fadnR03JR2' +
  'W720/ObO0UsHDZox7tZY3JwSV5mnhV2uOtxR03l9bD5XeDW+/OV0/fnVseyLYokyu+/GsZ419YHC7JOiZglCv1mGU/c/oVdnUL4w' +
  '4XBdn1vkxPlagx/atTic1pzrI1t4hz7+R7MLHUQ14yNh2tmfLrTuq5v2Ossrx5ZvFbQs/Ev3rPcvjTYs/NRTF19++lGlmzTMXHH6' +
  'M7feefiipXE+1qD2rq8vi8OBlVrUWWFUY28tw8PDlSHEKekAZKUEmTK7/zSAOCMlzj6pdki7qwn9C5HhV+7y6JlTKm/uPbuectG0' +
  'mntcVTdsmb/440Nz9W7YcMD6+x4ZNcA+960/oE6ps+0Jc49eUL3bYUe4ePOs9tGpzs6JE3/7wr2//OoNN9zw1a9fesYLd3Z3Lmrt' +
  'TBNk60m/DAs+lJuybWqbZLu6E1+m7povb3BgzNFXkm3Sb6aMWDm73ubxEnf4bOmIPXE5YqOQoE9nVlNhYeD817+0/+r9jz7pc4Nb' +
  'CgOB9Xq90lbL3jvs/9D7Drn+2qvOv27VBddef9qF9y05+LzCZK6WxgEOPvXkk1b/6JRzD7xq1XXnX3Dto6+sW3z0/OmNvc4yM6x4' +
  'dcusND32ipN5J+w1aI9JexRs2bJwwj2trZ/YEmtYsYr1i/BvsweX7Dan/gyBqbuVt5gek3Za+ZvBLQPcTjX+8OUjThMO1InilqY+' +
  'c0cGvANv47t3196G2l3GLgu//+cjZk3ojMtsWzsntLZvPWPPuLYwrgpZ2x6n+O61YfSeizq/ueU3t4cd/y8KUXhLN21/C7dqL97c' +
  'vanud29pn3Stbv9dMhvDJT9ffvPaWMPasmXD0t4rCjs7D1/UOWvGz35+SZiZGTbMH4v3mrGZsDEc9Gr3wgk3r1275561i9LTxbYz' +
  '1t5zxM8mPv90bMy3Ve/aAO+ZBEnvahJW3Hbp3ZsnTZowuj1dbNte+By/tG5ZuLz77htv2yd0ZNoymYxfF+81wzrGhsyyuDzqI//w' +
  '9W98Z+LycePGdS9fvrw73hQrPvrUd2949ttHpfeVy4xvkx+8BxXu6J7ZODZ+OvLbFz/7i6e+8vgXvvCFG37y01v/7pKnb1+RbjIz' +
  'E+/1rn7Fe7soWVa/hFimaQ4h/ddBdlw2c1lTXBhSaG3Ee7vPnDlMtQqKCv9iztixQ8YX2uPxHiZDxo/3W4FKERKTJKbF2Ngcif+u' +
  'VMwOCQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/Bv4X' +
  'xAHHw1sQ3JEAAAAASUVORK5CYII=' +
  ''

export const PHOTO_PLACEHOLDER_PNG = Buffer.from(PHOTO_PLACEHOLDER_BASE64, 'base64')

export const PHOTO_PLACEHOLDER_CONTENT_TYPE = 'image/png'
