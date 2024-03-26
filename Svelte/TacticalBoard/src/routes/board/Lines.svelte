<script lang="ts">
    import { Shape, Line, Rect } from "svelte-konva";
    export let width = 0;
    export let height = 0;
    export let x = 0;
    export let y = 0;
    let radius = 100;
    let color = "white";

    function drawShape(context: any, shape: any) {
        context.beginPath();

       

        // Calculate the offsets
        let widthOffsetFromCenter = width / 2;
        let heightOffsetFromCenter = height / 2;

        // Start in upper mid
        context.moveTo(0, heightOffsetFromCenter);

        // Top right corner
        context.lineTo(widthOffsetFromCenter - radius, heightOffsetFromCenter);
        context.arcTo(widthOffsetFromCenter, heightOffsetFromCenter, widthOffsetFromCenter, -heightOffsetFromCenter + radius, radius);

        // Bottom right corner
        context.lineTo(widthOffsetFromCenter, -heightOffsetFromCenter + radius);
        context.arcTo(widthOffsetFromCenter, -heightOffsetFromCenter, -widthOffsetFromCenter + radius, -heightOffsetFromCenter, radius);

        // Bottom left corner
        context.lineTo(-widthOffsetFromCenter + radius, -heightOffsetFromCenter);
        context.arcTo(-widthOffsetFromCenter, -heightOffsetFromCenter, -widthOffsetFromCenter, heightOffsetFromCenter - radius, radius);

        // Top left corner
        context.lineTo(-widthOffsetFromCenter, heightOffsetFromCenter - radius);
        context.arcTo(-widthOffsetFromCenter, heightOffsetFromCenter, 0, heightOffsetFromCenter, radius);

        context.closePath();
        context.fillStrokeShape(shape);
    }
</script>


<Shape
    config={{
        x: x,
        y: y,
        fill: color,
        stroke: "black",
        draggable: false,
        sceneFunc: drawShape,
        
    }}
/>

<Line
    config={{
        x: x,
        y: height ,
        points:[0 , 0, 0, height * -1],
        stroke: "black",
        strokeWidth: 2,
    }}/>



