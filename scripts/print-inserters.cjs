const fs = require('fs')
function read(path){
  try{ return JSON.parse(fs.readFileSync(path,'utf8')).blueprint || JSON.parse(fs.readFileSync(path,'utf8')) }
  catch(e){ console.error('Failed to read',path,e.message); process.exit(2) }
}
function list(bp){
  return (bp.entities||[]).filter(e=>e.name==='inserter').map(e=>({entity_number:e.entity_number, x:(e.position&&e.position.x), y:(e.position&&e.position.y), direction:('direction' in e)?e.direction:null}))
}
const files = [
  ['original','blueprints/smelting/smelting.json'],
  ['decoded','blueprints/smelting/smelting_decoded.json'],
  ['composed','blueprints/smelting/tiled_4x2.json'],
  ['composed_no_rot','blueprints/smelting/tiled_4x2_norot.json']
]
for(const [label,path] of files){
  if(!fs.existsSync(path)) continue
  const bp = read(path)
  console.log('---',label,'(',path,') ---')
  console.log(JSON.stringify(list(bp),null,2))
}
