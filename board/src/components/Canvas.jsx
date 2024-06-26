import React, { useCallback, useMemo, useState } from 'react'
import Info from './Info'
import Participants from './Participants'
import Toolbar from './Toolbar'
import Quest from './Quest'
import Advancedbar from './Advancedbar'
import { useMutation, useCanRedo, useCanUndo, useHistory, useStorage, useOthers, useOthersMapped, useSelf } from '../../liveblocks.config'
import { CanvasMode, LayerType } from '../../types/canvas'
import CursorsPresence from './CursorsPresence'
import { connectionIdToColor, findIntersectingLayersWithRectangle, pointerEventToCanvasPoint, resizeBounds } from '@/constants'
import { nanoid } from 'nanoid'
import { LiveObject } from '@liveblocks/client'
import LayerPreview from './LayerPreview'
import SelectionBox from './SelectionBox'
import SelectionTools from './SelectionTools'
import LockTools from './LockTools'
import HideLayer from './HideLayer'
import { Button } from './ui/button'
import AddShapeCombin from './AddShapeCombin'
import IdeasRectTitle from './IdeasRectTitle'
import CombinaisonTheme from './CombinaisonTheme'
import  RaffinementTable  from './RaffinementTable'
import AddShapeRaffin from './AddShapeRaffin'
import { RaffinementColumns } from './RaffinementColumns'
import { PriorityMoscow } from './PriorityMoscow'
import { IdeasRectMoscow } from './IdeasRectMoscow'
import MoscowDoit  from './MoscowDevrait'
import MoscowDevrait from './MoscowDoit'
import MoscowPourrait from './MoscowPourrait'
import MoscowDevraitPas from './MoscowDevraitPas'
import MoscowTitre from './MoscowTitre'


const MAX_LAYERS = 100


