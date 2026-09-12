
import { get, writable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";

export {
    deleteComponentById,
    changeComponentColorById,
    changeComponentShapeById,
    moveComponentById,
    addComponent,
    serializeComponents,
    loadComponentsFromJsonString
};

interface Component {
    x: number;
    y: number;
    color: string;
    shape: string;
    id: string;
}


export const components = writable([] as Component[]);


function deleteComponentById(id: string) {
    components.update((currentComponents: Component[]) => currentComponents.filter(component => component.id !== id));
}

function changeComponentColorById(id: string, color: string) {
    components.update((currentComponents: Component[]) => currentComponents.map((component) => {
        if (component.id == id) {
            component.color = color;
        }
        return component;
    }));
}

function changeComponentShapeById(id: string, shape: string) {
    components.update((currentComponents: Component[]) => currentComponents.map((component) => {
        if (component.id == id) {
            component.shape = shape;
        }
        return component;
    }));
}

function moveComponentById(x: number, y: number, id: string) {
    components.update((currentComponents: Component[]) => currentComponents.map((component) => {
        if (component.id == id) {
            component.x = x;
            component.y = y;
        }
        return component;
    }));
}

function addComponent(x: number, y: number, color: string, shape: string) {

    components.update(currentComponents => [
        ...currentComponents,
        { x: x, y: y, color: color, shape: shape, id: uuidv4() },
    ]);

}

function serializeComponents() {
    return JSON.stringify(get(components));
}

function loadComponentsFromJsonString(serializedComponents: string) {
    components.set(JSON.parse(serializedComponents));
}

