<script lang="ts">
import {getContext } from 'svelte';
import { deleteComponentById, changeComponentColorById,changeComponentShapeById } from '../Components';

    // pos is cursor position when right click occur
    let pos = { x: 0, y: 0 }
    // menu is dimension (height and width) of context menu
    let menu = { h: 0, w: 0 }
    // browser/window dimension (height and width)
    let browser = { w: 0, h: 0 }
    // showMenu is state of context-menu visibility
    let showMenu = false;

    let BoardComponentId : string;


    let menuItems = [
        {
            'name': 'delete',
            'onClick': deleteComponent,
            'displayText': "Delete",
            'class': 'fa-solid fa-trash'
        },
        {
            'name': 'changeColor',
            'onClick': changeColor,
        },
        {
            'name': 'changeShape',
            'onClick': changeShape,
            'displayText': "Change Shape",
            'class': 'fa-solid fa-shapes'
        }
    ]

    let colors = [
        {
            'name': 'red',
            'displaycolor': 'red',
            'hex' : '#FF0000'
        },
        {
            'name': 'blue',
            'displaycolor': 'blue',
            'hex' : '#0000FF'
        },
        {
            'name': 'green',
            'displaycolor': 'green',
            'hex' : '#00FF00'
        },
        {
            'name': 'yellow',
            'displaycolor': 'yellow',
            'hex' : '#FFFF00'
        },
        {
            'name': 'black',
            'displaycolor': 'black',
            'hex' : '#000000'
        }
    ]

    let shapes = [
        {
            'name': 'X',
            'shape': 'fa-solid fa-x'
        },
        {
            'name': 'Circle',
            'shape': 'fa-regular fa-circle'
        },
        {
            'name': 'Square',
            'shape': 'fa-regular fa-square-full'
        }
    ]
    export function showRightClickContextMenu(e: any, id: string){
        BoardComponentId = id;
        showMenu = true
        pos = { x: e.clientX, y: e.clientY }
        menu = { h: 200, w: 200 }
        browser = { w: window.innerWidth, h: window.innerHeight }
    }

    export function onPageClick(e: any){
        showMenu = false;
        BoardComponentId = "";
    }

    function deleteComponent(){
        console.log("Deleting component with id: " + BoardComponentId);
        deleteComponentById(BoardComponentId);
        onPageClick(null);
    }

    function changeColor(e :any){
        let color = e.target.id;
        console.log("Changing color of component with id: " + BoardComponentId);
        changeComponentColorById(BoardComponentId, color);
    }

    function changeShape(e : any){
        console.log("Changing shape of component with id: " + BoardComponentId);
        console.log(e.target);
        changeComponentShapeById(BoardComponentId, e.target.id)
    }

    function getContextMenuDimension(node : any){
        // This function will get context menu dimension
        // when navigation is shown => showMenu = true
        let height = node.offsetHeight
        let width = node.offsetWidth
        menu = {
            h: height,
            w: width
        }
    }

</script>
<svelte:head>
    <!-- You can change icon sets according to your taste. Change `class` value in `menuItems` above to represent your icons. -->
    <!-- <link rel="stylesheet" href="/icon/css/mfglabs_iconset.css"> -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css" integrity="sha512-KfkfwYDsLkIlwQp6LFnl8zNdLGxu9YAA1QvwINks4PhcElQSvqcyVLLD9aMhXd13uQjoXtEKNosOWaZqXgel0g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="/css/contextmenu.css">
</svelte:head>

{#if showMenu}
<nav use:getContextMenuDimension style="position: absolute; top:{pos.y}px; left:{pos.x}px">
    <div class="navbar" id="navbar">
        <ul>
            {#each menuItems as item}
                {#if item.name == "hr"}
                    <hr>
                {:else if item.name == "changeColor"}
                    <li class="colorlist" >
    
                            {#each colors as color}
                                <li><button id={color.hex} on:click={changeColor} style="background-color:{color.displaycolor}" class="colorbutton"></button></li>
                            {/each}
                    
                    </li>
                {:else if item.name == "changeShape"}
                    <li class="colorlist" >
    
                            {#each shapes as shape}
                                <li><button  class="shapebutton" on:click={changeShape}  ><i  id={shape.name} class={shape.shape}></i></button></li>
                            {/each}
                    
                    </li>
                {:else}
                    <li><button on:click={item.onClick}><i class={item.class}></i>{item.displayText}</button></li>
                {/if}
            {/each}
    
        </ul>
    </div>
</nav>
{/if}
