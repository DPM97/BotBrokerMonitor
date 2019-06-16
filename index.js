const Task = require('./classes/Task.js');
const fs = require('fs')
const config = require('./config/config.json');


async function start() {
    /* Load proxies */
    await populateProxies();
    return launch();
}

async function populateProxies() {
    global.proxies = []
    global.occupiedProxies = []
    const data = await fs.readFileSync('./proxies.txt').toString().split('\r\n')
    for (var i = 0; i < data.length; i++) {
        global.proxies.push(data[i])
    }
}

function launch() {
    for (var i = 0; i < config.bots.length; i++) {
        let data = {
            "delay": config.delay,
            "name": config.bots[i],
            "jar": global.jar
        }
        new Task(data).poll();
    }
}

Array.prototype.remove = function () {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

start();