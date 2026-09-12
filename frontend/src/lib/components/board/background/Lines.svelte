<script lang="ts">
    import { Shape, Line, Circle } from "svelte-konva";
    import BullyPoint from "./BullyPoint.svelte";
    export let width = 0;
    export let height = 0;
    export let x = 0;
    export let y = 0;

    let strokeWidth = 5;
    
    let color = "black";

    function drawShape(context: any, shape: any) {
      

       
        let radius = 100;
        // Calculate the offsets
        let widthOffsetFromCenter = width / 2;
        let heightOffsetFromCenter = height / 2;

        drawBoard(context, shape, widthOffsetFromCenter, heightOffsetFromCenter, radius);
        context.fillStrokeShape(shape);
        context.save();

        context.globalCompositeOperation = 'destination-out';
        let innerWidthOffsetFromCenter = widthOffsetFromCenter - strokeWidth;
        let innerHeightOffsetFromCenter = heightOffsetFromCenter - strokeWidth;
        let innerRadius = radius - strokeWidth;

        drawBoard(context, shape, innerWidthOffsetFromCenter, innerHeightOffsetFromCenter, innerRadius);

        context.fill();
        context.restore();
        context.stroke();
    }

    function drawBoard(context : any, shape : any, widthOffset: number, heightOffset: number, radius:number){
        context.beginPath();
        // Start in upper mid
        context.moveTo(0, heightOffset);

        // Top right corner
        context.lineTo(widthOffset - radius, heightOffset);
        context.arcTo(widthOffset, heightOffset, widthOffset, -heightOffset + radius, radius);

        // Bottom right corner
        context.lineTo(widthOffset, -heightOffset + radius);
        context.arcTo(widthOffset, -heightOffset, -widthOffset + radius, -heightOffset, radius);

        // Bottom left corner
        context.lineTo(-widthOffset + radius, -heightOffset);
        context.arcTo(-widthOffset, -heightOffset, -widthOffset, heightOffset - radius, radius);

        // Top left corner
        context.lineTo(-widthOffset, heightOffset - radius);
        context.arcTo(-widthOffset, heightOffset, 0, heightOffset, radius);

        context.closePath();
  
    }
</script>


<Shape
    x={x}
    y={y}
    fill={color}
    stroke={color}
    draggable={false}
    sceneFunc={drawShape}
/>

<Line
    x={x}
    y={height}
    points={[0, 0, 0, height * -1]}
    stroke={color}
    strokeWidth={strokeWidth}
/>



<!--Center-->
<BullyPoint x={x} y={y} color={color} strokeWidth={strokeWidth} radius={20} />

<!--Center Top and Bot-->
<BullyPoint x={x} y={y + height/2 - 80} color={color} strokeWidth={strokeWidth} radius={20} />
<BullyPoint x={x} y={y - height/2 + 80} color={color} strokeWidth={strokeWidth} radius={20} />

<!--Left (offsets match the confirmed board-design mockup: ~8.3% of width in from the side, ~20.6% of height in from top/bottom)-->
<BullyPoint x={x - width / 2 + width * 0.0829} y={y + height/2 - height * 0.2056} color={color} strokeWidth={strokeWidth} radius={20} />
<BullyPoint x={x - width / 2 + width * 0.0829} y={y - height/2 + height * 0.2056} color={color} strokeWidth={strokeWidth} radius={20} />

<!--Right-->
<BullyPoint x={x + width / 2 - width * 0.0829} y={y + height/2 - height * 0.2056} color={color} strokeWidth={strokeWidth} radius={20} />
<BullyPoint x={x + width / 2 - width * 0.0829} y={y - height/2 + height * 0.2056} color={color} strokeWidth={strokeWidth} radius={20} />