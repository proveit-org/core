import { Request, Response, } from 'express';
import { MAILJET, SLACK } from '../config';
const express = require("express")
export const signupApp = express()
const cors = require('cors')
signupApp.use(cors())
const Slack = require('slack')
const bot = new Slack(SLACK)


import { ok } from 'assert';

signupApp.post("*", async (req: Request, response: Response) => {
    const email = req.body.email
    const firstname = req.body.firstname
    const lastname = req.body.lastname
    const language = req.body.language

    try {

        ok(email, 'ERR_EMAIL_MISSING')
        ok(lastname, 'ERR_LASTNAME_MISSING')
        ok(firstname, 'ERR_FIRSTNAME_MISSING')
        ok(language, 'ERR_LANGUAGE_MISSING')

        const mailjet = require('node-mailjet').connect(MAILJET.PUBLIC_KEY, MAILJET.PRIVATE_KEY)
        const request = mailjet.post("contactslist")
            .id(MAILJET.CONTACT_LIST)
            .action("managecontact")
            .request({
                "Email": email,
                "Action": "addnoforce",
                "Properties": {
                    "firstname": firstname,
                    "name": lastname,
                    "language": language,
                }
            })
        await request
        console.info(`new signup for ${firstname} ${lastname} language ${language} address ${email}`)
        try {
            await bot.chat.postMessage({ channel: 'notifications', text: 'new signup to newsletter', icon_emoji: ':email:' })
        } catch (error) {
            console.error(error)
        }
        response.json({ success: true })
    } catch (error) {
        console.log('error signing up', { email, firstname, lastname, language })
        console.log(error)
        response.status(500).send(error.message)
        await bot.chat.postMessage({
            channel: 'notifications',
            text: 'error newsletter signup',
            blocks: [
                { "type": "section", "text": { "type": "plain_text", "text": "Error signing up user to newsletter" } },
                { "type": "section", "text": { "type": "plain_text", "text": error.message } }
            ],
            icon_emoji: ':warning:'
        })
    }
})

