const fs = require('fs')
function read(path){
  try{ return JSON.parse(fs.readFileSync(path,'utf8')).blueprint || JSON.parse(fs.readFileSync(path,'utf8')) }
  catch(e){ console.error('Failed to read',path,e.message); process.exit(2) }
}
function summarise(path){
  if(!fs.existsSync(path)) { console.log('Missing',path); return }
  const bp = read(path)
  const ins = (bp.entities||[]).filter(e=>e.name==='inserter').map(e=>({entity_number:e.entity_number,x:e.position.x,y:e.position.y,direction:('direction' in e)?e.direction:null}))
  if(ins.length===0){ console.log(path,'no inserters'); return }
  const ys = ins.map(i=>i.y)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const mid = (minY+maxY)/2
  const dirs = [...new Set(ins.map(i=>i.direction))]
  console.log('\n===',path,'===')
  console.log('count',ins.length,'minY',minY,'maxY',maxY,'mid',mid)
  console.log('unique directions',dirs)
  const top = ins.filter(i=>i.y < mid).sort((a,b)=>a.y-b.y||a.x-b.x)
  const bottom = ins.filter(i=>i.y >= mid).sort((a,b)=>a.y-b.y||a.x-b.x)
  console.log('top count',top.length,'sample',top.slice(0,6))
  console.log('bottom count',bottom.length,'sample',bottom.slice(0,6))
}
[summarise('blueprints/smelting/smelting.json'), summarise('blueprints/smelting/tiled_4x2_norot.json'), summarise('blueprints/smelting/tiled_4x2.json')]
