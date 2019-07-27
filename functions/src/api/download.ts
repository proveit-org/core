import { Request, Response, } from 'express';
const express = require('express')
export const downloadApp = express()
const cors = require('cors')
downloadApp.use(cors())

import { getFileHash } from '../helper/merkle'
import { firestore, storage } from 'firebase-admin'
import { ok } from 'assert'
import { postSlack } from '../helper/slack'

const db = firestore();
const bucket = storage().bucket();
const itemRef = db.collection('item');

downloadApp.get("*", async (request: Request, response: Response) => {
    const hash = request.query.hash
    const password = request.query.password
    try { 
        ok(hash, 'HASH_MISSING')

        const getItem = await itemRef.where('hash', '==', hash).get()
        if (getItem.empty) throw Error('HASH_NOT_FOUND')

        // if the item is password protected, verify it
        const storedPasswordHash = getItem.docs[0].data().password
        if (storedPasswordHash) {
            const passwordHash = getFileHash(hash, password)
            if (storedPasswordHash !== passwordHash) throw Error('INCORRECT_PASSWORD')
        }

        const [hasFile] = (await bucket.file(hash+'.pdf').exists())
        if (!hasFile) throw Error('FILE_NOT_FOUND')
        const [file] = await bucket.file(hash+'.pdf').get()

        return file.createReadStream().pipe(response)

    } catch (error) {

        response.status(500)
        const ts = await postSlack('downloadApp: '+error.message)
        return response.send({error_msg: error.message, slack_ts: ts})

    }
})
