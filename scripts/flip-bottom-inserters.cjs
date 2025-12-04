const fs = require('fs')
const p = 'blueprints/smelting/tiled_4x2.json'
if(!fs.existsSync(p)){ console.error('Missing',p); process.exit(2) }
const o = JSON.parse(fs.readFileSync(p,'utf8'))
const bp = o.blueprint || o
const ins = (bp.entities||[]).filter(e=>e.name==='inserter' && e.position && typeof e.position.y==='number')
if(ins.length===0){ console.error('No inserters found'); process.exit(1) }
const ys = ins.map(i=>i.position.y)
const minY = Math.min(...ys), maxY = Math.max(...ys)
const mid = (minY+maxY)/2
let changed = 0
for(const e of bp.entities){ if(e.name==='inserter' && e.position && typeof e.position.y==='number'){ if(e.position.y < mid){ if(e.direction !== 8){ e.direction = 8; changed++ } } else { if(e.direction !== 0){ e.direction = 0; changed++ } } } }
fs.writeFileSync(p, JSON.stringify(o,null,2))
console.log('Updated',changed,'inserters in',p,'(mid',mid,')')