const Canvas = ({boardId}) => {

  const layerIds = useStorage((root) => root.layerIds)//we use layers to know where and what to display in our canvas


  const selection = useSelf((me) => me.presence.selection)

  const [ canvasState, setCanvasState ] = useState({mode: CanvasMode.None})
  const [ camera, setCamera ] = useState({ x: 0, y: 0 })
  const [ focus, setFocus ] = useState(false)
  const [ lastUsedColor, setLastUsedColor ] = useState({r: 255,g : 255, b: 255})

  const locking = useMutation(({ storage }) => {
    const liveLayers = storage.get('layers')
    return liveLayers.get(selection[0])?.get("lock")

  }, [selection])

  const hiding = useMutation(({ storage }, layerId) => {
    const liveLayers = storage.get('layers')
    return liveLayers.get(layerId)?.get("hide")

  }, [selection])

  let lockme = locking()
  let hide = hiding()

  const history = useHistory()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()

  const insertLayer = useMutation((
    { storage, setMyPresence },
    LayerType,
    position,
    size
  ) => {
    const liveLayers = storage.get('layers')
    if(liveLayers.size >= MAX_LAYERS){
      return
    }

    const liveLayerIds = storage.get('layerIds')
    const layerId = nanoid()
    const layer = new LiveObject({
      type: LayerType,
      x: position.x,
      y: position.y,
      height: size.height,
      width: size.width,
      fill: lastUsedColor,
      lock: false,
      hide: false
    })

    liveLayerIds.push(layerId)
    liveLayers.set(layerId, layer)

    setMyPresence({ selection: [layerId] }, { addToHistory: true })
    setCanvasState({ mode: CanvasMode.None })

  }, [lastUsedColor])

  const insertLayer1 = useMutation((
    { storage, setMyPresence },
    LayerType,
    position,
    size,
    fill
  ) => {
    const liveLayers = storage.get('layers')
    if(liveLayers.size >= MAX_LAYERS){
      return
    }

    const liveLayerIds = storage.get('layerIds')
    const layerId = nanoid()
    const layer = new LiveObject({
      type: LayerType,
      x: position.x,
      y: position.y,
      height: size.height,
      width: size.width,
      fill: fill,
      lock: false,
      hide: false
    })

    liveLayerIds.push(layerId)
    liveLayers.set(layerId, layer)


    setMyPresence({ selection: [layerId] }, { addToHistory: true })
    setCanvasState({ mode: CanvasMode.None })

  }, [])

  const translateSelectedLayers = useMutation(({ storage, self }, point) => {
    if (canvasState.mode !== CanvasMode.Translating) {
      return
    }

    const offset = {
      x: point.x - canvasState.current.x,
      y: point.y - canvasState.current.y,
    }

    const liveLayers = storage.get("layers")

    for (const id of self.presence.selection) {
      const layer = liveLayers.get(id)

      if (layer) {
        layer.update({
          x: layer.get("x") + offset.x,
          y: layer.get("y") + offset.y,
        })
      }
    }

    setCanvasState({ mode: CanvasMode.Translating, current: point })
  }, [canvasState,])

  const unselectLayers = useMutation(({ self, setMyPresence }) => {
    if (self.presence.selection.length > 0) {
      setMyPresence({ selection: [] }, { addToHistory: true })
    }
  }, [])

  const updateSelectionNet = useMutation(({ storage, setMyPresence },current, origin) => {
    const layers = storage.get("layers").toImmutable();
    setCanvasState({
      mode: CanvasMode.SelectionNet,
      origin,
      current,
    });

    const ids = findIntersectingLayersWithRectangle(
      layerIds,
      layers,
      origin,
      current,
    );

    setMyPresence({ selection: ids });
  }, [layerIds]);

  const startMultiSelection = useCallback((current, origin) => {
    if (
      Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y) > 5
    ) {
      setCanvasState({
        mode: CanvasMode.SelectionNet,
        origin,
        current,
      })
    }
  }, [])

  const resizeSelectedLayer = useMutation(({ storage, self }, point) => {
    if (canvasState.mode !== CanvasMode.Resizing) {
      return
    }

    const bounds = resizeBounds(
      canvasState.initialBounds,
      canvasState.corner,
      point,
    )

    const liveLayers = storage.get("layers")
    const layer = liveLayers.get(self.presence.selection[0])

    if (layer) {
      layer.update(bounds)
    }
  }, [canvasState])

  const onResizeHandlePointerDown = useCallback(( corner, initialBounds ) => {
    history.pause()
    setCanvasState({
      mode: CanvasMode.Resizing,
      initialBounds,
      corner,
    })
  }, [history])

  const onWheel = useCallback((e) => {
    setCamera((camera) => ({
      x: camera.x - e.deltaX,
      y: camera.y - e.deltaY,
    }))
  }, [])

  const onPointerMove = useMutation(({ setMyPresence }, e) => {
    e.preventDefault()

    const current = pointerEventToCanvasPoint(e, camera)

    if (canvasState.mode === CanvasMode.Pressing) {
      startMultiSelection(current, canvasState.origin)
    } else if (canvasState.mode === CanvasMode.SelectionNet) {
      updateSelectionNet(current, canvasState.origin);
    } else if(canvasState.mode === CanvasMode.Translating){
      translateSelectedLayers(current)
    } else if (canvasState.mode === CanvasMode.Resizing){
      resizeSelectedLayer(current)
    }

    setMyPresence({ cursor: current })
  }, [camera, canvasState, resizeSelectedLayer, translateSelectedLayers])

  const onPointerLeave = useMutation(({ setMyPresence }) => {
    setMyPresence({ cursor: null })
  }, [])

  const onPointerDown = useCallback((e) => {
    const point = pointerEventToCanvasPoint(e, camera)

    if (canvasState.mode === CanvasMode.Inserting) {
      return
    }

    setCanvasState({ origin: point, mode: CanvasMode.Pressing })
  }, [camera, canvasState.mode, setCanvasState])

  const onPointerUp = useMutation(({}, e) => {
    const point = pointerEventToCanvasPoint(e, camera)
    
    if ( canvasState.mode === CanvasMode.None || canvasState.mode === CanvasMode.Pressing ) {
      unselectLayers()
      setCanvasState({ mode: CanvasMode.None, })
    } else if(canvasState.mode === CanvasMode.Inserting){
      insertLayer(canvasState.LayerType, point,{height:100,width:100})
    } else{
      setCanvasState({ mode: CanvasMode.None })
    }

    history.resume()
  }, [ camera, canvasState, history, insertLayer, unselectLayers,])

  const selections = useOthersMapped((other) => other.presence.selection)

  const onLayerPointerDown = useMutation(({self, setMyPresence}, e, layerId) => {
    if( canvasState.mode === CanvasMode.Inserting ){
      return 
    }
    history.pause()
    e.stopPropagation()

    const point = pointerEventToCanvasPoint(e, camera)
    
    if(!self.presence.selection.includes(layerId)){
      setMyPresence({ selection: [layerId] }, { addToHistory: true })
    }
    setCanvasState({ mode: CanvasMode.Translating, current: point })
  }, [setCanvasState, camera, history, canvasState.mode])

  const layerIdsToColorSelection = useMemo(() => {
    const layerIdsToColorSelection = {}

    for(const user of selections){
      const [connectionId, selection] = user
      for(const layerId of selection){
        layerIdsToColorSelection[layerId] = connectionIdToColor(connectionId)
      }
    }

    return layerIdsToColorSelection
  }, [selections])

