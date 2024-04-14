<script lang="ts">
	import { Stage, Layer, Rect } from "svelte-konva";
	import BoardComponent from '$lib/components/board/BoardComponent.svelte';
	import { Container } from "@sveltestrap/sveltestrap";
	import FloorballFullField from "$lib/components/board//background/FloorballFullField.svelte";
	import { onMount } from "svelte";
	import CustomContextMenu from "$lib/components/board/contextmenus/CustomContextMenu.svelte";
	import ContextMenuBoardComponent from "$lib/components/board/contextmenus/ContextMenuBoardComponent.svelte";
	import { components } from "$lib/components/board/Components";
	import {deleteComponentById, addComponent, serializeComponents,loadComponentsFromJsonString } from "$lib/components/board/Components";

	let contextMenu: CustomContextMenu;
	let contextMenuBoardComponent: ContextMenuBoardComponent;
	let sceneWidth: number = 2000;
	let sceneHeight: number = 1000;
	let baseScale = { x: 1, y: 1 };

	let containerWidth = sceneWidth;
	let containerHeight = sceneHeight;

	let serializedData: string = "";
	/*let components = [] as {
		x: number;
		y: number;
		color: string;
		shape: string;
		id: string;
	}[];*/

	function fitStageIntoParentContainer() {
		var container = document.getElementById("stage-parent");

		if (container == null) {
			return;
		}

		var cs = getComputedStyle(container!);
		var paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
		var borderX =
			parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);

		var parentContainerWidth = container!.offsetWidth - paddingX - borderX;
		var scale = parentContainerWidth / sceneWidth;

		containerWidth = parentContainerWidth;
		containerHeight = parentContainerWidth * (sceneHeight / sceneWidth);
		baseScale = { x: scale, y: scale };
	}

	function handleStageOnClick(e: any) {
		e.preventDefault();

		let x = e.detail.evt.layerX / baseScale.x;
		let y = e.detail.evt.layerY / baseScale.y;
		let target = e.detail.target;
		let evt = e.detail.evt;

		switch (e.detail.evt.button) {
			//Left Click
			case 0:
				if (target.attrs.name == "Component") {
					if (e.detail.evt.shiftKey){
						deleteComponentById(target.attrs.id);
					}
						
				} else {
					addComponent(x, y, "red", "O");
				}
				break;
			//Middle Click
			case 1:
				break;
			//Right Click
			case 2:
				if (target.attrs.name == "Component") {
					contextMenuBoardComponent.showRightClickContextMenu(
						evt,
						target.attrs.id,
					);
				} else {
					contextMenu.showRightClickContextMenu(evt);
				}

				break;
			default:
				break;
		}
	}

	function hideContextMenus(e: any) {
		contextMenu.onPageClick(e);
		contextMenuBoardComponent.onPageClick(e);
	}

	function downloadCurrentBoard(filename: string, text: string) {
    	const element = document.createElement('a');
    	element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(text));
   		element.setAttribute('download', filename);

    	element.style.display = 'none';
    	document.body.appendChild(element);

    	element.click();

    	document.body.removeChild(element);
	}

	function loadBoard(e : any){
		const file = (e.target)!.files[0];
		const reader = new FileReader();
		reader.onload = async (e) => {
			const text = e.target!.result as string;
			loadComponentsFromJsonString(text);
		};
		reader.readAsText(file);
	}


	onMount(async () => {
		fitStageIntoParentContainer();
		window.addEventListener("resize", fitStageIntoParentContainer);
		window.addEventListener("contextmenu", (e) => e.preventDefault());
	});
</script>

<svelte:head>
	<title>Tactical Board</title>
	<meta name="description" content="This is the board" />
</svelte:head>

<Container id="stage-parent" fluid>
	<Stage
		on:click={handleStageOnClick}
		on:pointerdown={hideContextMenus}
		id="stage"
		config={{
			width: containerWidth,
			height: containerHeight,
			scale: baseScale,
		}}
	>
		<Layer>
			<Rect
				config={{
					width: sceneWidth,
					height: sceneHeight,
					fill: "white",
				}}
			/>
		</Layer>
		<FloorballFullField width={sceneWidth} height={sceneHeight} />

		<Layer>
			{#each $components as component (component.id)}
				<BoardComponent
					x={component.x}
					y={component.y}
					color={component.color}
					shapeToDraw={component.shape}
					id={component.id}
				/>
			{/each}
		</Layer>
	</Stage>
</Container>
<CustomContextMenu bind:this={contextMenu} />
<ContextMenuBoardComponent bind:this={contextMenuBoardComponent} />

<button
	on:click={() => {
		serializedData = serializeComponents();
		downloadCurrentBoard("board.json", serializedData);
	}}>Download</button>

<input type="file" accept=".json" on:change={loadBoard} > 