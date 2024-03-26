<script lang="ts">
	import { Stage, Layer, Rect} from 'svelte-konva';
    import Goal from './Goal.svelte';
    import Lines from './Lines.svelte';

    export let width :number;
    export let height :number;
</script>
<Layer >
    
    <Lines width={width} height={ height} x={width / 2} y={height / 2} />
    <Goal x={width * 0.0875} y={height / 2} />	
    <Goal x={width - width * 0.0875} y={height / 2} rotation={180} />
</Layer>