const [scale, setScale] = useState(1)

function zoomIn() {
  setScale(prevScale => prevScale + 0.2)
  
}


function zoomOut() {
  setScale(prevScale => prevScale - 0.2)
  
}




const insertCombin= useMutation(({storage}) =>{
const layerIds=storage.get("layerIds")
const liveLayers = storage.get("layers")
var number=0

for (const id of layerIds){
  const layer = liveLayers.get(id)

  if (layer.get("type")== 15){
    number=number+1
  }
}
const x = 55+number*20
const y = 350 +number*20

insertLayer1(15,{x:x,y:y},{height:305,width:350},{r:200, g:233, b:251})

moveToFront2()
},[] )


const insertRaffin= useMutation(({storage}) =>{
const layerIds=storage.get("layerIds")
const liveLayers = storage.get("layers")
let number=0

let ideas = null;
let currentY = 0;

for (const id of layerIds){
  const layer = liveLayers.get(id)

if (layer.get("type")==16){
  ideas = layer
  currentY = layer.get("y")
  layer.update({
  y: currentY + 110
  })

}
  else if (layer.get("type")== 18){
    number=number+1
  }
  else if(layer.get("type")== 17){

    const currentHeight=layer.get("height")
    
    layer.update({
      height: currentHeight + 130
    })
  }
  else if (layer.get("type")==1 ){
    const currenty= layer.get("y")
    if( layer.get("y")> minY){
      layer.update({
        y: currenty+ 110
      })
    }
  }
  
  
}

const y = 190 +(number/9)*120



insertLayer1(18,{x:60,y:y},{height:100,width:155},{r:255, g:243, b:209})
insertLayer1(18,{x:230,y:y},{height:100,width:135},{r:200, g:233, b:251})
insertLayer1(18,{x:375,y:y},{height:100,width:140},{r:252, g:228, b:200})
insertLayer1(18,{x:525,y:y},{height:100,width:140},{r:200, g:233, b:251})
insertLayer1(18,{x:680,y:y},{height:100,width:135},{r:255, g:198, b:242})
insertLayer1(18,{x:825,y:y},{height:100,width:140},{r:202, g:252, b:234})
insertLayer1(18,{x:975,y:y},{height:100,width:140},{r:238, g:227, b:219})
insertLayer1(18,{x:1123,y:y},{height:100,width:143},{r:202, g:252, b:234})
insertLayer1(18,{x:1280,y:y},{height:100,width:150},{r:255, g:243, b:209})
moveToFront2()
},[] )
  


function Combinaison(){
  insertLayer1(15,{x:60,y:20},{height:305,width:350}, {r:255, g:208, b:72}) //inserting the three parts shape
  
  insertLayer1(15,{x:60,y:330},{height:305,width:350},{r:155, g:163, b:235})
  
  insertLayer1(19,{x:700,y:100},{height:150,width:700},{r:236, g:246, b:255,})// inserting where ideas will be shown
  updatePositionCombinaison()
                                                      //this will be changed and put inside the update Position function

  moveToFront2()
  

}

