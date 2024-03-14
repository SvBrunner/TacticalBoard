import {Shape} from 'react-konva';

const BoardComponent = ({x, y, scale, shapeFunc}: {x: any, y: any, scale : any, shapeFunc : Function}) => {
    const colors = ["red", "orange", "yellow", "green", "blue", "purple"];

    const rotateColor = (e : any) => {
        console.log(e)
        let cid = e.target.attrs.colorId;
        console.log(cid)
        if(e.evt.button == 0 ) {
          cid = (cid + 1) % colors.length;
        }
        else if(e.evt.button == 2){
          cid = (cid - 1 + colors.length) % colors.length;
        }
        e.target.setAttrs({
          fill : colors[cid],
          colorId : cid
        });
      };


      return(
         <Shape
            onClick={rotateColor}
            sceneFunc={(context, shape ) => shapeFunc(context, shape)}
            x={x}
            y={y}
            fill="#00D2FF"
            stroke="black"
            colorId={0}
            draggable
            strokeWidth={1}
            scaleX={scale}
            scaleY={scale}
          />
      );
};

export default BoardComponent;