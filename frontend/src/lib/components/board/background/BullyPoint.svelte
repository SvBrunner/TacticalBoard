<script lang="ts">
    import { Circle, Line } from "svelte-konva";
    export let radius = 100;
    export let x :number;
    export let y :number;
    export let color = "black";
    export let strokeWidth = 5;
</script>

<Circle
    x={x}
    y={y}
    radius={radius}
    fill="transparent"
    stroke={color}
    strokeWidth={strokeWidth}
/>

<Line
    x={x}
    y={y - radius}
    points={[0, 0, 0, 2 * radius]}
    stroke={color}
    strokeWidth={strokeWidth}
/>

<Line
    x={x - radius}
    y={y}
    points={[0, 0, 2 * radius, 0]}
    stroke={color}
    strokeWidth={strokeWidth}
/>