function Raffinement(){
  insertLayer1(16,{x:100,y:450},{height:150,width:1300},{r:236, g:246, b:255})

  insertLayer1(17,{x:50,y:190},{height:110,width:1380},{r:256, g:256, b:256})// the talbe space
  insertLayer1(18,{x:60,y:190},{height:100,width:155},{r:255, g:243, b:209})
  insertLayer1(18,{x:230,y:190},{height:100,width:135},{r:200, g:233, b:251})
  insertLayer1(18,{x:375,y:190},{height:100,width:140},{r:252, g:228, b:200})
  insertLayer1(18,{x:525,y:190},{height:100,width:140},{r:200, g:233, b:251})
  insertLayer1(18,{x:680,y:190},{height:100,width:135},{r:255, g:198, b:242})
  insertLayer1(18,{x:825,y:190},{height:100,width:140},{r:202, g:252, b:234})
  insertLayer1(18,{x:975,y:190},{height:100,width:140},{r:238, g:227, b:219})
  insertLayer1(18,{x:1123,y:190},{height:100,width:143},{r:202, g:252, b:234})
  insertLayer1(18,{x:1280,y:190},{height:100,width:150},{r:255, g:243, b:209})
  updatePositionRaffinement()
  moveToFront2()

}


let count =0;
let ideas=null;

let minX=0;
let minY=0;

const updatePositionRaffinement= useMutation(({storage}) =>{

  const layerIds = storage.get("layerIds")
  const liveLayers = storage.get("layers")

let currentIdeaX=0;
let currentIdeaY=0;

  //var position={x,y}


  for (const id of layerIds) {
      const layer = liveLayers.get(id)
      if (layer.get("type")== 16){
        ideas = layer
        //moveToBack(layer.get(id))
      }
    }

    const minX= ideas.get("x")
    const maxX = minX + ideas.get("width")
     minY = ideas.get("y")
    const maxY = minY + ideas.get("height")
    currentIdeaX= minX +30
    currentIdeaY= minY + 30
    for (const id of layerIds) {

      const layer = liveLayers.get(id)
    
      if(layer.get("type") == 1){

      const currentX = layer.get("x")
      const currentY = layer.get("y")
      const currentHeight = layer.get("height")
      const currentwidth = layer.get("width")
          
      layer.update({
        height : 80,
        width : 80,
        x: currentIdeaX,
        y: currentIdeaY,
      });
      currentIdeaX= currentIdeaX+ 130
      if (currentIdeaX > maxX - 100){
        currentIdeaX = minX + 30
        currentIdeaY= currentIdeaY +100
        minY=currentIdeaY
        if(currentIdeaY>maxY-50){
          ideas.update({
            height: ideas.get("height")+ 120
          });
        }
      }
  }
  }


}, [] ) // always use it with useMutation useEffect ( error type deps)

const updatePositionCombinaison= useMutation(({storage}) =>{

  let raffinementColumn=null;
  let currentx=0;
  let width=0;
  const layerIds = storage.get("layerIds")
  const liveLayers = storage.get("layers")

  
  
  //var position={x,y}
  
  let currentIdeaX=0;
  let currentIdeaY=0;
  
  for (const id of layerIds) {
    const layer = liveLayers.get(id)
    if (layer.get("type")== 19){
      ideas = layer
      //moveToBack(layer.get(id))
    }
    else if (layer.get("type")==17){
      raffinementColumn= layer
      currentx=layer.get("x")
      width = layer.get("width")
      layer.update({
        x: currentx -1500
      })
      
      
    }
    else if (layer.get("type") ==16  ){
      const currentx=layer.get("x")
      const width = layer.get("width")
      layer.update({
        x: currentx -1500
      })
    }
    else if (layer.get("type")==18){
      const currentx=layer.get("x")
      const width = layer.get("width")
      layer.update({
          x: currentx -1500
        })
      }

    }

    const minX= ideas.get("x")
    const maxX = minX + ideas.get("width")
     minY = ideas.get("y")
    const maxY = minY + ideas.get("height")
    currentIdeaX= minX +30
    currentIdeaY= minY + 30
    for (const id of layerIds) {

      const layer = liveLayers.get(id)
      if((layer.get("type") == 1) ) {
        const currentX = layer.get("x")
        const currentY = layer.get("y")
        const currentHeight = layer.get("height")
        const currentwidth = layer.get("width")
        layer.update({
          x:currentX -1500
        })

      if ((layer.get("x")+1500 > ((currentx + width)-250))){


          
      layer.update({
        height : 70,
        width : 70,
        x: currentIdeaX,
        y: currentIdeaY,
      });
      currentIdeaX= currentIdeaX+ 130
      if (currentIdeaX > maxX - 100){
        currentIdeaX = minX + 30
        currentIdeaY= currentIdeaY +100
        minY=currentIdeaY
        if(currentIdeaY>maxY-50){
          ideas.update({
            height: ideas.get("height")+ 120
          });
        }
      }
    }
  }
  }

}, [] ) // always use it with useMutation useEffect ( error type deps)


  //const liveLayers = storage.get("layers")
  const moveToFront2 = useMutation(({ storage }) => {
    const liveLayerIds = storage.get("layerIds")
    const indices = []
    const selection=[] 

    const liveLayers = storage.get("layers")
  
  
  
    for (const id of liveLayerIds) {
        const layer = liveLayers.get(id)
        if(layer.get("type")==1){

        selection.push(id)

        }
      }

    const arr = liveLayerIds.toImmutable()
    
    for (let i = 0; i < arr.length; i++) {
      if (selection.includes(arr[i])) {
        indices.push(i)
      }
    }

    for (let i = indices.length - 1; i >= 0; i--) {
      liveLayerIds.move(
        indices[i],
        arr.length - 1 - (indices.length - 1 - i)
      )
    }
  }, [selection]);


