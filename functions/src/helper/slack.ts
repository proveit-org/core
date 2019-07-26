const { WebClient } = require('@slack/web-api');
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

const channel = 'proveit-core';

export function postSlack(msg:string) {
    console.log(token)
    console.log(web)
    const res = web.chat.postMessage({
        channel,
        text: msg,
    })
    return res.ts
}