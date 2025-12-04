const fs = require('fs')
function readBP(path){
  if(!fs.existsSync(path)) throw new Error('missing '+path)
  const raw = JSON.parse(fs.readFileSync(path,'utf8'))
  return raw.blueprint || raw
}
function boundsOfEntities(ents){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  for(const e of ents){ if(e.position){ minX=Math.min(minX,e.position.x); minY=Math.min(minY,e.position.y); maxX=Math.max(maxX,e.position.x); maxY=Math.max(maxY,e.position.y);} }
  return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY}
}
function listInserters(bp){ return (bp.entities||[]).filter(e=>e.name==='inserter').map(e=>({entity_number:e.entity_number, x:e.position.x, y:e.position.y, direction:('direction' in e)?e.direction:null})) }
try{
  const orig = readBP('blueprints/smelting/smelting.json')
  const origBounds = boundsOfEntities(orig.entities)
  // normalize original into top-left 0,0 by subtracting min floor of bounds
  const origMinX = Math.floor(origBounds.minX)
  const origMinY = Math.floor(origBounds.minY)
  const origInserters = (orig.entities||[]).filter(e=>e.name==='inserter').map(e=>({entity_number:e.entity_number, lx:Math.floor(e.position.x)-origMinX, ly:Math.floor(e.position.y)-origMinY, direction:('direction' in e)?e.direction:null}))

  const comp = readBP('blueprints/smelting/tiled_4x2.json')
  const compBounds = boundsOfEntities(comp.entities)
  const compMinX = Math.floor(compBounds.minX)
  const compMinY = Math.floor(compBounds.minY)
  // top-left tile in composed blueprint corresponds to compMinX..compMinX+origWidth-1, compMinY..compMinY+origHeight-1
  const origWidth = Math.ceil(origBounds.width)
  const origHeight = Math.ceil(origBounds.height)
  const tlX0 = compMinX
  const tlY0 = compMinY
  const tlX1 = tlX0 + origWidth - 1
  const tlY1 = tlY0 + origHeight - 1
  const compInserters = (comp.entities||[]).filter(e=>e.name==='inserter' && Math.floor(e.position.x)>=tlX0 && Math.floor(e.position.x)<=tlX1 && Math.floor(e.position.y)>=tlY0 && Math.floor(e.position.y)<=tlY1).map(e=>({entity_number:e.entity_number, x:e.position.x, y:e.position.y, lx:Math.floor(e.position.x)-tlX0, ly:Math.floor(e.position.y)-tlY0, direction:('direction' in e)?e.direction:null}))

  console.log('orig bounds',origBounds)
  console.log('orig normalized inserters (local coords):')
  console.log(JSON.stringify(origInserters,null,2))
  console.log('\ncomposed top-left bounds', {tlX0,tlY0,tlX1,tlY1,origWidth,origHeight})
  console.log('composed inserters in top-left tile:')
  console.log(JSON.stringify(compInserters,null,2))
} catch(err){ console.error(err); process.exit(1) }
