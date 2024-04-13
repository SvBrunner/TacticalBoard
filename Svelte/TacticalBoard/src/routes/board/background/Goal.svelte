<script lang="ts">
  
    import { Shape } from 'svelte-konva';
    export let x = 0;
    export let y = 0;
 
    export let mirrored = false;
    let color = "black";
    let scaleX = 1;
    if(mirrored){
        scaleX = -1;
    }
    let goalDepth = 32;
    let goalWidth = 80;
    let goalThickness = 5;



    let points = [
        {x: 0, y: 0},
        {x: goalDepth, y : 0},
        {x: goalDepth, y : goalThickness},
        {x: goalThickness, y : goalThickness},
        {x: goalThickness, y : goalWidth - goalThickness},
        {x: goalDepth, y : goalWidth - goalThickness},
        {x: goalDepth, y : goalWidth},
        {x: 0, y : goalWidth}];


    let xStart = x - goalDepth;
    let yStart = y - goalWidth / 2;

    if(mirrored){
        xStart = x + goalDepth;
    }

    function drawGoal(context : any, shape : any){
        context.beginPath();

        context.moveTo(0, 0);
        points.forEach((point : any) => {
            context.lineTo(point.x , point.y );
        });
        context.closePath();
        
        context.fillStrokeShape(shape);
    }
    
</script>

<Shape
      config={{
        x: xStart,
        y: yStart,
        fill: color,
        draggable: false,
        scale: { x: scaleX, y: 1 },
        sceneFunc: drawGoal,
        stroke: "black",
      }}
      
    />
    <!--
<Rect 
      config={{
        x: x -100,
        y: y - 40,
        width: 64,
        height: 80,
        fill: "transparent",
        stroke: "black",
        strokeWidth: 1,
        draggable: false,
        rotation: rotation
      }}
/>
    -->
