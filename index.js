const { WebhookClient } = require('discord.js')
const config = require('./config.json')
const Parser = require('rss-parser')
const Winston = require('winston')
const parser = new Parser()

/**
 * Logger
 */
let logger = Winston.createLogger({
    transports: [
        new Winston.transports.File({ filename: 'Youtube-API-Discord.log' })
    ],
    format: Winston.format.printf((log) => `[${new Date().toLocaleString()}] - [${log.level.toUpperCase()}] - ${log.message}`)
})

/**
 * Outputs to console during Development
 */
if (process.env.NODE_ENV !== 'production') {
    logger.add(new Winston.transports.Console({
        format: Winston.format.simple()
    }))
}
const startAt = 1657625400000
//const startAt = Date.now();
logger.info(startAt)
let lastCachedVideos = {};

const webhookClient = new WebhookClient({ url: process.env.WEBHOOK_URL })

function formatDate(date) {
    let monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
    let day = date.getDate(), month = date.getMonth(), year = date.getFullYear();
    return `${day} ${monthNames[parseInt(month, 10)]} ${year}`;
}

async function getLastVideos(youtuber, rssURL){
    logger.info(`[${youtuber}]  | Getting videos...`);
    let feed = await parser.parseURL(rssURL)
        .catch(err => logger.error(err.stack))
    logger.info(`[${youtuber}]  | ${feed.items.length} videos found`);
    let tLastVideos = feed.items.sort((a, b) => {
        let aPubDate = new Date(a.pubDate || 0).getTime();
        let bPubDate = new Date(b.pubDate || 0).getTime();
        return bPubDate - aPubDate;
    });
    logger.info(`[${youtuber}]  | The last video is "${tLastVideos[0] ? tLastVideos[0].title : "err"}"`);
    logger.info(`[${youtuber}]  | The second last video is "${tLastVideos[1] ? tLastVideos[1].title : "err"}"`);
    return [tLastVideos[0], tLastVideos[1]]
}

async function checkVideos(youtuber, rssURL) {
    logger.info(`[${youtuber}] | Get the last two videos..`);
    let lastVideos = await getLastVideos(youtuber, rssURL)

    if (!lastVideos[0]) return
    if (new Date(lastVideos[0].pubDate).getTime() < startAt) {
        logger.info(`[${youtuber}] | Last video was uploaded before the bot starts`);
        return
    }
    logger.info(`[${youtuber}] | Video Found`)
    let lastSavedVideos = lastCachedVideos[youtuber]
    if (lastSavedVideos && (lastVideos[0].id === lastSavedVideos[0].id) && (lastVideos[0].id !== lastSavedVideos[1].id)){
        logger.info(`[${youtuber}] | Last video is the same as the last saved`);
        return
    }
    return lastVideos


    // let lastSavedVideo = lastCachedVideos[youtuber]
    // if (lastSavedVideo && (lastSavedVideo.id === lastVideos.id)){
    //     logger.info(`[${youtuber}] | Last video is the same as the last saved`);
    //     return
    // }
    // return lastVideo
}

function check() {
    config.youtubers.forEach(async (youtuber) => {
        logger.info(`[${youtuber}] | Start checking...`);
        let random = Math.random().toFixed(4).toString().slice(2,6)
        let rssURL = `https://www.youtube.com/feeds/videos.xml?channel_id=${youtuber}&${random}`
        logger.info(`[${youtuber}] | ${rssURL}`)

        let videos = await checkVideos(youtuber, rssURL)
        if (videos) logger.info(JSON.stringify(videos))
        if (!videos) {
            logger.info(`[${youtuber}] | No notification`);
        } else {
            logger.info(`[${youtuber}] | Posted notification`);
            await webhookClient.send({ content:
                config.message
                    .replace("{videoURL}", videos[0].link)
                    .replace("{videoAuthorName}", videos[0].author)
                    .replace("{videoPubDate}", formatDate(new Date(videos[0].pubDate)))
            })
            lastCachedVideos[youtuber] = videos
        }
    })
    logger.info(`LastVideos Object: ${JSON.stringify(lastCachedVideos)}`)
}

check()
setInterval(check, 300 * 1000)
