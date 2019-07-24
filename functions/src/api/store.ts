import { Request, Response, } from 'express';
const express = require("express")
const bodyParser = require('body-parser')
// const busyboy = require('connect-busboy')
const cors = require('cors')
const fileUpload = require('express-fileupload')
const fileMiddleware = require('express-multipart-file-parser')

export const storeApp = express()
// storeApp.use(busyboy())
storeApp.use(fileMiddleware)
storeApp.use(bodyParser())
storeApp.use(cors())
storeApp.use(fileUpload({
    tempFileDir: "/tmp",
    // limits: { fileSize: 50　* 1024 * 1024 },
    // abortOnLimit: true,
    // safeFileNames: true,
}))

import { firestore, storage } from 'firebase-admin';
import { ok } from 'assert';

const db = firestore();
const bucket = storage().bucket();

const itemRef = db.collection('item');

storeApp.post("*", async (request: any, response: Response) => {
    const hash = request.body.hash
    console.info(request.files)
    return store(hash, response, request.files.file)
})

storeApp.get("*", async (request: Request, response: Response) => {
    const hash = request.query.hash
    return store(hash, response)
})

const store = async (hash: string, response: Response, file?: any) => {

    try {

        ok(hash, 'HASH_MISSING')
    
        //Check if record already exists
        const getItem = await itemRef.doc(hash).get()
        if (getItem.exists) throw Error('DUPLICATE_ENTRY')

        //Store new record
        await itemRef.doc(hash).set({
            hash,
            hasMetaverseTestnet: null,
            hasMetaverse: null,
            hasBitcoinTestnet: null,
            hasBitcoin: null,
            created: firestore.Timestamp.now().seconds
        }).catch(error => {
            console.error(error)
            throw Error('HASH_STORE_FAILED')
        })

        // Optionally store the file in firebase storage using hash as filename
        if (file) {
            await bucket.upload(file.tempFilePath)
            await bucket.upload('', {destination: hash + ".pdf"})
        }

        return response.send("SUCCESS")

    } catch (error) {
        response.status(500)
        switch (error.message) {
            case 'HASH_MISSING':
            case 'DUPLICATE_ENTRY':
            case 'HASH_STORE_FAILED':
                return response.send(error.message)
        }
        return response.send('INTERNAL_ERROR')
    }
}