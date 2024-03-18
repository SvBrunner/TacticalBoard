import Button from 'react-bootstrap/Button';
import {StyleSheet, Text, View} from 'react-native';
import {X, Circle} from './shapes';
import React, { useEffect, useState } from 'react';


let chosenShape = X;
export default function DrawingMenu() {
    
    return (
        <div>
            {shapeButton('X', X)}
            {shapeButton('Circle', Circle)}
            <button>Triangle</button>
            <button>Line</button>
            <button>Text</button>
            <button>Color</button>
            <button>Undo</button>
            <button>Redo</button>
        </div>
    )

}

function mainButton(text: string, onClick: any) {
    return (
        <Button
            className='btn btn-outline-secondary btn-lg btn-block'
            style={styles.btnSquare}
            onClick={onClick}
            variant=''>
            {text}
        </Button>
    )
}


function shapeButton (text: string, shape: any) {
    const onClick = () => {
        console.log('Change to ' + shape)
        chosenShape = shape;
    }

    return mainButton(text, onClick);
}

function menuButton (text: string, options : any) {

}

const styles = StyleSheet.create({
    btnSquare: {
        //TODO : dynamic width and height
        width: 150,
        height: 150,
        margin: 10,
    }
});

export function CurrentShape(){
    return chosenShape;
}