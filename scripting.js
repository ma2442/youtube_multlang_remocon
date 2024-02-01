"use strict";

var done = false;

async function scriptingjs() {
    if (done) return;
    done = true;

    let debug = true;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    console.log("reload");
    location.reload();
}

scriptingjs();
