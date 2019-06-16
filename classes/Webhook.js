const request = require('request');
const config = require('../config/config.json')

class Webhook {
    constructor(msg) {
        this.price = msg.price;
        this.name = msg.name.toUpperCase();
        this.renewal = msg.renewal;
        this.endpoint = msg.endpoint;
    }

    post() {
        let title;
        let colorCode = '16711680';
        if (this.renewal === true) {
            title = `New Cheapest listing for ${this.name} (RENEWAL)`
        } else {
            title = `New Cheapest listing for ${this.name} (LIFETIME)`
        }
    
        request({
            url: config.webhook,
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            json: {
                "embeds": [
                    {
                        "title": title,
                        "color": colorCode,
                        "timestamp": new Date().toISOString(),
                        "footer": {
                            "icon_url": "https://pbs.twimg.com/profile_images/945882748920594432/Y4f4s73D_400x400.jpg",
                            "text": "BotBroker Monitor by Dollon"
                        },
                        "author": {
                            "name": "BotBroker Monitor",
                            "url": "https://discordapp.com",
                            "icon_url": "https://pbs.twimg.com/profile_images/945882748920594432/Y4f4s73D_400x400.jpg"
                        },
                        "fields": [
                            {
                                "name": "Bot",
                                "value": this.name,
                                "inline": false
                            },
                            {
                                "name": "Renewal",
                                "value": this.renewal,
                                "inline": true
                            },
                            {
                                "name": "Price",
                                "value": '$' + this.price,
                                "inline": true
                            },
                            {
                                "name": "Link",
                                "value": this.endpoint,
                                "inline": false
                            }
                        ]
                    }
                ]
            }
        }, (error, response, html) => {
            return;
        });
    }
}

module.exports = Webhook;