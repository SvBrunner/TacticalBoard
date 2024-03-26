<script lang="ts">
  
    import { Shape } from 'svelte-konva';
    export let x = 0;
    export let y = 0;
    export let color = "blue";
    export let shapeToDraw = "X";
 

    let counter = 0;
    function handleOnClick(e : any){
        e.preventDefault();
        const konvaEvent = e.detail;
        konvaEvent.evt.preventDefault();
        alert("Clicked on shape");
    }
    function handleOnDragStart(){
        console.log("Drag started");
    }

    function handleOnDragEnd(){
        console.log("Drag ended");
    }

   
 function drawX (context : any, shape : any)  {
        context.beginPath();
        context.moveTo(-16, -8);
        context.lineTo(-8, 0);
        context.lineTo(-16, 8);
        context.lineTo(-8, 16);
        context.lineTo(0, 8);
        context.lineTo(8, 16);
        context.lineTo(16, 8);
        context.lineTo(8, 0);
        context.lineTo(16, -8);
        context.lineTo(8, -16);
        context.lineTo(0, -8);
        context.lineTo(-8, -16);
        context.closePath();
        context.fillStrokeShape(shape);
    };
    function drawCircle  (context : any, shape : any)  {
        context.beginPath();
        context.arc(0, 0, 20, 0, 2 * Math.PI); // outer circle
        context.closePath();
        context.fillStrokeShape(shape); // Konva specific method
        context.save();
        context.globalCompositeOperation = 'destination-out';
        context.beginPath();
        context.arc(0, 0, 10, 0, 2 * Math.PI);
        context.fill();
        context.restore();
        context.stroke();
    };
</script>
<Shape
      config={{
        x: x,
        y: y,
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
                        default :
                            drawX(context, shape);
                }    
            }
      }}
      on:pointerclick={handleOnClick}
      
      on:dragstart={handleOnDragStart}
      on:dragend={handleOnDragEnd}
    />