const request = require('request');
const requestPromise = require("request-promise");
const ProxyMethod = require('./ProxyMethod.js');
const Webhook = require('./Webhook.js')
const cheerio = require('cheerio')
const moment = require('moment')
const crypto = require('crypto');
const cloudscraper = require('cloudscraper');


class Task {
    constructor(data) {
        this.rate = 0;
        this.name = data.name;
        this.type = data.type;
        this.price = 0;
        this.renewalPrice = 0;
        this.endpoint = `https://botbroker.io/bots/${data.name}`;
        this.delay = data.delay;
        this.jar = data.jar;
        this.proxy = '';
        this.cookieJar = request.jar();
        this.request = requestPromise.defaults({
            requester: request,
            // Cookies should be enabled
            jar: request.jar(),
            // Reduce Cloudflare's timeout to cloudflareMaxTimeout if it is excessive
            cloudflareMaxTimeout: 30000,
            // followAllRedirects - follow non-GET HTTP 3xx responses as redirects
            followAllRedirects: true,
            // Support only this max challenges in row. If CF returns more, throw an error
            challengesToSolve: 3,
            // Remove Cloudflare's email protection
            decodeEmails: false,
            // Support gzip encoded responses
            gzip: true,
            agentOptions: {
                // Removes a few problematic TLSv1.0 ciphers to avoid CAPTCHA
                ciphers: crypto.constants.defaultCipherList + ':!ECDHE+SHA:!AES128-SHA'
            }
        });
        this.headers = {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36",
            "authority": "botbroker.io",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "max-age=0",
            "upgrade-insecure-requests": '1'
        };
    }

    async poll() {
        await this.setProxy(); //await this.rotateProxy() to rotate current proxy (on ban perhaps)
        await this.fetchOrigin();
        let f = setInterval(() => {
            this.fetchPrice(); //fix fetchorigin
        }, this.delay)
    }

    async fetchOrigin() {
        await this.rotateProxy();

        if (this.proxy != '') {
            this.proxy = `http://${this.proxy}`
        }

        var options = {
            method: 'GET',
            url: this.endpoint,
            proxy: `${this.proxy}`
        };
        let that = this;
        cloudscraper(options).then(function (body) {
            switch (that.type) {
                case "lifetime":
                    return that.originLifetime(body)
                case "renewal":
                    return that.originRenewal(body)
                case "both":
                    that.originLifetime(body)
                    return that.originRenewal(body)
            }
        });
    }

    async originRenewal(body) {
        const $ = cheerio.load(body)
        let renewal = []
        $('span[class="float-right text-right pull-right"]').each(function () {
            var href = $(this).parent().text();
            renewal.push(href);
        });
        let lowestAsk = renewal[0].match(/^\d+|\d+\b|\d+(?=\w)/g)[0].toString();
        return this.purgeOrigin(lowestAsk, false)
    }

    async originLifetime(body) {
        const $ = cheerio.load(body)
        let lifetime = []
        $('div[class="col-6"]').each(function () {
            var href = $(this).text();
            lifetime.push(href);
        });
        for (var i = 0; i < lifetime.length; i++) {
            if (lifetime[i].indexOf('Ask Price') > -1) {
                let lowestAsk = lifetime[i + 1];
                return this.purgeOrigin(lowestAsk, true)
            }
        }
    }

    purgeOrigin(lowestAsk, isLifetime) {
        let num = lowestAsk.replace(/[^0-9]/g, '');
        let price = parseInt(num, 10);
        if (isLifetime && price != this.price) {
            return this.price = price;
        } else if (!isLifetime && price != this.renewalPrice) {
            return this.renewalPrice = price
        } else {
            return;
        }
    }

    async fetchPrice() {
        await this.rotateProxy();

        if (this.proxy != '') {
            this.proxy = `http://${this.proxy}`
        }

        var options = {
            method: 'GET',
            url: this.endpoint,
            proxy: `${this.proxy}`
        };
        let that = this;
        cloudscraper(options).then(function (body) {

            switch (that.type) {
                case "lifetime":
                    return that.fetchLifetime(body)
                case "renewal":
                    return that.fetchRenewal(body)
                case "both":
                    that.fetchLifetime(body)
                    return that.fetchRenewal(body)
            }
        });
    }

    async fetchRenewal(body) {
        const $ = cheerio.load(body)
        let renewal = []
        $('span[class="float-right text-right pull-right"]').each(function () {
            var href = $(this).parent().text();
            renewal.push(href);
        });
        let lowestAsk = renewal[0].match(/^\d+|\d+\b|\d+(?=\w)/g)[0].toString();
        return this.purgeText(lowestAsk, false)
    }

    async fetchLifetime(body) {
        const $ = cheerio.load(body)
        let lifetime = []
        $('div[class="col-6"]').each(function () {
            var href = $(this).text();
            lifetime.push(href);
        });
        for (var i = 0; i < lifetime.length; i++) {
            if (lifetime[i].indexOf('Ask Price') > -1) {
                let lowestAsk = lifetime[i + 1];
                return this.purgeText(lowestAsk, true)
            }
        }
    }

    purgeText(lowestAsk, isLifetime) {
        let num = lowestAsk.replace(/[^0-9]/g, '');
        let price = parseInt(num, 10);
        if (isLifetime && price != this.price) {
            this.price = price
            let postData = {
                "price": this.price,
                "name": this.name,
                "renewal": false,
                "endpoint": this.endpoint
            }
            this.log(postData, 'post')
        } else if (!isLifetime && price != this.renewalPrice) {
            this.renewalPrice = price
            let postData = {
                "price": this.renewalPrice,
                "name": this.name,
                "renewal": true,
                "endpoint": this.endpoint
            }
            this.log(postData, 'post')
        } else {
            return;
        }
    }

    setProxy() {
        let proxy = new ProxyMethod(this.proxy).fetch();
        let that = this;
        if (proxy && Object.prototype.toString.call(proxy) === "[object Promise]") { //check if promise uhh for some reason it was returning one in specific instances
            proxy.then(function (result) {
                return that.proxy = result
            });
        } else {
            that.proxy = proxy
        }
    }

    rotateProxy() {
        let proxy = new ProxyMethod(this.proxy).rotate();
        let that = this;
        if (proxy && Object.prototype.toString.call(proxy) === "[object Promise]") {
            proxy.then(function (result) {
                return that.proxy = result
            });
        } else {
            that.proxy = proxy
        }
    }


    log(msg, type) {
        const formatted = moment().format('MMMM Do YYYY h:mm:ss.SSS a');

        switch (type) {
            case 'err':
                return console.error(`[${formatted}][${this.name}]: ` + msg);
            case 'info':
                return console.log(`[${formatted}][${this.name}]: ` + msg);
            case 'post':
                return new Webhook(msg).post();
            default:
                return console.error('Incorrect logging format')
        }
    }
}

module.exports = Task;