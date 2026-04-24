import {
    full_ui_t,
    onInput,
    updateDiff,
    updateMap,
    updateOutput,
} from "../api.js";
import { _Curve, CurveH, CurveSnake, CurveSpiral, CurveV } from "../curve.js";

onInput((val, up) => {
    console.log(up, val);

    if (up === "*" || up === "map" || up === "input" || up === "downsample") {
        _updateMap(val);
    }
});

function _updateMap(val: full_ui_t) {
    if (val.input === null) {
        updateMap("uninitialized");
        return;
    }

    const curves: _Curve[] = [];

    switch (val.map) {
        case "vertical":
            for (let x = 0; x < val.width; x++) {
                curves.push(new CurveV(x, 0, val.height - 1));
            }
            break;
        case "horizontal":
            for (let y = 0; y < val.height; y++) {
                curves.push(new CurveH(0, val.width - 1, y));
            }
            break;
        case "snake":
            curves.push(new CurveSnake(0, 0, val.width - 1, val.height - 1));
            break;
        case "spiral":
            curves.push(new CurveSpiral(0, 0, val.width - 1, val.height - 1));
            break;
    }

    updateMap({
        width: val.width,
        height: val.height,
        curves,
    });
}
