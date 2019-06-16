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
            this.fetchPrice();
        }, this.delay)
    }

    async fetchOrigin() {
        await this.rotateProxy();

        if (this.proxy != '') {
            console.log(this.name, `http://${this.proxy}`)
            this.proxy = `http://${this.proxy}`
        }

        var options = {
            method: 'GET',
            url: this.endpoint,
            proxy: `${this.proxy}`
        };
        let that = this;
        cloudscraper(options).then(function (body) {
            const $ = cheerio.load(body)
            let element = $('a[class="btn btn-light font-weight-bold text-left pl-md-4 btn-block"]').text();
            let num = element.replace(/[^0-9]/g, '');
            let price = parseInt(num, 10);
            if (element.indexOf('renewal') > -1) {
                that.renewalPrice = price
                console.log(that.name, that.renewalPrice)
                return;
            } else {
                that.price = price;
                console.log(that.name, that.price)
                return;
            }
        });
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
            const $ = cheerio.load(body)
            let element = $('a[class="btn btn-light font-weight-bold text-left pl-md-4 btn-block"]').text();
            let num = element.replace(/[^0-9]/g, '');
            let price = parseInt(num, 10);
            if (element.indexOf('renewal') > -1) {
                if (price != that.renewalPrice) {
                    that.renewalPrice = price
                    let postData = {
                        "price": that.renewalPrice,
                        "name": that.name,
                        "renewal": true,
                        "endpoint": that.endpoint
                    }
                    that.log(postData, 'post')
                } else {
                    return;
                }
            } else {
                if (price != that.price) {
                    that.price = price;
                    let postData = {
                        "price": that.price,
                        "name": that.name,
                        "renewal": false,
                        "endpoint": that.endpoint
                    }
                    that.log(postData, 'post')
                } else {
                    return;
                }
            }
        });
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