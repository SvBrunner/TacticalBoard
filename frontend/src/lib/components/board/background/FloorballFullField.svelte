<script lang="ts">
    import {Layer} from "svelte-konva";
    import Goal from "./Goal.svelte";
    import Lines from "./Lines.svelte";
    export let width: number;
    export let height: number;
</script>

<Layer>
    <Lines {width} {height} x={width / 2} y={height / 2} />
</Layer>
<Layer>
    <Goal x={width * 0.0875} y={height / 2} />
    <Goal x={width - width * 0.0875} y={height / 2} mirrored={true} />
</Layer>