function insertMoscow(){
  insertLayer1(21,{x:1100,y:80},{height:130,width:280},{r:236, g:246, b:255})
  insertLayer(20,{x:60,y:100},{height:500,width:1000})
  updatePositionMoscow()
  moveToFront2()
}


const updatePositionMoscow= useMutation(({storage})=>{

  let raffinementColumn=null;
  let currentx=0;
  let width=0;
  const layerIds = storage.get("layerIds")
  const liveLayers = storage.get("layers")
  const shapes=[]

  
  
  //var position={x,y}
  
  let currentIdeaX=0;
  let currentIdeaY=0;
  
  for (const id of layerIds) {
    const layer = liveLayers.get(id)
    if (layer.get("type")== 21){
      ideas = layer

    }
    else if (layer.get("type")==17){
      raffinementColumn= layer
      currentx=layer.get("x")
      width = layer.get("width")
      layer.update({
        x: currentx -1500
      })
      
      
    }
    else if (layer.get("type") ==16  ){
      const currentx=layer.get("x")
      const width = layer.get("width")
      layer.update({
        x: currentx -1500
      })
    }
    else if (layer.get("type")==18){
      const currentx=layer.get("x")
      const width = layer.get("width")
      layer.update({
          x: currentx -1500
        })
      }
      else if(layer.get("type")== 19){
        const currentx=layer.get("x")
        layer.update({
          x:currentx-1500
        })
      }
      else if(layer.get("type")==15){
        const currentx=layer.get("x")
        shapes.push(layer)
        layer.update({
          x:currentx -1500
        })
      }

    }

    const minX= ideas.get("x")
    const maxX = minX + ideas.get("width")
     minY = ideas.get("y")
    const maxY = minY + ideas.get("height")
    currentIdeaX= minX +30
    currentIdeaY= minY + 30
    for (const id of layerIds) {

      const layer = liveLayers.get(id)
      if((layer.get("type") == 1) ) {
        const currentX = layer.get("x")
        const currentY = layer.get("y")
        const currentHeight = layer.get("height")
        const currentwidth = layer.get("width")
        layer.update({
          x:currentX -1500
        })

        for(const shape of shapes){
          if ((layer.get("x")+1500 > shape.get("x")+1500) && (layer.get("x")+1500<shape.get("x")+shape.get("width")+1500)&& (layer.get("y")>=shape.get("y")+shape.get("height")-3*shape.get("height")/10)&&(layer.get("y")<=shape.get("y")+shape.get("height"))){


          
            layer.update({
            height : 70,
            width : 70,
            x: currentIdeaX,
            y: currentIdeaY,
            });
            currentIdeaX= currentIdeaX+ 130
          if (currentIdeaX > maxX - 100){
            currentIdeaX = minX + 30
            currentIdeaY= currentIdeaY +100
            minY=currentIdeaY
            if(currentIdeaY>maxY-50){
              ideas.update({
              height: ideas.get("height")+ 120
              });
            }
          }

        }
      }
}
}


},[])




  return (
    <main className='h-full w-full relative bg-neutral-100 touch-none overflow-hidden'>
        <Info 
          boardId={boardId}
          canRedo={canRedo}
          canUndo={canUndo}
          undo={history.undo}
          redo={history.redo}
        />
        <Participants />
        <Toolbar 
          canvasState={canvasState}
          setCanvasState={setCanvasState}
        />
        <Quest />
        <Button className='fixed top-0 left-[50%]' onClick={Raffinement}>To Raffinement...</Button>
        <Button  onClick={Combinaison}>  To.............................................................................................. Combinaison</Button>
        <Button className='fixed bottom-0 left-[50%]' onClick={insertMoscow}>moscow</Button>

        {layerIds.map((layerId) => (
        <AddShapeCombin
          key={layerId} 
          id={layerId} 
          camera={camera} 
          insertCombin={insertCombin}
          />

        ))}

        {layerIds.map((layerId)=>(
          <AddShapeRaffin
          key={layerId} 
          id={layerId} 
          camera={camera} 
          insertRaffin={insertRaffin}
          />

        ))}

        {layerIds.map((layerId)=>(
          <CombinaisonTheme
          key={layerId} 
          id={layerId} 
          camera={camera}
          />
        ))}

        {layerIds.map((layerId)=>(
          <IdeasRectTitle
          key={layerId} 
          id={layerId} 
          camera={camera} 
          />
        ))}

        {layerIds.map((layerId)=>(
          <RaffinementTable
          key={layerId} 
          id={layerId} 
          camera={camera}
          insertRaffin={insertRaffin}
          />
        ))}

        {layerIds.map((layerId)=>(
          <MoscowDoit
          key={layerId} 
          id={layerId} 
          camera={camera}
          />
        ))}
        {layerIds.map((layerId)=>(
          <MoscowDevrait
          key={layerId} 
          id={layerId} 
          camera={camera}
          />
        ))}
        {layerIds.map((layerId)=>(
          <MoscowPourrait
          key={layerId} 
          id={layerId} 
          camera={camera}
          />
        ))}
        {layerIds.map((layerId)=>(
          <MoscowDevraitPas
          key={layerId} 
          id={layerId} 
          camera={camera}
          />
        ))}
        {layerIds.map((layerId)=>(
          <MoscowTitre
          key={layerId} 
          id={layerId} 
          camera={camera}
          />
        ))}



        <Advancedbar 
          scale={scale} 
          zoomIn={zoomIn} 
          zoomOut={zoomOut}
          focus={focus}
          setFocus={setFocus}
        />
        { lockme || hide ? 
          <LockTools 
          camera={camera}
          />
          :
          <SelectionTools 
          camera={camera}
          setLastUsedColor={setLastUsedColor}
          lastUsedColor={lastUsedColor}
          />
        }
        <svg 
          className='h-[100vh] w-[100vw]'
          onWheel={onWheel}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <g
            style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${scale})`}}
          >
            {layerIds.map((layerId) => (
             hiding(layerId) === true ?
                <HideLayer key={layerId} id={layerId} selectionColor={layerIdsToColorSelection[layerId]}/>
              :
                 <LayerPreview 
                  key={layerId}
                  id={layerId}
                  onLayerPointerDown={onLayerPointerDown}
                  selectionColor={layerIdsToColorSelection[layerId]}//to know when a user has selected an element and the color will match their color Id
                  hide={hide}
                  /> 
            ))}
            <SelectionBox 
              onResizeHandlePointerDown={onResizeHandlePointerDown}
            />
            {canvasState.mode === CanvasMode.SelectionNet && canvasState.current != null && (
            <rect
              className="fill-blue-500/5 stroke-blue-500 stroke-1"
              x={Math.min(canvasState.origin.x, canvasState.current.x)}
              y={Math.min(canvasState.origin.y, canvasState.current.y)}
              width={Math.abs(canvasState.origin.x - canvasState.current.x)}
              height={Math.abs(canvasState.origin.y - canvasState.current.y)}
            />
          )}
            <CursorsPresence />
          </g>
        </svg>
    </main>
  )
}


export default Canvas