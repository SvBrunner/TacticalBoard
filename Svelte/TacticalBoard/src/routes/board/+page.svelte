<svelte:head>
	<title>Tactical Board</title>
	<meta name="description" content="This is the board" />
</svelte:head>

<script lang="ts">
	import { Stage, Layer, Rect} from 'svelte-konva';
	import BoardComponent from './BoardComponent.svelte';
	import { Container } from '@sveltestrap/sveltestrap';
	import Goal from './Goal.svelte';
    import { base } from '$app/paths';
    import Lines from './Lines.svelte';
    import FloorballFullField from './FloorballFullField.svelte';


	let sceneWidth : number = 2000;
	let sceneHeight : number = 1000;
	let baseScale = { x: 1, y: 1 };



	let containerWidth  = sceneWidth;
	let	containerHeight = sceneHeight;


	function fitStageIntoParentContainer() {
		var container = document.getElementById('stage-parent');

        
		var cs = getComputedStyle(container!);

		var paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
	
		var borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
	

        // now we need to fit stage into parent container
        var parentContainerWidth = container!.offsetWidth - paddingX - borderX;

		if(parentContainerWidth){
			var scale = parentContainerWidth / sceneWidth;

			containerWidth = parentContainerWidth;
			containerHeight = parentContainerWidth * (sceneHeight / sceneWidth);
			baseScale = { x: scale, y: scale  };
		}
    
       
      }
	
	
	

	let components = [] as { x: number, y: number, color: string, shape: string }[];

	function addShape(e : any ) {
		let x = e.detail.evt.layerX / baseScale.x;
		let y = e.detail.evt.layerY  / baseScale.y;
		let target = e.detail.target;
		//Check if empty space

		if(target.attrs.name ==  "BaseLayer"){
		
			components = [...components, {x : x, y : y, color : "blue", shape : "X"}];
		}
		
				
	}

	//window.addEventListener('resize', fitStageIntoParentContainer);
  </script>

<Container id="stage-parent" fluid  >
	<h1>TODO</h1>



	<Stage on:click={addShape} config={{ width: containerWidth, height: containerHeight, scale: baseScale  }}>
		<FloorballFullField width={containerWidth} height={containerHeight} />
		<Layer>			
			{#each components as component}
				<BoardComponent x={component.x} y={component.y} color={component.color} shapeToDraw={component.shape} />
			{/each}
		</Layer>
	
	</Stage>

</Container>

