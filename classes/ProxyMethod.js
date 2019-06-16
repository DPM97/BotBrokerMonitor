class ProxyMethod {
    constructor(data) {
        this.id = data
    }

    fetch() { 
        for (var i = 0; i < global.proxies.length; i++) {
            if (global.occupiedProxies.includes(global.proxies[i]) === false && global.proxies[i] != undefined) {
                let proxy = global.proxies[i];
                global.occupiedProxies.push(proxy)
                global.proxies.remove(proxy)
                return proxy;
            }
        }
        return ''
    }

    rotate() { 
        global.proxies.push(this.id)
        global.occupiedProxies.remove(this.id)
        for (var i = 0; i < global.proxies.length; i++) {
            if (global.occupiedProxies.includes(global.proxies[i]) === false && global.proxies[i] != undefined) {
                let proxy = global.proxies[i];
                global.occupiedProxies.push(proxy)
                global.proxies.remove(proxy)
                return proxy;
            }
        }
        return ''
    }
}

module.exports = ProxyMethod;