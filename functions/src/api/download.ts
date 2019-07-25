import { Request, Response, } from 'express';
const express = require('express')
export const downloadApp = express()
const cors = require('cors')
downloadApp.use(cors())

import { getFileHash } from '../helper/merkle'
import { storage } from 'firebase-admin';
import { ok } from 'assert';

const bucket = storage().bucket();

downloadApp.get("*", async (request: Request, response: Response) => {
    const hash = request.query.hash
    const password = request.query.password
    try { 
        ok(hash, 'HASH_MISSING')
        // get the file from Firebase storage by the hash of document-hash + password
        const filehash = getFileHash(hash, password)
        const [hasFile] = (await bucket.file(filehash+'.pdf').exists())
        if (!hasFile) throw Error('FILE_NOT_FOUND')
        const [file] = await bucket.file(filehash+'.pdf').get()
        return file.createReadStream().pipe(response)
    } catch (error) {
        response.status(500)
        return response.send(error.message)
    }
})
