<script lang="ts">
  
    import { Shape } from 'svelte-konva';
    import {getContext } from 'svelte';
    import {moveShapeById} from './Components';
    import {drawX, drawCircle, drawSquare} from './Shapes';


    export let x = 0;
    export let y = 0;
    export let color = "blue";
    export let shapeToDraw = "X";
    export let id : string;

    const parentMoveComponent : Function = getContext('moveComponent');
    
    function handleOnClick(e : any){
        e.preventDefault();

    
    }
    function handleOnDragStart(){
        console.log("Drag started");
    }

    function handleOnDragEnd(e : any){
        let x = e.detail.target.attrs.x;
        let y = e.detail.target.attrs.y;
        moveShapeById(x,y,id);
    }
  

 
</script>
<Shape
      config={{
        name:"Component",
        x: x,
        y: y,
        id: id,
        fill: color,
        draggable: true,
        sceneFunc: function (context, shape) {
                    switch(shapeToDraw){
                        case "X":
                            drawX(context, shape);
                            break;
                        case "Circle":
                            drawCircle(context, shape);
                            break;
                        case "Square":
                            drawSquare(context, shape);
                            break;
                        default :
                            drawX(context, shape);
                }    
            }
      }}
      on:pointerclick={handleOnClick}
  
      on:dragstart={handleOnDragStart}
      on:dragend={handleOnDragEnd}
    />

