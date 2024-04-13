
import { writable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";

export { delShapeById, changeColorById, changeShapeById, moveShapeById, addShape };

interface Component {
    x: number;
    y: number;
    color: string;
    shape: string;
    id: string;
}


export const  components = writable( [] as Component[]);


function delShapeById(id: string) {
    components.update((currentComponents: Component[]) => currentComponents.filter(component => component.id !== id));
}

function changeColorById(id: string, color: string) {
    components.update((currentComponents: Component[]) => currentComponents.map((component) => {
        if (component.id == id) {
            component.color = color;
        }
        return component;
    }));
}

function changeShapeById(id: string, shape: string) {


   components.update((currentComponents: Component[]) => currentComponents.map((component) => {
        if (component.id == id) {
            component.shape = shape;
        }
        return component;
    }));
}

function moveShapeById(x: number, y: number, id: string) {

    components.update((currentComponents: Component[]) => currentComponents.map((component) => {
        if (component.id == id) {
            component.x = x;
            component.y = y;
        }
        return component;
    }));
}

function addShape(x: number, y: number, color: string, shape: string) {

    components.update(currentComponents => [
        ...currentComponents,
        { x: x, y: y, color: color, shape: shape, id: uuidv4() },
    ]);

}