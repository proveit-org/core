import { Request, Response, } from 'express';
const express = require("express")
const bodyParser = require('body-parser')
// const busboy = require('connect-busboy')
const cors = require('cors')
// const fileUpload = require('express-fileupload')
const fileMiddleware = require('express-multipart-file-parser')

export const storeApp = express()
// storeApp.use(busboy())
storeApp.use(fileMiddleware)
storeApp.use(bodyParser())
storeApp.use(cors())
// storeApp.use(fileUpload({
    // tempFileDir: "/tmp",
    // limits: { fileSize: 50　* 1024 * 1024 },
    // abortOnLimit: true,
    // safeFileNames: true,
// }))

import { firestore, storage } from 'firebase-admin';
import { ok } from 'assert';

const db = firestore();
const bucket = storage().bucket();

const itemRef = db.collection('item');

storeApp.post("*", async (request: any, response: Response) => {
    const hash = request.body.hash
    const meta = request.body.meta
    return store(hash, response, meta, request.files ? request.files[0] : undefined)
})

storeApp.get("*", async (request: Request, response: Response) => {
    const hash = request.query.hash
    return store(hash, response)
})

const store = async (hash: string, response: Response, meta?: any, file?: any) => {

    try {

        ok(hash, 'HASH_MISSING')
    
        //Check if record already exists
        const getItem = await itemRef.doc(hash).get()
        if (getItem.exists) throw Error('DUPLICATE_ENTRY')

        //Store new record
        await itemRef.doc(hash).set({
            hash,
            ...(meta && {meta}),
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
            const bucketFile = bucket.file(hash+'.pdf');
            await bucketFile.save(file.buffer)
            // await writeBuffer(hash+'.pdf', file.buffer)
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
/*
function writeBuffer(filename: string, buffer: Buffer){
    return new Promise((resolve, reject)=>{
            const bucketFile = bucket.file(filename);
            const stream = bucketFile.createWriteStream({
                metadata: {
                    contentType: 'application/pdf'
                }
            });
            stream.on('error', (err: Error) => {
                console.error(err)
                throw err.message
            });
            stream.on('finish', () => {
                resolve();
            });
            stream.end(buffer);
    })
}
*/