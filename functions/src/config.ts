const functions = require('firebase-functions');

export const MNEMONIC = functions.config().wallet.mnemonic
export const AVATAR = functions.config().wallet.avatar
export const ADDRESS = functions.config().wallet.address