<script lang="ts">
	import { Stage, Layer, Rect } from "svelte-konva";
	import BoardComponent from "./BoardComponent.svelte";
	import { Container } from "@sveltestrap/sveltestrap";
	import FloorballFullField from "./background/FloorballFullField.svelte";
	import { onMount } from "svelte";
	import { v4 as uuidv4 } from "uuid";
	import CustomContextMenu from "./contextmenus/CustomContextMenu.svelte";
	import ContextMenuBoardComponent from "./contextmenus/ContextMenuBoardComponent.svelte";
	import { setContext } from 'svelte';
	import {components} from "./Components";
	import { delShapeById, addShape } from "./Components";



	let contextMenu : CustomContextMenu;
	let contextMenuBoardComponent : ContextMenuBoardComponent;
	let sceneWidth: number = 2000;
	let sceneHeight: number = 1000;
	let baseScale = { x: 1, y: 1 };

	let containerWidth = sceneWidth;
	let containerHeight = sceneHeight;

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
/*
	function delShapeById(id: string) {
		components = components.filter((component) => {
			return component.id != id;
		});
	}

	function changeColorById(id: string, color: string) {
		components = components.map((component) => {
			if (component.id == id) {
				component.color = color;
			}
			return component;
		});
	}

	function changeShapeById(id: string, shape: string) {
		console.log("Changing shape of component with id: " + id + " to " + shape)
		components = components.map((component) => {
			if (component.id == id) {
				component.shape = shape;
			}
			return component;
		});
	}

	function moveShapeById(x:number, y:number, id: string) {
	
		components = components.map((component) => {
			if (component.id == id) {
				component.x = x;
				component.y = y;
			}
			return component;
		});
	}*/

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
					if (e.detail.evt.shiftKey) 
						delShapeById(target.attrs.id);
				} else {
					addShape(x, y, "blue", "X");
				/*	components = [
						...components,
						{ x: x, y: y, color: "blue", shape: "X", id: uuidv4() },
					];*/
				}
				break;
			//Middle Click
			case 1:
				break;
			//Right Click
			case 2:
				if(target.attrs.name == "Component"){
					contextMenuBoardComponent.showRightClickContextMenu(evt, target.attrs.id);
				}
				else{
					contextMenu.showRightClickContextMenu(evt);
				}
				
				break;
			default:
				break;
		}
	}

	function hideContextMenus(e : any){
		contextMenu.onPageClick(e);
		contextMenuBoardComponent.onPageClick(e);
	
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
<ContextMenuBoardComponent bind:this={contextMenuBoardComponent}    />
