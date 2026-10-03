<script lang="ts">
    import {Layer} from "svelte-konva";
    import Goal from "./Goal.svelte";
    import GoalArea from "./GoalArea.svelte";
    import Lines from "./Lines.svelte";
    export let width: number;
    export let height: number;
</script>

<Layer listening={false}>
    <Lines {width} {height} x={width / 2} y={height / 2} />
</Layer>
<Layer listening={false}>
    <GoalArea {width} {height} y={height / 2} />
    <GoalArea {width} {height} y={height / 2} mirrored={true} />
    <Goal x={width * 0.0987} y={height / 2} {width} {height} />
    <Goal x={width - width * 0.0987} y={height / 2} {width} {height} mirrored={true} />
</Layer>
